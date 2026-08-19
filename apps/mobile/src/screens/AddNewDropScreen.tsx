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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
} from 'lucide-react-native';
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  PlacePrediction,
  getLiveDeviceLocation,
  reverseGeocodeGoogle,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';

export default function AddNewDropScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const params = route?.params || {};
  const isEditing = !!params.isEditing;
  const initialDrop = params.drop || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [customerName, setCustomerName] = useState(initialDrop.recipient || '');
  const [phoneNumber, setPhoneNumber] = useState(initialDrop.phone || '');
  const [companyName, setCompanyName] = useState(initialDrop.name || '');
  
  // Visit Agenda State
  const defaultAgenda = initialDrop.items || '';
  const [meetingAgenda, setMeetingAgenda] = useState(defaultAgenda);
  const [selectedAgendaKey, setSelectedAgendaKey] = useState<string>(() => {
    if (defaultAgenda.includes('นำเสนอ') || defaultAgenda.toLowerCase().includes('pitch')) return 'pitch';
    if (defaultAgenda.includes('ต่อสัญญา') || defaultAgenda.toLowerCase().includes('renewal')) return 'renewal';
    if (defaultAgenda.includes('ตรวจระบบ') || defaultAgenda.toLowerCase().includes('health')) return 'healthcheck';
    if (defaultAgenda.includes('แนะนำสินค้า') || defaultAgenda.toLowerCase().includes('demo')) return 'demo';
    if (defaultAgenda.startsWith('อื่นๆ') || defaultAgenda.toLowerCase().startsWith('other')) return 'other';
    return 'pitch';
  });
  const [customAgendaText, setCustomAgendaText] = useState(
    defaultAgenda.startsWith('อื่นๆ:') ? defaultAgenda.replace('อื่นๆ:', '').trim() : ''
  );

  const [destinationAddress, setDestinationAddress] = useState(initialDrop.address || DEFAULT_BANGKOK_LOCATION.address);
  const [selectedCoord, setSelectedCoord] = useState({
    latitude: initialDrop.latitude || DEFAULT_BANGKOK_LOCATION.latitude,
    longitude: initialDrop.longitude || DEFAULT_BANGKOK_LOCATION.longitude,
  });

  const mapRef = useRef<MapView | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const isSelectingRef = useRef<boolean>(false);

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

  // Select place from Google autocomplete dropdown
  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    isSelectingRef.current = true;
    setSearchQuery('');
    setPredictions([]);
    Keyboard.dismiss();

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
    const coord = e.nativeEvent.coordinate;
    setSelectedCoord(coord);

    const geocode = await reverseGeocodeGoogle(coord.latitude, coord.longitude);
    setCompanyName(geocode.name);
    setDestinationAddress(geocode.address);
  };

  const handleConfirm = () => {
    if (!customerName && !companyName && !destinationAddress) {
      Alert.alert(
        language === 'th' ? 'กรุณากรอกข้อมูล' : 'Information Required',
        language === 'th' ? 'กรุณาระบุชื่อผู้ติดต่อ หรือชื่อบริษัท และสถานที่นัดหมาย' : 'Please provide contact name or company name'
      );
      return;
    }

    const payload = {
      id: initialDrop.id || `client-${Date.now()}`,
      name: companyName || customerName || (language === 'th' ? 'ลูกค้านัดหมาย' : 'Client Visit'),
      address: destinationAddress || 'Bangkok Central Area',
      recipient: customerName || 'Client Representative',
      phone: phoneNumber.trim() || '',
      items: meetingAgenda || (language === 'th' ? 'นำเสนอแผนงาน' : 'Product Demo'),
      latitude: selectedCoord.latitude,
      longitude: selectedCoord.longitude,
      ...(initialDrop.expenses ? { expenses: initialDrop.expenses } : {}),
      ...(initialDrop.photos ? { photos: initialDrop.photos } : {}),
      ...(initialDrop.note ? { note: initialDrop.note } : {}),
    };

    if (isEditing && params.onEditDrop) {
      params.onEditDrop(payload);
    } else if (params.onAddDrop) {
      params.onAddDrop(payload);
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
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
        >
          {/* Interactive Google Map Container */}
          <View style={styles.mapContainer}>
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
                showsUserLocation={true}
                region={{
                  latitude: selectedCoord.latitude,
                  longitude: selectedCoord.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                onPress={handleMapPress}
              >
                <Marker
                  coordinate={selectedCoord}
                  title={companyName || 'Client Meeting Location'}
                  description={destinationAddress}
                  draggable
                  onDragEnd={async (e) => {
                    const c = e.nativeEvent.coordinate;
                    setSelectedCoord(c);
                    const geocode = await reverseGeocodeGoogle(c.latitude, c.longitude);
                    setCompanyName(geocode.name);
                    setDestinationAddress(geocode.address);
                  }}
                  pinColor="#1D4ED8"
                />
              </MapView>
            )}

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
                <Text style={styles.inputLabel}>{t('add_location')}</Text>
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
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.9}
          >
            <CheckCircle size={18} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.confirmButtonText}>{t('btn_confirm')}</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 110,
    gap: 16,
  },
  mapContainer: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginTop: 16,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
});
