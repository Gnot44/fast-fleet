import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { reverseGeocodeGoogle, getDistanceMeters, DEFAULT_BANGKOK_LOCATION, Coordinates } from './mapServices';

// ==============================================================================
// BACKGROUND LOCATION TASK NAME
// Must be globally unique and defined at the top-level
// ==============================================================================
export const BACKGROUND_LOCATION_TASK = 'FLEET_BACKGROUND_LOCATION_TASK';

// ==============================================================================
// SMARTPHONE GPS TELEMETRY & ANTI-DRIFT ENGINE
// 3-State evaluation engine for mobile phones to eliminate indoor jitter
// ==============================================================================
export const ANTI_DRIFT_CONFIG = {
  MB_SPEED_MOVING: 6.0,   // km/h (ความเร็วขั้นต่ำสำหรับการเดินทาง)
  MB_DIST_MOVING: 10.0,   // meters (ระยะขยับขั้นต่ำสำหรับการเดินทาง)
  MB_SPEED_STATIC: 1.5,   // km/h (ความเร็วสูงสุดขณะหยุดนิ่ง)
  MB_STATIC_RADIUS: 15.0, // meters (รัศมีหยุดนิ่ง ป้องกันพิกัดดริฟท์)
  MAX_GPS_ACCURACY: 50.0, // meters (ความแม่นยำขั้นต่ำจากดาวเทียม)
  DROP_IGNORE_DATA: true, // กรองพิกัด Ignore ทิ้ง ไม่บันทึกลง DB
  HEARTBEAT_MS: 20000,    // 20 seconds
};

// Fetch and sync GPS config from system_settings dynamically
export async function syncGpsConfigFromDatabase() {
  try {
    const { data } = await (supabase.from('system_settings' as any) as any)
      .select('gps_config')
      .limit(1)
      .maybeSingle();

    if (data && data.gps_config) {
      if (typeof data.gps_config.mbSpeedMoving === 'number') {
        ANTI_DRIFT_CONFIG.MB_SPEED_MOVING = data.gps_config.mbSpeedMoving;
      }
      if (typeof data.gps_config.mbDistMoving === 'number') {
        ANTI_DRIFT_CONFIG.MB_DIST_MOVING = data.gps_config.mbDistMoving;
      }
      if (typeof data.gps_config.mbSpeedStatic === 'number') {
        ANTI_DRIFT_CONFIG.MB_SPEED_STATIC = data.gps_config.mbSpeedStatic;
      }
      if (typeof data.gps_config.mbStaticRadius === 'number') {
        ANTI_DRIFT_CONFIG.MB_STATIC_RADIUS = data.gps_config.mbStaticRadius;
      }
      if (typeof data.gps_config.dropIgnoreData === 'boolean') {
        ANTI_DRIFT_CONFIG.DROP_IGNORE_DATA = data.gps_config.dropIgnoreData;
      }
      console.log(`[Anti-Drift] 🔄 Synced GPS settings from DB: Moving > ${ANTI_DRIFT_CONFIG.MB_SPEED_MOVING} km/h & ${ANTI_DRIFT_CONFIG.MB_DIST_MOVING}m, Stopped <= ${ANTI_DRIFT_CONFIG.MB_SPEED_STATIC} km/h & ${ANTI_DRIFT_CONFIG.MB_STATIC_RADIUS}m`);
    }
  } catch (err) {
    console.warn('[Anti-Drift] GPS config sync note:', err);
  }
}

