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
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowLeft,
  Navigation,
  Gauge,
  MapPin,
  Trash2,
  Plus,
  Sparkles,
  Play,
  CheckCircle,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Clock,
  Edit2,
  Edit3,
  MoveUp,
  MoveDown,
  X,
  Compass,
  Search,
  CheckCircle2,
  Lock,
  Zap,
  Phone,
} from 'lucide-react-native';
import {
  getLiveDeviceLocation,
  reverseGeocodeGoogle,
  optimizeAndFetchRoadDirections,
  fetchPlacePredictions,
  fetchPlaceDetails,
  PlacePrediction,
  Coordinates,
  OptimizedStopDetail,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';

interface StopItem {
  id: string;
  name: string;
  address: string;
  recipient?: string;
  phone?: string;
  items?: string;
  latitude?: number;
  longitude?: number;
}

const initialStops: StopItem[] = [
  {
    id: 'stop-1',
    name: 'TechCorp HQ (Sathorn)',
    address: '120 Innovation Drive, Sathorn, Bangkok',
    recipient: 'Khun Thanawat (Procurement Lead)',
    phone: '+66 89 111 2233',
    items: 'นำเสนอโปรเจกต์ Enterprise ERP & โบรชัวร์',
    latitude: 13.7225,
    longitude: 100.5283,
  },
  {
    id: 'stop-2',
    name: 'Northside Retail Chain',
    address: '4500 Commerce Blvd, Pathum Wan, Bangkok',
    recipient: 'Khun Supaporn (Marketing Director)',
    phone: '+66 82 555 8899',
    items: 'ประชุมสรุปแผน Co-Marketing Q3 & Demo',
    latitude: 13.7469,
    longitude: 100.5349,
  },
];

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const TIME_SLOTS = [
  '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM',
  '10:30 AM', '11:00 AM', '01:00 PM', '01:30 PM', '02:00 PM', '03:00 PM', '04:30 PM'
];

export default function NewAppointmentScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const [tabMode, setTabMode] = useState<'startNow' | 'planLater'>('startNow');

  // Start Location State
  const [odometer, setOdometer] = useState('45200');
  const [startLocationCoord, setStartLocationCoord] = useState({
    latitude: DEFAULT_BANGKOK_LOCATION.latitude,
    longitude: DEFAULT_BANGKOK_LOCATION.longitude,
    name: DEFAULT_BANGKOK_LOCATION.name,
    address: DEFAULT_BANGKOK_LOCATION.address,
  });
  const [isStartSubmitted, setIsStartSubmitted] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Search & Map for Start Location
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [startPredictions, setStartPredictions] = useState<PlacePrediction[]>([]);
  const [searchingStart, setSearchingStart] = useState(false);
  const startMapRef = useRef<MapView | null>(null);
  const startSearchTimeout = useRef<any>(null);
  const isSelectingStartRef = useRef<boolean>(false);

  // Plan Later & Trip Info State
  const [tripName, setTripName] = useState('Q3 Commercial Client Visits');
  
  // Date & Time Picker Modal State
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('08:30 AM');
  const [calViewYear, setCalViewYear] = useState<number>(new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState<number>(new Date().getMonth());
  const [scheduledDisplay, setScheduledDisplay] = useState('Today • 08:30 AM');

  // Stops list
  const [stops, setStops] = useState<StopItem[]>(initialStops);

  // Optimized Route State & Modal
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRoadPolyline, setOptimizedRoadPolyline] = useState<Coordinates[]>([]);
  const [optimizedStopsOrder, setOptimizedStopsOrder] = useState<StopItem[]>([]);
  const [optimizedStopDetails, setOptimizedStopDetails] = useState<OptimizedStopDetail[]>([]);
  const [optimizedStats, setOptimizedStats] = useState({
    distanceText: '45.2 km',
    durationText: '2h 15m',
    savedMins: 25,
    reducedKm: '8.0',
  });

  // Auto fetch current live GPS on mount
  useEffect(() => {
    handleFetchCurrentGps(false);
  }, []);

  // Format scheduled display when date/time changes
  const updateScheduledDisplayText = (date: Date, time: string) => {
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow =
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();

    const day = date.getDate();
    const month = MONTH_NAMES_TH[date.getMonth()];
    const yearThai = date.getFullYear() + 543;

    if (isToday) {
      setScheduledDisplay(`วันนี้ (${day} ${month}) • ${time}`);
    } else if (isTomorrow) {
      setScheduledDisplay(`พรุ่งนี้ (${day} ${month}) • ${time}`);
    } else {
      setScheduledDisplay(`${day} ${month} ${yearThai} • ${time}`);
    }
  };

  // Fetch real current device GPS and animate map
  const handleFetchCurrentGps = async (showAlert = true) => {
    isSelectingStartRef.current = true;
    Keyboard.dismiss();
    setStartPredictions([]);
    setFetchingGps(true);

    const loc = await getLiveDeviceLocation((fastCoords) => {
      setStartLocationCoord((prev) => ({
        ...prev,
        latitude: fastCoords.latitude,
        longitude: fastCoords.longitude,
      }));
      startMapRef.current?.animateToRegion(
        {
          latitude: fastCoords.latitude,
          longitude: fastCoords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        400
      );
    });

    setStartLocationCoord({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      name: loc.name,
      address: loc.address,
    });
    setIsStartSubmitted(false);
    setFetchingGps(false);

    startMapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      500
    );

    if (showAlert) {
      Alert.alert('ดึงพิกัด GPS สำเร็จ', `พิกัดปัจจุบัน: ${loc.address}\n\nกรุณากดปุ่ม "ยืนยันจุดเริ่มต้น (Submit)" เพื่อบันทึกเข้าสู่แผนการเดินทาง`);
    }
  };

  // Google Places search for Start Location
  const handleStartQueryChange = (text: string) => {
    setStartSearchQuery(text);

    if (startSearchTimeout.current) {
      clearTimeout(startSearchTimeout.current);
    }

    if (isSelectingStartRef.current) {
      isSelectingStartRef.current = false;
      setStartPredictions([]);
      return;
    }

    if (text.trim().length < 2) {
      setStartPredictions([]);
      return;
    }

    startSearchTimeout.current = setTimeout(async () => {
      if (isSelectingStartRef.current) return;
      setSearchingStart(true);
      const results = await fetchPlacePredictions(text);
      if (!isSelectingStartRef.current) {
        setStartPredictions(results);
      }
      setSearchingStart(false);
    }, 280);
  };

  // Select place from Start autocomplete dropdown
  const handleSelectStartPrediction = async (prediction: PlacePrediction) => {
    isSelectingStartRef.current = true;
    if (startSearchTimeout.current) {
      clearTimeout(startSearchTimeout.current);
    }

    Keyboard.dismiss();
    setStartPredictions([]);
    setSearchingStart(false);
    setStartSearchQuery(prediction.main_text);

    setSearchingStart(true);
    const details = await fetchPlaceDetails(prediction.place_id);
    setSearchingStart(false);
    setStartPredictions([]);

    if (details) {
      setStartLocationCoord({
        latitude: details.coordinates.latitude,
        longitude: details.coordinates.longitude,
        name: details.name,
        address: details.formattedAddress || prediction.description,
      });
      setIsStartSubmitted(false);

      startMapRef.current?.animateToRegion(
        {
          latitude: details.coordinates.latitude,
          longitude: details.coordinates.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    } else {
      setStartLocationCoord((prev) => ({
        ...prev,
        name: prediction.main_text,
        address: prediction.description,
      }));
      setIsStartSubmitted(false);
    }
  };

  const handleStartMapPress = async (e: any) => {
    Keyboard.dismiss();
    setStartPredictions([]);
    const coord = e.nativeEvent.coordinate;
    const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
    setStartLocationCoord({
      latitude: coord.latitude,
      longitude: coord.longitude,
      name: geocode.name,
      address: geocode.address,
    });
    setIsStartSubmitted(false);
  };

  // Submit & Confirm Start Location
  const handleSubmitStartLocation = () => {
    Keyboard.dismiss();
    setStartPredictions([]);
    setIsStartSubmitted(true);
    Alert.alert(
      'ยืนยันจุดเริ่มต้นสำเร็จ',
      `กำหนดจุดเริ่มต้น: ${startLocationCoord.name} ถูกเพิ่มเข้าสู่ลำดับที่ 1 ของเส้นทางเรียบร้อยแล้ว`
    );
  };

  const handleAddStop = () => {
    navigation.navigate('AddNewDrop', {
      onAddDrop: (newDrop: StopItem) => {
        setStops((prev) => [...prev, newDrop]);
      },
    });
  };

  const handleEditStop = (stop: StopItem, index: number) => {
    navigation.navigate('AddNewDrop', {
      drop: stop,
      isEditing: true,
      onEditDrop: (updated: StopItem) => {
        setStops((prev) => prev.map((s, i) => (i === index ? { ...s, ...updated } : s)));
      },
    });
  };

  const handleRemoveStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  // Manual Reordering (Move Up / Move Down)
  const handleMoveStopUp = (index: number) => {
    if (index <= 0) return;
    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[index - 1];
    newStops[index - 1] = temp;
    setStops(newStops);
  };

  const handleMoveStopDown = (index: number) => {
    if (index >= stops.length - 1) return;
    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[index + 1];
    newStops[index + 1] = temp;
    setStops(newStops);
  };

  // Open Route Optimization Modal (AI Selects Best 1st Stop & Global Sequence)
  const handleOpenOptimize = async () => {
    if (!isStartSubmitted) {
      Alert.alert(
        'ยังไม่ได้ยืนยันจุดเริ่มต้น',
        'กรุณากดปุ่ม "ยืนยันจุดเริ่มต้น (Submit)" ก่อนทำการคำนวณและปรับแต่งเส้นทาง'
      );
      return;
    }

    if (stops.length < 1) {
      Alert.alert('Route Optimization', 'กรุณาเพิ่มจุดส่งปลายทางอย่างน้อย 1 จุด');
      return;
    }

    setOptimizing(true);

    const origin: Coordinates = {
      latitude: startLocationCoord.latitude,
      longitude: startLocationCoord.longitude,
    };

    // Calculate AI optimal sequence from origin to all stops
    const result = await optimizeAndFetchRoadDirections(origin, stops);

    // Reordered stops array
    const reorderedStops = result.orderedIndices.map((idx) => stops[idx]);

    setOptimizedStopsOrder(reorderedStops);
    setOptimizedStopDetails(result.stopDetails);
    setOptimizedRoadPolyline(result.coordinates);
    setOptimizedStats({
      distanceText: result.distanceKm,
      durationText: result.durationText,
      savedMins: result.realSavedMins,
      reducedKm: result.realReducedKm,
    });

    setOptimizing(false);
    setShowOptimizeModal(true);
  };

  const handleApplyOptimizedRoute = () => {
    if (optimizedStopsOrder.length > 0) {
      setStops(optimizedStopsOrder);
    }
    setShowOptimizeModal(false);
    const firstStopName = optimizedStopsOrder[0]?.name || 'จุดแรก';
    Alert.alert(
      'นำเส้นทางที่ AI แนะนำไปใช้แล้ว! 🎯',
      `ระบบได้ปรับลำดับให้ไปที่ "${firstStopName}" เป็นจุดแรกเพื่อความคุ้มค่าสูงสุด และลดระยะทางได้ ~${optimizedStats.reducedKm} km`
    );
  };

  const handleStartTracking = () => {
    // 1. Mandatory Live GPS Confirmation
    if (!isStartSubmitted) {
      Alert.alert(
        language === 'th' ? 'กรุณายืนยันพิกัดจุดเริ่มต้น 📍' : 'Confirm Start Location 📍',
        language === 'th'
          ? 'ต้องกดดึงพิกัด GPS ปัจจุบันและกดยืนยันจุดเริ่มต้นก่อนเริ่มเดินทาง'
          : 'Please fetch current GPS and confirm start location before starting.',
        [
          { text: language === 'th' ? 'ยกเลิก' : 'Cancel', style: 'cancel' },
          {
            text: language === 'th' ? '📍 ดึงพิกัด GPS ทันที' : '📍 Fetch GPS Now',
            onPress: () => handleFetchCurrentGps(true),
          },
        ]
      );
      return;
    }

    // 2. Mandatory Start Odometer Input
    if (!odometer || !odometer.trim()) {
      Alert.alert(
        language === 'th' ? 'กรุณาระบุเลขไมล์เริ่มต้น ⚠️' : 'Start Odometer Required ⚠️',
        language === 'th'
          ? 'กรุณากรอกเลขไมล์เริ่มต้นของยานพาหนะก่อนเริ่มออกเดินทาง เพื่อบันทึกระยะทางที่ถูกต้อง'
          : 'Please enter starting odometer before starting the route for accurate distance logging.'
      );
      return;
    }

    // 3. Minimum 1 Stop
    if (stops.length === 0) {
      Alert.alert(
        language === 'th' ? 'ยังไม่มีจุดส่งปลายทาง' : 'No Stops',
        language === 'th'
          ? 'กรุณาเพิ่มจุดส่งปลายทาง/ลูกค้าอย่างน้อย 1 จุดก่อนเริ่มการนำทาง'
          : 'Please add at least 1 destination stop before starting.'
      );
      return;
    }

    navigation.navigate('RoutePreview', {
      tripTitle: tripName || 'Bangkok Immediate Dispatch',
      scheduledDate: 'Now',
      selectedVehicle: 'Isuzu D-Max (1กข-4452)',
      startLocation: {
        ...startLocationCoord,
        isGpsConfirmed: true,
      },
      startOdometer: odometer.trim(),
      drops: stops,
      roadPolyline: optimizedRoadPolyline,
    });
  };

  const handleSaveTrip = () => {
    if (!isStartSubmitted) {
      Alert.alert(
        language === 'th' ? 'ยังไม่ได้ยืนยันจุดเริ่มต้น' : 'Start Location Pending',
        language === 'th'
          ? 'กรุณากดปุ่ม "ยืนยันพิกัดจุดเริ่มต้น" เพื่อกำหนดจุดปล่อยรถในแผนงาน'
          : 'Please tap "Confirm Start Location" to set the origin in your visit plan.'
      );
      return;
    }

    if (stops.length === 0) {
      Alert.alert(
        language === 'th' ? 'ยังไม่มีรายชื่อลูกค้า' : 'No Stops',
        language === 'th'
          ? 'กรุณาเพิ่มจุดส่งปลายทาง/ลูกค้าอย่างน้อย 1 จุดก่อนบันทึกแผนงาน'
          : 'Please add at least 1 client drop before saving.'
      );
      return;
    }

    Alert.alert(
      language === 'th' ? 'บันทึกแผนงานสำเร็จ 📅' : 'Visit Plan Saved 📅',
      language === 'th'
        ? `แผนงาน "${tripName}" ถูกบันทึกลงในตารางงาน (${scheduledDisplay}) เรียบร้อยแล้ว\n\n💡 ในวันเดินทางจริง ที่หน้า Route Preview สามารถกดดึง GPS ปัจจุบันเพื่อเปลี่ยนจุดเริ่มตามตำแหน่งจริง และระบุเลขไมล์เริ่มต้นก่อนออกเดินทางได้`
        : `Plan "${tripName}" has been saved to your schedule (${scheduledDisplay}).\n\n💡 On departure day, you can fetch live GPS in Route Preview to update origin and enter start odometer before departure.`,
      [
        {
          text: language === 'th' ? 'ดูตารางงาน (Schedule)' : 'View Schedule',
          onPress: () => navigation.navigate('TripSchedule'),
        },
        {
          text: language === 'th' ? 'ตกลง' : 'OK',
          style: 'default',
        }
      ]
    );
  };

  // Calendar Navigation
  const handlePrevMonth = () => {
    if (calViewMonth === 0) {
      setCalViewMonth(11);
      setCalViewYear((y) => y - 1);
    } else {
      setCalViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calViewMonth === 11) {
      setCalViewMonth(0);
      setCalViewYear((y) => y + 1);
    } else {
      setCalViewMonth((m) => m + 1);
    }
  };

  // Calendar Day Generation
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calViewYear, calViewMonth, 1).getDay();

  const calendarDays: Array<number | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const handleSelectDay = (day: number) => {
    const newDate = new Date(calViewYear, calViewMonth, day);
    setSelectedDate(newDate);
  };

  const handleConfirmDateTime = () => {
    updateScheduledDisplayText(selectedDate, selectedTimeSlot);
    setShowDateTimePicker(false);
  };

  const handleQuickPreset = (type: 'today' | 'tomorrow' | 'monday') => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'monday') {
      const day = d.getDay();
      const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
      d.setDate(diff);
    }
    setSelectedDate(d);
    setCalViewMonth(d.getMonth());
    setCalViewYear(d.getFullYear());
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#03246B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('plan_title')}</Text>
            <LanguageTogglePill />
          </View>

          {/* Segmented Switcher (Start Now vs Plan Later) */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                tabMode === 'startNow' && styles.segmentButtonActive,
              ]}
              onPress={() => setTabMode('startNow')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentText,
                  tabMode === 'startNow' && styles.segmentTextActive,
                ]}
              >
                {t('plan_mode_instant')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentButton,
                tabMode === 'planLater' && styles.segmentButtonActive,
              ]}
              onPress={() => setTabMode('planLater')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentText,
                  tabMode === 'planLater' && styles.segmentTextActive,
                ]}
              >
                {t('plan_mode_scheduled')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================================= */}
          {/* 1. Start Location Card with Live Map, Search & Submit Button (For Both Modes) */}
          {/* ========================================================================= */}
          <View style={[styles.card, isStartSubmitted && styles.cardConfirmed]}>
            <View style={styles.startHeaderRow}>
              <View style={[styles.gpsIconCircle, isStartSubmitted && { backgroundColor: '#DCFCE7' }]}>
                {fetchingGps ? (
                  <ActivityIndicator size="small" color="#1D4ED8" />
                ) : isStartSubmitted ? (
                  <CheckCircle2 size={22} color="#166534" />
                ) : (
                  <Navigation size={22} color="#1D4ED8" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  {isStartSubmitted ? (
                    <View style={styles.submittedPill}>
                      <Text style={styles.submittedPillText}>{t('plan_origin_confirmed')}</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>{t('plan_origin_pending')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gpsValue} numberOfLines={1}>
                  {startLocationCoord.name}
                </Text>
                <Text style={styles.gpsSubName} numberOfLines={1}>
                  {startLocationCoord.address}
                </Text>
              </View>

              {/* Instant Live GPS Button */}
              <TouchableOpacity
                style={styles.gpsFetchButton}
                onPress={() => handleFetchCurrentGps(true)}
                activeOpacity={0.8}
              >
                <Compass size={15} color="#FFFFFF" />
                <Text style={styles.gpsFetchButtonText}>{t('add_live_gps')}</Text>
              </TouchableOpacity>
            </View>

            {/* Interactive Map with Google Places Search Bar */}
            <View style={styles.startMapContainer}>
              {Platform.OS === 'web' ? (
                <View style={styles.webMapFallback}>
                  <MapPin size={32} color="#10B981" />
                  <Text style={styles.webMapText}>Start Location GPS Active</Text>
                  <Text style={styles.webMapSub}>{startLocationCoord.address}</Text>
                </View>
              ) : (
                <MapView
                  ref={startMapRef}
                  style={StyleSheet.absoluteFillObject}
                  provider={PROVIDER_GOOGLE}
                  showsUserLocation={true}
                  region={{
                    latitude: startLocationCoord.latitude,
                    longitude: startLocationCoord.longitude,
                    latitudeDelta: 0.008,
                    longitudeDelta: 0.008,
                  }}
                  onPress={handleStartMapPress}
                >
                  <Marker
                    coordinate={{
                      latitude: startLocationCoord.latitude,
                      longitude: startLocationCoord.longitude,
                    }}
                    title={startLocationCoord.name}
                    description={startLocationCoord.address}
                    draggable
                    onDragEnd={async (e) => {
                      const coord = e.nativeEvent.coordinate;
                      setStartLocationCoord((prev) => ({
                        ...prev,
                        latitude: coord.latitude,
                        longitude: coord.longitude,
                        address: language === 'th' ? 'กำลังระบุที่อยู่...' : 'Resolving address...',
                      }));
                      const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
                      setStartLocationCoord({
                        latitude: coord.latitude,
                        longitude: coord.longitude,
                        name: geocode.name,
                        address: geocode.address,
                      });
                    }}
                    pinColor="#10B981"
                  />
                </MapView>
              )}

              {/* Search Bar inside Start Map */}
              <View style={styles.startSearchWrapper}>
                <View style={styles.startSearchBar}>
                  <Search size={16} color="#747686" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.startSearchInput}
                    placeholder={t('add_search_placeholder')}
                    placeholderTextColor="#747686"
                    value={startSearchQuery}
                    onChangeText={handleStartQueryChange}
                    returnKeyType="search"
                  />
                  {searchingStart && (
                    <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />
                  )}
                  {startSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setStartSearchQuery('');
                        setStartPredictions([]);
                      }}
                    >
                      <X size={14} color="#747686" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Google Places Dropdown for Start Location */}
                {startPredictions.length > 0 && (
                  <View style={styles.startPredictionsDropdown}>
                    {startPredictions.map((item) => (
                      <TouchableOpacity
                        key={item.place_id}
                        style={styles.startPredictionItem}
                        onPress={() => handleSelectStartPrediction(item)}
                        activeOpacity={0.8}
                      >
                        <MapPin size={14} color="#10B981" style={{ marginTop: 2 }} />
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
            </View>

            {/* Confirm Location Button */}
            <TouchableOpacity
              style={[
                styles.submitStartLocationBtn,
                isStartSubmitted && styles.submitStartLocationBtnDone,
              ]}
              onPress={handleSubmitStartLocation}
              activeOpacity={0.85}
            >
              <CheckCircle2
                size={18}
                color={isStartSubmitted ? '#FFFFFF' : '#1D4ED8'}
              />
              <Text
                style={[
                  styles.submitStartLocationBtnText,
                  isStartSubmitted && styles.submitStartLocationBtnTextDone,
                ]}
              >
                {isStartSubmitted
                  ? (language === 'th' ? '✓ ยืนยันพิกัดจุดเริ่มต้นแล้ว' : '✓ Start Location Confirmed')
                  : (language === 'th' ? 'ยืนยันพิกัดจุดเริ่มต้น' : 'Confirm Start Location')}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Form Fields: Trip Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('plan_trip_name')}</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={
                    tabMode === 'startNow'
                      ? (language === 'th' ? 'เช่น ออกพบลูกค้าโซนสุขุมวิท' : 'e.g. Bangkok Central Client Visits')
                      : (language === 'th' ? 'เช่น เข้าพบลูกค้ารายใหญ่ Q3' : 'e.g., Enterprise Client Visits')
                  }
                  placeholderTextColor="#94A3B8"
                  value={tripName}
                  onChangeText={setTripName}
                />
                <Edit2 size={16} color="#94A3B8" />
              </View>
            </View>

            {tabMode === 'startNow' ? (
              /* Start Now: Start Odometer */
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('tracker_telemetry_odometer')}</Text>
                <View style={styles.inputWithIcon}>
                  <Gauge size={18} color="#747686" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 45200"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={odometer}
                    onChangeText={setOdometer}
                  />
                </View>
              </View>
            ) : (
              /* Plan Later: Date & Time Picker */
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('plan_date_time')}</Text>
                <TouchableOpacity
                  style={styles.datePickerTriggerBtn}
                  onPress={() => setShowDateTimePicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.datePickerTriggerLeft}>
                    <View style={styles.calendarIconCircle}>
                      <Calendar size={18} color="#1D4ED8" />
                    </View>
                    <View>
                      <Text style={styles.datePickerTriggerValue}>{scheduledDisplay}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2. Route Stops Section */}
          <View style={styles.stopsSection}>
            <View style={styles.stopsSectionHeader}>
              <Text style={styles.stopsSectionTitle}>
                {t('plan_clients_list')}{' '}
                <Text style={styles.stopsSectionCount}>
                  ({isStartSubmitted ? 1 + stops.length : stops.length})
                </Text>
              </Text>
            </View>

            <View style={styles.stopsList}>
              {/* Sequence #1: START LOCATION */}
              {isStartSubmitted ? (
                <View style={[styles.stopCard, styles.startStopCard]}>
                  <View style={styles.startBadgeCircle}>
                    <Text style={styles.startBadgeText}>START</Text>
                  </View>
                  <View style={styles.stopDetails}>
                    <Text style={[styles.stopName, { color: '#166534' }]} numberOfLines={1}>
                      1. {startLocationCoord.name}
                    </Text>
                    <Text style={styles.stopAddress} numberOfLines={1}>
                      {startLocationCoord.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editOriginBtn}
                    onPress={() => {
                      setIsStartSubmitted(false);
                      startMapRef.current?.animateToRegion(
                        {
                          latitude: startLocationCoord.latitude,
                          longitude: startLocationCoord.longitude,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008,
                        },
                        400
                      );
                    }}
                  >
                    <Edit2 size={15} color="#166534" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.unconfirmedStartWarning}>
                  <Lock size={15} color="#B45309" />
                  <Text style={styles.unconfirmedStartWarningText}>
                    1. {language === 'th' ? 'กรุณากดยืนยันพิกัดจุดเริ่มต้นด้านบน' : 'Please confirm starting location above'}
                  </Text>
                </View>
              )}

              {/* Destination Stops */}
              {stops.map((stop, index) => {
                const displaySeqNumber = isStartSubmitted ? index + 2 : index + 1;

                return (
                  <View key={stop.id || index} style={styles.stopCard}>
                    {/* Sequence Number */}
                    <View style={styles.stopSequenceBadge}>
                      <Text style={styles.stopSequenceText}>{displaySeqNumber}</Text>
                    </View>

                    {/* Stop Details */}
                    <View style={styles.stopDetails}>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {displaySeqNumber}. {stop.name}
                      </Text>
                      <Text style={styles.stopAddress} numberOfLines={1}>
                        {stop.address}
                      </Text>
                      {(stop.recipient || stop.phone || stop.items) && (
                        <View style={{ gap: 3, marginTop: 4 }}>
                          <View style={styles.stopContactRow}>
                            {stop.recipient && (
                              <Text style={styles.stopRecipientText} numberOfLines={1}>
                                👤 {stop.recipient}
                              </Text>
                            )}
                            {stop.phone && (
                              <View style={styles.stopPhonePill}>
                                <Phone size={10} color="#1D4ED8" />
                                <Text style={styles.stopPhonePillText}>{stop.phone}</Text>
                              </View>
                            )}
                          </View>
                          {stop.items && (
                            <Text style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '600' }} numberOfLines={1}>
                              📌 {t('preview_agenda_tag')}: {stop.items}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Manual Reorder Actions */}
                    <View style={styles.reorderCol}>
                      <TouchableOpacity
                        disabled={index === 0}
                        onPress={() => handleMoveStopUp(index)}
                        style={[styles.reorderBtn, index === 0 && { opacity: 0.25 }]}
                      >
                        <MoveUp size={14} color="#03246B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={index === stops.length - 1}
                        onPress={() => handleMoveStopDown(index)}
                        style={[styles.reorderBtn, index === stops.length - 1 && { opacity: 0.25 }]}
                      >
                        <MoveDown size={14} color="#03246B" />
                      </TouchableOpacity>
                    </View>

                    {/* Edit & Delete Stop Action Icons */}
                    <View style={styles.stopActionGroup}>
                      <TouchableOpacity
                        style={styles.editStopButton}
                        onPress={() => handleEditStop(stop, index)}
                        activeOpacity={0.7}
                      >
                        <Edit3 size={15} color="#1D4ED8" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteStopButton}
                        onPress={() => handleRemoveStop(stop.id)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Add Stop & Optimize Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.addStopButton}
                onPress={handleAddStop}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#1D4ED8" />
                <Text style={styles.addStopButtonText}>{t('btn_add_client')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optimizeButton,
                  !isStartSubmitted && { opacity: 0.6 },
                ]}
                onPress={handleOpenOptimize}
                activeOpacity={0.8}
                disabled={optimizing}
              >
                {optimizing ? (
                  <ActivityIndicator size="small" color="#795900" />
                ) : (
                  <>
                    <Sparkles size={16} color="#795900" />
                    <Text style={styles.optimizeButtonText}>{t('btn_reoptimize')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Action */}
        <View style={styles.bottomBar}>
          {tabMode === 'startNow' ? (
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                !isStartSubmitted && styles.primaryActionButtonDisabled,
              ]}
              onPress={handleStartTracking}
              activeOpacity={0.9}
            >
              {!isStartSubmitted ? (
                <Lock size={18} color="#FFFFFF" />
              ) : (
                <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
              )}
              <Text style={styles.primaryActionText}>
                {isStartSubmitted ? t('btn_start_trip') : (language === 'th' ? 'กดยืนยันจุดเริ่มต้นก่อน' : 'Confirm Start First')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                !isStartSubmitted && styles.primaryActionButtonDisabled,
              ]}
              onPress={handleSaveTrip}
              activeOpacity={0.9}
            >
              <CheckCircle size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.primaryActionText}>{t('btn_save')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ========================================================================= */}
      {/* Beautiful Date & Time Picker Modal */}
      {/* ========================================================================= */}
      <Modal
        visible={showDateTimePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDateTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '94%' }]}>
            <View style={styles.modalHandleBar}>
              <View style={styles.modalHandle} />
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowDateTimePicker(false)}
            >
              <X size={18} color="#434655" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
              <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 16 }}>
                {/* Header Title */}
                <View>
                  <Text style={styles.calModalTitle}>เลือกวันและเวลานัดหมาย 🗓️</Text>
                  <Text style={styles.calModalSubtitle}>กำหนดตารางการเดินทางล่วงหน้าอย่างแม่นยำ</Text>
                </View>

                {/* Quick Presets */}
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleQuickPreset('today')}
                  >
                    <Text style={styles.quickPresetChipText}>วันนี้</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleQuickPreset('tomorrow')}
                  >
                    <Text style={styles.quickPresetChipText}>พรุ่งนี้</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleQuickPreset('monday')}
                  >
                    <Text style={styles.quickPresetChipText}>จันทร์หน้า</Text>
                  </TouchableOpacity>
                </View>

                {/* Month & Year Navigation Header */}
                <View style={styles.monthNavRow}>
                  <TouchableOpacity style={styles.monthNavBtn} onPress={handlePrevMonth}>
                    <ChevronLeft size={20} color="#03246B" />
                  </TouchableOpacity>
                  <Text style={styles.monthNavTitle}>
                    {MONTH_NAMES_TH[calViewMonth]} {calViewYear + 543}
                  </Text>
                  <TouchableOpacity style={styles.monthNavBtn} onPress={handleNextMonth}>
                    <ChevronRight size={20} color="#03246B" />
                  </TouchableOpacity>
                </View>

                {/* Calendar Weekday Names */}
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((w, idx) => (
                    <Text
                      key={idx}
                      style={[styles.weekdayText, (idx === 0 || idx === 6) && { color: '#EF4444' }]}
                    >
                      {w}
                    </Text>
                  ))}
                </View>

                {/* Calendar Days Grid */}
                <View style={styles.daysGrid}>
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <View key={idx} style={styles.dayCellEmpty} />;
                    }

                    const isSelected =
                      selectedDate.getDate() === day &&
                      selectedDate.getMonth() === calViewMonth &&
                      selectedDate.getFullYear() === calViewYear;

                    const today = new Date();
                    const isToday =
                      today.getDate() === day &&
                      today.getMonth() === calViewMonth &&
                      today.getFullYear() === calViewYear;

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.dayCell,
                          isToday && styles.dayCellToday,
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() => handleSelectDay(day)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            isToday && styles.dayCellTextToday,
                            isSelected && styles.dayCellTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.divider} />

                {/* Time Slot Picker */}
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#1D4ED8" />
                    <Text style={styles.timeSectionTitle}>เลือกเวลาออกเดินทาง</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotsScroll}>
                    {TIME_SLOTS.map((slot, idx) => {
                      const isTimeSelected = selectedTimeSlot === slot;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.timeSlotPill, isTimeSelected && styles.timeSlotPillSelected]}
                          onPress={() => setSelectedTimeSlot(slot)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.timeSlotPillText, isTimeSelected && styles.timeSlotPillTextSelected]}>
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </ScrollView>

            {/* Sticky Modal Bottom Action */}
            <View style={styles.modalBottomActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDateTimePicker(false)}
              >
                <Text style={styles.modalCancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleConfirmDateTime}
                activeOpacity={0.9}
              >
                <Text style={styles.modalApplyBtnText}>ยืนยันวัน-เวลานัดหมาย</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* Optimized Route Map Preview Modal */}
      {/* ========================================================================= */}
      <Modal
        visible={showOptimizeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOptimizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleBar}>
              <View style={styles.modalHandle} />
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowOptimizeModal(false)}
            >
              <X size={18} color="#434655" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
              {/* Map Preview with Google Map & Real Road Polyline */}
              <View style={styles.modalMapWrapper}>
                {Platform.OS === 'web' ? (
                  <View style={styles.modalWebMap}>
                    <Sparkles size={32} color="#1D4ED8" />
                    <Text style={styles.modalMapTitle}>AI Road Route Calculated</Text>
                    <Text style={styles.modalMapSub}>{optimizedStats.distanceText} • {optimizedStats.durationText}</Text>
                  </View>
                ) : (
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    region={{
                      latitude: startLocationCoord.latitude,
                      longitude: startLocationCoord.longitude,
                      latitudeDelta: 0.12,
                      longitudeDelta: 0.12,
                    }}
                  >
                    {/* Origin Marker */}
                    <Marker
                      coordinate={{
                        latitude: startLocationCoord.latitude,
                        longitude: startLocationCoord.longitude,
                      }}
                      title="1. Start: จุดเริ่มต้น"
                      pinColor="#10B981"
                    />

                    {/* Drop Stop Markers in AI Optimal Order */}
                    {(optimizedStopsOrder.length > 0 ? optimizedStopsOrder : stops).map((drop, idx) => (
                      <Marker
                        key={drop.id || idx}
                        coordinate={{
                          latitude: drop.latitude || 13.7225 + idx * 0.02,
                          longitude: drop.longitude || 100.5283 + idx * 0.03,
                        }}
                        title={`${idx + 2}. ${drop.name}`}
                        description={drop.address}
                        pinColor={idx === 0 ? '#10B981' : '#1D4ED8'}
                      />
                    ))}

                    {/* Real Road Polyline */}
                    {optimizedRoadPolyline.length > 0 && (
                      <Polyline
                        coordinates={optimizedRoadPolyline}
                        strokeColor="#1D4ED8"
                        strokeWidth={5}
                      />
                    )}
                  </MapView>
                )}

                {/* Floating Badge */}
                <View style={styles.modalBadge}>
                  <Text style={{ fontSize: 14 }}>✨</Text>
                  <Text style={styles.modalBadgeText}>AI Selected Optimal Route!</Text>
                </View>
              </View>

              <View style={styles.modalContentInner}>
                {/* 1. Best 1st Stop Highlight Card */}
                {optimizedStopsOrder.length > 0 && (
                  <View style={styles.bestFirstStopCard}>
                    <View style={styles.bestFirstStopHeader}>
                      <Zap size={18} color="#D97706" />
                      <Text style={styles.bestFirstStopTitle}>AI แนะนำจุดที่ควรไปส่งเป็น "อันดับแรก":</Text>
                    </View>
                    <Text style={styles.bestFirstStopName}>
                      👉 จุดที่ 2: {optimizedStopsOrder[0].name}
                    </Text>
                    <Text style={styles.bestFirstStopReason}>
                      {optimizedStopDetails[0]?.reason || 'ใกล้จุดเริ่มต้นที่สุดและประหยัดเวลาเลี้ยววน'}
                    </Text>
                  </View>
                )}

                {/* 2. Real Optimization Stats */}
                <View style={styles.modalStatsRow}>
                  <View style={styles.modalStatPill}>
                    <Text style={{ fontSize: 13 }}>⏱️</Text>
                    <Text style={styles.modalStatPillText}>ประหยัดเวลา ~{optimizedStats.savedMins} นาที</Text>
                  </View>
                  <View style={styles.modalStatPill}>
                    <Text style={{ fontSize: 13 }}>🛣️</Text>
                    <Text style={styles.modalStatPillText}>ลดระยะทาง ~{optimizedStats.reducedKm} km</Text>
                  </View>
                </View>

                {/* 3. AI Recommended Sequence Timeline */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.modalSeqHeaderTitle}>ลำดับการเดินทางที่ AI จัดให้ (คุ้มค่าที่สุด):</Text>
                </View>

                <View style={styles.modalTimeline}>
                  {/* Origin */}
                  <View style={styles.modalTimelineItem}>
                    <View style={[styles.modalDot, { backgroundColor: '#10B981', borderColor: '#DCFCE7' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTimelineLabel}>START (จุดเริ่มต้น)</Text>
                      <Text style={styles.modalTimelineName}>1. {startLocationCoord.name}</Text>
                      <Text style={styles.modalTimelineSub}>{startLocationCoord.address}</Text>
                    </View>
                  </View>

                  {/* Stops in AI Recommended Order */}
                  {(optimizedStopsOrder.length > 0 ? optimizedStopsOrder : stops).map((stop, index) => {
                    const detail = optimizedStopDetails[index];

                    return (
                      <View key={stop.id || index} style={styles.modalTimelineItem}>
                        <View
                          style={[
                            styles.modalDot,
                            index === 0
                              ? { backgroundColor: '#16A34A', borderColor: '#DCFCE7' }
                              : { backgroundColor: '#1D4ED8', borderColor: '#DCE1FF' },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              style={[
                                styles.modalTimelineLabel,
                                index === 0 && { color: '#16A34A', fontWeight: '800' },
                              ]}
                            >
                              DROP {index + 1} {index === 0 ? '• (จุดแรกที่ควรไป)' : ''}
                            </Text>
                            {detail?.distanceFromPreviousKm && (
                              <View style={styles.distPill}>
                                <Text style={styles.distPillText}>+{detail.distanceFromPreviousKm}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.modalTimelineName}>
                            {index + 2}. {stop.name}
                          </Text>
                          <Text style={styles.modalTimelineSub}>{stop.address}</Text>
                          {detail?.reason ? (
                            <Text style={styles.modalReasonText}>{detail.reason}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Sticky Actions */}
            <View style={styles.modalBottomActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowOptimizeModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyOptimizedRoute}
                activeOpacity={0.9}
              >
                <Text style={styles.modalApplyBtnText}>Apply Route (จัดลำดับตามนี้)</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 12,
    backgroundColor: '#F2F4F7',
    gap: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E3E6',
    borderRadius: 30,
    padding: 3,
    maxWidth: 320,
    alignSelf: 'center',
    width: '100%',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#434655',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(224, 227, 230, 0.6)',
  },
  cardConfirmed: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  startHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCE1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.6,
  },
  submittedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  submittedPillText: {
    color: '#166534',
    fontSize: 9,
    fontWeight: '700',
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pendingPillText: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '700',
  },
  gpsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#03246B',
    marginTop: 1,
  },
  gpsSubName: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  gpsFetchButton: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  gpsFetchButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  startMapContainer: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0E3E6',
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  startSearchWrapper: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  startSearchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  startSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#191C1E',
    padding: 0,
  },
  startPredictionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 4,
    maxHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  startPredictionItem: {
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
    marginTop: 1,
  },
  submitStartLocationBtn: {
    backgroundColor: 'rgba(29, 78, 216, 0.08)',
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    borderRadius: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitStartLocationBtnDone: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  submitStartLocationBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  submitStartLocationBtnTextDone: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E3E6',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#03246B',
    paddingLeft: 4,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#E0E3E6',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#03246B',
  },
  datePickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  datePickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCE1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerTriggerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  datePickerTriggerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  stopsSection: {
    gap: 12,
  },
  stopsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stopsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#03246B',
  },
  stopsSectionCount: {
    fontSize: 13,
    fontWeight: '400',
    color: '#747686',
  },
  stopsList: {
    gap: 10,
  },
  startStopCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
  },
  startBadgeCircle: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  originTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  originTagText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  editOriginBtn: {
    padding: 8,
  },
  unconfirmedStartWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unconfirmedStartWarningText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(224, 227, 230, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  stopSequenceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCE1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSequenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  stopDetails: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  stopAddress: {
    fontSize: 12,
    color: '#747686',
    marginTop: 2,
  },
  reorderCol: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editStopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  deleteStopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  addStopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: 'rgba(29, 78, 216, 0.04)',
  },
  addStopButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  optimizeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFC32D',
    backgroundColor: 'rgba(255, 195, 45, 0.15)',
  },
  optimizeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#795900',
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
  primaryActionButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Calendar Modal Styles */
  calModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#03246B',
  },
  calModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickPresetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPresetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  monthNavTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#03246B',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  weekdayText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dayCellToday: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  dayCellSelected: {
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayCellTextToday: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timeSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  timeSlotsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  timeSlotPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeSlotPillSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  timeSlotPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeSlotPillTextSelected: {
    color: '#FFFFFF',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHandleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E0E3E6',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalMapWrapper: {
    height: 240,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  modalWebMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  modalMapTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  modalMapSub: {
    fontSize: 12,
    color: '#64748B',
  },
  modalBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  modalBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
  },
  modalContentInner: {
    padding: 20,
    gap: 16,
  },
  bestFirstStopCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  bestFirstStopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bestFirstStopTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  bestFirstStopName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78350F',
  },
  bestFirstStopReason: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  modalStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalStatPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  modalSeqHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
    marginTop: 4,
  },
  modalTimeline: {
    paddingLeft: 4,
    gap: 14,
  },
  modalTimelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    marginTop: 3,
  },
  modalTimelineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#747686',
    letterSpacing: 0.8,
  },
  modalTimelineName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
    marginTop: 1,
  },
  modalTimelineSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalReasonText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    marginTop: 3,
  },
  distPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  distPillText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  modalBottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E3E6',
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
  },
  modalApplyBtn: {
    flex: 1.4,
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stopContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  stopRecipientText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  stopPhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stopPhonePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  planLaterNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  planLaterNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
  },
});
