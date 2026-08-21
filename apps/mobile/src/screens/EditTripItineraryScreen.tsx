import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowLeft,
  MoveUp,
  MoveDown,
  Trash2,
  Edit3,
  Check,
  Plus,
  Sparkles,
  MapPin,
  AlertCircle,
  Package,
  Compass,
  Search,
  X,
  Crosshair,
  Building,
  RotateCw,
  CheckCircle2,
} from 'lucide-react-native';
import {
  solveOptimalStopOrder,
  getLiveDeviceLocation,
  reverseGeocodeGoogle,
  fetchPlacePredictions,
  fetchPlaceDetails,
  PlacePrediction,
  Coordinates,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

interface DropItem {
  id: string;
  name: string;
  address: string;
  recipient?: string;
  phone?: string;
  items?: string;
  latitude?: number;
  longitude?: number;
  isConfirmed?: boolean;
  meetingMinutes?: string;
  photos?: string[];
  expenses?: any[];
}

export default function EditTripItineraryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const initialDrops: DropItem[] = Array.isArray(params.drops) && params.drops.length > 0 ? params.drops : [];
  const currentDropIndex = typeof params.currentDropIndex === 'number' ? params.currentDropIndex : 0;
  const startLocation = params.startLocation || DEFAULT_BANGKOK_LOCATION;

  const [drops, setDrops] = useState<DropItem[]>(initialDrops);
  const [optimizing, setOptimizing] = useState(false);

  // AI Re-Optimize Modal State
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originType, setOriginType] = useState<'currentGps' | 'manualPin' | 'originalStart'>('currentGps');
  
  // Live GPS State
  const [currentGpsLocation, setCurrentGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  } | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Manual Pin State
  const [manualPinLocation, setManualPinLocation] = useState({
    latitude: startLocation.latitude || DEFAULT_BANGKOK_LOCATION.latitude,
    longitude: startLocation.longitude || DEFAULT_BANGKOK_LOCATION.longitude,
    name: startLocation.name || 'จุดปักหมุดเริ่มต้น',
    address: startLocation.address || 'กรุงเทพมหานคร',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const isSelectingRef = useRef<boolean>(false);

  // Manual Reordering
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const prevItem = drops[index - 1];
    if (prevItem?.isConfirmed || drops[index]?.isConfirmed) {
      Alert.alert('ไม่สามารถย้ายได้', 'ไม่สามารถย้ายสลับกับจุดที่ปิดงานเรียบร้อยแล้วได้');
      return;
    }
    const newDrops = [...drops];
    const temp = newDrops[index];
    newDrops[index] = newDrops[index - 1];
    newDrops[index - 1] = temp;
    setDrops(newDrops);
  };

  const handleMoveDown = (index: number) => {
    if (index >= drops.length - 1 || drops[index]?.isConfirmed) {
      Alert.alert('ไม่สามารถย้ายได้', 'ไม่สามารถย้ายจุดที่ปิดงานแล้วได้');
      return;
    }
    const nextItem = drops[index + 1];
    if (nextItem?.isConfirmed) {
      Alert.alert('ไม่สามารถย้ายได้', 'ไม่สามารถย้ายสลับกับจุดที่ปิดงานเรียบร้อยแล้วได้');
      return;
    }
    const newDrops = [...drops];
    const temp = newDrops[index];
    newDrops[index] = newDrops[index + 1];
    newDrops[index + 1] = temp;
    setDrops(newDrops);
  };

  // Add New Drop Mid-Trip
  const handleAddNewDrop = () => {
    navigation.navigate('AddNewDrop', {
      onAddDrop: (newDrop: DropItem) => {
        setDrops((prev) => [...prev, newDrop]);
        Alert.alert('เพิ่มลูกค้านัดหมายสำเร็จ', `เพิ่ม "${newDrop.name}" เข้าสู่แผนการเดินทางเรียบร้อยแล้ว`);
      },
    });
  };

  // Edit Existing Drop Mid-Trip
  const handleEditDrop = (drop: DropItem, index: number) => {
    navigation.navigate('AddNewDrop', {
      drop,
      isEditing: true,
      onEditDrop: (updatedDrop: DropItem) => {
        setDrops((prev) => prev.map((d, i) => (i === index ? { ...d, ...updatedDrop } : d)));
      },
    });
  };

  // Remove / Skip Stop
  const handleRemove = (index: number) => {
    if (index < currentDropIndex) {
      Alert.alert('ไม่สามารถลบได้', 'ลูกค้ารายนี้ได้รับการเข้าพบและบันทึกผลเรียบร้อยแล้ว');
      return;
    }

    Alert.alert('ยกเลิก / ข้ามการเข้าพบลูกค้ารายนี้', `คุณต้องการลบ "${drops[index]?.name}" ออกจากแผนใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบลูกค้านัดหมาย',
        style: 'destructive',
        onPress: () => {
          setDrops((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  // Fetch Live GPS
  const handleFetchLiveGps = async () => {
    setFetchingGps(true);
    try {
      const loc = await getLiveDeviceLocation((fastCoords) => {
        setCurrentGpsLocation({
          latitude: fastCoords.latitude,
          longitude: fastCoords.longitude,
          name: 'ตำแหน่งคนขับปัจจุบัน (GPS)',
          address: 'กำลังระบุที่อยู่ละเอียด...',
        });
      });

      setCurrentGpsLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        name: loc.name || 'ตำแหน่งปัจจุบันของคุณ',
        address: loc.address,
      });
    } catch (e) {
      console.warn('Live GPS fetch error:', e);
    } finally {
      setFetchingGps(false);
    }
  };

  // Open Re-Optimize Modal
  const handleOpenReOptimize = () => {
    const uncompleted = drops.filter((d) => !d.isConfirmed);

    if (uncompleted.length <= 1) {
      Alert.alert(
        language === 'th' ? 'AI จัดลำดับเส้นทาง' : 'Route Optimization',
        language === 'th'
          ? 'มีลูกค้านัดหมายที่ยังไม่เสร็จสิ้นเพียง 1 จุด ไม่จำเป็นต้องจัดลำดับใหม่'
          : 'Only 1 pending stop remaining. No reordering needed.'
      );
      return;
    }

    setShowOptimizeModal(true);

    if (!currentGpsLocation) {
      handleFetchLiveGps();
    }
  };

  // Manual Pin: Live Autocomplete search
  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      setPredictions([]);
      return;
    }

    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (isSelectingRef.current) return;
      setSearching(true);
      const results = await fetchPlacePredictions(text);
      if (!isSelectingRef.current) {
        setPredictions(results);
      }
      setSearching(false);
    }, 280);
  };

  // Manual Pin: Select place from dropdown
  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    isSelectingRef.current = true;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    Keyboard.dismiss();
    setPredictions([]);
    setSearching(false);
    setSearchQuery(prediction.main_text);

    setSearching(true);
    const details = await fetchPlaceDetails(prediction.place_id);
    setSearching(false);

    if (details) {
      setManualPinLocation({
        latitude: details.coordinates.latitude,
        longitude: details.coordinates.longitude,
        name: details.name,
        address: details.formattedAddress || prediction.description,
      });

      mapRef.current?.animateToRegion(
        {
          latitude: details.coordinates.latitude,
          longitude: details.coordinates.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        450
      );
    } else {
      setManualPinLocation((prev) => ({
        ...prev,
        name: prediction.main_text,
        address: prediction.description,
      }));
    }
  };

  // Manual Pin: Tap on Map
  const handleMapPress = async (e: any) => {
    Keyboard.dismiss();
    setPredictions([]);
    const coord = e.nativeEvent.coordinate;
    setManualPinLocation((prev) => ({
      ...prev,
      latitude: coord.latitude,
      longitude: coord.longitude,
      address: 'กำลังระบุที่อยู่...',
    }));

    const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
    setManualPinLocation({
      latitude: coord.latitude,
      longitude: coord.longitude,
      name: geocode.name,
      address: geocode.address,
    });
  };

  // Manual Pin: Snap to GPS
  const handleSnapPinToGps = async () => {
    setFetchingGps(true);
    const loc = await getLiveDeviceLocation();
    setManualPinLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      name: loc.name,
      address: loc.address,
    });
    setFetchingGps(false);
    mapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      450
    );
  };

  // Execute AI Re-Optimization
  const handleExecuteOptimization = async () => {
    const completed = drops.filter((d) => !!d.isConfirmed);
    const remaining = drops.filter((d) => !d.isConfirmed);

    if (remaining.length <= 1) {
      Alert.alert(
        language === 'th' ? 'AI จัดลำดับเส้นทาง' : 'Route Optimization',
        language === 'th'
          ? 'มีลูกค้านัดหมายที่ยังไม่เสร็จสิ้นเพียง 1 จุด ไม่จำเป็นต้องจัดลำดับใหม่'
          : 'Only 1 pending stop remaining. No reordering needed.'
      );
      setShowOptimizeModal(false);
      return;
    }

    setOptimizing(true);

    let originCoord: Coordinates;
    let originLabel = '';

    if (originType === 'currentGps') {
      let loc = currentGpsLocation;
      if (!loc) {
        try {
          const fetched = await getLiveDeviceLocation();
          loc = {
            latitude: fetched.coords.latitude,
            longitude: fetched.coords.longitude,
            name: fetched.name || 'ตำแหน่งปัจจุบันของคุณ',
            address: fetched.address,
          };
          setCurrentGpsLocation(loc);
        } catch (e) {
          console.warn('GPS fetch error in optimize:', e);
        }
      }
      originCoord = {
        latitude: loc?.latitude || startLocation.latitude || 13.7563,
        longitude: loc?.longitude || startLocation.longitude || 100.5018,
      };
      originLabel = loc?.name || (language === 'th' ? 'ตำแหน่ง GPS สดปัจจุบัน' : 'Current Live GPS');
    } else if (originType === 'manualPin') {
      originCoord = {
        latitude: manualPinLocation.latitude,
        longitude: manualPinLocation.longitude,
      };
      originLabel = manualPinLocation.name || (language === 'th' ? 'จุดปักหมุด Manual' : 'Manual Pin');
    } else {
      originCoord = {
        latitude: startLocation.latitude || 13.7563,
        longitude: startLocation.longitude || 100.5018,
      };
      originLabel = startLocation.name || (language === 'th' ? 'จุดเริ่มต้นเดิมของทริป' : 'Trip Start Location');
    }

    setTimeout(() => {
      const optimalRemainingIndices = solveOptimalStopOrder(originCoord, remaining);
      const reorderedRemaining = optimalRemainingIndices.map((idx) => remaining[idx]);

      const newDrops = [...completed, ...reorderedRemaining];
      setDrops(newDrops);
      setOptimizing(false);
      setShowOptimizeModal(false);

      const firstClientName = reorderedRemaining[0]?.name || (language === 'th' ? 'จุดแรก' : '1st Stop');
      Alert.alert(
        language === 'th' ? '✨ AI จัดลำดับใหม่สำเร็จ' : '✨ AI Optimization Completed',
        language === 'th'
          ? `จัดลำดับลูกค้านัดหมายที่เหลือ ${remaining.length} รายการให้สั้นที่สุด โดยคำนวณเริ่มจาก:\n"${originLabel}"\n\nจุดแรกที่แนะนำ: ${firstClientName}`
          : `Optimized sequence for ${remaining.length} remaining stops starting from:\n"${originLabel}"\n\nRecommended first stop: ${firstClientName}`
      );
    }, 450);
  };

  // Apply Changes & Go Back to Tracker
  const handleApplyChanges = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const tripId = params.tripId;

    try {
      if (tripId) {
        // Fetch existing appointments in Supabase
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('id')
          .eq('trip_id', tripId);

        const currentIds = (existingAppts || []).map((a: any) => a.id);
        const keptIds = drops.map((d) => d.id).filter(Boolean);
        const toDeleteIds = currentIds.filter((id: string) => !keptIds.includes(id));

        // 1. Delete removed appointments
        if (toDeleteIds.length > 0) {
          await supabase
            .from('appointments')
            .delete()
            .in('id', toDeleteIds);
        }

        // Get staff_id from trip or current user
        const { data: { user } } = await supabase.auth.getUser();
        const { data: tripRow } = await supabase.from('trips').select('staff_id').eq('id', tripId).single();
        const staffId = tripRow?.staff_id || user?.id || '42284d55-3997-4add-9226-dd9cf2f085df';

        // 2. Update sequence_order for remaining / newly added drops
        for (let idx = 0; idx < drops.length; idx++) {
          const d = drops[idx];
          const seq = idx + 1;

          if (d.id && currentIds.includes(d.id)) {
            await (supabase.from('appointments' as any) as any)
              .update({
                sequence_order: seq,
                company_name: d.name,
                customer_name: d.recipient || d.name,
                recipient_name: d.recipient || d.name,
                recipient_phone: d.phone || '',
                destination_address: d.address,
                destination_lat: d.latitude,
                destination_lng: d.longitude,
                agenda: d.items || 'เข้าพบและนำเสนอสินค้า',
              })
              .eq('id', d.id);
          } else {
            const { data: insertedAppt, error: insertErr } = await (supabase.from('appointments' as any) as any)
              .insert({
                trip_id: tripId,
                staff_id: staffId,
                type: 'appointment',
                sequence_order: seq,
                company_name: d.name,
                customer_name: d.recipient || d.name,
                recipient_name: d.recipient || d.name,
                recipient_phone: d.phone || '',
                destination_address: d.address,
                destination_lat: d.latitude || 13.7563,
                destination_lng: d.longitude || 100.5018,
                agenda: d.items || 'เข้าพบและนำเสนอสินค้า',
                status: 'pending',
                confirmation_status: false,
              })
              .select('id')
              .single();

            if (insertErr) {
              console.error('Error inserting new appointment to Supabase:', insertErr);
            }
            if (insertedAppt?.id) {
              d.id = insertedAppt.id;
              (d as any).appointmentId = insertedAppt.id;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error syncing reordered itinerary to Supabase:', err);
    } finally {
      setIsSaving(false);
    }

    if (route.params?.onUpdateDrops) {
      route.params.onUpdateDrops(drops);
    }

    Alert.alert(
      language === 'th' ? 'อัปเดตแผนการเดินทางสำเร็จ' : 'Itinerary Updated',
      language === 'th'
        ? 'ระบบได้ปรับเปลี่ยนลำดับการเข้าพบลูกค้าและซิงค์ข้อมูลกับ Live Map เรียบร้อยแล้ว'
        : 'The client visit sequence has been updated and synchronized with the Live Map.',
      [
        {
          text: language === 'th' ? 'กลับไปหน้าติดตามการเดินทาง' : 'Back to Tracker',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const remainingDropsCount = drops.filter((d) => !d.isConfirmed).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#03246B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_title')}</Text>
        <LanguageTogglePill />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.noticeBanner}>
          <AlertCircle size={18} color="#1D4ED8" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeText}>
              {t('edit_notice')}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row (Add Drop & Optimize) */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.addDropBtn}
            onPress={handleAddNewDrop}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addDropBtnText}>{t('btn_add_client')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reOptimizeBtn}
            onPress={handleOpenReOptimize}
            activeOpacity={0.85}
            disabled={optimizing}
          >
            {optimizing ? (
              <ActivityIndicator size="small" color="#795900" />
            ) : (
              <>
                <Sparkles size={16} color="#795900" />
                <Text style={styles.reOptimizeBtnText}>{t('btn_reoptimize')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Drops List */}
        <View style={styles.dropsListSection}>
          <Text style={styles.sectionHeaderTitle}>
            {t('plan_clients_list')} ({drops.length})
          </Text>

          <View style={styles.dropsList}>
            {drops.map((drop, index) => {
              const isCompleted = index < currentDropIndex;
              const isCurrent = index === currentDropIndex;
              const isPending = index > currentDropIndex;

              return (
                <View
                  key={drop.id || index}
                  style={[
                    styles.dropCard,
                    isCurrent && styles.dropCardCurrent,
                    isCompleted && styles.dropCardCompleted,
                  ]}
                >
                  {/* Sequence Badge */}
                  <View
                    style={[
                      styles.dropNumberCircle,
                      isCompleted && styles.dropNumberCircleCompleted,
                      isCurrent && styles.dropNumberCircleCurrent,
                      isPending && styles.dropNumberCirclePending,
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.dropNumberText}>{index + 1}</Text>
                    )}
                  </View>

                  {/* Drop Info */}
                  <View style={[styles.dropDetails, { flex: 1 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.dropName,
                          { flex: 1 },
                          isCompleted && { color: '#166534' },
                          isCurrent && { color: '#1D4ED8', fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        #{index + 1} {drop.name}
                      </Text>
                      {isCurrent && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>📍 {t('tracker_status_going')}</Text>
                        </View>
                      )}
                      {isCompleted && (
                        <View style={styles.donePill}>
                          <Text style={styles.donePillText}>✓ {t('tracker_status_done')}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.dropAddress} numberOfLines={1}>
                      {drop.address}
                    </Text>

                    {drop.items && (
                      <View style={styles.itemsRow}>
                        <Package size={12} color="#64748B" />
                        <Text style={styles.itemsText}>{drop.items}</Text>
                      </View>
                    )}
                  </View>

                  {/* Reorder Up/Down & Action Icons (Edit & Delete) */}
                  {!isCompleted && (
                    <View style={styles.reorderActionsCol}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          disabled={index <= currentDropIndex}
                          onPress={() => handleMoveUp(index)}
                          style={[
                            styles.reorderBtn,
                            index <= currentDropIndex && { opacity: 0.25 },
                          ]}
                        >
                          <MoveUp size={14} color="#03246B" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={index >= drops.length - 1}
                          onPress={() => handleMoveDown(index)}
                          style={[
                            styles.reorderBtn,
                            index >= drops.length - 1 && { opacity: 0.25 },
                          ]}
                        >
                          <MoveDown size={14} color="#03246B" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleEditDrop(drop, index)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={15} color="#1D4ED8" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleRemove(index)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Save CTA */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <TouchableOpacity
          style={[styles.applyButton, isSaving && { opacity: 0.6 }]}
          onPress={handleApplyChanges}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Check size={18} color="#FFFFFF" />
          )}
          <Text style={styles.applyButtonText}>
            {isSaving ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t('btn_apply')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* AI Re-Optimize Starting Point Configuration Modal */}
      {/* ========================================================================= */}
      <Modal
        visible={showOptimizeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOptimizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardAvoid}
          >
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={styles.sparkleIconCircle}>
                    <Sparkles size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{t('edit_modal_title')}</Text>
                    <Text style={styles.modalSubtitle} numberOfLines={1}>
                      {t('edit_modal_sub')} ({remainingDropsCount})
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowOptimizeModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Mode Selection Tabs (3 Options) */}
              <View style={styles.tabSelectorRow}>
                {/* 1. Live GPS */}
                <TouchableOpacity
                  style={[
                    styles.tabOptionBtn,
                    originType === 'currentGps' && styles.tabOptionBtnActive,
                  ]}
                  onPress={() => setOriginType('currentGps')}
                  activeOpacity={0.8}
                >
                  <Compass
                    size={15}
                    color={originType === 'currentGps' ? '#1D4ED8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.tabOptionText,
                      originType === 'currentGps' && styles.tabOptionTextActive,
                    ]}
                  >
                    {t('edit_opt_live_gps')}
                  </Text>
                </TouchableOpacity>

                {/* 2. Manual Pin */}
                <TouchableOpacity
                  style={[
                    styles.tabOptionBtn,
                    originType === 'manualPin' && styles.tabOptionBtnActive,
                  ]}
                  onPress={() => setOriginType('manualPin')}
                  activeOpacity={0.8}
                >
                  <MapPin
                    size={15}
                    color={originType === 'manualPin' ? '#1D4ED8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.tabOptionText,
                      originType === 'manualPin' && styles.tabOptionTextActive,
                    ]}
                  >
                    {t('edit_opt_manual')}
                  </Text>
                </TouchableOpacity>

                {/* 3. Original Trip Start */}
                <TouchableOpacity
                  style={[
                    styles.tabOptionBtn,
                    originType === 'originalStart' && styles.tabOptionBtnActive,
                  ]}
                  onPress={() => setOriginType('originalStart')}
                  activeOpacity={0.8}
                >
                  <Building
                    size={15}
                    color={originType === 'originalStart' ? '#1D4ED8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.tabOptionText,
                      originType === 'originalStart' && styles.tabOptionTextActive,
                    ]}
                  >
                    {t('edit_opt_original')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content Body */}
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBodyScrollInner}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* ----------------- MODE 1: LIVE GPS ----------------- */}
                {originType === 'currentGps' && (
                  <View style={styles.originCard}>
                    <View style={styles.originCardHeader}>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>Live GPS Location</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.refreshGpsBtn}
                        onPress={handleFetchLiveGps}
                        disabled={fetchingGps}
                        activeOpacity={0.7}
                      >
                        {fetchingGps ? (
                          <ActivityIndicator size="small" color="#1D4ED8" />
                        ) : (
                          <>
                            <RotateCw size={13} color="#1D4ED8" />
                            <Text style={styles.refreshGpsBtnText}>{t('add_live_gps')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.originInfoBox}>
                      <View style={styles.originIconCircle}>
                        <Compass size={22} color="#1D4ED8" />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.originNameText}>
                          {currentGpsLocation?.name || (language === 'th' ? 'พิกัดสดปัจจุบัน' : 'Current Live GPS')}
                        </Text>
                        <Text style={styles.originAddressText} numberOfLines={2}>
                          {currentGpsLocation?.address ||
                            (fetchingGps ? (language === 'th' ? 'กำลังระบุพิกัด...' : 'Locating GPS...') : t('tracker_current_loc'))}
                        </Text>
                        {currentGpsLocation?.latitude && (
                          <Text style={styles.originCoordText}>
                            Lat: {currentGpsLocation.latitude.toFixed(5)}, Lng: {currentGpsLocation.longitude.toFixed(5)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.infoHintBox}>
                      <Text style={styles.infoHintText}>
                        💡 {t('edit_gps_hint')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ----------------- MODE 2: MANUAL PIN & MAP ----------------- */}
                {originType === 'manualPin' && (
                  <View style={styles.manualPinSection}>
                    {/* Embedded Map */}
                    <View style={styles.mapContainer}>
                      {Platform.OS === 'web' ? (
                        <View style={styles.webMapFallback}>
                          <MapPin size={32} color="#1D4ED8" />
                          <Text style={styles.webMapText}>Interactive Map (Manual Pin)</Text>
                          <Text style={styles.webMapSub}>
                            Lat: {manualPinLocation.latitude.toFixed(4)}, Lng: {manualPinLocation.longitude.toFixed(4)}
                          </Text>
                        </View>
                      ) : (
                        <MapView
                          ref={mapRef}
                          style={styles.map}
                          provider={PROVIDER_GOOGLE}
                          showsUserLocation={true}
                          region={{
                            latitude: manualPinLocation.latitude,
                            longitude: manualPinLocation.longitude,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          }}
                          onPress={handleMapPress}
                        >
                          <Marker
                            coordinate={{
                              latitude: manualPinLocation.latitude,
                              longitude: manualPinLocation.longitude,
                            }}
                            title={manualPinLocation.name}
                            description={manualPinLocation.address}
                            draggable
                            onDragEnd={async (e) => {
                              const coord = e.nativeEvent.coordinate;
                              setManualPinLocation((prev) => ({
                                ...prev,
                                latitude: coord.latitude,
                                longitude: coord.longitude,
                                address: language === 'th' ? 'กำลังระบุที่อยู่...' : 'Resolving address...',
                              }));
                              const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
                              setManualPinLocation({
                                latitude: coord.latitude,
                                longitude: coord.longitude,
                                name: geocode.name,
                                address: geocode.address,
                              });
                            }}
                            pinColor="#1D4ED8"
                          />
                        </MapView>
                      )}

                      {/* Google Places Search Bar overlay */}
                      <View style={styles.searchSectionWrapper}>
                        <View style={styles.floatingSearchBar}>
                          <Search size={16} color="#747686" style={{ marginRight: 6 }} />
                          <TextInput
                            style={styles.searchInput}
                            placeholder={t('add_search_placeholder')}
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={handleSearchQueryChange}
                            returnKeyType="search"
                          />
                          {searching && (
                            <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />
                          )}
                          {searchQuery.length > 0 && (
                            <TouchableOpacity
                              onPress={() => {
                                setSearchQuery('');
                                setPredictions([]);
                              }}
                            >
                              <X size={15} color="#747686" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Autocomplete dropdown */}
                        {predictions.length > 0 && (
                          <View style={styles.predictionsDropdown}>
                            {predictions.map((item) => (
                              <TouchableOpacity
                                key={item.place_id}
                                style={styles.predictionItem}
                                onPress={() => handleSelectPrediction(item)}
                                activeOpacity={0.8}
                              >
                                <MapPin size={15} color="#1D4ED8" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.predMainText}>{item.main_text}</Text>
                                  {item.secondary_text ? (
                                    <Text style={styles.predSubText} numberOfLines={1}>
                                      {item.secondary_text}
                                    </Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Snap GPS button on Map */}
                      <TouchableOpacity
                        style={styles.snapGpsBtn}
                        onPress={handleSnapPinToGps}
                        activeOpacity={0.85}
                      >
                        <Crosshair size={16} color="#1D4ED8" />
                        <Text style={styles.snapGpsBtnText}>{t('edit_snap_gps_btn')}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Selected Pin Details Card */}
                    <View style={styles.originCard}>
                      <View style={styles.originInfoBox}>
                        <View style={[styles.originIconCircle, { backgroundColor: '#EFF6FF' }]}>
                          <MapPin size={22} color="#1D4ED8" />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.originNameText}>{manualPinLocation.name}</Text>
                          <Text style={styles.originAddressText} numberOfLines={2}>
                            {manualPinLocation.address}
                          </Text>
                          <Text style={styles.originCoordText}>
                            Lat: {manualPinLocation.latitude.toFixed(5)}, Lng: {manualPinLocation.longitude.toFixed(5)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.pinHintSmall}>
                        💡 {t('edit_manual_hint')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ----------------- MODE 3: ORIGINAL START ----------------- */}
                {originType === 'originalStart' && (
                  <View style={styles.originCard}>
                    <View style={styles.originInfoBox}>
                      <View style={[styles.originIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Building size={22} color="#03246B" />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.originNameText}>
                          {startLocation.name || t('preview_origin')}
                        </Text>
                        <Text style={styles.originAddressText} numberOfLines={2}>
                          {startLocation.address}
                        </Text>
                        {startLocation.latitude && (
                          <Text style={styles.originCoordText}>
                            Lat: {startLocation.latitude.toFixed(5)}, Lng: {startLocation.longitude.toFixed(5)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.infoHintBox}>
                      <Text style={styles.infoHintText}>
                        💡 {t('edit_original_hint')}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer CTA Buttons */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowOptimizeModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>{t('btn_cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleExecuteOptimization}
                  disabled={optimizing}
                  activeOpacity={0.9}
                >
                  {optimizing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Sparkles size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>
                        {t('btn_reoptimize')} ({remainingDropsCount})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#F2F4F7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#03246B',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 130,
    gap: 16,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 14,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  noticeText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addDropBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  addDropBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reOptimizeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 195, 45, 0.18)',
    borderWidth: 1,
    borderColor: '#FFC32D',
    paddingVertical: 14,
    borderRadius: 24,
  },
  reOptimizeBtnText: {
    color: '#795900',
    fontSize: 13,
    fontWeight: '700',
  },
  dropsListSection: {
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
  },
  dropsList: {
    gap: 10,
  },
  dropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(224, 227, 230, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  dropCardCurrent: {
    borderColor: '#1D4ED8',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
  },
  dropCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  dropNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropNumberCircleCompleted: {
    backgroundColor: '#16A34A',
  },
  dropNumberCircleCurrent: {
    backgroundColor: '#1D4ED8',
  },
  dropNumberCirclePending: {
    backgroundColor: '#94A3B8',
  },
  dropNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dropDetails: {
    flex: 1,
    gap: 2,
  },
  dropName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  dropAddress: {
    fontSize: 12,
    color: '#64748B',
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  activePill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activePillText: {
    color: '#1D4ED8',
    fontSize: 9,
    fontWeight: '700',
  },
  donePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  donePillText: {
    color: '#166534',
    fontSize: 9,
    fontWeight: '700',
  },
  reorderActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(242, 244, 247, 0.95)',
  },
  applyButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 36, 107, 0.45)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    width: '100%',
    maxHeight: '90%',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sparkleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#03246B',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginVertical: 14,
    gap: 4,
  },
  tabOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
  },
  tabOptionBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabOptionTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  modalBodyScroll: {
    maxHeight: 380,
  },
  modalBodyScrollInner: {
    gap: 12,
    paddingBottom: 10,
  },
  originCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  originCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  refreshGpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  originInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  originIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#03246B',
  },
  originAddressText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  originCoordText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  infoHintBox: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 12,
  },
  infoHintText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  manualPinSection: {
    gap: 12,
  },
  mapContainer: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E0E3E6',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    gap: 4,
  },
  webMapText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
  },
  webMapSub: {
    fontSize: 11,
    color: '#64748B',
  },
  searchSectionWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 40,
  },
  floatingSearchBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#191C1E',
    padding: 0,
  },
  predictionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 4,
    maxHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  predMainText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#03246B',
  },
  predSubText: {
    fontSize: 10,
    color: '#64748B',
  },
  snapGpsBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  snapGpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pinHintSmall: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