// Auto-init sync and listen to realtime updates from admin web dashboard
syncGpsConfigFromDatabase();
supabase
  .channel('mobile_system_settings_sync')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'system_settings' },
    (payload) => {
      if (payload.new && typeof payload.new === 'object') {
        const row: any = payload.new;
        if (row.gps_config) {
          if (typeof row.gps_config.mbSpeedMoving === 'number') ANTI_DRIFT_CONFIG.MB_SPEED_MOVING = row.gps_config.mbSpeedMoving;
          if (typeof row.gps_config.mbDistMoving === 'number') ANTI_DRIFT_CONFIG.MB_DIST_MOVING = row.gps_config.mbDistMoving;
          if (typeof row.gps_config.mbSpeedStatic === 'number') ANTI_DRIFT_CONFIG.MB_SPEED_STATIC = row.gps_config.mbSpeedStatic;
          if (typeof row.gps_config.mbStaticRadius === 'number') ANTI_DRIFT_CONFIG.MB_STATIC_RADIUS = row.gps_config.mbStaticRadius;
          if (typeof row.gps_config.dropIgnoreData === 'boolean') ANTI_DRIFT_CONFIG.DROP_IGNORE_DATA = row.gps_config.dropIgnoreData;
          console.log(`[Anti-Drift] ⚡ Realtime GPS settings updated from Web Admin! (Moving > ${ANTI_DRIFT_CONFIG.MB_SPEED_MOVING} km/h, Stopped <= ${ANTI_DRIFT_CONFIG.MB_SPEED_STATIC} km/h)`);
        }
      }
    }
  )
  .subscribe();

interface AntiDriftState {
  lastAcceptedCoords: Coordinates | null;
  anchorCoords: Coordinates | null;
  lastGeocodedCoords: Coordinates | null;
  lastAddress: string;
  isStationary: boolean;
  lastSpeedKmH: number;
}

const state: AntiDriftState = {
  lastAcceptedCoords: null,
  anchorCoords: null,
  lastGeocodedCoords: null,
  lastAddress: DEFAULT_BANGKOK_LOCATION.address,
  isStationary: true,
  lastSpeedKmH: 0,
};

let presenceInterval: any = null;
let positionWatcherSub: Location.LocationSubscription | null = null;

/**
 * 3-State Anti-Drift Evaluator
 */
