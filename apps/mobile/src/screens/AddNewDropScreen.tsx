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
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { GOOGLE_MAPS_TILE_URL } from '../lib/mapConfig';
import {
  ArrowLeft,
  Search,
  MapPin,
  User,
  Building,
  Map,
  CheckCircle,
  X,
  Compass,
  Phone,
  Briefcase,
  FileText,
  Maximize2,
} from 'lucide-react-native';
import LocationPickerModal from '../components/LocationPickerModal';
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  PlacePrediction,
  getLiveDeviceLocation,
  reverseGeocodeGoogle,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';
import { useTripDraft, StopItem } from '../lib/TripDraftContext';
import { supabase } from '../lib/supabase';

export default function AddNewDropScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const {
    addStop,
    updateStop,
    addActiveTripDrop,
    updateActiveTripDrop,
    activeTripDrops,
    setActiveTripDrops,
  } = useTripDraft();
  const params = route?.params || {};
  const isEditing = !!params.isEditing;
  const initialDrop = isEditing ? (params.drop || {}) : {};

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rawInitCust = (
    initialDrop.customerName ||
    initialDrop.recipient ||
    initialDrop.customer_name ||
    initialDrop.recipient_name ||
    ''
  ).trim();
  const isDummyInitCust =
    !rawInitCust ||
    rawInitCust.toLowerCase() === 'client representative' ||
    rawInitCust === 'ลูกค้านัดหมาย' ||
    rawInitCust === 'จุดลูกค้า' ||
    rawInitCust === 'Client Visit';

  const [customerName, setCustomerName] = useState(isDummyInitCust ? '' : rawInitCust);
  const [phoneNumber, setPhoneNumber] = useState(initialDrop.phone || '');
  const [companyName, setCompanyName] = useState(
    initialDrop.companyName ||
    initialDrop.company_name ||
    (initialDrop.name !== rawInitCust && initialDrop.name !== initialDrop.address ? initialDrop.name : '') ||
    ''
  );
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // Visit Agenda State
  const defaultAgenda = initialDrop.items || '';
  const [meetingAgenda, setMeetingAgenda] = useState(defaultAgenda);
  const [selectedAgendaKey, setSelectedAgendaKey] = useState<string>('pitch');
  const [customAgendaText, setCustomAgendaText] = useState('');

  const [destinationAddress, setDestinationAddress] = useState(initialDrop.address || DEFAULT_BANGKOK_LOCATION.address);
  const [selectedCoord, setSelectedCoord] = useState({
    latitude: initialDrop.latitude || DEFAULT_BANGKOK_LOCATION.latitude,
    longitude: initialDrop.longitude || DEFAULT_BANGKOK_LOCATION.longitude,
  });
  const mapRef = useRef<MapView | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const isSelectingRef = useRef<boolean>(false);
  const dropGeocodeTimer = useRef<any>(null);
  const isInteractingDropMapRef = useRef(false);

  // Sync camera when selectedCoord changes programmatically (GPS, Search, or Modal)
  useEffect(() => {
    if (selectedCoord.latitude && selectedCoord.longitude && !isInteractingDropMapRef.current) {
      mapRef.current?.animateToRegion(
        {
          latitude: selectedCoord.latitude,
          longitude: selectedCoord.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        400
      );
    }
  }, [selectedCoord.latitude, selectedCoord.longitude]);

  const handleDropMapRegionChange = () => {
    isInteractingDropMapRef.current = true;
  };

  const handleDropMapRegionChangeComplete = (region: any) => {
    if (!region?.latitude || !region?.longitude) return;
    setSelectedCoord({
      latitude: region.latitude,
      longitude: region.longitude,
    });

    if (dropGeocodeTimer.current) clearTimeout(dropGeocodeTimer.current);
    dropGeocodeTimer.current = setTimeout(async () => {
      isInteractingDropMapRef.current = false;
      const geocode = await reverseGeocodeGoogle(region.latitude, region.longitude);
      setCompanyName(geocode.name);
      setDestinationAddress(geocode.address);
    }, 400);
  };

  // Sync state whenever route.params changes
  useEffect(() => {
    setIsSubmitting(false);
    const editing = !!route?.params?.isEditing;
    const d = editing ? (route?.params?.drop || {}) : {};
    setCustomerName(d.recipient || d.customerName || '');
    setPhoneNumber(d.phone || '');
    setCompanyName(d.name || d.companyName || '');
    setDestinationAddress(d.address || DEFAULT_BANGKOK_LOCATION.address);
    setSelectedCoord({
      latitude: d.latitude || DEFAULT_BANGKOK_LOCATION.latitude,
      longitude: d.longitude || DEFAULT_BANGKOK_LOCATION.longitude,
    });
    const agenda = d.items || '';
    setMeetingAgenda(agenda || (language === 'th' ? 'นำเสนอแผนงาน' : 'Product Demo'));
    if (agenda.includes('นำเสนอ') || agenda.toLowerCase().includes('pitch')) setSelectedAgendaKey('pitch');
    else if (agenda.includes('ต่อสัญญา') || agenda.toLowerCase().includes('renewal')) setSelectedAgendaKey('renewal');
    else if (agenda.includes('ตรวจระบบ') || agenda.toLowerCase().includes('health')) setSelectedAgendaKey('healthcheck');
    else if (agenda.includes('แนะนำสินค้า') || agenda.toLowerCase().includes('demo')) setSelectedAgendaKey('demo');
    else if (agenda.startsWith('อื่นๆ') || agenda.toLowerCase().startsWith('other')) setSelectedAgendaKey('other');
    else setSelectedAgendaKey('pitch');
    setCustomAgendaText(agenda.startsWith('อื่นๆ:') ? agenda.replace('อื่นๆ:', '').trim() : '');
    setSearchQuery('');
    setPredictions([]);
  }, [route?.params?.drop, route?.params?.isEditing, route?.params?.timestamp]);

  // Fast live GPS fetch
  const handleUseCurrentLocation = async () => {
    isSelectingRef.current = true;
    Keyboard.dismiss();
    setPredictions([]);
    setFetchingGps(true);

    const loc = await getLiveDeviceLocation((fastCoords) => {
      setSelectedCoord(fastCoords);
      mapRef.current?.animateToRegion(
        {
          latitude: fastCoords.latitude,
          longitude: fastCoords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        400
      );
    });

    setSelectedCoord(loc.coords);
    setCompanyName(loc.name);
    setDestinationAddress(loc.address);
    setFetchingGps(false);

    mapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      400
    );
  };

  // Live autocomplete search as user types
  const handleQueryChange = (text: string) => {
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
      setPredictions(results);
      setSearching(false);
    }, 300);
  };

  // Select place from autocomplete dropdown
  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    isSelectingRef.current = true;
    setSearchQuery('');
    setPredictions([]);
    Keyboard.dismiss();

    if (prediction.latitude && prediction.longitude) {
      setCompanyName(prediction.main_text);
      setDestinationAddress(prediction.description);
      setSelectedCoord({
        latitude: prediction.latitude,
        longitude: prediction.longitude,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: prediction.latitude,
          longitude: prediction.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
      return;
    }

    const details = await fetchPlaceDetails(prediction.place_id);
    if (details) {
      setCompanyName(details.name || prediction.main_text);
      setDestinationAddress(details.formattedAddress || prediction.description);
      setSelectedCoord(details.coordinates);

      mapRef.current?.animateToRegion(
        {
          latitude: details.coordinates.latitude,
          longitude: details.coordinates.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    } else {
      setCompanyName(prediction.main_text);
      setDestinationAddress(prediction.description);
    }
  };

  // Tap on map to pick location
  const handleMapPress = async (e: any) => {
    Keyboard.dismiss();
    setPredictions([]);
    const coord = e.nativeEvent?.coordinate;
    if (!coord) return;
    setSelectedCoord(coord);

    mapRef.current?.animateToRegion(
      {
        latitude: coord.latitude,
        longitude: coord.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      300
    );

    const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
    setCompanyName(geocode.name);
    setDestinationAddress(geocode.address);
  };

  const handleConfirmPickerLocation = (loc: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  }) => {
    isInteractingDropMapRef.current = false;
    setSelectedCoord({ latitude: loc.latitude, longitude: loc.longitude });
    setCompanyName(loc.name);
    setDestinationAddress(loc.address);
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        400
      );
    }, 300);
  };

  const handleConfirm = async () => {
    if (!customerName && !companyName && !destinationAddress) {
      Alert.alert(
        language === 'th' ? 'กรุณากรอกข้อมูล' : 'Information Required',
        language === 'th' ? 'กรุณาระบุชื่อผู้ติดต่อ หรือชื่อบริษัท และสถานที่นัดหมาย' : 'Please provide contact name or company name'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const targetScreen = route?.params?.returnScreen || params.returnScreen || 'NewAppointment';
      const isEditingMode = !!(route?.params?.isEditing ?? params.isEditing);
      const activeDropData = isEditingMode ? (route?.params?.drop || params.drop || {}) : {};
      const tripId = route?.params?.tripId || params.tripId;
      let dropId = (isEditingMode && activeDropData.id)
        ? activeDropData.id
        : `drop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const cleanCustomer = customerName.trim();
      const cleanCompany = companyName.trim();
      const cleanAddress = (destinationAddress || 'Bangkok Central Area').trim();

      // Resolved display name: Customer Name if provided, else destination address, else company
      const resolvedDisplayName = cleanCustomer || cleanAddress || cleanCompany || (language === 'th' ? 'สถานที่นัดหมาย' : 'Client Stop');

      // 1. If tripId exists and caller is not a staging screen, persist directly to Supabase
      if (tripId && targetScreen !== 'EditTripItinerary') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: tripRow } = await (supabase.from('trips' as any) as any)
            .select('staff_id')
            .eq('id', tripId)
            .single();
          const staffId = tripRow?.staff_id || user?.id || '42284d55-3997-4add-9226-dd9cf2f085df';

          const resolvedCompanyName = cleanCompany || cleanCustomer || cleanAddress || (language === 'th' ? 'สถานที่นัดหมาย' : 'Client Stop');
          const resolvedCustomerName = cleanCustomer || cleanCompany || cleanAddress || (language === 'th' ? 'ลูกค้านัดหมาย' : 'Client Visit');

          if (isEditingMode && activeDropData.id && !String(activeDropData.id).startsWith('drop_')) {
            // Update existing appointment in Supabase
            await (supabase.from('appointments' as any) as any)
              .update({
                company_name: resolvedCompanyName,
                customer_name: resolvedCustomerName,
                recipient_name: cleanCustomer || resolvedCustomerName,
                recipient_phone: phoneNumber.trim() || '',
                destination_address: cleanAddress,
                destination_lat: selectedCoord.latitude,
                destination_lng: selectedCoord.longitude,
                agenda: meetingAgenda || 'เข้าพบและนำเสนอสินค้า',
              })
              .eq('id', activeDropData.id);
            dropId = activeDropData.id;
          } else {
            // Query current max sequence_order for this trip
            const { data: existingAppts } = await (supabase.from('appointments' as any) as any)
              .select('sequence_order')
              .eq('trip_id', tripId)
              .order('sequence_order', { ascending: false })
              .limit(1);

            const maxSeq = existingAppts?.[0]?.sequence_order || 0;
            const currentCount = typeof params.currentCount === 'number' ? params.currentCount : activeTripDrops.length;
            const nextSeq = Math.max(maxSeq + 1, currentCount + 1, 1);

            const { data: inserted, error: insertErr } = await (supabase.from('appointments' as any) as any)
              .insert({
                trip_id: tripId,
                staff_id: staffId,
                type: 'appointment',
                sequence_order: nextSeq,
                company_name: resolvedCompanyName,
                customer_name: resolvedCustomerName,
                recipient_name: cleanCustomer || resolvedCustomerName,
                recipient_phone: phoneNumber.trim() || '',
                destination_address: cleanAddress,
                destination_lat: selectedCoord.latitude || 13.7563,
                destination_lng: selectedCoord.longitude || 100.5018,
                agenda: meetingAgenda || 'เข้าพบและนำเสนอสินค้า',
                status: 'pending',
                confirmation_status: false,
              })
              .select('id')
              .single();

            if (insertErr) {
              console.error('Error inserting appointment to Supabase:', insertErr);
            } else if (inserted?.id) {
              dropId = inserted.id;
            }
          }
        } catch (dbErr) {
          console.error('Failed to sync appointment with Supabase:', dbErr);
        }
      }

      const payload: StopItem = {
        id: dropId,
        appointmentId: dropId,
        name: resolvedDisplayName,
        address: cleanAddress,
        recipient: cleanCustomer || '',
        customerName: cleanCustomer || '',
        companyName: cleanCompany || '',
        phone: phoneNumber.trim() || '',
        items: meetingAgenda || (language === 'th' ? 'นำเสนอแผนงาน' : 'Product Demo'),
        latitude: selectedCoord.latitude,
        longitude: selectedCoord.longitude,
        isConfirmed: isEditingMode ? !!activeDropData.isConfirmed : false,
        isVisited: isEditingMode ? !!activeDropData.isVisited : false,
        isDataComplete: isEditingMode ? !!activeDropData.isDataComplete : false,
        status: isEditingMode ? (activeDropData.status || 'pending') : 'pending',
        ...(isEditingMode && activeDropData.odometer ? { odometer: activeDropData.odometer } : {}),
        ...(isEditingMode && activeDropData.expenses ? { expenses: activeDropData.expenses } : {}),
        ...(isEditingMode && activeDropData.photos ? { photos: activeDropData.photos } : {}),
        ...(isEditingMode && activeDropData.note ? { note: activeDropData.note } : {}),
        ...(isEditingMode && activeDropData.meetingMinutes ? { meetingMinutes: activeDropData.meetingMinutes } : {}),
        ...(tripId ? { tripId, trip_id: tripId } : {}),
      };

      // Direct callback support for reliable, synchronous staging updates (e.g. from EditTripItinerary)
      if (typeof route?.params?.onSaveDrop === 'function') {
        route.params.onSaveDrop(payload);
        navigation.goBack();
        return;
      }
      if (typeof params.onSaveDrop === 'function') {
        params.onSaveDrop(payload);
        navigation.goBack();
        return;
      }

      if (targetScreen === 'NewAppointment') {
        if (isEditingMode && typeof params.editIndex === 'number' && params.editIndex >= 0) {
          updateStop(params.editIndex, payload);
        } else {
          addStop(payload);
        }
        navigation.goBack();
      } else if (targetScreen === 'ActiveTracker') {
        // Sync to activeTripDrops in TripDraftContext for active trip screens
        if (isEditingMode && typeof params.editIndex === 'number' && params.editIndex >= 0) {
          updateActiveTripDrop(params.editIndex, payload);
          navigation.navigate('ActiveTracker', {
            tripId: tripId,
            updatedDrop: payload,
            editIndex: params.editIndex,
            timestamp: Date.now(),
          });
        } else {
          addActiveTripDrop(payload);
          navigation.navigate('ActiveTracker', {
            tripId: tripId,
            addedDrop: payload,
            timestamp: Date.now(),
          });
        }
      } else if (targetScreen === 'EditTripItinerary') {
        const currentDrops: StopItem[] = Array.isArray(route?.params?.currentDrops)
          ? route.params.currentDrops
          : (Array.isArray(params?.currentDrops) ? params.currentDrops : (activeTripDrops.length > 0 ? activeTripDrops : []));

        let nextDrops: StopItem[];
        if (isEditingMode && typeof params.editIndex === 'number' && params.editIndex >= 0) {
          nextDrops = currentDrops.map((d, i) => (i === params.editIndex ? { ...d, ...payload } : d));
        } else {
          const existingIdx = currentDrops.findIndex((d) => d.id === payload.id);
          if (existingIdx !== -1) {
            nextDrops = currentDrops.map((d, i) => (i === existingIdx ? { ...d, ...payload } : d));
          } else {
            nextDrops = [...currentDrops, payload];
          }
        }

        // Return to EditTripItinerary with staged drops (will be committed to activeTripDrops & DB upon tapping Apply)
        navigation.navigate('EditTripItinerary', {
          tripId: tripId,
          drops: nextDrops,
          addedDrop: payload,
          updatedDrop: isEditingMode ? payload : null,
          editIndex: isEditingMode ? params.editIndex : null,
          timestamp: Date.now(),
        });
      } else {
        // Staged screens (e.g. RoutePreview)
        navigation.navigate(
          targetScreen,
          isEditingMode
            ? { updatedDrop: payload, editIndex: params.editIndex, addedDrop: null, timestamp: Date.now() }
            : { addedDrop: payload, updatedDrop: null, editIndex: null, timestamp: Date.now() }
        );
      }
    } catch (err) {
      console.error('Error in AddNewDrop handleConfirm:', err);
      navigation.goBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  const doGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (params.returnScreen) {
      navigation.navigate(params.returnScreen);
    } else {
      navigation.navigate('NewAppointment');
    }
  };

  const handleAddNewDropGoBack = () => {
    const hasUnsavedInfo = !isEditing && (customerName.trim().length > 0 || phoneNumber.trim().length > 0 || companyName.trim().length > 0);
    if (hasUnsavedInfo) {
      Alert.alert(
        language === 'th' ? 'ยกเลิกการเพิ่มจุดส่ง?' : 'Discard New Drop?',
        language === 'th'
          ? 'ข้อมูลที่คุณกรอกไว้ยังไม่ได้บันทึก คุณต้องการยกเลิกและย้อนกลับใช่หรือไม่?'
          : 'You have unsaved drop details. Are you sure you want to discard them?',
        [
          { text: language === 'th' ? 'กรอกต่อ' : 'Keep Editing', style: 'cancel' },
          {
            text: language === 'th' ? 'ละทิ้ง' : 'Discard',
            style: 'destructive',
            onPress: () => doGoBack(),
          },
        ]
      );
      return;
    }
    doGoBack();
  };

  useEffect(() => {
    const onBackPress = () => {
      handleAddNewDropGoBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [customerName, phoneNumber, companyName, isEditing, language, params.returnScreen]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleAddNewDropGoBack}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#03246B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? (language === 'th' ? 'แก้ไขข้อมูลลูกค้า' : 'Edit Client Visit') : t('add_client_title')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LanguageTogglePill />
            <TouchableOpacity
              style={styles.gpsHeaderBtn}
              onPress={handleUseCurrentLocation}
              activeOpacity={0.8}
            >
              {fetchingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Compass size={14} color="#FFFFFF" />
                  <Text style={styles.gpsHeaderBtnText}>{t('add_live_gps')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
        >
          {/* Interactive Google Map Container */}
          <View
            style={styles.mapContainer}
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
          >
            {Platform.OS === 'web' ? (
              <View style={styles.webMapFallback}>
                <MapPin size={36} color="#1D4ED8" />
                <Text style={styles.webMapText}>Google Maps (Live Client Coordinates)</Text>
                <Text style={styles.webMapSub}>
                  Lat: {selectedCoord.latitude.toFixed(4)}, Lng: {selectedCoord.longitude.toFixed(4)}
                </Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                mapType="standard"
                showsUserLocation={true}
                initialRegion={{
                  latitude: selectedCoord.latitude,
                  longitude: selectedCoord.longitude,
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                }}
                onRegionChange={handleDropMapRegionChange}
                onRegionChangeComplete={handleDropMapRegionChangeComplete}
                onPress={handleMapPress}
              >
                <UrlTile
                  urlTemplate={GOOGLE_MAPS_TILE_URL}
                  maximumZ={19}
                  flipY={false}
                  zIndex={-1}
                />
              </MapView>
            )}

            {/* Center Pin Overlay (Always 100% visible on screen, never disappears) */}
            <View style={styles.inlineCenterPinAnchor} pointerEvents="none">
              <View style={[styles.inlinePinBubble, { backgroundColor: '#1D4ED8' }]}>
                <Text style={styles.inlinePinBubbleText} numberOfLines={1}>
                  {companyName.trim() || destinationAddress.split(',')[0] || (language === 'th' ? 'จุดลูกค้า' : 'Client Stop')}
                </Text>
              </View>
              <View style={[styles.inlinePinArrow, { borderTopColor: '#1D4ED8' }]} />
              <View style={styles.inlinePinIconWrap}>
                <MapPin size={32} color="#1D4ED8" fill="#1D4ED8" />
              </View>
              <View style={[styles.inlineGroundDot, { backgroundColor: '#1D4ED8' }]} />
            </View>

            {/* Drag to Pin Instruction Hint Badge */}
            <View style={styles.inlineMapHintBadge} pointerEvents="none">
              <Text style={styles.inlineMapHintText}>
                {language === 'th' ? 'เลื่อนแผนที่หรือแตะเพื่อปักหมุด' : 'Drag map or tap to pin'}
              </Text>
            </View>

            {/* Google Places Floating Search Bar */}
            <View style={styles.searchSectionWrapper}>
              <View style={styles.floatingSearchBar}>
                <Search size={16} color="#747686" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('add_search_placeholder')}
                  placeholderTextColor="#747686"
                  value={searchQuery}
                  onChangeText={handleQueryChange}
                  returnKeyType="search"
                />
                {searching && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 6 }} />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setPredictions([]);
                    }}
                  >
                    <X size={16} color="#747686" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Google Places Autocomplete Predictions Dropdown */}
              {predictions.length > 0 && (
                <View style={styles.predictionsDropdown}>
                  {predictions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.predictionItem}
                      onPress={() => handleSelectPrediction(item)}
                      activeOpacity={0.8}
                    >
                      <MapPin size={16} color="#1D4ED8" style={{ marginTop: 2 }} />
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

            {/* Floating Full-Screen Pin Button */}
            <TouchableOpacity
              style={styles.expandMapBtn}
              onPress={() => setShowPickerModal(true)}
              activeOpacity={0.85}
            >
              <Maximize2 size={13} color="#1D4ED8" />
              <Text style={styles.expandMapBtnText}>
                {t('pin_on_map') || 'ปักหมุดบนแผนที่'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Client Details Card */}
          <TouchableWithoutFeedback onPress={() => {
            Keyboard.dismiss();
            setPredictions([]);
          }}>
            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>{t('add_client_title')}</Text>

              {/* Contact Person Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('add_contact_name')}</Text>
                <View style={styles.inputFieldContainer}>
                  <User size={16} color="#747686" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('add_contact_placeholder')}
                    placeholderTextColor="#94A3B8"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>
              </View>

              {/* Customer Phone (Optional) */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.inputLabel}>{t('add_phone')}</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>
                    {t('add_phone_optional')}
                  </Text>
                </View>
                <View style={styles.inputFieldContainer}>
                  <Phone size={16} color="#747686" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('add_phone_placeholder')}
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>
              </View>

              {/* Company Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('add_company')}</Text>
                <View style={styles.inputFieldContainer}>
                  <Building size={16} color="#747686" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('add_company_placeholder')}
                    placeholderTextColor="#94A3B8"
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                </View>
              </View>

              {/* Meeting Agenda / Purpose (Dropdown Selection) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {language === 'th' ? 'วัตถุประสงค์การเข้าพบ (Visit Agenda)' : 'Visit Agenda / Purpose'}
                </Text>
                
                {/* Dropdown Options Grid */}
                <View style={styles.agendaOptionsContainer}>
                  {[
                    { id: 'pitch', label: language === 'th' ? 'นำเสนอโปรเจกต์ (Pitch & Proposal)' : 'Pitch & Proposal', icon: '💼' },
                    { id: 'renewal', label: language === 'th' ? 'ต่อสัญญา & SLA (Renewal & SLA)' : 'Renewal & SLA', icon: '📝' },
                    { id: 'healthcheck', label: language === 'th' ? 'ตรวจระบบ (Healthcheck & Integration)' : 'Healthcheck & Integration', icon: '🔧' },
                    { id: 'demo', label: language === 'th' ? 'แนะนำสินค้า & เดโม (Demo & Customer Success)' : 'Demo & Customer Success', icon: '🚀' },
                    { id: 'other', label: language === 'th' ? 'อื่นๆ (Other)' : 'Other', icon: '📌' },
                  ].map((option) => {
                    const isSelected = selectedAgendaKey === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.agendaOptionCard,
                          isSelected && styles.agendaOptionCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedAgendaKey(option.id);
                          if (option.id !== 'other') {
                            setMeetingAgenda(option.label);
                          } else if (!customAgendaText) {
                            setMeetingAgenda('');
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.agendaOptionIcon}>{option.icon}</Text>
                        <Text
                          style={[
                            styles.agendaOptionLabel,
                            isSelected && styles.agendaOptionLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <View style={styles.agendaSelectedDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom "Other" text input if 'other' is selected */}
                {selectedAgendaKey === 'other' && (
                  <View style={[styles.inputFieldContainer, { marginTop: 8, borderColor: '#1D4ED8', borderWidth: 1.5 }]}>
                    <Briefcase size={16} color="#1D4ED8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder={language === 'th' ? 'โปรดระบุวัตถุประสงค์เพิ่มเติม...' : 'Please specify other purpose...'}
                      placeholderTextColor="#94A3B8"
                      value={customAgendaText}
                      onChangeText={(text) => {
                        setCustomAgendaText(text);
                        setMeetingAgenda(text ? `อื่นๆ: ${text}` : '');
                      }}
                      autoFocus
                    />
                  </View>
                )}
              </View>

              {/* Destination Address */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>{t('add_location')}</Text>
                  <TouchableOpacity
                    style={styles.pinShortcutBtn}
                    onPress={() => setShowPickerModal(true)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={13} color="#1D4ED8" />
                    <Text style={styles.pinShortcutBtnText}>
                      {t('pin_on_map') || 'ปักหมุดบนแผนที่'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputFieldContainer}>
                  <Map size={16} color="#747686" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('add_location_placeholder')}
                    placeholderTextColor="#94A3B8"
                    value={destinationAddress}
                    onChangeText={setDestinationAddress}
                    multiline
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {/* Sticky Bottom CTA */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <CheckCircle size={18} color="#FFFFFF" fill="#FFFFFF" />
            )}
            <Text style={styles.confirmButtonText}>
              {isSubmitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t('btn_confirm')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location Picker Modal */}
        <LocationPickerModal
          visible={showPickerModal}
          onClose={() => setShowPickerModal(false)}
          onConfirm={handleConfirmPickerLocation}
          initialLocation={{
            latitude: selectedCoord.latitude,
            longitude: selectedCoord.longitude,
            name: companyName,
            address: destinationAddress,
          }}
          title={language === 'th' ? 'ปักหมุดจุดเข้าพบลูกค้า' : 'Pin Client Location'}
          pinColor="#1D4ED8"
        />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  gpsHeaderBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 170,
    gap: 16,
  },
  mapContainer: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    backgroundColor: '#E2E8F0',
    marginTop: 16,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  webMapFallback: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
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
  searchSectionWrapper: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 30,
  },
  floatingSearchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  predictionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 6,
    paddingVertical: 6,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  predMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
  },
  predSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
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
  confirmButton: {
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
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
  customDropMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  customDropBubble: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  customDropText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  customDropArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1D4ED8',
    alignSelf: 'center',
    marginTop: -1,
    marginBottom: -3,
  },
  customDropPinCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCenterPinAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -75,
    marginTop: -52,
    width: 150,
    height: 62,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 15,
  },
  inlinePinBubble: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  inlinePinBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  inlinePinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1D4ED8',
    alignSelf: 'center',
    marginBottom: -2,
  },
  inlinePinIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 8,
  },
  inlineGroundDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1D4ED8',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginTop: -2,
  },
  inlineMapHintBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(3, 36, 107, 0.88)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  inlineMapHintText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  expandMapBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 25,
  },
  expandMapBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pinShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  pinShortcutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
