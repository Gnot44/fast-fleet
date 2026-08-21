import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Receipt,
  Save,
  Gauge,
  CreditCard,
  Trash2,
  Edit3,
  FileText,
  Sparkles,
  X,
  Eye,
  Paperclip,
  ImageIcon,
} from 'lucide-react-native';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  uploadImageToSupabase,
  pickImageFromCamera,
  pickImageFromLibrary,
} from '../lib/storageServices';

export interface ExpenseItem {
  id: string;
  category: string;
  amount: string;
  receiptUri?: string;
  receiptName?: string;
  note?: string;
}

function parsePhotos(photoField?: any): string[] {
  if (!photoField) return [];
  const results: string[] = [];

  const extract = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(extract);
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('"{') && trimmed.endsWith('}"')) ||
        (trimmed.startsWith('"[') && trimmed.endsWith(']"'))
      ) {
        try {
          const unescaped = trimmed.startsWith('"') && trimmed.endsWith('"') ? JSON.parse(trimmed) : trimmed;
          const parsed = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;
          extract(parsed);
          return;
        } catch (e) {}
      }
      if (trimmed.includes('||')) {
        trimmed.split('||').forEach((s) => extract(s.trim()));
        return;
      }
      if (trimmed.length > 5 && !trimmed.startsWith('[') && !trimmed.endsWith(']')) {
        results.push(trimmed);
      }
    }
  };

  extract(photoField);
  return Array.from(new Set(results));
}

