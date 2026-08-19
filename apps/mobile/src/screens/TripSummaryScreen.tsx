import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Route,
  Clock,
  Receipt,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Camera,
  CreditCard,
  PlusCircle,
  Send,
  MoreVertical,
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
} from 'lucide-react-native';

import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

export default function TripSummaryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const params = route?.params || {};
  const tripRoute = params.tripTitle || params.tripRoute || 'Bangkok Central Delivery Route';
  const selectedVehicle = params.selectedVehicle || 'Isuzu D-Max (1กข-4452)';
  
  // Starting Location & Odometer state (editable directly in visit logs)
  const [startOdometer, setStartOdometer] = useState<string>(params.startOdometer || '45200');
  const [startLocation, setStartLocation] = useState(
    params.startLocation || {
      name: language === 'th' ? 'สำนักงาน / จุดปล่อยรถ (Depot)' : 'Office / Dispatch Depot',
      address: 'ถนนสุขุมวิท เขตคลองเตย กรุงเทพมหานคร',
    }
  );
  const [isEditStartOdoOpen, setIsEditStartOdoOpen] = useState(false);
  const [editingOdoValue, setEditingOdoValue] = useState(params.startOdometer || '45200');

  const rawDrops = Array.isArray(params.drops) && params.drops.length > 0 ? params.drops : [
    { id: '1', name: 'TechCorp HQ (Sathorn)', address: '120 Innovation Drive, Sathorn' },
    { id: '2', name: 'Northside Retail (Pathum Wan)', address: '4500 Commerce Blvd, Pathum Wan' },
    { id: '3', name: 'Mega Bangna Distribution', address: 'Bangna-Trad Km.8, Samut Prakan' },
  ];

  const initialNoteText =
    params.note ||
    (typeof params.meetingMinutes === 'string'
      ? params.meetingMinutes
      : params.meetingMinutes?.notes) ||
    'ส่งมอบสินค้าตาม PO ครบ 2 พาเลท สภาพสินค้าสมบูรณ์ 100% เอกสารลงนามครบถ้วน';

  // Default expense generator per drop if not yet entered
  const getDropExpenses = (dropItem: any, index: number): any[] => {
    if (Array.isArray(dropItem.expenses) && dropItem.expenses.length > 0) {
      return dropItem.expenses;
    }
    if (index === 0) {
      return [
        {
          id: 'exp-0-1',
          category: language === 'th' ? 'ค่าทางด่วน' : 'Toll Fee',
          amount: '60.00',
          receiptUri: 'https://images.unsplash.com/photo-1554415707-9e49016a3e06?w=600&auto=format&fit=crop&q=80',
          receiptName: 'Slip-Toll-M9.jpg',
          note: language === 'th' ? 'ทางพิเศษศรีรัช' : 'Expressway',
        },
        {
          id: 'exp-0-2',
          category: language === 'th' ? 'ค่าที่จอดรถ' : 'Parking Fee',
          amount: '80.00',
          receiptUri: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&auto=format&fit=crop&q=80',
          receiptName: 'Parking-Sathorn.jpg',
          note: language === 'th' ? 'อาคารสาทรซิตี้' : 'Sathorn City Tower',
        },
      ];
    }
    if (index === 1) {
      return [
        {
          id: 'exp-1-1',
          category: language === 'th' ? 'ค่าอาหาร / รับรองลูกค้า' : 'Client Meals',
          amount: '150.00',
          receiptUri: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=600&auto=format&fit=crop&q=80',
          receiptName: 'Receipt-Coffee-Meeting.jpg',
          note: language === 'th' ? 'เครื่องดื่มประชุม' : 'Meeting Drinks',
        },
      ];
    }
    if (index === 2) {
      return [
        {
          id: 'exp-2-1',
          category: language === 'th' ? 'ค่าน้ำมัน' : 'Fuel',
          amount: '350.00',
          receiptUri: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80',
          receiptName: 'Slip-Fuel-PTT.jpg',
          note: language === 'th' ? 'ปั๊ม ปตท. บางนา' : 'PTT Gas Station',
        },
      ];
    }
    return [];
  };

  // Dynamic state that gets updated when returning from DropReporting
  const [dropsList, setDropsList] = useState<any[]>(rawDrops);

  // Sync state when route params change (e.g. from DropReporting edit)
  useEffect(() => {
    if (params.drops && Array.isArray(params.drops) && params.drops.length > 0) {
      setDropsList(params.drops);
    } else if (params.updatedDropIndex !== undefined && params.updatedDropData) {
      setDropsList((prev) => {
        const next = [...prev];
        next[params.updatedDropIndex] = {
          ...next[params.updatedDropIndex],
          ...params.updatedDropData,
        };
        return next;
      });
    }
  }, [params]);

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
  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string; subtitle?: string } | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  // Navigation to DropReporting for retroactive edits
  const handleEditDrop = (dropItem: any, index: number) => {
    navigation.navigate('DropReporting', {
      drop: dropItem,
      dropIndex: index,
      drops: dropsList,
      totalDrops: dropsList.length,
      tripTitle: tripRoute,
      selectedVehicle: selectedVehicle,
      isEditingFromSummary: true,
      note: dropItem.note || dropItem.meetingMinutes || '',
      expenses: dropItem.expenses || getDropExpenses(dropItem, index),
      odometer: dropItem.odometer,
      photos: dropItem.photos,
    });
  };

  const handleSubmitTripReport = () => {
    const unconfirmedList = dropsList.filter((d: any, idx: number) => {
      if (d.isConfirmed !== undefined) return !d.isConfirmed;
      return idx >= 2;
    });

    if (unconfirmedList.length > 0) {
      Alert.alert(
        language === 'th' ? 'ยังยืนยันไม่ครบทุกจุด ⚠️' : 'Incomplete Confirmations ⚠️',
        language === 'th'
          ? `มี ${unconfirmedList.length} จุดที่ยังไม่ได้เปิดสวิตช์ยืนยันเข้าพบ กรุณาแตะที่รายชื่อลูกค้าเพื่อกดยืนยันให้ครบถ้วนก่อนส่งรายงาน`
          : `There are ${unconfirmedList.length} stops not confirmed yet. Please verify all stops before submitting report.`,
        [
          { text: t('btn_cancel'), style: 'cancel' },
          {
            text: language === 'th' ? 'ตรวจสอบจุดที่เหลือ' : 'Review Stops',
            onPress: () => {
              const firstUnconfirmedIndex = dropsList.findIndex((d: any, idx: number) => {
                if (d.isConfirmed !== undefined) return !d.isConfirmed;
                return idx >= 2;
              });
              if (firstUnconfirmedIndex >= 0) {
                handleEditDrop(dropsList[firstUnconfirmedIndex], firstUnconfirmedIndex);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      params.isRevision
        ? (language === 'th' ? 'ยืนยันการส่งรายงานแก้ไข 🚀' : 'Confirm Resubmission 🚀')
        : (language === 'th' ? 'ยืนยันการส่งรายงาน 🎉' : 'Submit Field Report 🎉'),
      params.isRevision
        ? (language === 'th'
            ? `ส่งรายงานฉบับแก้ไขรอบที่ ${params.revisionCount || 1} พร้อมเอกสารและสลิปค่าใช้จ่ายรวม ฿${totalExpenseAmount.toFixed(2)} ให้หัวหน้างานตรวจสอบ`
            : `Resubmit revised report for manager review with total expenses of ฿${totalExpenseAmount.toFixed(2)}`)
        : (language === 'th'
            ? `ส่งรายงานการเข้าพบลูกค้าทั้งหมด (${dropsList.length} รายการ) และสรุปค่าใช้จ่ายรวม ฿${totalExpenseAmount.toFixed(2)} (${totalExpenseItemsCount} รายการ) เข้าระบบส่วนกลาง`
            : `Submit report for ${dropsList.length} client visits and total expenses of ฿${totalExpenseAmount.toFixed(2)} (${totalExpenseItemsCount} items) to central system`),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        {
          text: t('btn_confirm'),
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const staffId = user?.id;

              if (staffId) {
                // Check if tripId exists or create new
                let tripId = params.tripId;
                const startOdoNum = parseInt(startOdometer || '45200', 10);
                const endOdoNum = startOdoNum + 45;

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
                      status: 'completed',
                      approval_status: 'pending',
                      start_odometer: startOdoNum,
                      end_odometer: endOdoNum,
                      total_distance_km: 45.2,
                      total_expenses: totalExpenseAmount,
                    })
                    .select()
                    .single();

                  if (newTrip) {
                    tripId = newTrip.id;
                  }
                } else {
                  await supabase
                    .from('trips')
                    .update({
                      status: 'completed',
                      approval_status: 'pending',
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
                    const apptRes = await supabase
                      .from('appointments')
                      .insert({
                        type: 'appointment',
                        trip_id: tripId,
                        staff_id: staffId,
                        company_name: d.name || `ลูกค้าจุดที่ ${i + 1}`,
                        customer_name: d.contactPerson || d.name || `ลูกค้าจุดที่ ${i + 1}`,
                        recipient_name: d.contactPerson || 'ผู้จัดการสาขา',
                        recipient_phone: d.contactPhone || '081-000-0000',
                        destination_address: d.address || 'กรุงเทพมหานคร',
                        agenda: d.agenda || 'demo',
                        sequence_order: i + 1,
                        confirmation_status: d.isConfirmed !== false,
                        meeting_notes: d.meetingMinutes || d.note || '',
                        status: 'completed',
                        client_photo_url: d.photos && d.photos[0] ? d.photos[0] : null,
                      })
                      .select()
                      .single();

                    // Sync drop expenses
                    const dropExps = d.expenses || getDropExpenses(d, i);
                    if (apptRes.data?.id && Array.isArray(dropExps)) {
                      for (const exp of dropExps) {
                        if (parseFloat(exp.amount) > 0) {
                          await supabase.from('expenses').insert({
                            staff_id: staffId,
                            trip_id: tripId,
                            appointment_id: apptRes.data.id,
                            category: exp.category === 'ค่าน้ำมัน' ? 'fuel' : (exp.category === 'ค่าทางด่วน' ? 'toll' : 'parking'),
                            amount: parseFloat(exp.amount),
                            receipt_url: exp.receiptUri,
                            notes: exp.note,
                          });
                        }
                      }
                    }
                  }
                }
              }
            } catch (syncErr) {
              console.error('Error syncing trip report to Supabase:', syncErr);
            }

            Alert.alert(
              params.isRevision
                ? (language === 'th' ? 'ส่งรายงานแก้ไขเรียบร้อย 🚀' : 'Report Resubmitted 🚀')
                : (language === 'th' ? 'ส่งรายงานเรียบร้อย 🚀' : 'Report Submitted 🚀'),
              params.isRevision
                ? (language === 'th'
                    ? `ข้อมูลฉบับแก้ไขถูกส่งไปยัง Web Admin ให้ผู้จัดการตรวจสอบแล้ว`
                    : 'Your revised trip report has been sent to Web Admin for manager approval.')
                : (language === 'th'
                    ? 'ข้อมูลการเข้าพบลูกค้าและหลักฐานสลิปค่าใช้จ่ายถูกบันทึกเรียบร้อยแล้ว'
                    : 'Client visit records and expense receipts have been synced successfully.'),
              [
                {
                  text: language === 'th' ? 'กลับหน้าหลัก' : 'Go to Dashboard',
                  onPress: () => navigation.navigate('Dashboard'),
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
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
              {params.isRevision
                ? (language === 'th' ? 'แก้ไขรายงานทริป' : 'Revise Trip Report')
                : t('summary_title')}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>{tripRoute}</Text>
          </View>
          <LanguageTogglePill />
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Manager Revision Alert Banner if in Revision Mode */}
        {params.isRevision && (
          <View style={styles.revisionNoticeCard}>
            <View style={styles.revisionNoticeHeader}>
              <AlertTriangle size={18} color="#DC2626" />
              <Text style={styles.revisionNoticeTitle}>
                {language === 'th'
                  ? `⚠️ ทริปนี้ถูกส่งกลับแก้ไข (รอบที่ ${params.revisionCount || 1})`
                  : `⚠️ Revision Requested (Cycle #${params.revisionCount || 1})`}
              </Text>
            </View>
            <Text style={styles.revisionNoticeText}>
              {language === 'th' ? '💬 ข้อความจากหัวหน้างาน:' : '💬 Manager Feedback:'}{' '}
              "{params.managerFeedback || 'กรุณาตรวจสอบและแก้ไขข้อมูลให้ถูกต้องก่อนส่งใหม่'}"
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
            {/* Origin / Start Location Item (#0) with Edit Start Odo Button */}
            <TouchableOpacity
              style={styles.timelineItem}
              onPress={() => {
                setEditingOdoValue(startOdometer);
                setIsEditStartOdoOpen(true);
              }}
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

                  <TouchableOpacity
                    style={styles.editDropButton}
                    onPress={() => {
                      setEditingOdoValue(startOdometer);
                      setIsEditStartOdoOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={12} color="#1D4ED8" />
                    <Text style={styles.editDropButtonText}>{t('btn_edit')}</Text>
                  </TouchableOpacity>
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
              const isDropConfirmed = dropItem.isConfirmed !== undefined ? !!dropItem.isConfirmed : index < 2;
              const dropExp = getDropExpenses(dropItem, index);
              const dropExpSum = dropExp.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

              return (
                <TouchableOpacity
                  key={dropItem.id || index}
                  style={[
                    styles.timelineItem,
                    !isDropConfirmed && styles.timelineItemUnconfirmed,
                  ]}
                  onPress={() => handleEditDrop(dropItem, index)}
                  activeOpacity={0.7}
                >
                  {/* Sequence Number Circle */}
                  <View style={styles.seqCol}>
                    <View
                      style={[
                        styles.seqCircle,
                        isDropConfirmed
                          ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                          : { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.seqText,
                          isDropConfirmed ? { color: '#166534' } : { color: '#B45309' },
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
                        
                        {/* Compact Confirmation Badge */}
                        <View
                          style={[
                            styles.confirmBadgePill,
                            isDropConfirmed ? styles.confirmBadgePillGreen : styles.confirmBadgePillAmber,
                          ]}
                        >
                          {isDropConfirmed ? (
                            <CheckCircle2 size={10} color="#166534" />
                          ) : (
                            <AlertTriangle size={10} color="#B45309" />
                          )}
                          <Text
                            style={[
                              styles.confirmBadgePillText,
                              isDropConfirmed ? { color: '#166534' } : { color: '#B45309' },
                            ]}
                          >
                            {isDropConfirmed
                              ? (language === 'th' ? 'ยืนยันแล้ว' : 'Confirmed')
                              : (language === 'th' ? 'ยังไม่ยืนยัน' : 'Unconfirmed')}
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
                      <Clock size={12} color={isDropConfirmed ? '#16A34A' : '#D97706'} />
                      <Text
                        style={[
                          styles.timeText,
                          !isDropConfirmed && { color: '#B45309', fontWeight: '700' },
                        ]}
                      >
                        {`0${9 + Math.floor(index * 0.8)}:${15 + (index * 25) % 40}`} น.{' '}
                        {isDropConfirmed
                          ? (language === 'th' ? '• เข้าพบแล้ว' : '• Visited')
                          : (language === 'th' ? '• ยังไม่ยืนยัน (แตะเพื่อยืนยัน)' : '• Tap to verify')}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Camera size={13} color="#1D4ED8" />
                        <Text style={styles.metaPillText}>
                          {Array.isArray(dropItem.photos) ? `${dropItem.photos.length} ${language === 'th' ? 'รูปถ่าย' : 'Photos'}` : (language === 'th' ? '2 รูปถ่าย' : '2 Photos')}
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
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>


      {/* Bottom Sticky Action Bar (Submit CTA) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitTripReport}
          activeOpacity={0.9}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.submitBtnText}>
            {params.isRevision
              ? (language === 'th' ? `ส่งรายงานแก้ไข (รอบที่ ${params.revisionCount || 1})` : `Resubmit Report (#${params.revisionCount || 1})`)
              : t('btn_submit')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen Slip / Photo Preview Modal */}
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
                  {previewImage?.title || 'ดูรูปสลิป'}
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
                onPress={() => {
                  if (editingOdoValue.trim()) {
                    setStartOdometer(editingOdoValue.trim());
                    Alert.alert(
                      language === 'th' ? 'บันทึกสำเร็จ ✓' : 'Saved ✓',
                      language === 'th'
                        ? `อัปเดตเลขไมล์เริ่มต้นเป็น ${editingOdoValue.trim()} กม. เรียบร้อยแล้ว`
                        : `Starting odometer updated to ${editingOdoValue.trim()} km.`
                    );
                  }
                  setIsEditStartOdoOpen(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.editOdoSaveBtnText}>{t('btn_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? 36 : 10,
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
    paddingBottom: 110,
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
});