export function evaluateAntiDrift(
  rawCoords: Coordinates,
  rawSpeedKmH: number,
  accuracy: number | null
): {
  status: 'Running' | 'Stopped' | 'Ignore';
  coords: Coordinates;
  speedKmH: number;
  shouldGeocode: boolean;
  action: 'RECORD' | 'STABILIZE' | 'DROP';
} {
  // 1. Initial State (First GPS Lock)
  if (!state.lastAcceptedCoords || !state.anchorCoords) {
    state.lastAcceptedCoords = rawCoords;
    state.anchorCoords = rawCoords;
    state.lastGeocodedCoords = rawCoords;
    state.lastSpeedKmH = rawSpeedKmH;
    state.isStationary = rawSpeedKmH <= ANTI_DRIFT_CONFIG.MB_SPEED_STATIC;

    return {
      status: state.isStationary ? 'Stopped' : 'Running',
      coords: rawCoords,
      speedKmH: state.isStationary ? 0 : rawSpeedKmH,
      shouldGeocode: true,
      action: 'RECORD',
    };
  }

  // 2. Reject extremely degraded GPS accuracy (e.g. deep inside concrete building > 50m error)
  if (accuracy !== null && accuracy > ANTI_DRIFT_CONFIG.MAX_GPS_ACCURACY) {
    console.log(`[Anti-Drift] ⚠️ Low GPS accuracy (${accuracy.toFixed(1)}m > ${ANTI_DRIFT_CONFIG.MAX_GPS_ACCURACY}m). Dropping jitter.`);
    return {
      status: 'Ignore',
      coords: state.anchorCoords || state.lastAcceptedCoords,
      speedKmH: 0,
      shouldGeocode: false,
      action: 'DROP',
    };
  }

  const distFromLast = getDistanceMeters(state.lastAcceptedCoords, rawCoords);
  const distFromAnchor = getDistanceMeters(state.anchorCoords, rawCoords);

  // 3. State 1: Running (กำลังเดินทาง)
  if (rawSpeedKmH > ANTI_DRIFT_CONFIG.MB_SPEED_MOVING && distFromLast > ANTI_DRIFT_CONFIG.MB_DIST_MOVING) {
    state.isStationary = false;
    state.lastAcceptedCoords = rawCoords;
    state.anchorCoords = rawCoords;
    state.lastSpeedKmH = rawSpeedKmH;

    const distFromGeocode = state.lastGeocodedCoords
      ? getDistanceMeters(state.lastGeocodedCoords, rawCoords)
      : 999;
    const shouldGeocode = distFromGeocode > 60;

    if (shouldGeocode) {
      state.lastGeocodedCoords = rawCoords;
    }

    console.log(`[Anti-Drift] 🚗 Running: Speed ${rawSpeedKmH.toFixed(1)} > ${ANTI_DRIFT_CONFIG.MB_SPEED_MOVING} km/h & Dist ${distFromLast.toFixed(1)} > ${ANTI_DRIFT_CONFIG.MB_DIST_MOVING}m`);
    return {
      status: 'Running',
      coords: rawCoords,
      speedKmH: rawSpeedKmH,
      shouldGeocode,
      action: 'RECORD',
    };
  }

  // 4. State 2: Stopped (หยุดนิ่ง / ณ จุดลูกค้า / ในอาคาร)
  if (rawSpeedKmH <= ANTI_DRIFT_CONFIG.MB_SPEED_STATIC && distFromAnchor <= ANTI_DRIFT_CONFIG.MB_STATIC_RADIUS) {
    state.isStationary = true;
    state.lastSpeedKmH = 0;

    console.log(`[Anti-Drift] 📍 Stopped: Speed ${rawSpeedKmH.toFixed(1)} <= ${ANTI_DRIFT_CONFIG.MB_SPEED_STATIC} km/h & Radius ${distFromAnchor.toFixed(1)} <= ${ANTI_DRIFT_CONFIG.MB_STATIC_RADIUS}m`);
    return {
      status: 'Stopped',
      coords: state.anchorCoords,
      speedKmH: 0,
      shouldGeocode: false,
      action: 'STABILIZE',
    };
  }

  // 5. State 3: Ignore (GPS Drift / Multipath Jitter)
  console.log(`[Anti-Drift] 🛡️ Ignore Drift: Speed ${rawSpeedKmH.toFixed(1)} km/h, Dist ${distFromAnchor.toFixed(1)}m. Dropping noise.`);
  return {
    status: 'Ignore',
    coords: state.anchorCoords || state.lastAcceptedCoords,
    speedKmH: 0,
    shouldGeocode: false,
    action: 'DROP',
  };
}

/**
 * Process raw location data and stream telemetry to Supabase
 */
