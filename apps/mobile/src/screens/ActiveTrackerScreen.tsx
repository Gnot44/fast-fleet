import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Battery from 'expo-battery';
import {
  ArrowLeft,
  Navigation,
  CheckCircle2,
  Edit3,
  AlertTriangle,
  BatteryCharging,
  Battery as BatteryIcon,
  Gauge,
  Clock,
  MapPin,
  ChevronRight,
  Package,
  Phone,
  Radio,
  Check,
  Zap,
  Flag,
  ExternalLink,
  Home,
  Calendar,
  Eye,
  Play,
  Plus,
} from 'lucide-react-native';
import {
  fetchRoadDirections,
  getLiveDeviceLocation,
  Coordinates,
  LEG_COLORS,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

const defaultInitialDrops: any[] = [];

export default function ActiveTrackerScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const tripId = params.tripId;
  const tripTitle = params.tripTitle || (language === 'th' ? 'เส้นทางเข้าพบลูกค้า' : 'Client Visit Route');
  const selectedVehicle = params.selectedVehicle || 'Isuzu D-Max SpaceCab (1กข-5555 กทม.)';
  // Remove license plate to keep badge compact
  const displayVehicleName = selectedVehicle.split('(')[0]?.trim() || selectedVehicle;
  const startLocation = params.startLocation || DEFAULT_BANGKOK_LOCATION;
  const startOdometer = params.startOdometer || '';

  // Exact drops array passed from previous screens
  const [drops, setDrops] = useState<any[]>(
    Array.isArray(params.drops) ? params.drops : []
  );
  const [currentDropIndex, setCurrentDropIndex] = useState<number>(
    typeof params.dropIndex === 'number' ? params.dropIndex : 0
  );

  // Real Hardware Battery State
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  // Telemetry Metrics
  const [speed, setSpeed] = useState(42);
  const [odometer, setOdometer] = useState(parseInt(startOdometer, 10) || 45228);
  const gpsAccuracy = language === 'th' ? '3 ม. (สูง)' : '3m (High)';

  // Driver Current Live Position & Address
  const [driverLocation, setDriverLocation] = useState({
    latitude: startLocation.latitude || 13.7563,
    longitude: startLocation.longitude || 100.5018,
    name: language === 'th' ? 'ตำแหน่งปัจจุบันของคุณ' : 'Your Live Location',
    address: startLocation.address || (language === 'th' ? 'ถนนสุขุมวิท เขตคลองเตย กรุงเทพมหานคร' : 'Sukhumvit Rd, Khlong Toei, Bangkok'),
  });

  const [roadPolyline, setRoadPolyline] = useState<Coordinates[]>([]);
  const [legDistance, setLegDistance] = useState('3.8 km');
  const [legDuration, setLegDuration] = useState(language === 'th' ? '14 นาที' : '14 mins');
  const [loadingRoad, setLoadingRoad] = useState(false);

  const mapRef = useRef<MapView | null>(null);

  // 1. Initialize Real Battery Level & Listeners
  useEffect(() => {
    async function setupBattery() {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level !== -1) {
          setBatteryLevel(Math.round(level * 100));
        }
        const state = await Battery.getBatteryStateAsync();
        setIsCharging(state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL);
      } catch (e) {
        console.warn('Battery API fallback:', e);
      }
    }
    setupBattery();

    // Fetch real device GPS
    async function initGps() {
      const loc = await getLiveDeviceLocation();
      setDriverLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        name: language === 'th' ? 'ตำแหน่งปัจจุบันของคุณ' : 'Your Live Location',
        address: loc.address,
      });
    }
    initGps();
  }, [language]);

  // Fallback: Fetch appointments from Supabase if drops array is empty but tripId exists
  useEffect(() => {
    async function fetchTripDropsFallback() {
      if (drops.length === 0 && tripId) {
        try {
          const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .eq('trip_id', tripId)
            .order('sequence_order', { ascending: true });

          const { data: dbExpenses } = await supabase
            .from('expenses')
            .select('*')
            .eq('trip_id', tripId);

          const reverseCatMap: Record<string, string> = {
            'toll': 'ค่าทางด่วน',
            'parking': 'ค่าที่จอดรถ',
            'fuel': 'ค่าน้ำมัน',
            'entertainment': 'ค่าอาหาร / เลี้ยงรับรอง',
            'other': 'อื่นๆ',
          };

          if (appts && appts.length > 0) {
            const mapped = appts.map((a: any) => {
              const apptExps = (dbExpenses || []).filter((e: any) => e.appointment_id === a.id);
              const mappedExps = apptExps.map((e: any) => ({
                id: e.id,
                category: reverseCatMap[e.category] || e.category,
                amount: String(e.amount),
                receiptUri: e.receipt_url || e.receipt_image_path,
                receiptName: e.title || (e.receipt_url ? 'Slip.jpg' : undefined),
                note: e.notes || '',
              }));

              return {
                id: a.id,
                appointmentId: a.id,
                name: a.company_name,
                recipient: a.recipient_name || a.customer_name || '',
                phone: a.recipient_phone || '',
                items: a.agenda || '',
                address: a.destination_address || '',
                latitude: a.destination_lat || undefined,
                longitude: a.destination_lng || undefined,
                isConfirmed: !!a.confirmation_status,
                isDataComplete: a.status === 'completed' || a.status === 'Completed',
                status: a.status || (a.confirmation_status ? 'incomplete' : 'pending'),
                meetingMinutes: a.meeting_notes || '',
                photos: a.client_photo_url ? [a.client_photo_url] : [],
                expenses: mappedExps,
              };
            });
            setDrops(mapped);
          }
        } catch (err) {
          console.warn('Error fetching fallback drops in ActiveTracker:', err);
        }
      }
    }
    fetchTripDropsFallback();
  }, [tripId, drops.length]);

  // Auto-redirect if trip is already submitted for approval or approved
  useEffect(() => {
    async function checkTripStatus() {
      if (!tripId) return;
      try {
        const { data: t } = await supabase
          .from('trips')
          .select('status, approval_status, title, start_location, start_odometer')
          .eq('id', tripId)
          .single();

        if (t?.approval_status === 'pending' || t?.approval_status === 'approved') {
          navigation.replace('TripSummary', {
            tripId: tripId,
            tripCode: params.tripCode,
            tripTitle: t.title || tripTitle,
            drops: drops,
            startLocation: t.start_location || startLocation,
            startOdometer: t.start_odometer?.toString() || startOdometer,
            isPendingReview: t.approval_status === 'pending',
            isApproved: t.approval_status === 'approved',
          });
        }
      } catch (err) {
        console.warn('Error checking trip status in ActiveTracker:', err);
      }
    }
    checkTripStatus();
  }, [tripId]);

  // 2. Sync route params when arriving from DropReporting or EditTripItinerary
  useEffect(() => {
    if (Array.isArray(route.params?.drops) && route.params.drops.length > 0) {
      setDrops(route.params.drops);
    }
  }, [route.params?.drops]);

  // Update active drop selection when drops array changes or route params specify a target
  useEffect(() => {
    if (Array.isArray(drops) && drops.length > 0) {
      const firstUnconfirmed = drops.findIndex((d) => !d.isConfirmed);

      if (typeof route.params?.dropIndex === 'number' && route.params.dropIndex >= 0 && route.params.dropIndex < drops.length) {
        // If route specified a target index and it's not confirmed, choose it; otherwise choose first unconfirmed
        if (!drops[route.params.dropIndex]?.isConfirmed) {
          setCurrentDropIndex(route.params.dropIndex);
        } else if (firstUnconfirmed !== -1) {
          setCurrentDropIndex(firstUnconfirmed);
        } else {
          setCurrentDropIndex(route.params.dropIndex);
        }
      } else {
        // If current index is out of bounds or already confirmed, auto-focus first unconfirmed drop
        if (currentDropIndex >= drops.length || drops[currentDropIndex]?.isConfirmed) {
          if (firstUnconfirmed !== -1) {
            setCurrentDropIndex(firstUnconfirmed);
          }
        }
      }
    }
  }, [drops, route.params?.dropIndex]);

  // Derive completed drops from real isConfirmed status
  const completedDropIndices = drops
    .map((d, idx) => (d.isConfirmed ? idx : -1))
    .filter((idx) => idx !== -1);
  const completedCount = completedDropIndices.length;
  const totalDropsCount = drops.length;
  const progressPercent = totalDropsCount > 0 ? Math.min(100, Math.round((completedCount / totalDropsCount) * 100)) : 0;
  const isAllCompleted = totalDropsCount > 0 && completedCount === totalDropsCount;

  // First uncompleted drop index according to sequential route plan
  const nextSequentialDropIndex = drops.findIndex((d) => !d.isConfirmed);

  // Resolved active drop
  const activeDrop = drops[Math.min(currentDropIndex, Math.max(0, drops.length - 1))] || drops[0] || {
    name: 'กำลังโหลดข้อมูลจุดส่ง...',
    address: 'กรุงเทพมหานคร',
  };

  // 3. Fetch Road Connection between Driver and Next Sequential Destination
  useEffect(() => {
    if (isAllCompleted || !activeDrop) return;

    async function loadLegPolyline() {
      setLoadingRoad(true);
      const origin: Coordinates = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      };
      const dest: Coordinates = {
        latitude: activeDrop.latitude || 13.7469,
        longitude: activeDrop.longitude || 100.5349,
      };

      const res = await fetchRoadDirections(origin, dest);
      setRoadPolyline(res.coordinates);
      setLegDistance(res.distanceKm);
      setLegDuration(res.durationText);
      setLoadingRoad(false);

      mapRef.current?.fitToCoordinates([origin, dest], {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }

    loadLegPolyline();
  }, [currentDropIndex, driverLocation.latitude, activeDrop?.latitude, isAllCompleted, drops]);

  // Open External Google Maps for Navigation
  const handleOpenGoogleMaps = () => {
    if (!activeDrop) return;
    const lat = activeDrop.latitude || 13.7469;
    const lng = activeDrop.longitude || 100.5349;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    const appUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}&mode=d`,
    });

    if (appUrl) {
      Linking.canOpenURL(appUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(appUrl);
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webUrl);
        });
    } else {
      Linking.openURL(webUrl);
    }
  };

  // 1-Tap Promote / Move Target Drop to be the immediate next uncompleted stop
  const handlePromoteDropToActive = async (targetIdx: number) => {
    if (nextSequentialDropIndex === -1 || targetIdx <= nextSequentialDropIndex) return;

    const targetItemName = drops[targetIdx]?.name || `จุดที่ #${targetIdx + 1}`;

    // Create reordered drops: take the target drop and place it right at nextSequentialDropIndex
    const updated = [...drops];
    const [promotedItem] = updated.splice(targetIdx, 1);
    updated.splice(nextSequentialDropIndex, 0, promotedItem);

    setDrops(updated);
    setCurrentDropIndex(nextSequentialDropIndex);

    // Sync sequence order to Supabase
    try {
      if (tripId) {
        for (let idx = 0; idx < updated.length; idx++) {
          const d = updated[idx];
          if (d.id || d.appointmentId) {
            await (supabase.from('appointments' as any) as any)
              .update({ sequence_order: idx + 1 })
              .eq('id', d.appointmentId || d.id);
          }
        }
      }
    } catch (err) {
      console.warn('Error syncing promoted drop sequence to Supabase:', err);
    }

    Alert.alert(
      language === 'th' ? '⚡ สลับลำดับคิวสำเร็จ' : '⚡ Stop Promoted',
      language === 'th'
        ? `ย้ายจุด "${targetItemName}" ขึ้นมาเป็นคิวถัดไปเรียบร้อยแล้ว คุณสามารถเดินทางและกดเช็คอินได้ทันที`
        : `Promoted "${targetItemName}" to the current active queue. You can now navigate and check in.`
    );
  };

  // Handle Check-in strictly following the planned route sequence
  const handleCheckInDrop = (targetIdx = currentDropIndex) => {
    // If attempting to check-in to a future drop while an earlier drop is not yet completed:
    if (nextSequentialDropIndex !== -1 && targetIdx > nextSequentialDropIndex) {
      Alert.alert(
        language === 'th' ? '⚠️ ต้องเข้าพบตามลำดับเส้นทาง' : '⚠️ Sequential Route Required',
        language === 'th'
          ? `คุณกำลังจะเช็คอินจุดที่ #${targetIdx + 1} (${drops[targetIdx]?.name}) ข้ามจุดที่ #${nextSequentialDropIndex + 1} (${drops[nextSequentialDropIndex]?.name}) ที่ยังไม่เสร็จสิ้น\n\nต้องการสลับจุดนี้ขึ้นมาทำก่อนทันทีหรือไม่?`
          : `You are attempting to check in to stop #${targetIdx + 1} before stop #${nextSequentialDropIndex + 1}.\n\nWould you like to promote this stop to the front of the queue?`,
        [
          {
            text: language === 'th' ? '⚡ สลับมาทำก่อนทันที' : '⚡ Promote to Front',
            onPress: () => handlePromoteDropToActive(targetIdx),
          },
          {
            text: language === 'th' ? `📍 ไปจุดที่ #${nextSequentialDropIndex + 1}` : `📍 Go to #${nextSequentialDropIndex + 1}`,
            onPress: () => setCurrentDropIndex(nextSequentialDropIndex),
          },
          { text: language === 'th' ? 'ยกเลิก' : 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const dropToReport = drops[targetIdx] || activeDrop;
    navigation.navigate('DropReporting', {
      tripId,
      tripTitle,
      selectedVehicle,
      drop: dropToReport,
      dropIndex: targetIdx,
      totalDrops: drops.length,
      drops,
    });
  };

  // Open Edit Itinerary to reorder or add drops
  const handleOpenEditItinerary = () => {
    navigation.navigate('EditTripItinerary', {
      tripId,
      drops,
      currentDropIndex: nextSequentialDropIndex !== -1 ? nextSequentialDropIndex : 0,
      startLocation,
      onUpdateDrops: (updated: any[]) => {
        setDrops(updated);
      },
    });
  };

  const handleEditDrop = (dropItem: any, idx: number) => {
    navigation.navigate('AddNewDrop', {
      drop: dropItem,
      isEditing: true,
      onEditDrop: (updated: any) => {
        setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, ...updated } : d)));
      },
    });
  };

  // Handle Finish Entire Trip
  const handleFinishTrip = () => {
    navigation.navigate('TripSummary', {
      tripId,
      totalDrops: drops.length,
      tripTitle,
      selectedVehicle,
      startLocation,
      startOdometer,
      drops,
    });
  };

  const activeLegColor = LEG_COLORS[currentDropIndex % LEG_COLORS.length];

  // Handle Back to Dashboard with Progress Persistence
  const handleBackToDashboard = async () => {
    try {
      if (tripId) {
        await supabase
          .from('trips')
          .update({
            status: 'in_progress',
            current_odometer: odometer ? parseFloat(odometer.toString()) : null,
          })
          .eq('id', tripId);
      }
    } catch (e) {
      console.warn('Error syncing in-progress trip state:', e);
    }

    Alert.alert(
      language === 'th' ? 'กลับสู่หน้าหลัก (Dashboard) 🏠' : 'Return to Dashboard 🏠',
      language === 'th'
        ? 'ต้องการกลับสู่หน้าหลักใช่หรือไม่? ระบบจะบันทึกสถานะและความคืบหน้าของทริปไว้ คุณสามารถกด "เข้าพบต่อ" เพื่อกลับมาทำงานต่อได้ตลอดเวลา'
        : 'Do you want to return to Dashboard? Your progress is saved and you can continue anytime.',
      [
        { text: language === 'th' ? 'อยู่หน้านี้ต่อ' : 'Stay on Tracker', style: 'cancel' },
        {
          text: language === 'th' ? '🏠 กลับหน้าหลัก' : '🏠 Go to Dashboard',
          onPress: () => {
            navigation.navigate('Dashboard');
          },
        },
      ]
    );
  };

  const isCurrentTargetDone = !!activeDrop?.isConfirmed;
  const isFutureDropViewing = !isCurrentTargetDone && nextSequentialDropIndex !== -1 && currentDropIndex > nextSequentialDropIndex;
  const isCurrentActiveDrop = !isCurrentTargetDone && currentDropIndex === nextSequentialDropIndex;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Quick Actions */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToDashboard}
            activeOpacity={0.8}
            accessibilityLabel="Back to Dashboard"
          >
            <ArrowLeft size={18} color="#03246B" />
          </TouchableOpacity>

          <View style={styles.routeHeaderPill}>
            <MapPin size={13} color="#1D4ED8" />
            <Text style={styles.routeHeaderTitle} numberOfLines={1}>
              {tripTitle}
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('TripSchedule')}
              activeOpacity={0.8}
              accessibilityLabel="Calendar"
            >
              <Calendar size={16} color="#03246B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Dashboard')}
              activeOpacity={0.8}
              accessibilityLabel="Home"
            >
              <Home size={16} color="#03246B" />
            </TouchableOpacity>

            <LanguageTogglePill />
          </View>
        </View>

        {/* Real Hardware Telemetry Status Bar */}
        <View style={styles.telemetryBar}>
          {/* Battery Status */}
          <View style={styles.telemetryItem}>
            {isCharging ? (
              <BatteryCharging size={16} color="#16A34A" />
            ) : (
              <BatteryIcon
                size={16}
                color={batteryLevel > 30 ? '#16A34A' : '#EF4444'}
              />
            )}
            <Text style={styles.telemetryValue}>{batteryLevel}%</Text>
            <Text style={styles.telemetrySub}>{isCharging ? t('tracker_telemetry_charging') : t('tracker_telemetry_battery')}</Text>
          </View>

          <View style={styles.telemetryDivider} />

          {/* GPS Signal */}
          <View style={styles.telemetryItem}>
            <Radio size={16} color="#1D4ED8" />
            <Text style={styles.telemetryValue}>GPS</Text>
            <Text style={styles.telemetrySub}>{gpsAccuracy}</Text>
          </View>

          <View style={styles.telemetryDivider} />

          {/* Odometer */}
          <View style={styles.telemetryItem}>
            <Clock size={16} color="#64748B" />
            <Text style={styles.telemetryValue}>{odometer}</Text>
            <Text style={styles.telemetrySub}>{t('tracker_telemetry_odometer')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Sequential Drop Progress Bar & Stepper */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <View>
              <Text style={styles.progressCardTitle}>{t('tracker_progress')}</Text>
              <Text style={styles.progressCardSub}>
                {t('tracker_visited_of')} {completedCount} / {totalDropsCount} ({progressPercent}%)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editRouteQuickBtn}
              onPress={handleOpenEditItinerary}
              activeOpacity={0.8}
            >
              <Edit3 size={13} color="#1D4ED8" />
              <Text style={styles.editRouteQuickBtnText}>{t('tracker_reorder_btn')}</Text>
            </TouchableOpacity>
          </View>

          {/* Continuous Progress Track */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isAllCompleted ? '#16A34A' : '#1D4ED8',
                },
              ]}
            />
          </View>

          {/* Sequential Stepper Drops Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepperScroll}
          >
            {drops.map((dropItem, idx) => {
              const isCompleted = !!dropItem.isConfirmed;
              const isActive = idx === currentDropIndex;
              const isFuture = !isCompleted && nextSequentialDropIndex !== -1 && idx > nextSequentialDropIndex;
              const isNextSequential = !isCompleted && idx === nextSequentialDropIndex;

              return (
                <TouchableOpacity
                  key={dropItem.id || idx}
                  style={[
                    styles.stepPill,
                    isCompleted && (isActive ? styles.stepPillCompletedActive : styles.stepPillCompleted),
                    !isCompleted && isActive && (isFuture ? styles.stepPillFutureActive : styles.stepPillActive),
                    !isCompleted && !isActive && (isNextSequential ? styles.stepPillNextPending : styles.stepPillPending),
                  ]}
                  onPress={() => setCurrentDropIndex(idx)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.stepIconCircle,
                      isCompleted && styles.stepIconCircleCompleted,
                      !isCompleted && isActive && (isFuture ? styles.stepIconCircleFuture : styles.stepIconCircleActive),
                      !isCompleted && !isActive && (isNextSequential ? styles.stepIconCircleNext : styles.stepIconCirclePending),
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={14} color="#FFFFFF" />
                    ) : isActive ? (
                      isFuture ? <Clock size={13} color="#FFFFFF" /> : <MapPin size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    )}
                  </View>

                  <View style={{ gap: 2 }}>
                    <Text
                      style={[
                        styles.stepPillTitle,
                        isCompleted
                          ? styles.stepPillTitleCompleted
                          : isActive
                          ? isFuture
                            ? styles.stepPillTitleFuture
                            : styles.stepPillTitleActive
                          : styles.stepPillTitlePending,
                      ]}
                      numberOfLines={1}
                    >
                      #{idx + 1} {dropItem.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {isCompleted ? (
                        <Text style={[styles.stepPillStatus, { color: '#166534' }]}>{language === 'th' ? '✓ เสร็จสิ้น' : '✓ Done'}</Text>
                      ) : isNextSequential ? (
                        <Text style={[styles.stepPillStatus, { color: '#1D4ED8' }]}>{isActive ? (language === 'th' ? '📍 จุดนี้' : '📍 Current') : (language === 'th' ? '▶️ ถัดไป' : '▶️ Next')}</Text>
                      ) : isFuture ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Eye size={11} color="#4F46E5" />
                          <Text style={[styles.stepPillStatus, { color: '#4F46E5' }]}>{language === 'th' ? 'ดูข้อมูล' : 'Preview'}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.stepPillStatus, { color: '#64748B' }]}>{language === 'th' ? '🕒 รอคิว' : '🕒 Queued'}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Target Destination Preview Card */}
        {(() => {
          const isTargetDone = isCurrentTargetDone;
          const targetThemeColor = isTargetDone ? '#16A34A' : isFutureDropViewing ? '#4F46E5' : '#1D4ED8';
          const targetLightBg = isTargetDone ? '#DCFCE7' : isFutureDropViewing ? '#EEF2FF' : '#EFF6FF';

          return (
            <View style={[styles.previewRouteCard, isFutureDropViewing && styles.previewRouteCardFuture]}>
              {/* Future Drop Info Banner */}
              {isFutureDropViewing && (
                <View style={styles.futureSimplePill}>
                  <Eye size={13} color="#4F46E5" />
                  <Text style={styles.futureSimplePillText} numberOfLines={1}>
                    {language === 'th'
                      ? `ดูข้อมูลล่วงหน้า (คิวปัจจุบัน: จุด #${nextSequentialDropIndex + 1})`
                      : `Previewing stop #${currentDropIndex + 1} (Current: #${nextSequentialDropIndex + 1})`}
                  </Text>
                </View>
              )}

              {/* Already Completed Drop Banner */}
              {isTargetDone && (
                <View style={styles.completedBanner}>
                  <CheckCircle2 size={15} color="#166534" />
                  <Text style={styles.completedBannerText} numberOfLines={1}>
                    {language === 'th'
                      ? `✓ จุดนี้เข้าพบเสร็จสิ้นแล้ว (#${currentDropIndex + 1})`
                      : `✓ Visited (#${currentDropIndex + 1})`}
                  </Text>
                </View>
              )}

              {/* Origin Live Position */}
              <View style={styles.previewRow}>
                <View style={[styles.previewDot, { backgroundColor: '#10B981', borderColor: '#DCFCE7' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewLabel}>{t('tracker_current_loc')}</Text>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {driverLocation.name}
                  </Text>
                  <Text style={styles.previewAddress} numberOfLines={1}>
                    {driverLocation.address}
                  </Text>
                </View>
              </View>

              {/* Connecting Route Arrow & Distance */}
              <View style={styles.previewConnectorRow}>
                <View style={styles.previewDottedLine} />
                <View style={[styles.previewDistancePill, { backgroundColor: targetLightBg }]}>
                  <Navigation size={12} color={targetThemeColor} />
                  <Text style={[styles.previewDistanceText, { color: targetThemeColor }]}>
                    ~{legDistance} • {legDuration}
                  </Text>
                </View>
              </View>

              {/* Target Destination Drop */}
              <View style={styles.previewRow}>
                <View style={[styles.previewDot, { backgroundColor: targetThemeColor, borderColor: targetLightBg }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.previewLabel, { color: targetThemeColor }]}>
                        {isTargetDone
                          ? `#${currentDropIndex + 1} • ${language === 'th' ? 'เสร็จสิ้น' : 'Done'}`
                          : isFutureDropViewing
                          ? `#${currentDropIndex + 1} • ${language === 'th' ? 'ดูล่วงหน้า' : 'Preview'}`
                          : `#${currentDropIndex + 1} • ${language === 'th' ? 'คิวปัจจุบัน' : 'Current'}`}
                      </Text>
                      {isTargetDone && (
                        <View style={styles.confirmedStatusPill}>
                          <CheckCircle2 size={11} color="#166534" />
                          <Text style={styles.confirmedStatusPillText}>{language === 'th' ? 'ยืนยันแล้ว' : 'Confirmed'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {activeDrop?.items && (
                        <View style={[styles.cargoBadge, { backgroundColor: targetLightBg }]}>
                          <Package size={11} color={targetThemeColor} />
                          <Text style={[styles.cargoBadgeText, { color: targetThemeColor }]} numberOfLines={1}>
                            {activeDrop.items.split('(')[0]?.trim()}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.quickEditDropBtn, { backgroundColor: targetLightBg, borderColor: isTargetDone ? '#86EFAC' : '#BFDBFE' }]}
                        onPress={() => handleEditDrop(activeDrop, currentDropIndex)}
                        activeOpacity={0.7}
                      >
                        <Edit3 size={11} color={targetThemeColor} />
                        <Text style={[styles.quickEditDropText, { color: targetThemeColor }]}>{t('btn_edit')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.previewName} numberOfLines={1}>{activeDrop?.name}</Text>
                  <Text style={styles.previewAddress} numberOfLines={1}>{activeDrop?.address}</Text>

                  {/* Google Maps External Navigation Button */}
                  <TouchableOpacity
                    style={styles.googleMapsNavBtn}
                    onPress={handleOpenGoogleMaps}
                    activeOpacity={0.85}
                  >
                    <View style={styles.googleMapsIconCircle}>
                      <MapPin size={14} color="#EA4335" />
                    </View>
                    <Text style={styles.googleMapsNavText}>{t('btn_open_maps')}</Text>
                    <ExternalLink size={14} color="#1E293B" />
                  </TouchableOpacity>

                  {/* Compact Recipient Contact Card */}
                  {activeDrop?.recipient && (
                    <View style={styles.compactContactRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={styles.compactContactIconCircle}>
                          <Phone size={10} color="#1D4ED8" />
                        </View>
                        <Text style={styles.compactContactText} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{activeDrop.recipient}</Text>
                          {activeDrop.phone ? ` • ${activeDrop.phone}` : ''}
                        </Text>
                      </View>
                      {activeDrop.phone && (
                        <TouchableOpacity
                          style={styles.compactCallBtn}
                          onPress={() => Linking.openURL(`tel:${activeDrop.phone}`)}
                          activeOpacity={0.7}
                        >
                          <Phone size={10} color="#FFFFFF" />
                          <Text style={styles.compactCallBtnText}>
                            {language === 'th' ? 'โทร' : 'Call'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })()}

        {/* 3. Bird's Eye Overview Google Map Preview */}
        <View style={styles.mapCard}>
          {Platform.OS === 'web' ? (
            <View style={styles.webMapFallback}>
              <Navigation size={32} color="#1D4ED8" />
              <Text style={styles.webMapText}>
                {language === 'th' ? 'แผนที่จำลองเส้นทาง' : 'Google Maps Live Preview'}
              </Text>
              <Text style={styles.webMapSub}>
                {driverLocation.name} ➔ {activeDrop?.name}
              </Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              showsUserLocation={true}
              initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
            >
              {/* Driver Live Marker */}
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title={t('tracker_current_loc')}
                description={driverLocation.address}
                pinColor="#10B981"
              />

              {/* Destination Drop Marker */}
              {!isAllCompleted && (
                <Marker
                  coordinate={{
                    latitude: activeDrop?.latitude || 13.7469,
                    longitude: activeDrop?.longitude || 100.5349,
                  }}
                  title={`${t('preview_client')} #${currentDropIndex + 1}: ${activeDrop?.name}`}
                  description={activeDrop?.address}
                  pinColor={activeLegColor}
                />
              )}

              {/* Road Polyline from Driver to Destination */}
              {roadPolyline.length > 0 && (
                <Polyline
                  coordinates={roadPolyline}
                  strokeColor={activeLegColor}
                  strokeWidth={6}
                />
              )}
            </MapView>
          )}

          {/* Floating Map Info Overlay */}
          <View style={styles.mapFloatingBadge}>
            <Navigation size={13} color="#1D4ED8" />
            <Text style={styles.mapFloatingBadgeText}>
              {isAllCompleted ? t('tracker_all_done') : `${t('tracker_status_going')}: ${activeDrop?.name}`}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* Sticky Bottom Actions */}
      {/* ========================================================================= */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        {isAllCompleted ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#93C5FD' }]}
              onPress={handleOpenEditItinerary}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#1D4ED8" />
              <Text style={[styles.primaryActionText, { color: '#1D4ED8' }]}>
                {language === 'th' ? '+ เพิ่มจุดเข้าพบ' : '+ Add Stop'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionButton, { flex: 1.3, backgroundColor: '#16A34A' }]}
              onPress={handleFinishTrip}
              activeOpacity={0.9}
            >
              <Flag size={17} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>
                {language === 'th' ? 'สรุปผลทริป 🏁' : 'Go to Summary 🏁'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : isCurrentTargetDone ? (
          /* 1. Viewing an already completed drop */
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#D97706' }]}
              onPress={() => handleCheckInDrop(currentDropIndex)}
              activeOpacity={0.9}
            >
              <Edit3 size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionText} numberOfLines={1}>
                {language === 'th' ? `✏️ แก้ไข (#${currentDropIndex + 1})` : `Edit (#${currentDropIndex + 1})`}
              </Text>
            </TouchableOpacity>
            {nextSequentialDropIndex !== -1 && (
              <TouchableOpacity
                style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#1D4ED8' }]}
                onPress={() => setCurrentDropIndex(nextSequentialDropIndex)}
                activeOpacity={0.9}
              >
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.primaryActionText} numberOfLines={1}>
                  {language === 'th' ? `▶️ ไปจุดที่ #${nextSequentialDropIndex + 1}` : `Go to #${nextSequentialDropIndex + 1}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isFutureDropViewing ? (
          /* 2. Viewing a future uncompleted drop: 1-click go to current sequential queue stop */
          <TouchableOpacity
            style={[styles.primaryActionButton, { backgroundColor: '#1D4ED8' }]}
            onPress={() => setCurrentDropIndex(nextSequentialDropIndex)}
            activeOpacity={0.9}
          >
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.primaryActionText} numberOfLines={1}>
              {language === 'th' ? `▶️ ไปจุดที่ #${nextSequentialDropIndex + 1}` : `Go to #${nextSequentialDropIndex + 1}`}
            </Text>
          </TouchableOpacity>
        ) : (
          /* 3. Standard sequential check-in for current planned stop */
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => handleCheckInDrop(currentDropIndex)}
            activeOpacity={0.9}
          >
            <CheckCircle2 size={18} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.primaryActionText} numberOfLines={1}>
              {language === 'th' ? `📍 เช็คอินจุดที่ #${currentDropIndex + 1}` : `Check-in (#${currentDropIndex + 1})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#F2F4F7',
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  routeHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flex: 1,
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  routeHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#03246B',
    flexShrink: 1,
  },
  telemetryBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#03246B',
  },
  telemetrySub: {
    fontSize: 9,
    color: '#747686',
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E3E6',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 130,
    gap: 14,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(224, 227, 230, 0.6)',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  progressCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editRouteQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editRouteQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1D4ED8',
    borderRadius: 4,
  },
  stepperScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    minWidth: 150,
  },
  stepPillCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  stepPillCompletedActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
    borderWidth: 2,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  stepPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
    borderWidth: 2,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  stepPillFutureActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
    borderWidth: 2,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  stepPillNextPending: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1.5,
  },
  stepPillPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stepIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconCircleCompleted: {
    backgroundColor: '#16A34A',
  },
  stepIconCircleActive: {
    backgroundColor: '#1D4ED8',
  },
  stepIconCircleFuture: {
    backgroundColor: '#4F46E5',
  },
  stepIconCircleNext: {
    backgroundColor: '#2563EB',
  },
  stepIconCirclePending: {
    backgroundColor: '#94A3B8',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepPillTitle: {
    fontSize: 12,
    maxWidth: 130,
  },
  stepPillTitleActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  stepPillTitleFuture: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  stepPillTitleCompleted: {
    color: '#166534',
    fontWeight: '800',
  },
  stepPillTitlePending: {
    color: '#475569',
    fontWeight: '700',
  },
  stepPillStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  previewRouteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(224, 227, 230, 0.6)',
  },
  previewRouteCardFuture: {
    borderColor: '#C7D2FE',
    borderWidth: 1.5,
  },
  futureSimplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  futureSimplePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    flex: 1,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completedBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    marginTop: 3,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#747686',
    letterSpacing: 0.6,
  },
  previewName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
    marginTop: 1,
  },
  previewAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  previewConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
    marginVertical: -2,
    gap: 12,
  },
  previewDottedLine: {
    width: 3,
    height: 32,
    backgroundColor: '#CBD5E1',
    borderRadius: 1.5,
  },
  previewDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  cargoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cargoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  quickEditDropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickEditDropText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  googleMapsNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleMapsIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMapsNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  compactContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  compactContactIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactContactText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  compactCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  compactCallBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  allDoneCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  allDoneIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },
  allDoneSubtitle: {
    fontSize: 13,
    color: '#15803D',
    textAlign: 'center',
  },
  mapCard: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E0E3E6',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    gap: 6,
  },
  webMapText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  webMapSub: {
    fontSize: 12,
    color: '#64748B',
  },
  mapFloatingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapFloatingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#03246B',
    flex: 1,
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
  primaryActionButton: {
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
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmedStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confirmedStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  inlineCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 6,
  },
  inlineCallBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  stopsTimelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stopsTimelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stopsTimelineTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  stopsTimelineSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  stopsTimelineList: {
    gap: 10,
  },
  stopTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  stopTimelineRowPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stopTimelineRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 2,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  stopTimelineRowDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
  },
  stopTimelineRowDoneActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
    borderWidth: 2,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  stopTimelineNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stopTimelineNumberText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stopTimelineName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
    flex: 1,
  },
  stopTimelineStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stopTimelineStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stopTimelineAddress: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  stopTimelineContact: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
    marginTop: 2,
  },
});
