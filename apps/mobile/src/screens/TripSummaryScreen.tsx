import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Route,
  Clock,
  Receipt,
  CheckCircle,
  AlertTriangle,
  Camera,
  CreditCard,
  Send,
  CheckCircle2,
  FileText,
  Users,
  Eye,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  ChevronRight,
  Gauge,
  Navigation as NavigationIcon,
  Home,
  Save,
} from 'lucide-react-native';

import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

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

export default function TripSummaryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const tripRoute = params.tripTitle || params.tripRoute || 'Bangkok Central Delivery Route';
  const selectedVehicle = params.selectedVehicle || 'Isuzu D-Max (1กข-4452)';
  
  // Starting Location & Odometer state
  const [startOdometer, setStartOdometer] = useState<string>(params.startOdometer || '45200');
  const [startLocation] = useState(
    params.startLocation || {
      name: language === 'th' ? 'สำนักงาน / จุดปล่อยรถ (Depot)' : 'Office / Dispatch Depot',
      address: 'ถนนสุขุมวิท เขตคลองเตย กรุงเทพมหานคร',
    }
  );
  const [isEditStartOdoOpen, setIsEditStartOdoOpen] = useState(false);
  const [editingOdoValue, setEditingOdoValue] = useState(params.startOdometer || '45200');

  const rawDrops = Array.isArray(params.drops) ? params.drops : [];

  const initialNoteText =
    params.note ||
    (typeof params.meetingMinutes === 'string'
      ? params.meetingMinutes
      : params.meetingMinutes?.notes) ||
    '';

  // Default expense generator per drop if not yet entered
  const getDropExpenses = (dropItem: any, _index: number): any[] => {
    if (Array.isArray(dropItem.expenses)) {
      return dropItem.expenses;
    }
    return [];
  };

  // Dynamic state that gets updated when returning from DropReporting
  const [dropsList, setDropsList] = useState<any[]>(rawDrops);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevision, setIsRevision] = useState<boolean>(!!params.isRevision);
  const [revisionCount, setRevisionCount] = useState<number>(params.revisionCount || 1);
  const [managerFeedback, setManagerFeedback] = useState<string>(params.managerFeedback || '');
  const [isApproved, setIsApproved] = useState<boolean>(!!params.isApproved);
  const [isPendingReview, setIsPendingReview] = useState<boolean>(!!params.isPendingReview);
  const hasInitialTripExpensesLoadedRef = useRef(false);

  // Sync state when route params change (e.g. from DropReporting edit)
  useEffect(() => {
    if (params.drops && Array.isArray(params.drops) && params.drops.length > 0) {
      setDropsList(params.drops);
    } else if (params.updatedDropIndex !== undefined && params.updatedDrop) {
      // Single drop update from DropReporting edit
      setDropsList((prev) => {
        const next = [...prev];
        next[params.updatedDropIndex] = {
          ...next[params.updatedDropIndex],
          ...params.updatedDrop,
        };
        return next;
      });
    }
  }, [params]);

  useEffect(() => {
    if (params.isRevision !== undefined) setIsRevision(!!params.isRevision);
    if (params.revisionCount !== undefined) setRevisionCount(params.revisionCount);
    if (params.managerFeedback !== undefined) setManagerFeedback(params.managerFeedback);
    if (params.isApproved !== undefined) setIsApproved(!!params.isApproved);
    if (params.isPendingReview !== undefined) setIsPendingReview(!!params.isPendingReview);
  }, [params.isRevision, params.revisionCount, params.managerFeedback, params.isApproved, params.isPendingReview]);

  // Load trip status & manager feedback directly from Supabase
  useEffect(() => {
    async function loadTripMeta() {
      if (!params.tripId) return;
      try {
        const { data: tripData } = await supabase
          .from('trips')
          .select('approval_status, manager_feedback, status')
          .eq('id', params.tripId)
          .single();
        if (tripData) {
          if (tripData.approval_status === 'revision_requested') {
            setIsRevision(true);
            setIsApproved(false);
            setIsPendingReview(false);
            const revMatch = tripData.manager_feedback?.match(/\[(?:รอบที่|REV:)\s*(\d+)\]/i);
            const count = revMatch ? parseInt(revMatch[1], 10) : 1;
            setRevisionCount(count);
            const cleanFeedback = tripData.manager_feedback?.replace(/\[(?:รอบที่|REV:)\s*\d+\]\s*/i, '').trim() || tripData.manager_feedback || '';
            setManagerFeedback(cleanFeedback);
          } else if (tripData.approval_status === 'approved') {
            setIsApproved(true);
            setIsRevision(false);
            setIsPendingReview(false);
          } else if (tripData.approval_status === 'pending') {
            setIsPendingReview(true);
            setIsRevision(false);
            setIsApproved(false);
          }
        }
      } catch (err) {
        console.warn('Error loading trip meta in TripSummary:', err);
      }
    }
    loadTripMeta();
  }, [params.tripId]);

  // Load expenses from Supabase for all drops if tripId is present (only once if dropsList has no expenses)
  useEffect(() => {
    async function loadTripExpenses() {
      if (!params.tripId || hasInitialTripExpensesLoadedRef.current) return;
      try {
        const { data: dbExpenses } = await supabase
          .from('expenses')
          .select('*')
          .eq('trip_id', params.tripId);

        if (dbExpenses && dbExpenses.length > 0) {
          hasInitialTripExpensesLoadedRef.current = true;
          const reverseCatMap: Record<string, string> = {
            'toll': 'ค่าทางด่วน',
            'parking': 'ค่าที่จอดรถ',
            'fuel': 'ค่าน้ำมัน',
            'entertainment': 'ค่าอาหาร / เลี้ยงรับรอง',
            'other': 'อื่นๆ',
          };
          setDropsList((prev) =>
            prev.map((d) => {
              if (Array.isArray(d.expenses) && d.expenses.length > 0) {
                return d;
              }
              const apptId = d.appointmentId || d.id;
              const apptExps = dbExpenses.filter((e) => e.appointment_id === apptId);
              if (apptExps.length > 0) {
                return {
                  ...d,
                  expenses: apptExps.map((e) => ({
                    id: e.id,
                    category: reverseCatMap[e.category] || e.category || 'ค่าใช้จ่ายเข้าพบ',
                    amount: String(e.amount),
                    receiptUri: e.receipt_url || e.receipt_image_path,
                    receiptName: e.title || (e.receipt_url ? 'Slip.jpg' : undefined),
                    note: e.notes || '',
                  })),
                };
              }
              return d;
            })
          );
        }
      } catch (err) {
        console.warn('Error loading trip expenses in TripSummary:', err);
      }
    }
    loadTripExpenses();
  }, [params.tripId]);

  // Aggregate breakdown by each client
  const clientExpensesBreakdown = dropsList.map((drop, index) => {
    const expenses = getDropExpenses(drop, index);
    const subtotal = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
    return {
      drop,
      index,
      expenses,
      subtotal,
    };
  });

  const totalExpenseAmount = clientExpensesBreakdown.reduce((sum, item) => sum + item.subtotal, 0);
  const totalExpenseItemsCount = clientExpensesBreakdown.reduce((sum, item) => sum + item.expenses.length, 0);

  // Modal Image Preview State
  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string; subtitle?: string; location?: string; latitude?: number; longitude?: number } | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  // Navigation to DropReporting for retroactive edits
  const handleEditDrop = (dropItem: any, index: number) => {
    if (isApproved) {
      Alert.alert(
        language === 'th' ? 'รายงานได้รับการอนุมัติแล้ว' : 'Report Approved',
        language === 'th'
          ? 'รายงานนี้ได้รับการอนุมัติจาก Admin เรียบร้อยแล้ว จึงถูกบันทึกเป็นประวัติถาวร (Read-Only) ไม่สามารถแก้ไขได้'
          : 'This report has been approved by the Admin and is archived as read-only.',
        [{ text: t('btn_confirm') || 'ตกลง' }]
      );
      return;
    }
    if (isPendingReview) {
      Alert.alert(
        language === 'th' ? 'รายงานอยู่ระหว่างรออนุมัติ' : 'Report Pending Approval',
        language === 'th'
          ? 'รายงานนี้ถูกส่งให้ Admin แล้ว ไม่สามารถแก้ไขได้ในขณะนี้ หากต้องการแก้ไขต้องรอให้ Admin ส่งกลับมาแก้ไข (Revision Requested) เท่านั้น'
          : 'This report has been submitted to Admin and is locked. You can only edit if Admin requests a revision.'
      );
      return;
    }
    const currentDrop = dropsList[index] || dropItem;
    const currentExps = Array.isArray(currentDrop.expenses)
      ? currentDrop.expenses
      : Array.isArray(dropItem.expenses)
      ? dropItem.expenses
      : getDropExpenses(currentDrop, index);

    const currentPhotos = Array.isArray(currentDrop.photos)
      ? parsePhotos(currentDrop.photos)
      : Array.isArray(dropItem.photos)
      ? parsePhotos(dropItem.photos)
      : parsePhotos(currentDrop.client_photo_url);

    navigation.navigate('DropReporting', {
      drop: {
        ...currentDrop,
        expenses: currentExps,
        photos: currentPhotos,
      },
      dropIndex: index,
      drops: dropsList,
      totalDrops: dropsList.length,
      tripId: params.tripId,
      tripTitle: tripRoute,
      selectedVehicle: selectedVehicle,
      startLocation: startLocation,
      startOdometer: startOdometer,
      isEditingFromSummary: true,
      isRevision: isRevision,
      revisionCount: revisionCount,
      managerFeedback: managerFeedback,
      isApproved: isApproved,
      isPendingReview: isPendingReview,
      note: currentDrop.note || currentDrop.meetingMinutes || '',
      expenses: currentExps,
      odometer: currentDrop.odometer,
      photos: currentPhotos,
    });
  };

  // Start Odometer edit handler (same protection as drop edits)
  const handleEditStartOdo = () => {
    if (params.isApproved) {
      Alert.alert(
        language === 'th' ? 'รายงานได้รับการอนุมัติแล้ว' : 'Report Approved',
        language === 'th'
          ? 'รายงานนี้ได้รับการอนุมัติจาก Admin เรียบร้อยแล้ว จึงถูกบันทึกเป็นประวัติถาวร (Read-Only) ไม่สามารถแก้ไขได้'
          : 'This report has been approved by the Admin and is archived as read-only.',
        [{ text: t('btn_confirm') || 'ตกลง' }]
      );
      return;
    }
    if (params.isPendingReview) {
      Alert.alert(
        language === 'th' ? 'รายงานอยู่ระหว่างรออนุมัติ' : 'Report Pending Approval',
        language === 'th'
          ? 'รายงานนี้ถูกส่งให้ Admin แล้ว ไม่สามารถแก้ไขได้ในขณะนี้ หากต้องการแก้ไขต้องรอให้ Admin ส่งกลับมาแก้ไข (Revision Requested) เท่านั้น'
          : 'This report has been submitted to Admin and is locked. You can only edit if Admin requests a revision.'
      );
      return;
    }
    setEditingOdoValue(startOdometer);
    setIsEditStartOdoOpen(true);
  };

  const handleSaveStartOdo = async () => {
    const trimmed = editingOdoValue.trim();
    if (!trimmed) {
      setIsEditStartOdoOpen(false);
      return;
    }
    setStartOdometer(trimmed);
    setIsEditStartOdoOpen(false);

    if (params.tripId) {
      try {
        await supabase.from('trips').update({
          start_odometer: Number(trimmed) || 0,
        }).eq('id', params.tripId);
      } catch (err) {
        console.warn('Error updating start odometer in DB:', err);
      }
    }

    Alert.alert(
      language === 'th' ? 'บันทึกสำเร็จ ✓' : 'Saved ✓',
      language === 'th'
        ? `อัปเดตเลขไมล์เริ่มต้นเป็น ${trimmed} กม. เรียบร้อยแล้ว`
        : `Starting odometer updated to ${trimmed} km.`
    );
  };

  const incompleteDropsCount = dropsList.filter((d: any) => !d.isConfirmed || !d.isDataComplete).length;
  const isAllDropsCompleted = dropsList.length > 0 && incompleteDropsCount === 0;

  const syncTripDataToDatabase = async (targetApprovalStatus: 'draft' | 'pending' | 'revision_requested') => {
    const { data: { user } } = await supabase.auth.getUser();
    const staffId = user?.id;
    if (!staffId) return;

    let tripId = params.tripId;
    const startOdoNum = parseInt(startOdometer || '45200', 10);
    const endOdoNum = startOdoNum + 45;
    const isPending = targetApprovalStatus === 'pending';

    if (!tripId) {
      const newTripCode = `TRP-${Date.now().toString().slice(-6)}`;
      const { data: newTrip } = await supabase
        .from('trips')
        .insert({
          type: 'marketing',
          trip_code: newTripCode,
          staff_id: staffId,
          title: tripRoute,
          trip_date: new Date().toISOString().split('T')[0],
          status: isPending ? 'completed' : 'in_progress',
          approval_status: targetApprovalStatus,
          start_odometer: startOdoNum,
          end_odometer: endOdoNum,
          total_distance_km: 45.2,
          total_expenses: totalExpenseAmount,
        })
        .select()
        .single();

      if (newTrip) tripId = newTrip.id;
    } else {
      await supabase
        .from('trips')
        .update({
          status: isPending ? 'completed' : 'in_progress',
          approval_status: targetApprovalStatus,
          start_odometer: startOdoNum,
          end_odometer: endOdoNum,
          total_expenses: totalExpenseAmount,
        })
        .eq('id', tripId);
    }

    // Sync appointments
    if (tripId && Array.isArray(dropsList)) {
      for (let i = 0; i < dropsList.length; i++) {
        const d = dropsList[i];
        const isDataComp = !!d.isDataComplete;
        const isConf = !!d.isConfirmed;

        const dropExps = d.expenses || getDropExpenses(d, i);
        const cleanedPhotos = parsePhotos(d.photos || d.client_photo_url);
        const finalPhotoUrl = cleanedPhotos.length > 0 ? (cleanedPhotos.length === 1 ? cleanedPhotos[0] : JSON.stringify(cleanedPhotos)) : null;

        const apptPayload: any = {
          type: 'appointment',
          trip_id: tripId,
          staff_id: staffId,
          company_name: d.name || `ลูกค้าจุดที่ ${i + 1}`,
          customer_name: d.contactPerson || d.recipient || d.name || `ลูกค้าจุดที่ ${i + 1}`,
          recipient_name: d.recipient || d.contactPerson || '',
          recipient_phone: d.phone || d.contactPhone || '',
          destination_address: d.address || '',
          destination_lat: d.latitude || null,
          destination_lng: d.longitude || null,
          agenda: d.agenda || d.items || '',
          sequence_order: i + 1,
          confirmation_status: isConf,
          meeting_notes: d.meetingMinutes || d.note || '',
          status: isConf ? (isDataComp ? 'completed' : 'incomplete') : 'pending',
        };

        if (isPending) {
          // Submitted/Resubmitted to Admin: Commit the newly revised photos to official client_photo_url and clear draft!
          apptPayload.client_photo_url = finalPhotoUrl;
          apptPayload.driver_notes = null;
        } else if (isRevision) {
          // Saving draft during revision: Store draft photos in driver_notes so specialist keeps them, but DO NOT update client_photo_url (Admin won't see new draft photos yet!)
          apptPayload.driver_notes = JSON.stringify({ draftPhotos: cleanedPhotos, draftExpenses: dropExps });
        } else {
          // Brand new draft:
          apptPayload.client_photo_url = finalPhotoUrl;
          apptPayload.driver_notes = null;
        }

        let apptId = d.appointmentId || d.id;
        if (apptId) {
          await supabase
            .from('appointments')
            .update(apptPayload)
            .eq('id', apptId);
        } else {
          const { data: newAppt } = await supabase
            .from('appointments')
            .insert(apptPayload)
            .select()
            .single();
          if (newAppt) apptId = newAppt.id;
        }
        if (apptId && Array.isArray(dropExps)) {
          await supabase.from('expenses').delete().eq('appointment_id', apptId);
          for (const exp of dropExps) {
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
              await supabase.from('expenses').insert({
                staff_id: staffId,
                trip_id: tripId,
                appointment_id: apptId,
                category: catMap[exp.category] || exp.category || 'other',
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
    }
  };

  const handleSaveDraftAndReturn = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const targetStatus = isRevision ? 'revision_requested' : 'draft';
      await syncTripDataToDatabase(targetStatus);
      Alert.alert(
        language === 'th' ? 'บันทึกสำเร็จ ✓' : 'Saved ✓',
        language === 'th'
          ? (isRevision
              ? 'บันทึกแบบร่างฉบับแก้ไขเรียบร้อย ทริปนี้จะยังคงอยู่ในกล่อง "⚠️ ส่งกลับแก้ไข" เพื่อให้คุณกลับมาแก้ไขและส่งใหม่ได้ตลอดเวลา'
              : 'บันทึกข้อมูลเรียบร้อย ทริปนี้จะคงอยู่ในแผนงานวันนี้ เพื่อให้คุณสามารถกลับมาแก้ไขข้อมูลได้ตลอดเวลา')
          : 'Saved draft. This trip will remain available for editing.',
        [
          {
            text: language === 'th' ? 'กลับหน้าหลัก' : 'Go to Dashboard',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ]
      );
    } catch (err: any) {
      console.error('Error saving draft:', err);
      Alert.alert(
        language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        err.message || 'Could not save draft'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitToAdmin = () => {
    if (isSaving) return;
    const incompleteList = dropsList.filter((d: any) => !d.isConfirmed || !d.isDataComplete);
    if (incompleteList.length > 0) {
      Alert.alert(
        language === 'th' ? 'ข้อมูลยังไม่ครบถ้วน ⚠️' : 'Incomplete Data ⚠️',
        language === 'th'
          ? `มี ${incompleteList.length} จุดที่ยังไม่สมบูรณ์ (Incomplete) คุณต้องกรอกข้อมูลให้ครบถ้วนทุกจุดก่อนจึงจะส่งให้ Admin ได้\n\nหากต้องการออกไปก่อน กรุณากดปุ่ม "บันทึกและกลับไปแผนงานวันนี้"`
          : `There are ${incompleteList.length} incomplete stops. Please complete all stops before submitting to Admin, or save draft to Planned Today.`
      );
      return;
    }

    Alert.alert(
      isRevision
        ? (language === 'th' ? 'ยืนยันการส่งรายงานแก้ไขให้ Admin 🚀' : 'Confirm Resubmission to Admin 🚀')
        : (language === 'th' ? 'ยืนยันส่งรายงานให้ Admin ตรวจสอบ 🚀' : 'Confirm Submit to Admin 🚀'),
      isRevision
        ? (language === 'th'
            ? `ส่งรายงานฉบับแก้ไขรอบที่ ${revisionCount || 1} พร้อมสลิปค่าใช้จ่ายรวม ฿${totalExpenseAmount.toFixed(2)} ไปยัง Web Admin เพื่อรออนุมัติ`
            : `Resubmit revised report for manager approval with total expenses of ฿${totalExpenseAmount.toFixed(2)}`)
        : (language === 'th'
            ? `ยืนยันส่งรายงานการเข้าพบลูกค้า (${dropsList.length} จุด) และค่าใช้จ่ายรวม ฿${totalExpenseAmount.toFixed(2)} ไปยัง Web Admin เพื่อรออนุมัติ? (รายงานจะย้ายไปที่กล่องรออนุมัติ)`
            : `Submit report for ${dropsList.length} client visits and total expenses of ฿${totalExpenseAmount.toFixed(2)} to Web Admin? (It will move to Pending Approval)`),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        {
          text: language === 'th' ? 'ส่งให้ Admin' : 'Submit to Admin',
          onPress: async () => {
            if (isSaving) return;
            setIsSaving(true);
            try {
              await syncTripDataToDatabase('pending');
              Alert.alert(
                isRevision
                  ? (language === 'th' ? 'ส่งรายงานแก้ไขเรียบร้อย 🚀' : 'Report Resubmitted 🚀')
                  : (language === 'th' ? 'ส่งรายงานให้ Admin เรียบร้อย 🚀' : 'Submitted to Admin 🚀'),
                language === 'th'
                  ? 'ข้อมูลถูกส่งไปยังหน้า Web Admin เรียบร้อยแล้ว รายงานจะย้ายไปอยู่ที่กล่องรออนุมัติ (คุณสามารถกดดึงกลับมาแก้ไขได้ตลอดเวลา)'
                  : 'Report sent to Web Admin for manager approval. It has moved to Pending Approval box.',
                [
                  {
                    text: language === 'th' ? 'กลับหน้าหลัก' : 'Go to Dashboard',
                    onPress: () => navigation.navigate('Dashboard'),
                  },
                ]
              );
            } catch (err: any) {
              console.error('Error submitting to admin:', err);
              Alert.alert(
                language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
                err.message || 'Could not submit report'
              );
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top App Bar (Dark Navy Header) */}
        <View style={styles.darkHeader}>
          <SafeAreaView edges={['top']} style={styles.headerInner}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {isRevision
                  ? (language === 'th' ? 'แก้ไขรายงานทริป' : 'Revise Trip Report')
                  : t('summary_title')}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>{tripRoute}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <LanguageTogglePill />
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate('Dashboard')}
                activeOpacity={0.8}
              >
                <Home size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Manager Revision Alert Banner if in Revision Mode */}
        {isRevision && (
          <View style={styles.revisionNoticeCard}>
            <View style={styles.revisionNoticeHeader}>
              <AlertTriangle size={18} color="#DC2626" />
              <Text style={styles.revisionNoticeTitle}>
                {language === 'th'
                  ? `⚠️ ทริปนี้ถูกส่งกลับแก้ไข (รอบที่ ${revisionCount || 1})`
                  : `⚠️ Revision Requested (Cycle #${revisionCount || 1})`}
              </Text>
            </View>
            <Text style={styles.revisionNoticeText}>
              {language === 'th' ? '💬 ข้อความจากหัวหน้างาน:' : '💬 Manager Feedback:'}{' '}
              "{managerFeedback || 'กรุณาตรวจสอบและแก้ไขข้อมูลให้ถูกต้องก่อนส่งใหม่'}"
            </Text>
          </View>
        )}

        {/* Approved Notice Banner if already approved */}
        {isApproved && (
          <View style={[styles.revisionNoticeCard, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
            <View style={styles.revisionNoticeHeader}>
              <CheckCircle2 size={18} color="#166534" />
              <Text style={[styles.revisionNoticeTitle, { color: '#166534' }]}>
                {language === 'th'
                  ? '✓ รายงานนี้ได้รับการอนุมัติเรียบร้อยแล้ว'
                  : '✓ Report Approved by Admin'}
              </Text>
            </View>
            <Text style={[styles.revisionNoticeText, { color: '#14532D' }]}>
              {language === 'th'
                ? 'รายงานและค่าใช้จ่ายในทริปนี้ผ่านการตรวจสอบและอนุมัติจากผู้จัดการฝ่ายการตลาดแล้ว ข้อมูลและประวัติการเข้าพบถูกจัดเก็บเป็นประวัติถาวร (Read-Only)'
                : 'This visit report and expenses have been verified and approved by the marketing manager. Data is permanently archived.'}
            </Text>
          </View>
        )}

        {/* Pending Review Banner if already submitted */}
        {isPendingReview && (
          <View style={[styles.revisionNoticeCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={styles.revisionNoticeHeader}>
              <Clock size={18} color="#1D4ED8" />
              <Text style={[styles.revisionNoticeTitle, { color: '#1D4ED8' }]}>
                {language === 'th'
                  ? '⏳ ส่งรายงานให้ Admin แล้ว (รอการอนุมัติ)'
                  : '⏳ Report Submitted to Admin (Pending Approval)'}
              </Text>
            </View>
            <Text style={[styles.revisionNoticeText, { color: '#1E40AF' }]}>
              {language === 'th'
                ? 'รายงานนี้ถูกส่งไปที่หน้า Trip Approval เพื่อรอ Admin ตรวจสอบและอนุมัติแล้ว ไม่สามารถแก้ไขได้ หากต้องการแก้ไขเพิ่มเติม ต้องรอให้ Admin ส่งกลับมาแก้ไข (Revision Requested) เท่านั้น'
                : 'This report has been submitted for Admin approval. If modifications are needed, Admin must request a revision.'}
            </Text>
          </View>
        )}

        {/* Drops Confirmation Status Banner */}
        {(() => {
          const confirmedCount = dropsList.filter((d: any, idx: number) => {
            if (d.isConfirmed !== undefined) return !!d.isConfirmed;
            return idx < 2;
          }).length;
          const hasUnconfirmed = confirmedCount < dropsList.length;

          return (
            <View style={[styles.successBanner, hasUnconfirmed && styles.unconfirmedBanner]}>
              {hasUnconfirmed ? (
                <AlertTriangle size={24} color="#D97706" />
              ) : (
                <CheckCircle2 size={24} color="#166534" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.successBannerTitle, hasUnconfirmed && { color: '#92400E' }]}>
                  {hasUnconfirmed
                    ? (language === 'th' ? `ยังยืนยันไม่ครบ (${confirmedCount}/${dropsList.length} จุด)` : `Incomplete Visits (${confirmedCount}/${dropsList.length} Confirmed)`)
                    : t('tracker_all_done')}
                </Text>
                <Text style={[styles.successBannerSub, hasUnconfirmed && { color: '#B45309' }]}>
                  {hasUnconfirmed
                    ? (language === 'th' ? 'มีจุดที่ยังไม่ได้เปิดสวิตช์ยืนยันเข้าพบ แตะรายชื่อด้านล่างเพื่อกดยืนยันย้อนหลัง' : 'Some stops are not confirmed. Tap client below to verify.')
                    : `${dropsList.length} ${t('dash_total_clients')} • ${selectedVehicle}`}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* KPI 4-Card Bento Grid */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Total Drops */}
          <View style={styles.kpiCard}>
            <Users size={22} color="#1D4ED8" />
            <Text style={styles.kpiValue}>{dropsList.length}</Text>
            <Text style={styles.kpiLabel}>{t('summary_total_visits')}</Text>
          </View>

          {/* Card 2: Distance */}
          <View style={styles.kpiCard}>
            <Route size={22} color="#1D4ED8" />
            <Text style={styles.kpiValue}>
              {((dropsList.length * 11.4) + 12.2).toFixed(1)} <Text style={styles.kpiUnit}>km</Text>
            </Text>
            <Text style={styles.kpiLabel}>{t('summary_total_distance')}</Text>
          </View>

          {/* Card 3: Total Time */}
          <View style={styles.kpiCard}>
            <Clock size={22} color="#1D4ED8" />
            <Text style={styles.kpiValue}>
              {Math.floor(dropsList.length * 0.8) + 1}<Text style={styles.kpiUnit}>h</Text> {((dropsList.length * 18) % 60)}
              <Text style={styles.kpiUnit}>m</Text>
            </Text>
            <Text style={styles.kpiLabel}>{t('summary_total_time')}</Text>
          </View>

          {/* Card 4: Expenses */}
          <View style={styles.kpiCard}>
            <Receipt size={22} color="#1D4ED8" />
            <Text style={styles.kpiValue}>฿{totalExpenseAmount.toFixed(2)}</Text>
            <Text style={styles.kpiLabel}>{t('summary_total_expenses')}</Text>
          </View>
        </View>

        {/* CLIENT EXPENSES BREAKDOWN SECTION (SUMMARY OF EXPENSES PER CLIENT) */}
        <View style={styles.expensesContainer}>
          <TouchableOpacity
            style={styles.expensesHeaderRow}
            onPress={() => setShowAllExpenses(!showAllExpenses)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CreditCard size={18} color="#1D4ED8" />
              <Text style={styles.expensesTitle}>{t('summary_client_expenses')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.expensesTotalBadge}>฿{totalExpenseAmount.toFixed(2)}</Text>
              {showAllExpenses ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
            </View>
          </TouchableOpacity>

          {showAllExpenses && (
            <View style={styles.clientExpensesListWrapper}>
              {clientExpensesBreakdown.map((item) => (
                <View key={item.drop.id || item.index} style={styles.clientExpenseCard}>
                  {/* Client Header Row with Badge & Subtotal */}
                  <View style={styles.clientExpenseCardHeader}>
                    <View style={styles.clientBadgePill}>
                      <Text style={styles.clientBadgeText}>#{item.index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.clientExpenseName} numberOfLines={1}>
                        {item.drop.name}
                      </Text>
                      <Text style={styles.clientExpenseCountText}>
                        {item.expenses.length} {t('summary_items')}
                      </Text>
                    </View>
                    <View style={styles.clientSubtotalCol}>
                      <Text style={styles.clientSubtotalLabel}>{t('summary_client_subtotal')}</Text>
                      <Text style={styles.clientSubtotalAmount}>฿{item.subtotal.toFixed(2)}</Text>
                    </View>
                  </View>

                    {/* Itemized Expenses under this Client */}
                    {item.expenses.length > 0 ? (
                      <View style={styles.clientExpenseItemsList}>
                        {item.expenses.map((exp: any, eIdx: number) => (
                          <View key={exp.id || eIdx} style={styles.expenseRowCard}>
                            <View style={styles.expenseRowInfo}>
                              <View style={styles.expenseIconBox}>
                                <Receipt size={14} color="#1D4ED8" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.expenseItemCat}>{exp.category}</Text>
                                {exp.note ? (
                                  <Text style={styles.expenseItemNote}>{exp.note}</Text>
                                ) : null}
                                {exp.receiptName && (
                                  <Text style={styles.expenseSlipTag}>📎 {exp.receiptName}</Text>
                                )}
                              </View>
                              <Text style={styles.expenseItemVal}>฿{parseFloat(exp.amount || 0).toFixed(2)}</Text>
                            </View>

                            {/* Slip Preview Button if receipt attached */}
                            {exp.receiptUri && (
                              <TouchableOpacity
                                style={styles.viewSlipRowBtn}
                                onPress={() =>
                                  setPreviewImage({
                                    uri: exp.receiptUri,
                                    title: `${item.drop.name} - ${exp.category}`,
                                    subtitle: `฿${exp.amount} • ${exp.receiptName || 'Slip'}`,
                                    location: item.drop.name,
                                    latitude: item.drop.latitude,
                                    longitude: item.drop.longitude,
                                  })
                                }
                                activeOpacity={0.8}
                              >
                                <Image source={{ uri: exp.receiptUri }} style={styles.viewSlipThumb} />
                                <Text style={styles.viewSlipBtnText} numberOfLines={1}>
                                  {language === 'th' ? 'ดูรูปสลิปหลักฐาน' : 'View Slip Receipt'} (฿{exp.amount})
                                </Text>
                                <Eye size={14} color="#1D4ED8" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noExpenseBox}>
                        <Text style={styles.noExpenseText}>
                          {t('summary_no_expenses')} • ฿0.00
                        </Text>
                      </View>
                    )}
                  </View>
                ))}

              {/* Grand Total Summary Box */}
              <View style={styles.grandTotalSummaryBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} color="#166534" />
                  <Text style={styles.grandTotalLabel}>{t('summary_grand_total')}</Text>
                </View>
                <Text style={styles.grandTotalAmount}>฿{totalExpenseAmount.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Timeline Drop Reports Section with Clickable Edit Action */}
        <View style={styles.reportsContainer}>
          <View style={styles.reportsHeader}>
            <View>
              <Text style={styles.reportsTitle}>{t('summary_logs')} ({dropsList.length})</Text>
              <Text style={styles.reportsNotice}>
                {t('summary_logs_sub')}
              </Text>
            </View>
          </View>

          <View style={styles.timelineList}>
            {/* Origin / Start Location Item (#0) (Editable in Draft/Revision, Locked in Approved/Pending) */}
            <TouchableOpacity
              style={styles.timelineItem}
              onPress={handleEditStartOdo}
              activeOpacity={0.7}
            >
              <View style={styles.seqCol}>
                <View style={[styles.seqCircle, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                  <NavigationIcon size={12} color="#166534" />
                </View>
                <View style={styles.timelineLine} />
              </View>

              <View style={styles.dropInfoBox}>
                <View style={styles.dropHeaderRow}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.dropName} numberOfLines={1}>
                      {t('summary_start_location')}
                    </Text>
                    <View style={[styles.confirmBadgePill, styles.confirmBadgePillGreen]}>
                      <CheckCircle2 size={10} color="#166534" />
                      <Text style={[styles.confirmBadgePillText, { color: '#166534' }]}>
                        {language === 'th' ? 'จุดเริ่มต้น' : 'Start'}
                      </Text>
                    </View>
                  </View>

                  {!params.isApproved && !params.isPendingReview && (
                    <TouchableOpacity
                      style={styles.editDropButton}
                      onPress={handleEditStartOdo}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={12} color="#1D4ED8" />
                      <Text style={styles.editDropButtonText}>{t('btn_edit')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.dropAddressText} numberOfLines={1}>
                  {startLocation.name || startLocation.address}
                </Text>

                <View style={styles.metaRow}>
                  <View style={[styles.metaPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}>
                    <Gauge size={13} color="#1D4ED8" />
                    <Text style={[styles.metaPillText, { fontWeight: '700' }]}>
                      {t('preview_start_odo')}: {startOdometer} km
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {dropsList.map((dropItem: any, index: number) => {
              // isDataComplete controls Complete vs Incomplete badge on summary
              const isDropComplete = dropItem.isDataComplete !== undefined
                ? !!dropItem.isDataComplete
                : (dropItem.status === 'Completed' || dropItem.status === 'completed');
              const dropExp = getDropExpenses(dropItem, index);
              const dropExpSum = dropExp.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

              return (
                <TouchableOpacity
                  key={dropItem.id || index}
                  style={[
                    styles.timelineItem,
                    !isDropComplete && styles.timelineItemUnconfirmed,
                  ]}
                  onPress={() => handleEditDrop(dropItem, index)}
                  activeOpacity={0.7}
                >
                  {/* Sequence Number Circle */}
                  <View style={styles.seqCol}>
                    <View
                      style={[
                        styles.seqCircle,
                        isDropComplete
                          ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                          : { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.seqText,
                          isDropComplete ? { color: '#166534' } : { color: '#B45309' },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    {index < dropsList.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  {/* Drop Info Box - Clickable with Edit Badge */}
                  <View style={styles.dropInfoBox}>
                    <View style={styles.dropHeaderRow}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 }}>
                        <Text style={[styles.dropName, { flexShrink: 1 }]} numberOfLines={1}>
                          #{index + 1} {dropItem.name}
                        </Text>
                        
                        {/* Compact Status Badge */}
                        <View
                          style={[
                            styles.confirmBadgePill,
                            isDropComplete ? styles.confirmBadgePillGreen : styles.confirmBadgePillAmber,
                          ]}
                        >
                          {isDropComplete ? (
                            <CheckCircle2 size={10} color="#166534" />
                          ) : (
                            <AlertTriangle size={10} color="#B45309" />
                          )}
                          <Text
                            style={[
                              styles.confirmBadgePillText,
                              isDropComplete ? { color: '#166534' } : { color: '#B45309' },
                            ]}
                          >
                            {isDropComplete
                              ? (language === 'th' ? '✓ สมบูรณ์' : '✓ Complete')
                              : (language === 'th' ? '⚠️ ไม่สมบูรณ์' : '⚠️ Incomplete')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.editDropButton}>
                        <Edit3 size={12} color="#1D4ED8" />
                        <Text style={styles.editDropButtonText}>{t('btn_edit')}</Text>
                      </View>
                    </View>

                    <Text style={styles.dropAddressText} numberOfLines={1}>
                      {dropItem.address}
                    </Text>

                    <View style={styles.timeRow}>
                      <Clock size={12} color={isDropComplete ? '#16A34A' : '#D97706'} />
                      <Text
                        style={[
                          styles.timeText,
                          !isDropComplete && { color: '#B45309', fontWeight: '700' },
                        ]}
                      >
                        {`0${9 + Math.floor(index * 0.8)}:${15 + (index * 25) % 40}`} น.{' '}
                        {isDropComplete
                          ? (language === 'th' ? '• เข้าพบแล้ว' : '• Visited')
                          : (language === 'th' ? '• ข้อมูลไม่สมบูรณ์ (แตะเพื่อแก้ไข)' : '• Incomplete (tap to edit)')}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Camera size={13} color="#1D4ED8" />
                        <Text style={styles.metaPillText}>
                          {(() => {
                            const pCount = Array.isArray(dropItem.photos) && dropItem.photos.length > 0
                              ? dropItem.photos.length
                              : parsePhotos(dropItem.client_photo_url).length;
                            return `${pCount} ${language === 'th' ? 'รูปถ่าย' : 'Photos'}`;
                          })()}
                        </Text>
                      </View>
                      <View style={styles.metaPill}>
                        <CreditCard size={13} color="#1D4ED8" />
                        <Text style={styles.metaPillText}>฿{dropExpSum.toFixed(2)}</Text>
                      </View>
                      {(index === 0 || dropItem.note || dropItem.meetingMinutes) && (
                        <View style={[styles.metaPill, { backgroundColor: '#F3E8FF' }]}>
                          <FileText size={13} color="#7C3AED" />
                          <Text style={[styles.metaPillText, { color: '#7C3AED' }]}>
                            {language === 'th' ? 'มีบันทึกการประชุม' : 'Notes Attached'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Proof Photos Thumbnail Strip */}
                    {(() => {
                      const displayPhotos = Array.isArray(dropItem.photos) && dropItem.photos.length > 0
                        ? dropItem.photos
                        : parsePhotos(dropItem.client_photo_url);

                      if (!displayPhotos || displayPhotos.length === 0) return null;

                      return (
                        <View style={styles.summaryPhotosStrip}>
                          {displayPhotos.map((phUri: string, pIdx: number) => (
                            <TouchableOpacity
                              key={pIdx}
                              onPress={(e) => {
                                e.stopPropagation();
                                setPreviewImage({
                                  uri: phUri,
                                  title: `${dropItem.name} - รูปถ่าย #${pIdx + 1}`,
                                  subtitle: dropItem.address || dropItem.name,
                                  location: dropItem.name,
                                  latitude: dropItem.latitude,
                                  longitude: dropItem.longitude,
                                });
                              }}
                              activeOpacity={0.8}
                              style={styles.summaryPhotoThumbBox}
                            >
                              <Image source={{ uri: phUri }} style={styles.summaryPhotoThumb} />
                              <View style={styles.summaryPhotoWatermarkBadge}>
                                <Text style={styles.summaryPhotoWatermarkText} numberOfLines={1}>
                                  📍 {dropItem.name}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>


      {/* Bottom Sticky Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        {isApproved ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: '#166534' }]}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.9}
          >
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>
              {language === 'th' ? 'กลับไปหน้าหลัก (อนุมัติเรียบร้อย)' : 'Back to Dashboard (Approved)'}
            </Text>
          </TouchableOpacity>
        ) : isPendingReview ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: '#64748B' }]}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.9}
          >
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>
              {language === 'th' ? 'กลับไปหน้าหลัก (รอ Admin อนุมัติ)' : 'Back to Dashboard (Pending Review)'}
            </Text>
          </TouchableOpacity>
        ) : !isAllDropsCompleted ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: '#D97706' }, isSaving && { opacity: 0.7 }]}
            onPress={handleSaveDraftAndReturn}
            disabled={isSaving}
            activeOpacity={0.9}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Save size={18} color="#FFFFFF" />
            )}
            <Text style={styles.submitBtnText}>
              {isSaving
                ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                : (language === 'th'
                    ? `บันทึกและกลับไปแผนงานวันนี้ (ไม่สมบูรณ์ ${incompleteDropsCount} จุด)`
                    : `Save & Back to Today Visits (${incompleteDropsCount} Incomplete)`)}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.submitBtnSecondary, { flex: 1 }, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveDraftAndReturn}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <Save size={16} color="#1D4ED8" />
              )}
              <Text style={styles.submitBtnSecondaryText}>
                {isSaving
                  ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                  : (language === 'th' ? 'บันทึกแบบร่าง' : 'Save Draft')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { flex: 1.6, backgroundColor: '#16A34A' }, isSaving && { opacity: 0.7 }]}
              onPress={handleSubmitToAdmin}
              disabled={isSaving}
              activeOpacity={0.9}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color="#FFFFFF" />
              )}
              <Text style={styles.submitBtnText}>
                {isSaving
                  ? (language === 'th' ? 'กำลังส่งรายงาน...' : 'Submitting...')
                  : (isRevision
                      ? (language === 'th' ? `ส่งรายงานแก้ไข (#${revisionCount || 1})` : `Resubmit (#${revisionCount || 1})`)
                      : (language === 'th' ? 'ส่งรายงานให้ Admin' : 'Submit to Admin'))}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Full-screen Slip / Photo Preview Modal */}
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
                  {previewImage?.title || 'ดูรูปสลิป'}
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
                  {/* Watermark Stamp Overlay */}
                  <View style={styles.photoWatermarkOverlay}>
                    <View style={styles.photoWatermarkContent}>
                      <Text style={styles.watermarkLocationText} numberOfLines={1}>
                        📍 {previewImage.location || previewImage.subtitle || previewImage.title || (language === 'th' ? 'สถานที่เข้าพบ' : 'Location')}
                      </Text>
                      {previewImage.latitude && (
                        <Text style={styles.watermarkCoordText}>
                          🌐 GPS: {previewImage.latitude.toFixed(5)}, {previewImage.longitude?.toFixed(5)}
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

      {/* Edit Start Odometer Modal */}
      <Modal
        visible={isEditStartOdoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditStartOdoOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editOdoModalCard}>
            <View style={styles.editOdoModalHeader}>
              <View style={styles.editOdoIconCircle}>
                <Gauge size={22} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.editOdoModalTitle}>{t('summary_edit_start_odo')}</Text>
                <Text style={styles.editOdoModalSub}>{startLocation.name || 'จุดเริ่มต้นเดินทาง'}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditStartOdoOpen(false)} activeOpacity={0.7}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.editOdoInputContainer}>
              <TextInput
                style={styles.editOdoTextInput}
                value={editingOdoValue}
                onChangeText={setEditingOdoValue}
                keyboardType="numeric"
                placeholder={language === 'th' ? 'เช่น 45200' : 'e.g. 45200'}
                placeholderTextColor="#94A3B8"
                autoFocus
              />
              <Text style={styles.editOdoUnitText}>{language === 'th' ? 'กม. (km)' : 'km'}</Text>
            </View>

            <View style={styles.editOdoModalActions}>
              <TouchableOpacity
                style={styles.editOdoCancelBtn}
                onPress={() => setIsEditStartOdoOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.editOdoCancelBtnText}>{t('btn_cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editOdoSaveBtn}
                onPress={handleSaveStartOdo}
                activeOpacity={0.85}
              >
                <Text style={styles.editOdoSaveBtnText}>{t('btn_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  darkHeader: {
    backgroundColor: '#03246B',
    paddingBottom: 20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 20,
    padding: 14,
  },
  unconfirmedBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  successBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  successBannerSub: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#03246B',
    marginTop: 4,
  },
  kpiUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#747686',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#747686',
    letterSpacing: 0.6,
  },
  reportsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reportsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#03246B',
  },
  timelineList: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  seqCol: {
    alignItems: 'center',
    width: 28,
  },
  seqCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  seqText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timelineLine: {
    width: 2,
    height: 64,
    backgroundColor: '#E2E8F0',
    marginVertical: -2,
  },
  dropInfoBox: {
    flex: 1,
    paddingBottom: 22,
    gap: 4,
  },
  dropHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
    flex: 1,
  },
  dropAddressText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timelineItemUnconfirmed: {
    opacity: 0.95,
  },
  confirmBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confirmBadgePillGreen: {
    backgroundColor: '#DCFCE7',
  },
  confirmBadgePillAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  confirmBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  inlineWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  inlineWarningBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#747686',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaPillText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E3E6',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    paddingVertical: 15,
    borderRadius: 28,
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
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnSecondary: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 15,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  submitBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  meetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  meetingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meetingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  minuteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  minuteBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
  },
  meetingTopicText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  meetingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  meetingDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  meetingDetailValue: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
  },
  meetingNotesBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    gap: 4,
  },
  meetingNotesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  meetingNotesText: {
    fontSize: 13,
    color: '#1E1B4B',
    lineHeight: 18,
  },
  meetingActionBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  meetingActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  meetingActionText: {
    fontSize: 13,
    color: '#064E3B',
    lineHeight: 18,
  },
  expensesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  expensesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expensesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#03246B',
  },
  expensesTotalBadge: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  clientExpensesListWrapper: {
    gap: 12,
    marginTop: 4,
  },
  clientExpenseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  clientExpenseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clientBadgePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  clientExpenseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  clientExpenseCountText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  clientSubtotalCol: {
    alignItems: 'flex-end',
  },
  clientSubtotalLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  clientSubtotalAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  clientExpenseItemsList: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  noExpenseBox: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noExpenseText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  grandTotalSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  grandTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#166534',
  },
  expenseRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  expenseRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseItemCat: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
  },
  expenseItemNote: {
    fontSize: 11,
    color: '#64748B',
  },
  expenseSlipTag: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '600',
    marginTop: 1,
  },
  expenseItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#03246B',
  },
  slipPreviewsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  viewSlipRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },
  viewSlipThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  viewSlipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    flex: 1,
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
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
  editCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  editCardActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  reportsNotice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  editDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editDropButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editOdoModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  editOdoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editOdoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editOdoModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#03246B',
  },
  editOdoModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editOdoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    paddingHorizontal: 14,
  },
  editOdoTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  editOdoUnitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  editOdoModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  editOdoCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editOdoCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  editOdoSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  editOdoSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  revisionNoticeCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginBottom: 16,
    gap: 8,
  },
  revisionNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revisionNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  revisionNoticeText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  summaryPhotosStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  summaryPhotoThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  summaryPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  summaryPhotoWatermarkBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 1,
    paddingHorizontal: 3,
  },
  summaryPhotoWatermarkText: {
    color: '#FFFFFF',
    fontSize: 7,
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

