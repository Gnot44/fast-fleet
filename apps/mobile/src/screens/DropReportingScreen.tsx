import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';

export interface ExpenseItem {
  id: string;
  category: string;
  amount: string;
  receiptUri?: string;
  receiptName?: string;
  note?: string;
}

const SAMPLE_RECEIPT_SLIPS = [
  {
    name: 'Slip-Toll-M9.jpg',
    category: 'ค่าทางด่วน',
    amount: '60.00',
    uri: 'https://images.unsplash.com/photo-1554415707-9e49016a3e06?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Slip-Coffee-Meeting.jpg',
    category: 'ค่าอาหาร / เลี้ยงรับรอง',
    amount: '150.00',
    uri: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Slip-Parking-Sathorn.jpg',
    category: 'ค่าที่จอดรถ',
    amount: '80.00',
    uri: 'https://images.unsplash.com/photo-1628527304948-06157ee3c8a7?w=600&auto=format&fit=crop&q=80',
  },
];

export default function DropReportingScreen({ navigation, route }: any) {
  const { t, language, expenseCategories, noteTemplates } = useLanguage();
  const params = route?.params || {};
  const isEditingFromSummary = !!params.isEditingFromSummary;
  const drop = params.drop || { name: language === 'th' ? 'จุดเข้าพบลูกค้า' : 'Client Location', address: '', contact: '' };
  const dropIndex = typeof params.dropIndex === 'number' ? params.dropIndex : 0;
  const drops = Array.isArray(params.drops) ? params.drops : [];
  const totalDrops = drops.length > 0 ? drops.length : (typeof params.totalDrops === 'number' ? params.totalDrops : 1);

  // Confirmation Status (Default to false / OFF as requested)
  const [isConfirmed, setIsConfirmed] = useState(drop.isConfirmed !== undefined ? !!drop.isConfirmed : false);

  // Odometer
  const [odometer, setOdometer] = useState(drop.odometer || params.odometer || '45280');

  // Visit Agenda State
  const initialAgenda = drop.items || drop.agenda || 'นำเสนอโปรเจกต์ (Pitch & Proposal)';
  const [visitAgenda, setVisitAgenda] = useState(initialAgenda);
  const [selectedAgendaKey, setSelectedAgendaKey] = useState<string>(() => {
    if (initialAgenda.includes('นำเสนอ')) return 'pitch';
    if (initialAgenda.includes('ต่อสัญญา')) return 'renewal';
    if (initialAgenda.includes('ตรวจระบบ')) return 'healthcheck';
    if (initialAgenda.includes('แนะนำสินค้า') || initialAgenda.includes('เดโม')) return 'demo';
    if (initialAgenda.startsWith('อื่นๆ')) return 'other';
    return 'pitch';
  });
  const [customAgendaText, setCustomAgendaText] = useState(
    initialAgenda.startsWith('อื่นๆ:') ? initialAgenda.replace('อื่นๆ:', '').trim() : ''
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

  // Expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    Array.isArray(drop.expenses) && drop.expenses.length > 0
      ? drop.expenses
      : Array.isArray(params.expenses) && params.expenses.length > 0
      ? params.expenses
      : []
  );

  // Form State for Adding/Editing Expense
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newReceiptUri, setNewReceiptUri] = useState<string | undefined>(undefined);
  const [newReceiptName, setNewReceiptName] = useState<string | undefined>(undefined);
  const [newNote, setNewNote] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<string[]>(
    Array.isArray(drop.photos) && drop.photos.length > 0
      ? drop.photos
      : [
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAeTqc_HT_3pN_On_ZrF2W3ESYrPMFFsiv79VwK7REGnL_tk0tWaYCjCw67CdjhSUpUaouy2nOgdMSccuayqwS7_QDebndi-cuGs1nG-bvRKTDvMDJv-TTJQJNBfmMuOm94O7zvZwOI8DejNsLh-PFycsxOVDxTb76Q8diw0pF7OivqhjwATuirnFPrKkv9cK17FPQXWZpDqxpEhqdBpJtugdrY19m7xUyIUaruXQeMqimq1XP_k-hU',
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBMzooyTS01enI1NNFi_RG4W9dnQcGCT5YQa5T9fEIWL3F94-10RiazETtCfnYAnqyTzjuy__h-EvnZmIYobs4_pU2KOhbdPdDfq1Jv8paG2qWzkWytebfeVK9Pte-nFnPpWYS5R6WAHpMNiyGc90ye0aiXYWw5_9pdjQr5F_FJxj8-KjvCd--IFqCkCEvxvAT_QrTWGYF0ydvikBZFtUdQGYdqDLGn9v4V-w3g2U74kCe3vU70JKtF',
        ]
  );

  // Modals
  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string; subtitle?: string } | null>(null);
  const [isReceiptPickerOpen, setIsReceiptPickerOpen] = useState(false);
  const [targetExpenseIdForSlip, setTargetExpenseIdForSlip] = useState<string | null>(null);

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

  const handleSelectReceiptSlip = (sample: typeof SAMPLE_RECEIPT_SLIPS[0]) => {
    if (targetExpenseIdForSlip) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === targetExpenseIdForSlip
            ? { ...e, receiptUri: sample.uri, receiptName: sample.name }
            : e
        )
      );
      setTargetExpenseIdForSlip(null);
    } else {
      setNewReceiptUri(sample.uri);
      setNewReceiptName(sample.name);
      if (!newCategory) setNewCategory(sample.category);
      if (!newAmount) setNewAmount(sample.amount);
    }
    setIsReceiptPickerOpen(false);
  };

  const handleSimulateCameraCapture = () => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const newUri = 'https://images.unsplash.com/photo-1554415707-9e49016a3e06?w=600&auto=format&fit=crop&q=80';
    const slipName = `Camera-Slip-${timestamp.replace(/[:\s]/g, '')}.jpg`;

    if (targetExpenseIdForSlip) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === targetExpenseIdForSlip
            ? { ...e, receiptUri: newUri, receiptName: slipName }
            : e
        )
      );
      setTargetExpenseIdForSlip(null);
    } else {
      setNewReceiptUri(newUri);
      setNewReceiptName(slipName);
    }
    setIsReceiptPickerOpen(false);
  };

  const handleTakePhoto = () => {
    const demoPhotos = [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
    ];
    const picked = demoPhotos[photos.length % demoPhotos.length];
    setPhotos((prev) => [...prev, picked]);
  };

  const handleSaveAndClose = () => {
    const updatedDrop = {
      ...drop,
      isConfirmed,
      odometer,
      items: visitAgenda,
      agenda: visitAgenda,
      note,
      meetingMinutes: note,
      expenses,
      photos,
      status: isConfirmed ? 'Completed' : 'Pending Confirmation',
    };

    if (isEditingFromSummary) {
      navigation.navigate('TripSummary', {
        tripId: params.tripId,
        updatedDropIndex: dropIndex,
        updatedDrop: updatedDrop,
      });
      return;
    }

    const nextIndex = dropIndex + 1;
    const isFinished = nextIndex >= totalDrops;

    if (isFinished) {
      const allUpdatedDrops = drops.map((d: any, idx: number) =>
        idx === dropIndex ? updatedDrop : d
      );
      navigation.navigate('TripSummary', {
        tripId: params.tripId,
        drops: allUpdatedDrops,
        tripTitle: params.tripTitle,
        selectedVehicle: params.selectedVehicle,
        totalExpenseAmount: expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
      });
    } else {
      navigation.navigate('ActiveTracker', {
        ...params,
        dropIndex: nextIndex,
        completedDropIndex: dropIndex,
        lastCompletedDrop: updatedDrop,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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

        {/* 1. Confirmation Toggle */}
        <View style={[styles.card, isConfirmed ? styles.cardConfirmedActive : styles.cardUnconfirmedActive]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, isConfirmed ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' }]}>
              {isConfirmed ? (
                <CheckCircle2 size={18} color="#16A34A" />
              ) : (
                <AlertTriangle size={18} color="#D97706" />
              )}
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.cardTitle}>{t('report_confirm_status')}</Text>
                <View
                  style={[
                    styles.confirmStatusPill,
                    isConfirmed ? styles.confirmStatusPillGreen : styles.confirmStatusPillAmber,
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmStatusPillText,
                      isConfirmed ? { color: '#166534' } : { color: '#B45309' },
                    ]}
                  >
                    {isConfirmed ? `✓ ${t('report_confirmed_status_text')}` : `⚠️ ${t('report_unconfirmed_status_text')}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub} numberOfLines={1}>{t('report_confirm_sub')}</Text>
            </View>
            <Switch
              value={isConfirmed}
              onValueChange={setIsConfirmed}
              trackColor={{ false: '#CBD5E1', true: '#16A34A' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

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
                          title: exp.category,
                          subtitle: `฿${exp.amount} • ${exp.receiptName || 'Receipt'}`,
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
                    <Image source={{ uri: newReceiptUri }} style={styles.newSlipThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.newSlipName} numberOfLines={1}>
                        {newReceiptName || 'Slip-attached.jpg'}
                      </Text>
                    </View>
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
              <Text style={styles.cardSub}>{t('report_photos_sub')}</Text>
            </View>
          </View>

          {/* Photo Thumbnails Grid */}
          <View style={styles.photosGrid}>
            {photos.map((uri, idx) => (
              <View key={idx} style={styles.photoContainer}>
                <TouchableOpacity
                  onPress={() =>
                    setPreviewImage({
                      uri,
                      title: `${t('report_photos')} #${idx + 1}`,
                      subtitle: drop.name,
                    })
                  }
                  activeOpacity={0.8}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Image source={{ uri }} style={styles.photoImage} />
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
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <Camera size={22} color="#1D4ED8" />
              <Text style={styles.takePhotoText}>{t('btn_take_photo')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveButton, isEditingFromSummary && styles.saveButtonEditing]}
          onPress={handleSaveAndClose}
          activeOpacity={0.9}
        >
          <CheckCircle2 size={18} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {isEditingFromSummary
              ? t('report_save_return')
              : dropIndex >= totalDrops - 1
              ? t('btn_finish')
              : t('report_save_next')}
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
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSafeArea}>
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
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalImageContainer}>
              {previewImage && (
                <Image
                  source={{ uri: previewImage.uri }}
                  style={styles.modalFullImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </SafeAreaView>
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
                  {language === 'th' ? 'ถ่ายรูปใหม่หรือเลือกจากสลิปตัวอย่าง' : 'Capture photo or select from sample slips'}
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
              onPress={handleSimulateCameraCapture}
              activeOpacity={0.8}
            >
              <View style={styles.cameraPickerIcon}>
                <Camera size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cameraOptionTitle}>
                  {language === 'th' ? 'เปิดกล้องถ่ายรูปสลิป' : 'Open Camera to Capture Slip'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Sample Slips */}
            <Text style={styles.sampleListTitle}>
              {language === 'th' ? 'หรือเลือกจากตัวอย่างสลิป' : 'Or select from sample slips'}
            </Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {SAMPLE_RECEIPT_SLIPS.map((sample, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.sampleItemCard}
                  onPress={() => handleSelectReceiptSlip(sample)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: sample.uri }} style={styles.sampleSlipThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sampleName}>{sample.name}</Text>
                    <Text style={styles.sampleDetails}>
                      ฿{sample.amount}
                    </Text>
                  </View>
                  <View style={styles.sampleSelectBtn}>
                    <Text style={styles.sampleSelectText}>{t('btn_confirm')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 16,
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
    paddingBottom: 110,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
});
