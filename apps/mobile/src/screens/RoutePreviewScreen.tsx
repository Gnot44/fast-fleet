import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowLeft,
  Play,
  MapPin,
  Clock,
  Navigation,
  Share2,
  Layers,
  ChevronRight,
  Edit3,
  Gauge,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ShieldCheck,
  Users,
  Phone,
  Home,
} from 'lucide-react-native';
import {
  optimizeAndFetchRoadDirections,
  getLiveDeviceLocation,
  Coordinates,
  RouteLeg,
  LEG_COLORS,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

export default function RoutePreviewScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const tripTitle = params.tripTitle || 'Bangkok Central Express Route';
  const scheduledDate = params.scheduledDate || 'Today';
  const selectedVehicle = params.selectedVehicle || 'Isuzu D-Max (1กข-4452)';
  const isOverdue = !!params.isOverdue;
  const [tripDateKey, setTripDateKey] = useState<string>(params.rawDate || params.scheduledDate || '');

  // Start Location & Live GPS Confirmation state
  const isFromStartNow = scheduledDate === 'Now' || !!params.startOdometer;
  const initialStartLocation = params.startLocation || DEFAULT_BANGKOK_LOCATION;
  const [startLocation, setStartLocation] = useState(initialStartLocation);
  const [hasGpsConfirmed, setHasGpsConfirmed] = useState<boolean>(isFromStartNow || !!route.params?.isGpsConfirmed);
  const [isStarting, setIsStarting] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Starting Odometer state
  const initialOdo = params.startOdometer || params.odometer || '';
  const [startOdometer, setStartOdometer] = useState<string>(initialOdo);

  const tripId = params.tripId;
  const tripCode = params.tripCode;
  const initialDrops = Array.isArray(params.drops) ? params.drops : [];

  const [drops, setDrops] = useState<any[]>(initialDrops);
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [distanceText, setDistanceText] = useState('0.0 km');
  const [durationText, setDurationText] = useState('0m');
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Fallback: Load drops from Supabase if empty on mount but tripId exists
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
          console.warn('Error fetching fallback drops in RoutePreview:', err);
        }
      }
    }
    fetchTripDropsFallback();
  }, [tripId, drops.length]);

  // Fetch individual multi-colored road routing legs
  useEffect(() => {
    async function loadRoadRoute() {
      if (drops.length === 0) {
        setRouteLegs([]);
        setDistanceText('0.0 km');
        setDurationText('0m');
        setLoadingRoute(false);
        return;
      }
      setLoadingRoute(true);
      const origin: Coordinates = {
        latitude: startLocation.latitude || 13.7563,
        longitude: startLocation.longitude || 100.5018,
      };

      const res = await optimizeAndFetchRoadDirections(origin, drops);
      setRouteLegs(res.legs);
      setDistanceText(res.distanceKm);
      setDurationText(res.durationText);
      setLoadingRoute(false);
    }

    loadRoadRoute();
  }, [drops, startLocation]);

  // Fetch live GPS and enforce current position
  const handleFetchLiveGps = async (autoStartAfter: boolean = false) => {
    setFetchingGps(true);
    try {
      const loc = await getLiveDeviceLocation();
      const newStartLoc = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        name: language === 'th' ? 'พิกัด GPS ปัจจุบันของคุณ' : 'Your Live GPS Location',
        address: loc.address,
      };
      setStartLocation(newStartLoc);
      setHasGpsConfirmed(true);

      if (autoStartAfter && startOdometer.trim()) {
        navigation.navigate('ActiveTracker', {
          tripId,
          tripCode,
          tripTitle,
          selectedVehicle,
          startLocation: newStartLoc,
          startOdometer: startOdometer.trim(),
          drops,
          routeLegs,
        });
      } else {
        Alert.alert(
          language === 'th' ? 'ยืนยันพิกัด GPS สำเร็จ 📍' : 'GPS Location Confirmed 📍',
          language === 'th'
            ? `อัปเดตจุดเริ่มต้นเป็นพิกัดปัจจุบันเรียบร้อย:\n${loc.address}`
            : `Origin updated to your live GPS position:\n${loc.address}`
        );
      }
    } catch (err) {
      Alert.alert(
        language === 'th' ? 'ไม่สามารถดึงพิกัดได้' : 'Location Error',
        language === 'th' ? 'กรุณาเปิด GPS และอนุญาตการเข้าถึงตำแหน่งบนอุปกรณ์' : 'Please enable GPS permissions.'
      );
    } finally {
      setFetchingGps(false);
    }
  };

  const handleEditDrop = (drop: any, index: number) => {
    navigation.navigate('AddNewDrop', {
      drop,
      isEditing: true,
      onEditDrop: (updated: any) => {
        setDrops((prev: any[]) => prev.map((d, i) => (i === index ? { ...d, ...updated } : d)));
      },
    });
  };

  const proceedStartTrip = async (todayKey: string) => {
    setIsStarting(true);
    try {
      // If trip exists in DB, update date to today and status to in_progress
      if (tripId) {
        const { error } = await supabase
          .from('trips')
          .update({
            status: 'in_progress',
            trip_date: todayKey,
            started_at: new Date().toISOString(),
            start_odometer: parseInt(startOdometer.trim(), 10) || null,
          })
          .eq('id', tripId);
        if (error) console.warn('Error activating trip:', error);
      }

      // Both GPS & Odo confirmed -> Launch Tracker!
      navigation.navigate('ActiveTracker', {
        tripId,
        tripCode,
        tripTitle,
        selectedVehicle,
        startLocation,
        startOdometer: startOdometer.trim(),
        drops,
        routeLegs,
      });
    } finally {
      setIsStarting(false);
    }
  };

  // Enforce Both GPS Confirmation & Start Odometer before Starting Trip
  const handleStartTrip = async () => {
    if (isStarting) return;

    // 1. Enforce Current GPS Confirmation
    if (!hasGpsConfirmed) {
      Alert.alert(
        language === 'th' ? 'ต้องดึงพิกัด GPS ปัจจุบันก่อน 📍' : 'Live GPS Required 📍',
        language === 'th'
          ? 'กรุณากดปุ่ม "ดึงพิกัด GPS ปัจจุบัน" เพื่อยืนยันจุดปล่อยรถจริงก่อนออกเดินทาง'
          : 'Please fetch current live GPS location to confirm origin before starting.',
        [
          { text: language === 'th' ? 'ยกเลิก' : 'Cancel', style: 'cancel' },
          {
            text: language === 'th' ? '📍 ดึงพิกัด GPS ทันที' : '📍 Fetch GPS Now',
            onPress: () => handleFetchLiveGps(false),
          },
        ]
      );
      return;
    }

    // 2. Enforce Start Odometer
    if (!startOdometer.trim()) {
      Alert.alert(
        language === 'th' ? 'กรุณาระบุเลขไมล์เริ่มต้น ⚠️' : 'Start Odometer Required ⚠️',
        language === 'th'
          ? 'กรุณากรอกเลขไมล์เริ่มต้นของยานพาหนะก่อนออกเดินทาง เพื่อบันทึกระยะทางที่ถูกต้อง'
          : 'Please enter starting odometer before starting the route for accurate distance logging.'
      );
      return;
    }

    // 3. Date check: if trip is scheduled for a different day, ask confirmation
    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const targetDate = tripDateKey || params.rawDate || params.scheduledDate;

    const isNotToday = !!(
      targetDate &&
      targetDate !== todayYMD &&
      targetDate !== 'Today' &&
      targetDate !== 'วันนี้' &&
      targetDate !== 'Now' &&
      !targetDate.includes('วันนี้')
    );

    if (isNotToday) {
      let formattedDateText = targetDate;
      try {
        const d = new Date(targetDate);
        if (!isNaN(d.getTime())) {
          formattedDateText = d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        }
      } catch (e) {}

      Alert.alert(
        language === 'th' ? '📅 แจ้งเตือนวันนัดหมาย' : '📅 Scheduled Date Notice',
        language === 'th'
          ? `แผนงานนี้กำหนดไว้สำหรับวัน:\n👉 "${formattedDateText}"\n\nคุณต้องการเริ่มออกเดินทางล่วงหน้าในวันนี้ทันทีใช่หรือไม่?`
          : `This trip is scheduled for:\n👉 "${formattedDateText}"\n\nDo you want to start this route today ahead of schedule?`,
        [
          { text: language === 'th' ? 'ยังไม่เริ่ม (ยกเลิก)' : 'Cancel', style: 'cancel' },
          {
            text: language === 'th' ? '🚀 เริ่มเดินทางตอนนี้เลย' : '🚀 Start Trip Now',
            onPress: () => proceedStartTrip(todayYMD),
          },
        ]
      );
      return;
    }

    await proceedStartTrip(todayYMD);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#03246B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('preview_title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LanguageTogglePill />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.7}
          >
            <Home size={16} color="#03246B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Real Interactive Google Map with Multi-Colored Road Segments */}
        <View style={styles.mapCard}>
          {Platform.OS === 'web' ? (
            <View style={styles.webMapFallback}>
              <Navigation size={32} color="#1D4ED8" />
              <Text style={styles.webMapText}>Google Maps Road Navigation</Text>
              <Text style={styles.webMapSub}>{distanceText} • {durationText}</Text>
            </View>
          ) : (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={{
                latitude: startLocation.latitude || 13.735,
                longitude: startLocation.longitude || 100.54,
                latitudeDelta: 0.12,
                longitudeDelta: 0.12,
              }}
            >
              {/* Origin Start Marker (Point 1) */}
              <Marker
                coordinate={{
                  latitude: startLocation.latitude || 13.7563,
                  longitude: startLocation.longitude || 100.5018,
                }}
                title="1. Start: จุดเริ่มต้น"
                description={startLocation.address}
                pinColor="#10B981"
              />

              {/* Waypoint Destination Markers with Distinct Colors */}
              {drops.map((drop: any, index: number) => {
                const markerColor = LEG_COLORS[index % LEG_COLORS.length];
                return (
                  <Marker
                    key={drop.id || index}
                    coordinate={{
                      latitude: drop.latitude || 13.7225 + index * 0.02,
                      longitude: drop.longitude || 100.5283 + index * 0.03,
                    }}
                    title={`${index + 2}. ${drop.name}`}
                    description={drop.address}
                    pinColor={markerColor}
                  />
                );
              })}

              {/* Multi-Colored Road Polylines (Each Leg has a distinct vibrant color) */}
              {routeLegs.map((leg, lIdx) => (
                <Polyline
                  key={`leg-poly-${lIdx}`}
                  coordinates={leg.coordinates}
                  strokeColor={leg.color}
                  strokeWidth={6}
                />
              ))}
            </MapView>
          )}

          {/* AI Road Optimized Badge */}
          <View style={styles.mapBadge}>
            <Layers size={14} color="#1D4ED8" />
            <Text style={styles.mapBadgeText}>Multi-Color Road Segments</Text>
            {loadingRoute && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginLeft: 4 }} />}
          </View>
        </View>

        {/* Quick Route Summary Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('preview_distance')}</Text>
            <Text style={styles.metricValue}>{distanceText}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('preview_est_time')}</Text>
            <Text style={styles.metricValue}>{durationText}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('preview_clients_count')}</Text>
            <Text style={styles.metricValue}>{drops.length}</Text>
          </View>
        </View>

        {/* Trip Meta Card */}
        <View style={styles.metaCard}>
          <Text style={styles.tripTitleText}>{tripTitle}</Text>
          <Text style={styles.tripVehicleText}>
            {t('profile_vehicle')}: <Text style={{ fontWeight: '700', color: '#03246B' }}>{selectedVehicle}</Text> • {scheduledDate}
          </Text>
        </View>

        {/* Overdue Frozen Banner if trip is past date */}
        {isOverdue && (
          <View style={styles.overdueBannerCard}>
            <AlertTriangle size={18} color="#BE123C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueBannerTitle}>
                {language === 'th' ? '⚠️ แผนงานค้างจากวันที่ผ่านมา (ล็อคข้อมูล)' : '⚠️ Overdue Plan (Locked)'}
              </Text>
              <Text style={styles.overdueBannerSub}>
                {language === 'th'
                  ? 'ทริปนี้เลยกำหนดแล้ว จึงเปิดให้ดูรายละเอียดเส้นทางและจุดส่งเท่านั้น หากต้องการเข้าพบกรุณาสร้างแผนงานใหม่'
                  : 'This plan is from a past date and is locked for read-only inspection. Please create a new visit plan to visit today.'}
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* PRE-DEPARTURE MANDATORY VERIFICATION CARD (GPS & ODOMETER) */}
        {/* ========================================================================= */}
        {!isOverdue && (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <ShieldCheck size={20} color="#1D4ED8" />
              <Text style={styles.verificationHeaderTitle}>
                {language === 'th' ? 'การตรวจสอบก่อนออกเดินทาง (Pre-Departure)' : 'Pre-Departure Verification'}
              </Text>
            </View>

            {/* 1. Origin Live GPS Step */}
            <View style={[styles.verificationStepBox, hasGpsConfirmed ? styles.stepBoxDone : styles.stepBoxPending]}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepTitleLeft}>
                  <MapPin size={16} color={hasGpsConfirmed ? '#166534' : '#B45309'} />
                  <Text style={[styles.stepTitleText, { color: hasGpsConfirmed ? '#166534' : '#92400E' }]}>
                    {language === 'th' ? '1. พิกัดจุดเริ่มต้นจริง (Live GPS)' : '1. Origin Live GPS Location'}
                  </Text>
                </View>
                {hasGpsConfirmed ? (
                  <View style={styles.confirmedPill}>
                    <CheckCircle2 size={12} color="#166534" />
                    <Text style={styles.confirmedPillText}>
                      {language === 'th' ? 'พิกัดพร้อมแล้ว' : 'Confirmed'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.requiredPill}>
                    <AlertTriangle size={12} color="#B45309" />
                    <Text style={styles.requiredPillText}>
                      {language === 'th' ? 'ต้องดึง GPS ก่อน' : 'Required'}
                    </Text>
                  </View>
                )}
              </View>

            <Text style={styles.stepAddressText} numberOfLines={2}>
              {startLocation.name ? `${startLocation.name} — ` : ''}{startLocation.address}
            </Text>

            {/* Fetch Current Location Button */}
            <TouchableOpacity
              style={[styles.fetchGpsBtn, hasGpsConfirmed && styles.fetchGpsBtnRe]}
              onPress={() => handleFetchLiveGps(false)}
              disabled={fetchingGps}
              activeOpacity={0.85}
            >
              {fetchingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Compass size={16} color="#FFFFFF" />
              )}
              <Text style={styles.fetchGpsBtnText}>
                {fetchingGps
                  ? (language === 'th' ? 'กำลังดึงพิกัด GPS...' : 'Fetching Live GPS...')
                  : hasGpsConfirmed
                  ? (language === 'th' ? '🔄 อัปเดตพิกัด GPS อีกครั้ง' : '🔄 Refresh Live GPS')
                  : (language === 'th' ? '📍 ดึงพิกัด GPS ปัจจุบันทันที' : '📍 Fetch Current GPS Now')}
              </Text>
            </TouchableOpacity>
          </View>

            {/* 2. Start Odometer Step */}
            <View style={styles.verificationStepBox}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepTitleLeft}>
                  <Gauge size={16} color="#1D4ED8" />
                  <Text style={styles.stepTitleText}>
                    {language === 'th' ? '2. เลขไมล์เริ่มต้น (Start Odo)' : '2. Starting Odometer'}
                  </Text>
                </View>
                {startOdometer.trim().length > 0 ? (
                  <View style={styles.confirmedPill}>
                    <CheckCircle2 size={12} color="#166534" />
                    <Text style={styles.confirmedPillText}>
                      {language === 'th' ? 'ระบุแล้ว' : 'Ready'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.requiredPill}>
                    <AlertTriangle size={12} color="#B45309" />
                    <Text style={styles.requiredPillText}>
                      {language === 'th' ? 'รอกรอกไมล์' : 'Required'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.odoInputRow}>
                <TextInput
                  style={styles.odoTextInput}
                  placeholder={language === 'th' ? 'กรอกเลขไมล์ เช่น 45200' : 'e.g. 45200'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={startOdometer}
                  onChangeText={setStartOdometer}
                />
                <View style={styles.odoUnitBadge}>
                  <Text style={styles.odoUnitText}>{language === 'th' ? 'กม. (km)' : 'km'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Legs Color Legend Scroll Bar (ช่วงที่ 1, ช่วงที่ 2, ช่วงที่ 3) */}
        {routeLegs.length > 0 && (
          <View style={styles.legendContainer}>
            <Text style={styles.legendHeaderTitle}>เส้นทางแต่ละช่วง (Leg Colors):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendScroll}>
              {routeLegs.map((leg, idx) => (
                <View key={`leg-legend-${idx}`} style={styles.legendPill}>
                  <View style={[styles.legendColorDot, { backgroundColor: leg.color }]} />
                  <Text style={styles.legendPillText}>
                    ช่วงที่ {idx + 1}: {idx === 0 ? 'จุดเริ่มต้น' : `จุด ${idx + 1}`} ➔ จุด {idx + 2}
                  </Text>
                  <Text style={styles.legendDistText}>({leg.distanceText})</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stops Sequence Timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineCardHeaderRow}>
            <Text style={styles.timelineTitle}>{t('preview_sequence')}</Text>
            {tripId && !isOverdue && (
              <TouchableOpacity
                style={styles.editPlanQuickBtn}
                onPress={() => navigation.navigate('NewAppointment', { tripId })}
                activeOpacity={0.8}
              >
                <Edit3 size={13} color="#1D4ED8" />
                <Text style={styles.editPlanQuickBtnText}>
                  {language === 'th' ? 'แก้ไขแผนงาน / จุดส่ง' : 'Edit Plan'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.stopsTimeline}>
            {/* Origin Start */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineLeftCol}>
                <View style={[styles.timelineNode, { borderColor: '#10B981', backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.nodeNumberText, { color: '#10B981' }]}>1</Text>
                </View>
                {drops.length > 0 && (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: routeLegs[0]?.color || '#10B981' },
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.stopHeaderRow}>
                  <Text style={styles.stopTypeTag}>{t('preview_origin')}</Text>
                  <View style={[styles.legTag, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={[styles.legTagText, { color: '#166534' }]}>#1 Start</Text>
                  </View>
                </View>
                <Text style={styles.stopNameText}>{startLocation.name || 'จุดเริ่มต้น / Depot'}</Text>
                <Text style={styles.stopAddressText}>{startLocation.address}</Text>
              </View>
            </View>

            {/* Waypoints Destination Drops */}
            {drops.map((drop: any, index: number) => {
              const legColor = LEG_COLORS[index % LEG_COLORS.length];
              const isLast = index === drops.length - 1;

              return (
                <View key={drop.id || index} style={styles.timelineItem}>
                  <View style={styles.timelineLeftCol}>
                    <View style={[styles.timelineNode, { borderColor: legColor, backgroundColor: '#FFFFFF' }]}>
                      <Text style={[styles.nodeNumberText, { color: legColor }]}>{index + 2}</Text>
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: routeLegs[index + 1]?.color || legColor },
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.timelineContent}>
                    <View style={styles.stopHeaderRow}>
                      <Text style={styles.stopTypeTag}>
                        {t('preview_client')} #{index + 1}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.legTag, { backgroundColor: `${legColor}18` }]}>
                          <View style={[styles.legendColorDot, { backgroundColor: legColor, width: 8, height: 8 }]} />
                          <Text style={[styles.legTagText, { color: legColor }]}>
                            {routeLegs[index]?.distanceText || ''}
                          </Text>
                        </View>
                        {!isOverdue && (
                          <TouchableOpacity
                            style={styles.editDropBtn}
                            onPress={() => handleEditDrop(drop, index)}
                            activeOpacity={0.7}
                          >
                            <Edit3 size={11} color="#1D4ED8" />
                            <Text style={styles.editDropBtnText}>{t('btn_edit')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={styles.stopNameText}>{drop.name}</Text>
                    <Text style={styles.stopAddressText}>{drop.address}</Text>

                    {/* Recipient Contact & Direct Phone Call Button */}
                    {drop.recipient ? (
                      <View style={styles.recipientRow}>
                        <Users size={12} color="#64748B" />
                        <Text style={styles.recipientText} numberOfLines={1}>
                          {drop.recipient}
                        </Text>
                        {drop.phone ? (
                          <TouchableOpacity
                            style={styles.callPillBtn}
                            onPress={() => Linking.openURL(`tel:${drop.phone}`)}
                            activeOpacity={0.75}
                          >
                            <Phone size={10} color="#1D4ED8" />
                            <Text style={styles.callPillText}>{drop.phone}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    {drop.items && (
                      <Text style={styles.itemsBadge}>📌 {drop.items}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        {isOverdue ? (
          <TouchableOpacity
            style={styles.closeOverdueButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.closeOverdueButtonText}>
              {language === 'th' ? 'ปิดหน้ารายละเอียด' : 'Close Preview'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.startTripButton,
              !hasGpsConfirmed && styles.startTripButtonPending,
              isStarting && { opacity: 0.6 },
            ]}
            onPress={handleStartTrip}
            disabled={isStarting}
            activeOpacity={0.9}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
            )}
            <Text style={styles.startTripButtonText}>
              {isStarting
                ? (language === 'th' ? 'กำลังเริ่มการเดินทาง...' : 'Starting Route...')
                : hasGpsConfirmed
                ? t('btn_start_trip')
                : (language === 'th' ? 'ดึง GPS เพื่อเริ่มเดินทาง' : 'Fetch GPS & Start Route')}
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
    fontSize: 20,
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
  mapCard: {
    width: '100%',
    height: 260,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E0E3E6',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
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
  mapBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#03246B',
  },
  legendContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  legendHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#03246B',
  },
  legendScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  legendColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  legendDistText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#747686',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E0E3E6',
  },
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(224, 227, 230, 0.6)',
  },
  tripTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
  },
  tripVehicleText: {
    fontSize: 12,
    color: '#747686',
  },
  verificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  verificationHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#03246B',
  },
  verificationStepBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  stepBoxDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  stepBoxPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confirmedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  requiredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  requiredPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  stepAddressText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  fetchGpsBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  fetchGpsBtnRe: {
    backgroundColor: '#0F766E',
  },
  fetchGpsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  odoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  odoTextInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  odoUnitBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  odoUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  timelineCard: {
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
  timelineCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
  },
  editPlanQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editPlanQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  stopsTimeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 28,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nodeNumberText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timelineLine: {
    width: 3.5,
    height: 52,
    marginVertical: -2,
    borderRadius: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 22,
    gap: 3,
  },
  stopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#747686',
    letterSpacing: 0.8,
  },
  legTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  legTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stopNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  stopAddressText: {
    fontSize: 12,
    color: '#64748B',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  recipientText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    flexShrink: 1,
  },
  callPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  callPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  itemsBadge: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
    marginTop: 2,
  },
  editDropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editDropBtnText: {
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
    backgroundColor: 'rgba(242, 244, 247, 0.95)',
  },
  startTripButton: {
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
  startTripButtonPending: {
    backgroundColor: '#D97706',
    shadowColor: '#D97706',
  },
  startTripButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overdueBannerCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  overdueBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#BE123C',
    marginBottom: 4,
  },
  overdueBannerSub: {
    fontSize: 12,
    color: '#9F1239',
    lineHeight: 18,
    fontWeight: '500',
  },
  closeOverdueButton: {
    backgroundColor: '#64748B',
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  closeOverdueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
