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
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Battery from 'expo-battery';
import {
  ArrowLeft,
  Navigation,
  CheckCircle2,
  Edit,
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
  Share2,
  ExternalLink,
} from 'lucide-react-native';
import {
  fetchRoadDirections,
  getLiveDeviceLocation,
  Coordinates,
  LEG_COLORS,
  DEFAULT_BANGKOK_LOCATION,
} from '../lib/mapServices';
import { useLanguage, LanguageTogglePill } from '../lib/LanguageContext';

const defaultInitialDrops: any[] = [];

export default function ActiveTrackerScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const params = route?.params || {};
  const tripId = params.tripId;
  const tripTitle = params.tripTitle || (language === 'th' ? 'เส้นทางเข้าพบลูกค้า' : 'Client Visit Route');
  const selectedVehicle = params.selectedVehicle || 'Isuzu D-Max SpaceCab (1กข-5555 กทม.)';
  const startLocation = params.startLocation || DEFAULT_BANGKOK_LOCATION;
  const startOdometer = params.startOdometer || '';

  // Exact drops array passed from previous screens
  const [drops, setDrops] = useState<any[]>(
    Array.isArray(params.drops) ? params.drops : []
  );
  const [currentDropIndex, setCurrentDropIndex] = useState<number>(
    typeof params.dropIndex === 'number' ? params.dropIndex : 0
  );

  // Completed drops state (strictly follows completed sequence)
  const [completedDropIndices, setCompletedDropIndices] = useState<number[]>([]);

  // Real Hardware Battery State
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  // Telemetry Metrics
  const [speed, setSpeed] = useState(42);
  const [odometer, setOdometer] = useState(parseInt(startOdometer, 10) || 45228);
  const [gpsAccuracy, setGpsAccuracy] = useState('3m (High)');

  // Driver Current Live Position & Address
  const [driverLocation, setDriverLocation] = useState({
    latitude: startLocation.latitude || 13.7563,
    longitude: startLocation.longitude || 100.5018,
    name: 'ตำแหน่งปัจจุบันของคุณ (Live Driver GPS)',
    address: startLocation.address || 'ถนนสุขุมวิท เขตคลองเตย กรุงเทพมหานคร',
  });

  const [roadPolyline, setRoadPolyline] = useState<Coordinates[]>([]);
  const [legDistance, setLegDistance] = useState('3.8 km');
  const [legDuration, setLegDuration] = useState('14 mins');
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
        name: 'พิกัดคนขับปัจจุบัน',
        address: loc.address,
      });
    }
    initGps();
  }, []);

  // 2. Sync route params when arriving from DropReporting or EditTripItinerary
  useEffect(() => {
    if (typeof route.params?.dropIndex === 'number') {
      const newIdx = route.params.dropIndex;
      setCurrentDropIndex(newIdx);
      const done: number[] = [];
      for (let i = 0; i < newIdx; i++) {
        done.push(i);
      }
      setCompletedDropIndices(done);
    }
    if (Array.isArray(route.params?.drops) && route.params.drops.length > 0) {
      setDrops(route.params.drops);
    }
  }, [route.params?.dropIndex, route.params?.drops]);

  const activeDrop = drops[currentDropIndex] || drops[0];
  const isAllCompleted = currentDropIndex >= drops.length;

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

  // Handle Check-in strictly for the current sequential drop
  const handleCheckInDrop = () => {
    navigation.navigate('DropReporting', {
      tripId,
      tripTitle,
      selectedVehicle,
      drop: activeDrop,
      dropIndex: currentDropIndex,
      totalDrops: drops.length,
      drops,
    });
  };

  // Open Edit Itinerary to reorder or add drops
  const handleOpenEditItinerary = () => {
    navigation.navigate('EditTripItinerary', {
      tripId,
      drops,
      currentDropIndex,
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

  const progressPercent = Math.min(
    100,
    Math.round((completedDropIndices.length / drops.length) * 100)
  );

  const activeLegColor = LEG_COLORS[currentDropIndex % LEG_COLORS.length];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Vehicle & Status */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#03246B" />
          </TouchableOpacity>

          <View style={styles.vehicleBadge}>
            <View style={styles.vehicleLiveDot} />
            <Text style={styles.vehicleBadgeText}>{selectedVehicle}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LanguageTogglePill />
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleOpenEditItinerary}
              activeOpacity={0.8}
            >
              <Edit size={16} color="#03246B" />
            </TouchableOpacity>
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
                {t('tracker_visited_of')} {completedDropIndices.length} / {drops.length} ({progressPercent}%)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editRouteQuickBtn}
              onPress={handleOpenEditItinerary}
              activeOpacity={0.8}
            >
              <Edit size={13} color="#1D4ED8" />
              <Text style={styles.editRouteQuickBtnText}>{t('tracker_reorder_btn')}</Text>
            </TouchableOpacity>
          </View>

          {/* Continuous Progress Track */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Sequential Stepper Drops Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepperScroll}
          >
            {drops.map((dropItem, idx) => {
              const isCompleted = completedDropIndices.includes(idx);
              const isActive = idx === currentDropIndex && !isCompleted;
              const isPending = idx > currentDropIndex && !isCompleted;

              return (
                <View
                  key={dropItem.id || idx}
                  style={[
                    styles.stepPill,
                    isCompleted && styles.stepPillCompleted,
                    isActive && styles.stepPillActive,
                    isPending && styles.stepPillPending,
                  ]}
                >
                  <View
                    style={[
                      styles.stepIconCircle,
                      isCompleted && styles.stepIconCircleCompleted,
                      isActive && styles.stepIconCircleActive,
                      isPending && styles.stepIconCirclePending,
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={14} color="#FFFFFF" />
                    ) : isActive ? (
                      <MapPin size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    )}
                  </View>

                  <View style={{ gap: 2 }}>
                    <Text
                      style={[
                        styles.stepPillTitle,
                        isActive && styles.stepPillTitleActive,
                        isCompleted && styles.stepPillTitleCompleted,
                      ]}
                      numberOfLines={1}
                    >
                      #{idx + 1} {dropItem.name}
                    </Text>
                    <Text
                      style={[
                        styles.stepPillStatus,
                        isCompleted && { color: '#166534' },
                        isActive && { color: '#1D4ED8' },
                      ]}
                    >
                      {isCompleted ? `✓ ${t('tracker_status_done')}` : isActive ? `📍 ${t('tracker_status_going')}` : `🕒 ${t('tracker_status_pending')}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Current Location & Next Destination Preview Card */}
        {!isAllCompleted ? (
          <View style={styles.previewRouteCard}>
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
              <View style={styles.previewDistancePill}>
                <Navigation size={13} color="#1D4ED8" />
                <Text style={styles.previewDistanceText}>
                  {t('preview_distance')} ~{legDistance} ({legDuration})
                </Text>
              </View>
            </View>

            {/* Target Destination Drop */}
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: activeLegColor, borderColor: `${activeLegColor}33` }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.previewLabel, { color: activeLegColor }]}>
                    {t('tracker_next_client')} (#{currentDropIndex + 1})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {activeDrop.items && (
                      <View style={styles.cargoBadge}>
                        <Package size={11} color="#1D4ED8" />
                        <Text style={styles.cargoBadgeText}>{activeDrop.items}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.quickEditDropBtn}
                      onPress={() => handleEditDrop(activeDrop, currentDropIndex)}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={11} color="#1D4ED8" />
                      <Text style={styles.quickEditDropText}>{t('btn_edit')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.previewName}>{activeDrop.name}</Text>
                <Text style={styles.previewAddress}>{activeDrop.address}</Text>

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

                {/* Recipient Contact Card */}
                {activeDrop.recipient && (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactText}>
                      {t('tracker_contact_label')}: <Text style={{ fontWeight: '700' }}>{activeDrop.recipient}</Text>{' '}
                      {activeDrop.phone ? `(${activeDrop.phone})` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* All Drops Completed Summary Banner */
          <View style={styles.allDoneCard}>
            <View style={styles.allDoneIconCircle}>
              <CheckCircle2 size={36} color="#166534" />
            </View>
            <Text style={styles.allDoneTitle}>{t('tracker_all_done')} 🎉</Text>
            <Text style={styles.allDoneSubtitle}>
              {t('tracker_all_done_sub')} ({drops.length} {t('dash_total_clients')})
            </Text>
          </View>
        )}

        {/* 3. Bird's Eye Overview Google Map Preview */}
        <View style={styles.mapCard}>
          {Platform.OS === 'web' ? (
            <View style={styles.webMapFallback}>
              <Navigation size={32} color="#1D4ED8" />
              <Text style={styles.webMapText}>Google Maps Live Preview</Text>
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
                    latitude: activeDrop.latitude || 13.7469,
                    longitude: activeDrop.longitude || 100.5349,
                  }}
                  title={`${t('preview_client')} #${currentDropIndex + 1}: ${activeDrop.name}`}
                  description={activeDrop.address}
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
      {/* Sticky Bottom Actions (Strict Sequential Closing) */}
      {/* ========================================================================= */}
      <View style={styles.bottomBar}>
        {!isAllCompleted ? (
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleCheckInDrop}
            activeOpacity={0.9}
          >
            <CheckCircle2 size={18} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.primaryActionText}>
              {t('btn_check_in')} (#{currentDropIndex + 1})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryActionButton, { backgroundColor: '#16A34A' }]}
            onPress={handleFinishTrip}
            activeOpacity={0.9}
          >
            <Flag size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>เสร็จสิ้นทริป & สรุปรายงานการเข้าพบ</Text>
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
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 12,
    backgroundColor: '#F2F4F7',
    gap: 12,
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
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vehicleLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  vehicleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03246B',
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
    paddingBottom: 110,
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
  stepPillActive: {
    backgroundColor: 'rgba(29, 78, 216, 0.06)',
    borderColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
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
    fontWeight: '700',
    color: '#475569',
    maxWidth: 130,
  },
  stepPillTitleActive: {
    color: '#03246B',
    fontWeight: '800',
  },
  stepPillTitleCompleted: {
    color: '#166534',
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
  contactRow: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  contactText: {
    fontSize: 11,
    color: '#475569',
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
});