async function processLocationTelemetry(rawCoords: {
  latitude: number;
  longitude: number;
  speed?: number | null;
  accuracy?: number | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rawSpeedKmH = rawCoords.speed ? Math.max(0, rawCoords.speed * 3.6) : 0;
    const accuracy = typeof rawCoords.accuracy === 'number' ? rawCoords.accuracy : null;

    let batteryLevel = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (typeof level === 'number' && level >= 0) {
        batteryLevel = Math.round(level * 100);
      }
    } catch (battErr) {
      // ignore
    }

    // Process through Smartphone GPS Anti-Drift Engine
    const evalResult = evaluateAntiDrift(
      { latitude: rawCoords.latitude, longitude: rawCoords.longitude },
      rawSpeedKmH,
      accuracy
    );

    // Geocode address if needed
    if (evalResult.shouldGeocode || !state.lastAddress) {
      try {
        const geocoded = await reverseGeocodeGoogle(evalResult.coords.latitude, evalResult.coords.longitude);
        state.lastAddress = geocoded.address;
      } catch (geoErr) {
        console.warn('Reverse geocode error:', geoErr);
      }
    }

    // Stream filtered and stabilized telemetry to Supabase Presence & Live Map
    const { error: rpcErr } = await (supabase.rpc as any)('update_specialist_presence', {
      p_is_online: true,
      p_lat: evalResult.coords.latitude,
      p_lng: evalResult.coords.longitude,
      p_address: state.lastAddress,
      p_speed: Math.round(evalResult.speedKmH),
      p_battery: batteryLevel,
    });

    if (rpcErr) {
      // Direct table update fallback
      try {
        await (supabase.from('profiles' as any) as any)
          .update({
            is_online: true,
            last_seen_at: new Date().toISOString(),
            current_lat: evalResult.coords.latitude,
            current_lng: evalResult.coords.longitude,
            current_address: state.lastAddress,
            current_speed: Math.round(evalResult.speedKmH),
            battery_level: batteryLevel,
          })
          .eq('id', user.id);

        if (evalResult.action !== 'DROP' || !ANTI_DRIFT_CONFIG.DROP_IGNORE_DATA) {
          await supabase.from('location_logs').insert({
            staff_id: user.id,
            lat: evalResult.coords.latitude,
            lng: evalResult.coords.longitude,
            speed: Math.round(evalResult.speedKmH),
            battery_level: batteryLevel,
          });
        }
      } catch (directErr) {
        console.warn('[LocationService] Direct update fallback note:', directErr);
      }
    }

    console.log(`[LocationService] ✅ Telemetry sent: ${evalResult.coords.latitude.toFixed(5)}, ${evalResult.coords.longitude.toFixed(5)} (${Math.round(evalResult.speedKmH)} km/h, Batt: ${batteryLevel}%)`);
  } catch (err) {
    console.error('[LocationService] Error processing location telemetry:', err);
  }
}

// ==============================================================================
// REGISTER NATIVE BACKGROUND TASK
// Executed by OS Background Service in standalone builds
// ==============================================================================
try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.warn(`[BackgroundLocationTask] Task error:`, error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const latest = locations[locations.length - 1];
        if (latest && latest.coords) {
          console.log(`[BackgroundLocationTask] 🛰️ Native background update received: ${latest.coords.latitude}, ${latest.coords.longitude}`);
          await processLocationTelemetry(latest.coords);
        }
      }
    }
  });
} catch (taskErr) {
  console.warn('[TaskManager] Task definition note:', taskErr);
}

/**
 * Send one-off location ping or mark offline
 */
export async function sendLocationPing(isOnline: boolean = true) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!isOnline) {
      const { error: rpcErr } = await (supabase.rpc as any)('update_specialist_presence', {
        p_is_online: false,
      });
      if (rpcErr) {
        try {
          await (supabase.from('profiles' as any) as any)
            .update({
              is_online: false,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        } catch (e) {}
      }
      console.log('[LocationService] 🛑 Specialist marked OFFLINE');
      return;
    }

    let rawLat = DEFAULT_BANGKOK_LOCATION.latitude;
    let rawLng = DEFAULT_BANGKOK_LOCATION.longitude;
    let rawSpeed = 0;
    let accuracy: number | null = null;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (currentLoc && currentLoc.coords) {
          rawLat = currentLoc.coords.latitude;
          rawLng = currentLoc.coords.longitude;
          rawSpeed = currentLoc.coords.speed ? Math.max(0, currentLoc.coords.speed * 3.6) : 0;
          accuracy = typeof currentLoc.coords.accuracy === 'number' ? currentLoc.coords.accuracy : null;
        }
      }
    } catch (locErr) {
      console.warn('GPS location ping fallback:', locErr);
    }

    await processLocationTelemetry({
      latitude: rawLat,
      longitude: rawLng,
      speed: rawSpeed / 3.6,
      accuracy,
    });
  } catch (err) {
    console.error('Error sending presence ping:', err);
  }
}

/**
 * Check if tracking is allowed for the logged in specialist
 * - If Admin enforced (is_tracking_enabled !== false) -> returns true
 * - If Admin not enforced (is_tracking_enabled === false) -> respects user_tracking_enabled (default true)
 */