export default function DropReportingScreen({ navigation, route }: any) {
  const { t, language, expenseCategories, noteTemplates } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const isEditingFromSummary = !!params.isEditingFromSummary;
  const drop = params.drop || { name: language === 'th' ? 'จุดเข้าพบลูกค้า' : 'Client Location', address: '', contact: '' };
  const dropIndex = typeof params.dropIndex === 'number' ? params.dropIndex : 0;
  const drops = Array.isArray(params.drops) ? params.drops : [];
  const totalDrops = drops.length > 0 ? drops.length : (typeof params.totalDrops === 'number' ? params.totalDrops : 1);

  // Data Completeness Status (Default to false unless verified/checked by user)
  // If not ticked → status = Incomplete on TripSummary, if ticked → Complete
  const [isDataComplete, setIsDataComplete] = useState<boolean>(
    drop.isDataComplete !== undefined
      ? !!drop.isDataComplete
      : (drop.status === 'completed' || drop.status === 'Completed')
  );

  // Odometer (Do NOT prefill fake numbers. Leave empty unless already recorded for this drop)
  const [odometer, setOdometer] = useState<string>(
    drop.odometer ? String(drop.odometer) : (drop.odometer_reading ? String(drop.odometer_reading) : '')
  );

  // Visit Agenda State (Strictly default to the agenda created for this drop)
  const initialAgenda = drop.agenda || drop.items || params.agenda || params.items || '';
  const [visitAgenda, setVisitAgenda] = useState(initialAgenda);
  const [selectedAgendaKey, setSelectedAgendaKey] = useState<string>(() => {
    if (!initialAgenda) return 'pitch';
    if (initialAgenda.includes('นำเสนอ') || initialAgenda.toLowerCase().includes('pitch')) return 'pitch';
    if (initialAgenda.includes('ต่อสัญญา') || initialAgenda.toLowerCase().includes('renewal')) return 'renewal';
    if (initialAgenda.includes('ตรวจระบบ') || initialAgenda.toLowerCase().includes('health')) return 'healthcheck';
    if (initialAgenda.includes('แนะนำสินค้า') || initialAgenda.includes('เดโม') || initialAgenda.toLowerCase().includes('demo')) return 'demo';
    if (initialAgenda.startsWith('อื่นๆ') || initialAgenda.toLowerCase().startsWith('other')) return 'other';
    return 'other';
  });
  const [customAgendaText, setCustomAgendaText] = useState(
    initialAgenda.startsWith('อื่นๆ:')
      ? initialAgenda.replace('อื่นๆ:', '').trim()
      : (!['pitch', 'renewal', 'healthcheck', 'demo'].some((k) => initialAgenda.toLowerCase().includes(k)) &&
         !initialAgenda.includes('นำเสนอ') &&
         !initialAgenda.includes('ต่อสัญญา') &&
         !initialAgenda.includes('ตรวจระบบ') &&
         !initialAgenda.includes('แนะนำสินค้า')
          ? initialAgenda
          : '')
  );

  // Stop Note State
  const defaultInitialNote = language === 'th'
    ? 'เข้าพบลูกค้าตามนัดหมาย นำเสนอแผนการตลาดและสาธิตระบบ ลูกค้าสนใจขอใบเสนอราคา'
    : 'Met with client as scheduled, presented marketing plan and product demo. Client requested quotation.';
  
  const initialNote =
    drop.note ||
    (typeof drop.meetingMinutes === 'string' ? drop.meetingMinutes : drop.meetingMinutes?.notes) ||
    params.note ||
    defaultInitialNote;
  const [note, setNote] = useState(initialNote);

  // Expenses (Strictly preserve array from drop/params if passed)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    if (Array.isArray(drop.expenses) && drop.expenses.length > 0) return drop.expenses;
    if (Array.isArray(params.expenses) && params.expenses.length > 0) return params.expenses;
    return [];
  });

  // Form State for Adding/Editing Expense
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newReceiptUri, setNewReceiptUri] = useState<string | undefined>(undefined);
  const [newReceiptName, setNewReceiptName] = useState<string | undefined>(undefined);
  const [newNote, setNewNote] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Photos (Start with real existing photos if any, preserving all items in array)
  const [photos, setPhotos] = useState<string[]>(() => {
    if (Array.isArray(drop.photos)) return parsePhotos(drop.photos);
    if (Array.isArray(params.photos)) return parsePhotos(params.photos);
    return parsePhotos(drop.client_photo_url);
  });

  // Modals & Upload State
  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string; subtitle?: string; latitude?: number; longitude?: number; timestamp?: string } | null>(null);
  const [isReceiptPickerOpen, setIsReceiptPickerOpen] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [targetExpenseIdForSlip, setTargetExpenseIdForSlip] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [uploadingProofPhoto, setUploadingProofPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset / Sync local form states whenever route params change (e.g. when editing a drop from summary)
  useEffect(() => {
    const currentDrop = params.drop || {};
    const passedExps = Array.isArray(currentDrop.expenses)
      ? currentDrop.expenses
      : Array.isArray(params.expenses)
      ? params.expenses
      : [];
    setExpenses(passedExps);

    const passedPhotos = Array.isArray(currentDrop.photos)
      ? parsePhotos(currentDrop.photos)
      : Array.isArray(params.photos)
      ? parsePhotos(params.photos)
      : parsePhotos(currentDrop.client_photo_url);
    setPhotos(passedPhotos);

    const currentAgenda = currentDrop.agenda || currentDrop.items || params.agenda || params.items || '';
    if (currentAgenda) setVisitAgenda(currentAgenda);

    const currentNote = currentDrop.note || (typeof currentDrop.meetingMinutes === 'string' ? currentDrop.meetingMinutes : currentDrop.meetingMinutes?.notes) || params.note || '';
    setNote(currentNote);

    const currentOdo = currentDrop.odometer !== undefined ? String(currentDrop.odometer) : (currentDrop.odometer_reading ? String(currentDrop.odometer_reading) : '');
    setOdometer(currentOdo);

    if (currentDrop.isDataComplete !== undefined) {
      setIsDataComplete(!!currentDrop.isDataComplete);
    }
  }, [params.drop, params.dropIndex, params.expenses, params.photos, params.note]);

  // Fetch existing expenses from Supabase for this appointment if not populated
  useEffect(() => {
    async function loadAppointmentData() {
      const apptId = drop.appointmentId || drop.id;
      if (apptId) {
        try {
          const { data: dbExpenses } = await supabase
            .from('expenses')
            .select('*')
            .eq('appointment_id', apptId);

          if (dbExpenses && dbExpenses.length > 0) {
            const reverseCatMap: Record<string, string> = {
              'toll': 'ค่าทางด่วน',
              'parking': 'ค่าที่จอดรถ',
              'fuel': 'ค่าน้ำมัน',
              'entertainment': 'ค่าอาหาร / เลี้ยงรับรอง',
              'other': 'อื่นๆ',
            };
            const mappedExps: ExpenseItem[] = dbExpenses.map((exp: any) => ({
              id: exp.id,
              category: reverseCatMap[exp.category] || exp.category || 'ค่าใช้จ่ายเข้าพบ',
              amount: String(exp.amount),
              receiptUri: exp.receipt_url || exp.receipt_image_path,
              receiptName: exp.title || (exp.receipt_url ? 'Receipt.jpg' : undefined),
              note: exp.notes || '',
            }));
            setExpenses(mappedExps);
          }
        } catch (err) {
          console.warn('Error loading appointment expenses:', err);
        }
      }
    }
    if ((!drop.expenses || drop.expenses.length === 0) && (!params.expenses || params.expenses.length === 0)) {
      loadAppointmentData();
    }
  }, [drop.id, drop.appointmentId]);

  const handleEditExpense = (exp: ExpenseItem) => {
    setEditingExpenseId(exp.id);
    setNewCategory(exp.category);
    setNewAmount(exp.amount);
    setNewReceiptUri(exp.receiptUri);
    setNewReceiptName(exp.receiptName);
    setNewNote(exp.note || '');
    setIsAddingExpense(true);
  };

  const handleAddExpense = () => {
    if (!newCategory || !newAmount) {
      Alert.alert(
        language === 'th' ? 'กรุณาระบุข้อมูล' : 'Incomplete Information',
        language === 'th' ? 'โปรดระบุประเภทค่าใช้จ่ายและจำนวนเงิน' : 'Please select category and amount'
      );
      return;
    }

    if (editingExpenseId) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingExpenseId
            ? {
                ...e,
                category: newCategory,
                amount: parseFloat(newAmount).toFixed(2),
                receiptUri: newReceiptUri,
                receiptName: newReceiptName || (newReceiptUri ? `Slip-${Date.now().toString().slice(-4)}.jpg` : undefined),
                note: newNote || undefined,
              }
            : e
        )
      );
    } else {
      setExpenses((prev) => [
        ...prev,
        {
          id: `exp-${Date.now()}`,
          category: newCategory,
          amount: parseFloat(newAmount).toFixed(2),
          receiptUri: newReceiptUri,
          receiptName: newReceiptName || (newReceiptUri ? `Slip-${Date.now().toString().slice(-4)}.jpg` : undefined),
          note: newNote || undefined,
        },
      ]);
    }

    setEditingExpenseId(null);
    setNewCategory('');
    setNewAmount('');
    setNewReceiptUri(undefined);
    setNewReceiptName(undefined);
    setNewNote('');
    setIsAddingExpense(false);
  };

  const handleCaptureReceiptFromCamera = async () => {
    setIsReceiptPickerOpen(false);
    try {
      setUploadingSlip(true);
      const picked = await pickImageFromCamera();
      if (picked) {
        const publicUrl = await uploadImageToSupabase(picked.uri, 'expense_receipts', picked.name, picked.base64);
        const finalUri = publicUrl || (picked.base64 ? `data:image/jpeg;base64,${picked.base64}` : picked.uri);
        const slipName = picked.name || `Slip-${Date.now().toString().slice(-4)}.jpg`;

        if (targetExpenseIdForSlip) {
          setExpenses((prev) =>
            prev.map((e) =>
              e.id === targetExpenseIdForSlip
                ? { ...e, receiptUri: finalUri, receiptName: slipName }
                : e
            )
          );
          setTargetExpenseIdForSlip(null);
        } else {
          setNewReceiptUri(finalUri);
          setNewReceiptName(slipName);
        }
      }
    } catch (e) {
      console.warn('Error capturing receipt slip:', e);
    } finally {
      setUploadingSlip(false);
    }
  };

  const handlePickReceiptFromLibrary = async () => {
    setIsReceiptPickerOpen(false);
    try {
      setUploadingSlip(true);
      const picked = await pickImageFromLibrary();
      if (picked) {
        const publicUrl = await uploadImageToSupabase(picked.uri, 'expense_receipts', picked.name, picked.base64);
        const finalUri = publicUrl || (picked.base64 ? `data:image/jpeg;base64,${picked.base64}` : picked.uri);
        const slipName = picked.name || `Slip-${Date.now().toString().slice(-4)}.jpg`;

        if (targetExpenseIdForSlip) {
          setExpenses((prev) =>
            prev.map((e) =>
              e.id === targetExpenseIdForSlip
                ? { ...e, receiptUri: finalUri, receiptName: slipName }
                : e
            )
          );
          setTargetExpenseIdForSlip(null);
        } else {
          setNewReceiptUri(finalUri);
          setNewReceiptName(slipName);
        }
      }
    } catch (e) {
      console.warn('Error selecting receipt slip:', e);
    } finally {
      setUploadingSlip(false);
    }
  };

  // Proof Photos Handlers
  const handleCapturePhotoFromCamera = async () => {
    setIsPhotoPickerOpen(false);
    try {
      setUploadingProofPhoto(true);
      const picked = await pickImageFromCamera();
      if (picked) {
        const publicUrl = await uploadImageToSupabase(picked.uri, 'trip_photos', picked.name, picked.base64);
        const finalPhotoUrl = publicUrl || (picked.base64 ? `data:image/jpeg;base64,${picked.base64}` : picked.uri);
        setPhotos((prev) => [...prev, finalPhotoUrl]);
      }
    } catch (e) {
      console.warn('Error capturing proof photo:', e);
    } finally {
      setUploadingProofPhoto(false);
    }
  };

  const handlePickPhotoFromLibrary = async () => {
    setIsPhotoPickerOpen(false);
    try {
      setUploadingProofPhoto(true);
      const picked = await pickImageFromLibrary();
      if (picked) {
        const publicUrl = await uploadImageToSupabase(picked.uri, 'trip_photos', picked.name, picked.base64);
        const finalPhotoUrl = publicUrl || (picked.base64 ? `data:image/jpeg;base64,${picked.base64}` : picked.uri);
        setPhotos((prev) => [...prev, finalPhotoUrl]);
      }
    } catch (e) {
      console.warn('Error picking photo from gallery:', e);
    } finally {
      setUploadingProofPhoto(false);
    }
  };

  const saveDropToDatabase = async (updatedDrop: any) => {
    try {
      const apptId = updatedDrop.appointmentId || updatedDrop.id;
      const tripId = params.tripId;
      const { data: { user } } = await supabase.auth.getUser();
      const staffId = user?.id || drop.staff_id || params.staffId || '42284d55-3997-4add-9226-dd9cf2f085df';

      if (apptId) {
        // 1. Update appointment record in Supabase
        await supabase
          .from('appointments')
          .update({
            confirmation_status: !!updatedDrop.isConfirmed,
            status: updatedDrop.isConfirmed ? (updatedDrop.isDataComplete ? 'completed' : 'incomplete') : 'pending',
            meeting_notes: updatedDrop.note || updatedDrop.meetingMinutes || '',
            odometer_reading: updatedDrop.odometer ? parseFloat(updatedDrop.odometer) : null,
            agenda: updatedDrop.agenda || updatedDrop.items || '',
            client_photo_url: (() => {
              const cleanedPhotos = parsePhotos(updatedDrop.photos || drop.photos);
              return cleanedPhotos.length > 0 ? (cleanedPhotos.length === 1 ? cleanedPhotos[0] : JSON.stringify(cleanedPhotos)) : null;
            })(),
            completed_at: updatedDrop.isConfirmed ? new Date().toISOString() : null,
            arrived_at: new Date().toISOString(),
          })
          .eq('id', apptId);

        // 2. Sync expenses for this appointment
        if (tripId && Array.isArray(updatedDrop.expenses)) {
          await supabase
            .from('expenses')
            .delete()
            .eq('appointment_id', apptId);

          for (const exp of updatedDrop.expenses) {
            const amt = parseFloat(exp.amount);
            if (amt > 0) {
              const catMap: Record<string, string> = {
                'ค่าทางด่วน': 'toll',
                'ค่าที่จอดรถ': 'parking',
                'ค่าน้ำมัน': 'fuel',
                'ค่าอาหาร / เลี้ยงรับรอง': 'entertainment',
                'ค่าเลี้ยงรับรอง': 'entertainment',
                'อื่นๆ': 'other',
              };
              const cat = catMap[exp.category] || exp.category || 'other';

              await supabase.from('expenses').insert({
                staff_id: staffId,
                trip_id: tripId,
                appointment_id: apptId,
                category: cat,
                title: exp.note || exp.category || 'ค่าใช้จ่ายเข้าพบ',
                amount: amt,
                receipt_url: exp.receiptUri,
                receipt_image_path: exp.receiptUri,
                notes: exp.note,
                status: 'pending',
              });
            }
          }
        }
      }

      // Update current odometer of trip if provided
      if (tripId && updatedDrop.odometer) {
        const odoVal = parseFloat(updatedDrop.odometer);
        if (!isNaN(odoVal) && odoVal > 0) {
          await supabase
            .from('trips')
            .update({ current_odometer: odoVal })
            .eq('id', tripId);
        }
      }
    } catch (dbErr) {
      console.warn('Error auto-saving drop to Supabase:', dbErr);
    }
  };

  const buildUpdatedDrop = (markConfirmed: boolean = true) => {
    const isConf = markConfirmed ? true : !!drop.isConfirmed;
    return {
      ...drop,
      isConfirmed: isConf,
      isDataComplete: isDataComplete,
      isVisited: isConf,
      odometer,
      items: visitAgenda,
      agenda: visitAgenda,
      note,
      meetingMinutes: note,
      expenses,
      photos,
      status: isConf ? (isDataComplete ? 'Completed' : 'Incomplete') : (drop.status || 'pending'),
    };
  };

  const handleGoBack = () => {
    if (isSaving) return;
    if (isEditingFromSummary) {
      navigation.navigate('TripSummary', {
        tripId: params.tripId,
        drops: drops,
        tripTitle: params.tripTitle,
        selectedVehicle: params.selectedVehicle,
        startLocation: params.startLocation,
        startOdometer: params.startOdometer,
        isRevision: params.isRevision,
        revisionCount: params.revisionCount,
        managerFeedback: params.managerFeedback,
        isApproved: params.isApproved,
        isPendingReview: params.isPendingReview,
      });
      return;
    }

    // Normal Go Back during Active Tracking: Simply go back without modifying or saving any data
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('ActiveTracker', {
        ...params,
        dropIndex: dropIndex,
        drops: drops,
      });
    }
  };

  const handleSaveAndClose = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const updatedDrop = buildUpdatedDrop(true);

      const allUpdatedDrops = drops.map((d: any, idx: number) =>
        idx === dropIndex ? updatedDrop : d
      );

      if (isEditingFromSummary) {
        // Pass staged updates back in memory to TripSummary (will be saved when user saves draft or submits)
        navigation.navigate('TripSummary', {
          tripId: params.tripId,
          drops: allUpdatedDrops,
          tripTitle: params.tripTitle,
          selectedVehicle: params.selectedVehicle,
          startLocation: params.startLocation,
          startOdometer: params.startOdometer,
          updatedDropIndex: dropIndex,
          updatedDrop: updatedDrop,
          isRevision: params.isRevision,
          revisionCount: params.revisionCount,
          managerFeedback: params.managerFeedback,
          isApproved: params.isApproved,
          isPendingReview: params.isPendingReview,
        });
        return;
      }

      // Persist immediately to Supabase during Active Tracking
      await saveDropToDatabase(updatedDrop);

      // Find next unconfirmed drop (not just dropIndex + 1)
      const nextUnconfirmedIdx = allUpdatedDrops.findIndex((d: any, idx: number) => idx > dropIndex && !d.isConfirmed);
      const fallbackNextIdx = allUpdatedDrops.findIndex((d: any) => !d.isConfirmed);
      const isFinished = fallbackNextIdx === -1;

      // Always return to ActiveTracker so user can review, add more drops, or click Summary button when ready
      const targetIdx = isFinished ? dropIndex : (nextUnconfirmedIdx !== -1 ? nextUnconfirmedIdx : fallbackNextIdx);
      navigation.navigate('ActiveTracker', {
        ...params,
        dropIndex: targetIdx,
        drops: allUpdatedDrops,
        completedDropIndex: dropIndex,
        lastCompletedDrop: updatedDrop,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top App Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{drop.name}</Text>
          <LanguageTogglePill />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Context Card */}
          <View style={[styles.contextCard, isEditingFromSummary && styles.contextCardEditing]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contextSub}>
              {isEditingFromSummary
                ? (language === 'th' ? `แก้ไขข้อมูลจุดที่ ${dropIndex + 1}` : `Editing Client #${dropIndex + 1}`)
                : `${t('preview_client')} #${dropIndex + 1} / ${totalDrops}`}
            </Text>
            <Text style={styles.contextTitle}>
              {isEditingFromSummary
                ? (language === 'th' ? 'แก้ไขข้อมูลย้อนหลัง' : 'Retroactive Edit')
                : t('report_title')}
            </Text>
          </View>
          <View style={[styles.statusBadge, isEditingFromSummary && styles.statusBadgeEditing]}>
            <Text style={[styles.statusBadgeText, isEditingFromSummary && styles.statusBadgeTextEditing]}>
              {isEditingFromSummary ? (language === 'th' ? 'แก้ไข' : 'EDIT') : (language === 'th' ? 'เข้าพบ' : 'VISITING')}
            </Text>
          </View>
        </View>

        {/* Data Completeness Toggle: ข้อมูลครบถ้วนสมบูรณ์ (Default OFF = Incomplete on summary) */}
        <TouchableOpacity
          style={[styles.card, isDataComplete ? styles.cardConfirmedActive : styles.cardUnconfirmedActive]}
          onPress={() => setIsDataComplete(!isDataComplete)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, isDataComplete ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' }]}>
              {isDataComplete ? (
                <CheckCircle2 size={18} color="#16A34A" />
              ) : (
                <AlertTriangle size={18} color="#D97706" />
              )}
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.cardTitle}>
                  {language === 'th' ? 'ยืนยันข้อมูลครบถ้วน' : 'Confirm Data Complete'}
                </Text>
                <View
                  style={[
                    styles.confirmStatusPill,
                    isDataComplete ? styles.confirmStatusPillGreen : styles.confirmStatusPillAmber,
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmStatusPillText,
                      isDataComplete ? { color: '#166534' } : { color: '#B45309' },
                    ]}
                  >
                    {isDataComplete
                      ? (language === 'th' ? '✓ สมบูรณ์' : '✓ Complete')
                      : (language === 'th' ? '⚠️ ไม่สมบูรณ์' : '⚠️ Incomplete')}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub} numberOfLines={2}>
                {language === 'th'
                  ? 'ติ๊กเมื่อกรอกข้อมูลเรียบร้อยแล้ว (ถ้าไม่ติ๊ก สถานะจะเป็น ไม่สมบูรณ์ เพื่อกลับมาใส่ข้อมูลทีหลัง)'
                  : 'Check when details are filled (if unchecked, marked as Incomplete to finish later)'}
              </Text>
            </View>
            <Switch
              value={isDataComplete}
              onValueChange={setIsDataComplete}
              trackColor={{ false: '#CBD5E1', true: '#16A34A' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </TouchableOpacity>

        {/* 2. Odometer Input */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <Gauge size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('report_odometer')}</Text>
              <Text style={styles.cardSub}>{t('report_odometer_sub')}</Text>
            </View>
          </View>
          <TextInput
            style={styles.textInput}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="numeric"
            placeholder="e.g. 45280"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* 2.5 Visit Agenda / Purpose */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Text style={{ fontSize: 16 }}>💼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {language === 'th' ? 'วัตถุประสงค์การเข้าพบ (Visit Agenda)' : 'Visit Agenda / Purpose'}
              </Text>
              <Text style={styles.cardSub}>
                {language === 'th' ? 'เลือกประเภทการเข้าพบเพื่อการวิเคราะห์สถิติ' : 'Select visit type for analytics tracking'}
              </Text>
            </View>
          </View>

          {/* Agenda Option Pills */}
          <View style={styles.agendaOptionsContainer}>
            {[
              { id: 'pitch', label: language === 'th' ? 'นำเสนอโปรเจกต์ (Pitch & Proposal)' : 'Pitch & Proposal', icon: '💼' },
              { id: 'renewal', label: language === 'th' ? 'ต่อสัญญา & SLA (Renewal & SLA)' : 'Renewal & SLA', icon: '📝' },
              { id: 'healthcheck', label: language === 'th' ? 'ตรวจระบบ (Healthcheck & Integration)' : 'Healthcheck & Integration', icon: '🔧' },
              { id: 'demo', label: language === 'th' ? 'แนะนำสินค้า & เดโม (Demo & Customer Success)' : 'Demo & Customer Success', icon: '🚀' },
              { id: 'other', label: language === 'th' ? 'อื่นๆ (Other)' : 'Other', icon: '📌' },
            ].map((opt) => {
              const isSelected = selectedAgendaKey === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.agendaOptionCard,
                    isSelected && styles.agendaOptionCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedAgendaKey(opt.id);
                    if (opt.id !== 'other') {
                      setVisitAgenda(opt.label);
                    } else if (!customAgendaText) {
                      setVisitAgenda('');
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.agendaOptionIcon}>{opt.icon}</Text>
                  <Text
                    style={[
                      styles.agendaOptionLabel,
                      isSelected && styles.agendaOptionLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <View style={styles.agendaSelectedDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Other Custom Input */}
          {selectedAgendaKey === 'other' && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={[styles.textInput, { borderColor: '#1D4ED8', borderWidth: 1.5 }]}
                placeholder={language === 'th' ? 'โปรดระบุวัตถุประสงค์เพิ่มเติม...' : 'Please specify other purpose...'}
                placeholderTextColor="#94A3B8"
                value={customAgendaText}
                onChangeText={(text) => {
                  setCustomAgendaText(text);
                  setVisitAgenda(text ? `อื่นๆ: ${text}` : '');
                }}
                autoFocus
              />
            </View>
          )}
        </View>

        {/* 3. Meeting Notes */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#EDE9FE' }]}>
              <FileText size={18} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('report_meeting_notes')}</Text>
              <Text style={styles.cardSub}>{t('report_meeting_notes_sub')}</Text>
            </View>
          </View>

          {/* Quick Preset Chips */}
          <View>
            <Text style={styles.inputLabel}>{t('report_quick_notes')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
              {noteTemplates.map((tmpl, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.templateChip}
                  onPress={() => setNote(tmpl)}
                  activeOpacity={0.7}
                >
                  <Sparkles size={12} color="#7C3AED" />
                  <Text style={styles.templateChipText} numberOfLines={1}>
                    {tmpl}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Note Input */}
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            placeholder={language === 'th' ? 'พิมพ์สรุปการเข้าพบลูกค้า หรือข้อตกลงสำคัญ...' : 'Enter meeting minutes or action items...'}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* 4. EXPENSES WITH RECEIPT SLIPS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <CreditCard size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardTitle}>{t('report_expenses')}</Text>
              </View>
              <Text style={styles.cardSub}>{t('report_expenses_sub')}</Text>
            </View>
            <TouchableOpacity
              style={styles.addExpenseIconButton}
              onPress={() => setIsAddingExpense(!isAddingExpense)}
            >
              <Plus size={16} color="#1D4ED8" />
            </TouchableOpacity>
          </View>

          {/* Loading indicator while uploading receipt slip */}
          {uploadingSlip && (
            <View style={styles.uploadingBanner}>
              <ActivityIndicator size="small" color="#1D4ED8" />
              <Text style={styles.uploadingText}>
                {language === 'th' ? 'กำลังอัปโหลดสลิปไปยังคลาวด์...' : 'Uploading slip to cloud...'}
              </Text>
            </View>
          )}

          {/* Expense Items List */}
          <View style={styles.expenseList}>
            {expenses.map((exp) => (
              <View key={exp.id} style={styles.expenseCardItem}>
                <View style={styles.expenseItemTop}>
                  <View style={styles.expenseLeft}>
                    <View style={styles.expenseCategoryBadge}>
                      <Receipt size={14} color="#1D4ED8" />
                    </View>
                    <View>
                      <Text style={styles.expenseCategory}>{exp.category}</Text>
                      {exp.note ? (
                        <Text style={styles.expenseNoteText}>{exp.note}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>฿{exp.amount}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => handleEditExpense(exp)}
                        style={{ padding: 4 }}
                        activeOpacity={0.7}
                      >
                        <Edit3 size={15} color="#1D4ED8" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          setExpenses((prev) => prev.filter((e) => e.id !== exp.id))
                        }
                        style={{ padding: 4 }}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Receipt Slip Attachment Row */}
                <View style={styles.slipRow}>
                  {exp.receiptUri ? (
                    <TouchableOpacity
                      style={styles.slipAttachedBox}
                      onPress={() =>
                        setPreviewImage({
                          uri: exp.receiptUri!,
                          title: `${drop.name || 'สถานที่'} • ${exp.category}`,
                          subtitle: `฿${exp.amount} • ${exp.receiptName || 'Receipt'}`,
                          latitude: drop.latitude,
                          longitude: drop.longitude,
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: exp.receiptUri }} style={styles.slipThumbnail} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} color="#16A34A" />
                          <Text style={styles.slipAttachedText} numberOfLines={1}>
                            {exp.receiptName || (language === 'th' ? 'แนบสลิปแล้ว' : 'Slip Attached')}
                          </Text>
                        </View>
                      </View>
                      <Eye size={16} color="#1D4ED8" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.slipAttachCta}
                      onPress={() => {
                        setTargetExpenseIdForSlip(exp.id);
                        setIsReceiptPickerOpen(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Paperclip size={13} color="#1D4ED8" />
                      <Text style={styles.slipAttachCtaText}>{t('btn_attach_slip')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Inline Add Expense Form */}
          {isAddingExpense && (
            <View style={styles.addExpenseContainer}>
              <Text style={styles.formSectionHeader}>{t('report_modal_expense_title')}</Text>

              {/* Category Quick Chips */}
              <View style={styles.categoryChipsWrap}>
                {expenseCategories.map((cat, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.categoryChip,
                      newCategory === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        newCategory === cat && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inlineInputsRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1.3, marginBottom: 0 }]}
                  placeholder={language === 'th' ? 'หรือพิมพ์ประเภทอื่น' : 'Or enter custom category'}
                  placeholderTextColor="#94A3B8"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={newAmount}
                  onChangeText={setNewAmount}
                />
              </View>

              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder={t('report_expense_note')}
                placeholderTextColor="#94A3B8"
                value={newNote}
                onChangeText={setNewNote}
              />

              {/* Attach Slip */}
              <View style={styles.newExpenseSlipSection}>
                {newReceiptUri ? (
                  <View style={styles.newExpenseSlipPreview}>
                    <TouchableOpacity
                      onPress={() =>
                        setPreviewImage({
                          uri: newReceiptUri!,
                          title: `${drop.name || 'สถานที่'} • ${newCategory || 'สลิปค่าใช้จ่าย'}`,
                          subtitle: `฿${newAmount || '0.00'} • ${newReceiptName || 'Slip'}`,
                          latitude: drop.latitude,
                          longitude: drop.longitude,
                        })
                      }
                      activeOpacity={0.8}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                    >
                      <Image source={{ uri: newReceiptUri }} style={styles.newSlipThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.newSlipName} numberOfLines={1}>
                          {newReceiptName || 'Slip-attached.jpg'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setNewReceiptUri(undefined);
                        setNewReceiptName(undefined);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.attachSlipBtn}
                    onPress={() => {
                      setTargetExpenseIdForSlip(null);
                      setIsReceiptPickerOpen(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Camera size={15} color="#1D4ED8" />
                    <Text style={styles.attachSlipBtnText}>{t('btn_attach_slip')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.formActionButtons}>
                <TouchableOpacity
                  style={styles.cancelExpenseBtn}
                  onPress={() => {
                    setIsAddingExpense(false);
                    setNewReceiptUri(undefined);
                    setNewReceiptName(undefined);
                  }}
                >
                  <Text style={styles.cancelExpenseBtnText}>{t('btn_cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveExpenseBtn}
                  onPress={handleAddExpense}
                >
                  <Save size={15} color="#FFFFFF" />
                  <Text style={styles.saveExpenseBtnText}>{t('btn_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 5. Proof Photos */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <Camera size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('report_photos')}</Text>
              <Text style={styles.cardSub}>
                {language === 'th'
                  ? 'ถ่ายรูปหน้าร้าน ป้ายบริษัท หรือรูปถ่ายคู่ลูกค้าเพื่อเป็นหลักฐาน'
                  : 'Capture storefront, sign, or client proof photos'}
              </Text>
            </View>
          </View>

          {/* Loading indicator while uploading proof photo */}
          {uploadingProofPhoto && (
            <View style={styles.uploadingBanner}>
              <ActivityIndicator size="small" color="#1D4ED8" />
              <Text style={styles.uploadingText}>
                {language === 'th' ? 'กำลังอัปโหลดรูปภาพไปยังคลาวด์...' : 'Uploading photo to cloud...'}
              </Text>
            </View>
          )}

          {/* Photo Thumbnails Grid */}
          <View style={styles.photosGrid}>
            {photos.map((uri, idx) => (
              <View key={idx} style={styles.photoContainer}>
                <TouchableOpacity
                  onPress={() =>
                    setPreviewImage({
                      uri,
                      title: `${t('report_photos')} #${idx + 1}`,
                      subtitle: drop.name || drop.recipient || (language === 'th' ? 'สถานที่เข้าพบ' : 'Visit Location'),
                      latitude: drop.latitude,
                      longitude: drop.longitude,
                    })
                  }
                  activeOpacity={0.8}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Image source={{ uri }} style={styles.photoImage} />
                  {/* Watermark Tag on Thumbnail */}
                  <View style={styles.photoThumbnailWatermark}>
                    <Text style={styles.photoThumbnailWatermarkText} numberOfLines={1}>
                      📍 {drop.name || 'Check-in'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() =>
                    setPhotos((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Take Photo CTA */}
            <TouchableOpacity
              style={styles.takePhotoBtn}
              onPress={() => setIsPhotoPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Camera size={22} color="#1D4ED8" />
              <Text style={styles.takePhotoText}>{t('btn_take_photo')}</Text>
            </TouchableOpacity>
          </View>

          {photos.length === 0 && !uploadingProofPhoto && (
            <Text style={styles.emptyPhotosNotice}>
              {language === 'th'
                ? 'ยังไม่มีรูปภาพหลักฐาน — กดปุ่มกล้องเพื่อถ่ายภาพจริงหรือแนบรูปจากอัลบั้ม'
                : 'No proof photos yet. Tap the camera button to capture or pick an image.'}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isEditingFromSummary && styles.saveButtonEditing,
            isSaving && { opacity: 0.6 },
          ]}
          onPress={handleSaveAndClose}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <CheckCircle2 size={18} color="#FFFFFF" fill="#FFFFFF" />
          )}
          <Text style={styles.saveButtonText}>
            {isSaving
              ? (language === 'th' ? 'กำลังบันทึกข้อมูล...' : 'Saving...')
              : isEditingFromSummary
              ? (language === 'th' ? '✓ บันทึกการแก้ไข' : 'Save Changes')
              : dropIndex >= totalDrops - 1
              ? (language === 'th' ? '✓ เช็คอิน & ปิดทริป' : 'Check-in & Finish')
              : (language === 'th' ? '✓ เช็คอิน & ไปจุดถัดไป' : 'Check-in & Next Stop')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          <View
            style={[
              styles.modalSafeArea,
              {
                paddingTop: Math.max(insets.top, 24) + 12,
                paddingBottom: Math.max(insets.bottom, 20) + 12,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {previewImage?.title || ''}
                </Text>
                {previewImage?.subtitle && (
                  <Text style={styles.modalHeaderSub}>{previewImage.subtitle}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewImage(null)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.7}
              >
                <X size={22} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalImageContainer}>
              {previewImage && (
                <View style={styles.modalFullImageWrapper}>
                  <Image
                    source={{ uri: previewImage.uri }}
                    style={styles.modalFullImage}
                    resizeMode="contain"
                  />
                  {/* Non-intrusive Watermark Stamp */}
                  <View style={styles.photoWatermarkOverlay}>
                    <View style={styles.photoWatermarkContent}>
                      <Text style={styles.watermarkLocationText} numberOfLines={1}>
                        📍 {previewImage.subtitle || drop.name || (language === 'th' ? 'สถานที่เข้าพบ' : 'Visit Location')}
                      </Text>
                      {(previewImage.latitude || drop.latitude) && (
                        <Text style={styles.watermarkCoordText}>
                          🌐 GPS: {(previewImage.latitude || drop.latitude).toFixed(5)}, {(previewImage.longitude || drop.longitude).toFixed(5)}
                        </Text>
                      )}
                      <Text style={styles.watermarkTimeText}>
                        🕒 {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Bottom floating tap-to-close bar */}
            <View style={styles.modalBottomActionWrap}>
              <TouchableOpacity
                style={styles.modalBottomClosePill}
                onPress={() => setPreviewImage(null)}
                activeOpacity={0.85}
              >
                <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.modalBottomCloseText}>
                  {language === 'th' ? 'แตะที่ใดก็ได้เพื่อปิด' : 'Tap anywhere to close'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Proof Photo Action Modal */}
      <Modal
        visible={isPhotoPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPhotoPickerOpen(false)}
      >
        <View style={styles.bottomSheetBackdrop}>
          <View style={styles.bottomSheetCard}>
            <View style={styles.bottomSheetHeader}>
              <View>
                <Text style={styles.bottomSheetTitle}>
                  {language === 'th' ? 'ถ่ายรูปหรือแนบรูปหลักฐาน' : 'Add Proof Photo'}
                </Text>
                <Text style={styles.bottomSheetSub}>
                  {language === 'th' ? 'ถ่ายภาพสดหน้างานจริงหรือเลือกจากอัลบั้ม' : 'Capture live photo or pick from gallery'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.bottomSheetClose}
                onPress={() => setIsPhotoPickerOpen(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Camera Option */}
            <TouchableOpacity
              style={styles.cameraPickerOption}
              onPress={handleCapturePhotoFromCamera}
              activeOpacity={0.8}
            >
              <View style={styles.cameraPickerIcon}>
                <Camera size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cameraOptionTitle}>
                  {language === 'th' ? 'ถ่ายรูปจากกล้อง (Camera)' : 'Take Photo with Camera'}
                </Text>
                <Text style={styles.cameraOptionSub}>
                  {language === 'th' ? 'เปิดกล้องถ่ายภาพหน้างานสด' : 'Launch camera to capture live photo'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Gallery Option */}
            <TouchableOpacity
              style={[styles.cameraPickerOption, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={handlePickPhotoFromLibrary}
              activeOpacity={0.8}
            >
              <View style={[styles.cameraPickerIcon, { backgroundColor: '#6366F1' }]}>
                <ImageIcon size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cameraOptionTitle, { color: '#4F46E5' }]}>
                  {language === 'th' ? 'เลือกจากคลังรูปภาพ (Gallery)' : 'Pick from Gallery'}
                </Text>
                <Text style={styles.cameraOptionSub}>
                  {language === 'th' ? 'เลือกรูปภาพที่มีอยู่ในเครื่อง' : 'Choose existing photo from device'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Receipt Slip Picker Modal */}
      <Modal
        visible={isReceiptPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReceiptPickerOpen(false)}
      >
        <View style={styles.bottomSheetBackdrop}>
          <View style={styles.bottomSheetCard}>
            <View style={styles.bottomSheetHeader}>
              <View>
                <Text style={styles.bottomSheetTitle}>{t('btn_attach_slip')}</Text>
                <Text style={styles.bottomSheetSub}>
                  {language === 'th' ? 'ถ่ายรูปใหม่หรือเลือกสลิปจากอัลบั้ม' : 'Capture photo or pick slip from gallery'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.bottomSheetClose}
                onPress={() => setIsReceiptPickerOpen(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Camera Option */}
            <TouchableOpacity
              style={styles.cameraPickerOption}
              onPress={handleCaptureReceiptFromCamera}
              activeOpacity={0.8}
            >
              <View style={styles.cameraPickerIcon}>
                <Camera size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cameraOptionTitle}>
                  {language === 'th' ? 'ถ่ายรูปสลิปจากกล้อง (Camera)' : 'Capture Slip with Camera'}
                </Text>
                <Text style={styles.cameraOptionSub}>
                  {language === 'th' ? 'เปิดกล้องถ่ายใบเสร็จ / สลิปโอนเงิน' : 'Take photo of receipt / slip'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Gallery Option */}
            <TouchableOpacity
              style={[styles.cameraPickerOption, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={handlePickReceiptFromLibrary}
              activeOpacity={0.8}
            >
              <View style={[styles.cameraPickerIcon, { backgroundColor: '#6366F1' }]}>
                <ImageIcon size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cameraOptionTitle, { color: '#4F46E5' }]}>
                  {language === 'th' ? 'เลือกสลิปจากคลังรูปภาพ (Gallery)' : 'Pick Slip from Gallery'}
                </Text>
                <Text style={styles.cameraOptionSub}>
                  {language === 'th' ? 'เลือกรูปภาพสลิปที่มีอยู่ในเครื่อง' : 'Choose receipt image from device'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 130,
    gap: 14,
  },
  contextCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  contextCardEditing: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  contextSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  contextTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeEditing: {
    backgroundColor: '#D97706',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextEditing: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  cardConfirmedActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  cardUnconfirmedActive: {
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  confirmStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confirmStatusPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  confirmStatusPillAmber: {
    backgroundColor: '#FEF3C7',
  },
  confirmStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  templateScroll: {
    gap: 6,
    paddingBottom: 4,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: 240,
  },
  templateChipText: {
    fontSize: 11,
    color: '#6B21A8',
    fontWeight: '600',
  },
  addExpenseIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseList: {
    gap: 10,
  },
  expenseCardItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  expenseItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  expenseCategoryBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  expenseNoteText: {
    fontSize: 11,
    color: '#64748B',
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  slipRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  slipAttachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slipThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  slipAttachedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  slipAttachCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 3,
  },
  slipAttachCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  addExpenseContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 10,
    marginTop: 6,
  },
  formSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  categoryChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  inlineInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  newExpenseSlipSection: {
    marginTop: 2,
  },
  newExpenseSlipPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  newSlipThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  newSlipName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  attachSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  attachSlipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  formActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelExpenseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelExpenseBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  saveExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
  },
  saveExpenseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takePhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  takePhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonEditing: {
    backgroundColor: '#D97706',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  modalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalFullImage: {
    width: '100%',
    height: '100%',
  },
  modalBottomActionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  modalBottomClosePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  modalBottomCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  bottomSheetSub: {
    fontSize: 11,
    color: '#64748B',
  },
  bottomSheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadingText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  emptyPhotosNotice: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cameraPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cameraPickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  cameraOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  sampleListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  sampleItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sampleSlipThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  sampleName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sampleDetails: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  sampleSelectBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sampleSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  agendaOptionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  agendaOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  agendaOptionCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  agendaOptionIcon: {
    fontSize: 15,
  },
  agendaOptionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  agendaOptionLabelSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  agendaSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D4ED8',
  },
  photoThumbnailWatermark: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  photoThumbnailWatermarkText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  modalFullImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWatermarkOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'flex-start',
  },
  photoWatermarkContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 2,
  },
  watermarkLocationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  watermarkCoordText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  watermarkTimeText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '500',
  },
});
