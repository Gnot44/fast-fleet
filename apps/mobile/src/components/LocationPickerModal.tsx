import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import {
  ArrowLeft,
  Search,
  X,
  MapPin,
  Compass,
  CheckCircle2,
  Crosshair,
  Navigation,
} from 'lucide-react-native';
import { GOOGLE_MAPS_TILE_URL } from '../lib/mapConfig';
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  getLiveDeviceLocation,
  reverseGeocodeGoogle,
  PlacePrediction,
  Coordinates,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage } from '../lib/LanguageContext';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  title?: string;
  pinColor?: string;
}

export default function LocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLocation,
  title,
  pinColor = '#10B981',
}: LocationPickerModalProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const defaultLat = initialLocation?.latitude || DEFAULT_BANGKOK_LOCATION.latitude;
  const defaultLng = initialLocation?.longitude || DEFAULT_BANGKOK_LOCATION.longitude;

  // Selected coordinate (tracked at center of map)
  const [currentCoord, setCurrentCoord] = useState<Coordinates>({
    latitude: defaultLat,
    longitude: defaultLng,
  });

  const [placeName, setPlaceName] = useState(
    initialLocation?.name || (language === 'th' ? 'ตำแหน่งที่เลือก' : 'Selected Location')
  );
  const [placeAddress, setPlaceAddress] = useState(
    initialLocation?.address || (language === 'th' ? 'กำลังระบุที่อยู่...' : 'Resolving address...')
  );

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [bottomCardHeight, setBottomCardHeight] = useState(250);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<any>(null);
  const geocodeDebounceRef = useRef<any>(null);
  const isSelectingPredictionRef = useRef(false);

  // Pin animation (lifts up slightly when map is dragging)
  const pinTranslateAnim = useRef(new Animated.Value(0)).current;
  const pinScaleAnim = useRef(new Animated.Value(1)).current;

  // Sync state when modal opens
  useEffect(() => {
    if (visible) {
      const lat = initialLocation?.latitude || DEFAULT_BANGKOK_LOCATION.latitude;
      const lng = initialLocation?.longitude || DEFAULT_BANGKOK_LOCATION.longitude;
      const initName = initialLocation?.name || (language === 'th' ? 'ตำแหน่งที่เลือก' : 'Selected Location');
      const initAddr = initialLocation?.address || (language === 'th' ? 'กำลังระบุที่อยู่...' : 'Resolving address...');

      setCurrentCoord({ latitude: lat, longitude: lng });
      setPlaceName(initName);
      setPlaceAddress(initAddr);
      setSearchQuery('');
      setPredictions([]);

      // Trigger initial reverse geocode if no address provided
      if (!initialLocation?.address || initialLocation.address === DEFAULT_BANGKOK_LOCATION.address) {
        performReverseGeocode(lat, lng);
      }

      // Center map after modal mounts
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          },
          400
        );
      }, 300);
    }
  }, [visible, initialLocation?.latitude, initialLocation?.longitude]);

  // Reverse geocode handler
  const performReverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await reverseGeocodeGoogle(lat, lng);
      setPlaceName(res.name);
      setPlaceAddress(res.address);
    } catch (e) {
      console.warn('Geocoding error:', e);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Map Region Change Handlers
  const handleRegionChange = () => {
    if (!isMoving) {
      setIsMoving(true);
      Animated.parallel([
        Animated.timing(pinTranslateAnim, {
          toValue: -12,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pinScaleAnim, {
          toValue: 1.12,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    setIsMoving(false);
    Animated.parallel([
      Animated.spring(pinTranslateAnim, {
        toValue: 0,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(pinScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    if (region && region.latitude && region.longitude) {
      setCurrentCoord({
        latitude: region.latitude,
        longitude: region.longitude,
      });

      // Debounce reverse geocode so we don't spam Google API while dragging stops
      if (geocodeDebounceRef.current) {
        clearTimeout(geocodeDebounceRef.current);
      }
      geocodeDebounceRef.current = setTimeout(() => {
        performReverseGeocode(region.latitude, region.longitude);
      }, 350);
    }
  };

  // Tap on map to re-center
  const handleMapPress = (e: any) => {
    Keyboard.dismiss();
    setPredictions([]);
    const coord = e.nativeEvent?.coordinate;
    if (coord) {
      mapRef.current?.animateToRegion(
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        300
      );
    }
  };

  // Live GPS snap
  const handleSnapToGps = async () => {
    Keyboard.dismiss();
    setPredictions([]);
    setFetchingGps(true);

    try {
      const loc = await getLiveDeviceLocation((fastCoords) => {
        mapRef.current?.animateToRegion(
          {
            latitude: fastCoords.latitude,
            longitude: fastCoords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          400
        );
      });

      setCurrentCoord(loc.coords);
      setPlaceName(loc.name);
      setPlaceAddress(loc.address);

      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        400
      );
    } catch (err) {
      console.warn('GPS snap failed:', err);
    } finally {
      setFetchingGps(false);
    }
  };

  // Search input change
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (isSelectingPredictionRef.current) {
      isSelectingPredictionRef.current = false;
      setPredictions([]);
      return;
    }

    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await fetchPlacePredictions(text);
      setPredictions(results);
      setSearching(false);
    }, 300);
  };

  // Select place from predictions
  const handleSelectPrediction = async (item: PlacePrediction) => {
    isSelectingPredictionRef.current = true;
    setSearchQuery('');
    setPredictions([]);
    Keyboard.dismiss();

    if (item.latitude && item.longitude) {
      const coord = { latitude: item.latitude, longitude: item.longitude };
      setCurrentCoord(coord);
      setPlaceName(item.main_text);
      setPlaceAddress(item.description);

      mapRef.current?.animateToRegion(
        {
          latitude: item.latitude,
          longitude: item.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        450
      );
      return;
    }

    setSearching(true);
    const details = await fetchPlaceDetails(item.place_id);
    setSearching(false);

    if (details) {
      setCurrentCoord(details.coordinates);
      setPlaceName(details.name || item.main_text);
      setPlaceAddress(details.formattedAddress || item.description);

      mapRef.current?.animateToRegion(
        {
          latitude: details.coordinates.latitude,
          longitude: details.coordinates.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        450
      );
    }
  };

  const handleConfirmLocation = () => {
    onConfirm({
      latitude: currentCoord.latitude,
      longitude: currentCoord.longitude,
      name: placeName,
      address: placeAddress,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Fullscreen Map */}
        {Platform.OS === 'web' ? (
          <View style={styles.webFallbackContainer}>
            <MapPin size={48} color="#1D4ED8" />
            <Text style={styles.webFallbackTitle}>Interactive Map Pinning</Text>
            <Text style={styles.webFallbackSub}>
              Lat: {currentCoord.latitude.toFixed(5)}, Lng: {currentCoord.longitude.toFixed(5)}
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            mapType="standard"
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            initialRegion={{
              latitude: defaultLat,
              longitude: defaultLng,
              latitudeDelta: 0.006,
              longitudeDelta: 0.006,
            }}
            onRegionChange={handleRegionChange}
            onRegionChangeComplete={handleRegionChangeComplete}
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

        {/* Center Target Pin & Crosshair (Stationary on screen center) */}
        <View style={styles.centerPinAnchor} pointerEvents="none">
          {/* Target Crosshair Circle on the ground */}
          <View
            style={[
              styles.targetRing,
              {
                borderColor: pinColor,
                backgroundColor:
                  pinColor === '#10B981'
                    ? (isMoving ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.12)')
                    : (isMoving ? 'rgba(29, 78, 216, 0.28)' : 'rgba(29, 78, 216, 0.12)'),
              },
              isMoving && styles.targetRingActive,
            ]}
          >
            <View style={[styles.targetInnerDot, { backgroundColor: pinColor }]} />
          </View>

          {/* Floating Pin Marker */}
          <Animated.View
            style={[
              styles.pinFloatingContainer,
              {
                transform: [
                  { translateY: pinTranslateAnim },
                  { scale: pinScaleAnim },
                ],
              },
            ]}
          >
            <View style={[styles.pinBubble, { backgroundColor: pinColor === '#10B981' ? '#065F46' : '#1E3A8A' }]}>
              <Text style={styles.pinBubbleText} numberOfLines={1}>
                {placeName || (language === 'th' ? 'เลื่อนเพื่อปักหมุด' : 'Move map to pin')}
              </Text>
            </View>
            <View style={[styles.pinArrow, { borderTopColor: pinColor === '#10B981' ? '#065F46' : '#1E3A8A' }]} />
            <View style={styles.pinIconWrapper}>
              <MapPin size={32} color={pinColor} fill={pinColor} />
            </View>
          </Animated.View>
        </View>

        {/* Top Header & Search Bar Overlay */}
        <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
          {/* Nav Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#03246B" />
            </TouchableOpacity>

            <Text style={styles.headerTitleText} numberOfLines={1} ellipsizeMode="tail">
              {title || (language === 'th' ? 'ปักหมุดตำแหน่งบนแผนที่' : 'Pin Location on Map')}
            </Text>

            {/* GPS Snap Button */}
            <TouchableOpacity
              style={styles.gpsSnapBtn}
              onPress={handleSnapToGps}
              disabled={fetchingGps}
              activeOpacity={0.85}
            >
              {fetchingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Compass size={14} color="#FFFFFF" />
                  <Text style={styles.gpsSnapBtnText}>{t('add_live_gps')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Search size={16} color="#747686" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('add_search_placeholder')}
                placeholderTextColor="#747686"
                value={searchQuery}
                onChangeText={handleQueryChange}
                returnKeyType="search"
              />
              {searching && (
                <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 6 }} />
              )}
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

            {/* Search Predictions Dropdown */}
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

        {/* Center Recenter Button (Floating over map) */}
        <TouchableOpacity
          style={[styles.floatingGpsBtn, { bottom: bottomCardHeight + 14 }]}
          onPress={handleSnapToGps}
          activeOpacity={0.85}
        >
          <Crosshair size={20} color="#1D4ED8" />
        </TouchableOpacity>

        {/* Bottom Details & Confirmation Card */}
        <View
          style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 16) + 6 }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - bottomCardHeight) > 1) {
              setBottomCardHeight(h);
            }
          }}
        >
          {/* Subtle Drag Handle / Indicator */}
          <View style={styles.handleBar} />

          {/* Hint */}
          <Text style={styles.hintText}>
            💡 {t('pin_move_hint') || (language === 'th' ? 'เลื่อนแผนที่เพื่อให้หมุดอยู่ตรงตำแหน่งที่ต้องการ' : 'Move map to place pin on desired location')}
          </Text>

          {/* Location Details Box */}
          <View style={styles.detailsBox}>
            <View
              style={[
                styles.detailsIconCircle,
                { backgroundColor: pinColor === '#10B981' ? '#ECFDF5' : '#EFF6FF' },
              ]}
            >
              <MapPin size={22} color={pinColor} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.placeTitleText} numberOfLines={1}>
                  {placeName}
                </Text>
                {isGeocoding && (
                  <ActivityIndicator size="small" color={pinColor} />
                )}
              </View>
              <Text style={styles.placeAddressText} numberOfLines={2}>
                {placeAddress}
              </Text>
              <Text style={styles.coordText}>
                Lat: {currentCoord.latitude.toFixed(5)}, Lng: {currentCoord.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              pinColor === '#10B981'
                ? { backgroundColor: '#10B981', shadowColor: '#10B981' }
                : { backgroundColor: '#1D4ED8', shadowColor: '#1D4ED8' },
            ]}
            onPress={handleConfirmLocation}
            activeOpacity={0.88}
          >
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>
              {t('pin_confirm_location') || (language === 'th' ? 'ยืนยันตำแหน่งนี้' : 'Confirm Location')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  webFallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    gap: 8,
  },
  webFallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#03246B',
  },
  webFallbackSub: {
    fontSize: 13,
    color: '#64748B',
  },
  // Fixed Center Pin Anchor
  centerPinAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -100,
    marginTop: -80,
    width: 200,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  targetRing: {
    width: 20,
    height: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
  },
  targetRingActive: {
    width: 26,
    height: 13,
    borderRadius: 13,
    borderColor: 'rgba(16, 185, 129, 0.7)',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  targetInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  pinFloatingContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  pinBubble: {
    backgroundColor: '#03246B',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  pinBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#03246B',
    marginBottom: -2,
  },
  pinIconWrapper: {
    marginTop: 2,
  },
  // Top Overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    flexShrink: 0,
  },
  headerTitleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#03246B',
    marginHorizontal: 4,
    textAlign: 'center',
  },
  gpsSnapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    flexShrink: 0,
  },
  gpsSnapBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Search section
  searchSection: {
    width: '100%',
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#191C1E',
    padding: 0,
  },
  predictionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 6,
    paddingVertical: 4,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
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
  // Floating recenter button
  floatingGpsBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 25,
  },
  // Bottom Confirmation Card
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  detailsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  detailsIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  placeTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#03246B',
  },
  placeAddressText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  coordText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 26,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