export async function isTrackingAllowed(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: prof } = await (supabase.from('profiles' as any) as any)
      .select('is_tracking_enabled, user_tracking_enabled')
      .eq('id', user.id)
      .single();

    if (!prof) return true;
    const isEnforced = prof.is_tracking_enabled !== false;
    if (isEnforced) return true;
    return prof.user_tracking_enabled !== false;
  } catch (err) {
    console.warn('[LocationService] isTrackingAllowed check error:', err);
    return true;
  }
}

/**
 * Start Presence Tracking (Hybrid: Native Background Service + Live Position Watcher + Heartbeat Interval)
 * Keeps sending GPS location until user explicitly logs out or disables tracking
 */
export async function startLivePresenceTracking() {
  try {
    // 0. Check if tracking is permitted by policy / specialist choice
    const allowed = await isTrackingAllowed();
    if (!allowed) {
      console.log('[LocationService] 🛑 Tracking is currently disabled by specialist settings.');
      await stopLivePresenceTracking();
      return;
    }

    // 1. Request Foreground Permissions
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.warn('[LocationService] Foreground location permission not granted');
      return;
    }

    // 2. Attempt Background Permissions request safely
    if (Platform.OS === 'android') {
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch (bgErr) {
        console.warn('[BackgroundLocation] Background permission request note:', bgErr);
      }
    }

    // 3. Start Native Background Task (For Android & Standalone iOS Development / Release Builds)
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: ANTI_DRIFT_CONFIG.HEARTBEAT_MS,
          distanceInterval: 5,
          deferredUpdatesInterval: ANTI_DRIFT_CONFIG.HEARTBEAT_MS,
          deferredUpdatesDistance: 5,
          foregroundService: {
            notificationTitle: 'ระบบติดตามพิกัดการทำงาน',
            notificationBody: 'กำลังส่งตำแหน่ง GPS แบบเรียลไทม์ (ทำงานเบื้องหลัง)',
            notificationColor: '#2563EB',
          },
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
        console.log('[BackgroundLocation] 🚀 Native Background Location task registered & started');
      }
    } catch (startUpdatesErr: any) {
      // In Expo Go on iOS, startLocationUpdatesAsync is not supported by Expo Go's App Store client.
      // We log gracefully and fall back to the live position watcher + interval without crashing.
      console.log('[BackgroundLocation] ℹ️ Running via Expo Client Watcher Mode (Live telemetry active)');
    }

    // 4. Start Live GPS Position Watcher for real-time smoothness
    if (!positionWatcherSub) {
      try {
        positionWatcherSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 5,
          },
          (location) => {
            if (location && location.coords) {
              processLocationTelemetry(location.coords);
            }
          }
        );
      } catch (watchErr) {
        console.warn('[LocationService] Watch position note:', watchErr);
      }
    }

    // 5. Send immediate ping
    await sendLocationPing(true);

    // 6. Start heartbeat interval
    if (presenceInterval) {
      clearInterval(presenceInterval);
    }

    presenceInterval = setInterval(() => {
      sendLocationPing(true);
    }, ANTI_DRIFT_CONFIG.HEARTBEAT_MS);
  } catch (err) {
    console.error('[LocationService] Error starting tracking service:', err);
  }
}

/**
 * Stop Background Location Service and mark specialist as Offline in Live Map
 * Triggered ONLY when specialist explicitly logs out
 */
export async function stopLivePresenceTracking() {
  try {
    // 1. Clear foreground interval
    if (presenceInterval) {
      clearInterval(presenceInterval);
      presenceInterval = null;
    }

    // 2. Remove position watcher
    if (positionWatcherSub) {
      positionWatcherSub.remove();
      positionWatcherSub = null;
    }

    // 3. Unregister and stop native background location updates
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundLocation] ⏹️ Native Background Location task stopped');
      }
    } catch (stopErr) {
      // ignore
    }
  } catch (err) {
    console.warn('[BackgroundLocation] Error stopping background task:', err);
  } finally {
    // 4. Send explicit offline status to Supabase
    await sendLocationPing(false);
  }
}
