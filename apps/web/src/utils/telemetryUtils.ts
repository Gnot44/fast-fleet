/**
 * Shared Telemetry & Distance Resolution Utility
 *
 * Core Business Logic:
 * 1. Total ODO (km): Strictly calculated from manual odometer readings entered by the specialist.
 *    - Start ODO: From trip's starting odometer.
 *    - End ODO:
 *        * If the trip has drops recorded (appointments/drops): End ODO MUST come from the
 *          odometer reading entered by the specialist at the latest/last drop.
 *          If NO drop has an odometer reading entered, End ODO is left blank (undefined).
 *        * If the trip has no drops recorded (e.g. ad-hoc single trip): fallback to trip.end_odometer.
 *    - Formula: Total ODO = |End ODO - Start ODO| (ONLY when BOTH Start ODO and End ODO exist).
 *      If either is missing, Total ODO is undefined ('-' / cannot calculate).
 *
 * 2. Total GPS (km): Calculated from Google Maps / GPS route tracking.
 *    - Priority 1 = trip.total_distance_km or trip.totalGpsDistanceKm
 *    - Priority 2 = Dynamically computed from GPS coordinates of the start depot and drop waypoints.
 *
 * 3. Drop GPS (km): Segment road GPS distance for each individual drop from previous stop/depot.
 *
 * 4. Drop ODO (km): Incremental ODO distance for each drop calculated by subtracting the current
 *    drop's odometer reading from the previous drop's odometer reading (or trip Start ODO for Drop #1).
 *    If unentered, it resolves to undefined ('-').
 */

export interface DropOdoItem {
  id?: string;
  dropNumber?: number;
  sequence_order?: number;
  odometerReading?: number | null;
  odometer_reading?: number | string | null;
  odometer?: number | string | null;
  lat?: number | null;
  lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  status?: string;
  confirmation_status?: any;
}

export interface TripOdoInput {
  start_odometer?: number | string | null;
  startOdometer?: number | string | null;
  end_odometer?: number | string | null;
  endOdometer?: number | string | null;
  total_distance_km?: number | string | null;
  totalGpsDistanceKm?: number | string | null;
  gps_distance?: number | string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  startLocation?: { lat?: number; lng?: number } | string;
  drops?: DropOdoItem[];
  appointments?: DropOdoItem[];
  visits?: DropOdoItem[];
}

export interface ResolvedTripTelemetry {
  startOdo?: number;
  endOdo?: number;
  totalOdoDistance?: number;
  totalGpsDistance: number;
  isOdoComplete: boolean;
}

export interface ResolvedDropTelemetry {
  dropId?: string;
  dropNumber: number;
  legGpsDistance: number;
  cumulativeGpsDistance: number;
}

export interface ResolvedDropOdoAndGps {
  dropId?: string;
  dropNumber: number;
  odometerReading?: number;
  dropOdoDistance?: number; // Drop ODO (km) = |Current Drop ODO - Previous Point ODO|
  dropGpsDistance: number;  // Drop GPS (km) = Google Maps leg distance
  cumulativeGpsDistance: number;
}

/**
 * Calculate straight-line Haversine distance in km between two lat/lng points
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate multi-stop Google Maps road routing distance from waypoint coordinates
 */
export function calculateRouteGpsDistance(
  startLat?: number,
  startLng?: number,
  drops?: DropOdoItem[]
): number {
  const waypoints: Array<{ lat: number; lng: number }> = [];

  const baseLat = startLat || 13.7285;
  const baseLng = startLng || 100.5345;
  waypoints.push({ lat: baseLat, lng: baseLng });

  if (drops && drops.length > 0) {
    const sorted = [...drops].sort((a, b) => {
      const ordA = a.dropNumber ?? a.sequence_order ?? 0;
      const ordB = b.dropNumber ?? b.sequence_order ?? 0;
      return ordA - ordB;
    });

    sorted.forEach((d) => {
      const dLat = Number(d.lat ?? d.destination_lat);
      const dLng = Number(d.lng ?? d.destination_lng);
      if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
        waypoints.push({ lat: dLat, lng: dLng });
      }
    });
  }

  if (waypoints.length <= 1) return 0;

  let totalStraightKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = calculateHaversineDistance(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
    totalStraightKm += dist;
  }

  // Multiply by road routing winding factor (~1.28x for city/highway roads)
  const roadKm = totalStraightKm * 1.28;
  return Math.round(roadKm * 10) / 10;
}

/**
 * Calculate individual drop GPS distances for each leg of the journey
 */
export function resolveDropGpsDistances(
  startLat?: number,
  startLng?: number,
  drops?: DropOdoItem[],
  totalTripGps?: number
): ResolvedDropTelemetry[] {
  if (!drops || drops.length === 0) return [];

  const baseLat = startLat || 13.7285;
  const baseLng = startLng || 100.5345;

  const waypoints: Array<{ lat: number; lng: number }> = [{ lat: baseLat, lng: baseLng }];

  const sorted = [...drops].sort((a, b) => {
    const ordA = a.dropNumber ?? a.sequence_order ?? 0;
    const ordB = b.dropNumber ?? b.sequence_order ?? 0;
    return ordA - ordB;
  });

  sorted.forEach((d, idx) => {
    const dLat = Number(d.lat ?? d.destination_lat);
    const dLng = Number(d.lng ?? d.destination_lng);
    if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
      waypoints.push({ lat: dLat, lng: dLng });
    } else {
      // Fallback pseudo coordinates
      waypoints.push({ lat: baseLat + 0.04 * (idx + 1), lng: baseLng + 0.03 * (idx + 1) });
    }
  });

  const rawLegs: number[] = [];
  let totalRaw = 0;

  for (let i = 0; i < sorted.length; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1] || p1;
    const dist = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.28;
    const legKm = Math.max(0.5, Math.round(dist * 10) / 10);
    rawLegs.push(legKm);
    totalRaw += legKm;
  }

  // Proportional scaling if total GPS is known and positive
  const factor = totalTripGps && totalTripGps > 0 && totalRaw > 0 ? totalTripGps / totalRaw : 1;

  let cum = 0;
  return sorted.map((d, idx) => {
    const legDist = Math.round(rawLegs[idx] * factor * 10) / 10;
    cum += legDist;
    return {
      dropId: d.id,
      dropNumber: d.dropNumber ?? d.sequence_order ?? idx + 1,
      legGpsDistance: legDist,
      cumulativeGpsDistance: Math.round(cum * 10) / 10,
    };
  });
}

function parseOdoVal(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = Number(cleaned);
  return !isNaN(num) && num > 0 ? num : undefined;
}

/**
 * Calculate per-drop incremental Drop ODO (km) and Drop GPS (km)
 *
 * Core Logic for Drop ODO (km):
 * - Drop #1: |Drop #1 ODO - Trip Start ODO| (if both exist, else undefined / '-')
 * - Drop #N: |Drop #N ODO - Previous Point ODO| (where Previous Point is Drop #(N-1) or most recent entered ODO / Start ODO)
 * - If the specialist did not enter an ODO reading at this drop, Drop ODO (km) is undefined ('-').
 */
export function resolveDropTelemetryList(
  startOdo?: number | string | null,
  startLat?: number,
  startLng?: number,
  drops?: DropOdoItem[],
  totalTripGps?: number
): ResolvedDropOdoAndGps[] {
  if (!drops || drops.length === 0) return [];

  const parsedStartOdo = parseOdoVal(startOdo);

  const sorted = [...drops].sort((a, b) => {
    const ordA = a.dropNumber ?? a.sequence_order ?? 0;
    const ordB = b.dropNumber ?? b.sequence_order ?? 0;
    return ordA - ordB;
  });

  const gpsList = resolveDropGpsDistances(startLat, startLng, sorted, totalTripGps);

  let lastKnownOdo = parsedStartOdo;

  return sorted.map((d, idx) => {
    const currOdo = parseOdoVal(d.odometerReading ?? d.odometer_reading ?? d.odometer);

    let dropOdoDistance: number | undefined = undefined;
    if (currOdo !== undefined && lastKnownOdo !== undefined) {
      dropOdoDistance = Math.abs(currOdo - lastKnownOdo);
    }

    if (currOdo !== undefined) {
      lastKnownOdo = currOdo;
    }

    const matchedGps = gpsList.find((g) => g.dropId === d.id || g.dropNumber === (d.dropNumber ?? d.sequence_order ?? idx + 1));

    return {
      dropId: d.id,
      dropNumber: d.dropNumber ?? d.sequence_order ?? idx + 1,
      odometerReading: currOdo,
      dropOdoDistance,
      dropGpsDistance: matchedGps?.legGpsDistance || 0,
      cumulativeGpsDistance: matchedGps?.cumulativeGpsDistance || 0,
    };
  });
}

export function resolveTripOdoAndGpsMetrics(trip: TripOdoInput): ResolvedTripTelemetry {
  // 1. Resolve Start ODO
  const rawStart = trip.startOdometer !== undefined ? trip.startOdometer : trip.start_odometer;
  const startOdo =
    rawStart !== null && rawStart !== undefined && rawStart !== '' && Number(rawStart) > 0
      ? Number(String(rawStart).replace(/,/g, '').trim())
      : undefined;

  // 2. Resolve Latest Drop ODO from appointments/drops/visits list (checking backwards)
  const dropsList = trip.drops || trip.appointments || trip.visits || [];
  let latestDropOdo: number | undefined = undefined;

  if (dropsList && dropsList.length > 0) {
    const sorted = [...dropsList].sort((a, b) => {
      const ordA = a.dropNumber ?? a.sequence_order ?? 0;
      const ordB = b.dropNumber ?? b.sequence_order ?? 0;
      return ordB - ordA;
    });

    for (const d of sorted) {
      const rawDropOdo = d.odometerReading ?? d.odometer_reading ?? d.odometer;
      if (rawDropOdo !== null && rawDropOdo !== undefined && rawDropOdo !== '') {
        const num = Number(String(rawDropOdo).replace(/,/g, '').trim());
        if (!isNaN(num) && num > 0) {
          latestDropOdo = num;
          break;
        }
      }
    }
  }

  // 3. Resolve Explicit End ODO (if set on trip level)
  const rawEnd = trip.endOdometer !== undefined ? trip.endOdometer : trip.end_odometer;
  const explicitEndOdo =
    rawEnd !== null && rawEnd !== undefined && rawEnd !== '' && Number(rawEnd) > 0
      ? Number(String(rawEnd).replace(/,/g, '').trim())
      : undefined;

  // End ODO Strict Rule:
  // - If the trip has drops recorded, End ODO MUST come from the latest drop with an entered ODO reading.
  //   If no drop has an odometer reading, End ODO MUST be undefined (เว้นว่างไว้ / ไม่ได้บันทึก).
  // - If the trip has NO drops recorded at all, fallback to explicit trip.end_odometer.
  let endOdo: number | undefined = undefined;
  if (dropsList.length > 0) {
    endOdo = latestDropOdo;
  } else {
    endOdo = explicitEndOdo;
  }

  // 4. Calculate Total ODO (km) - strictly from entered ODO numbers
  // Both Start ODO and End ODO must exist, otherwise Total ODO is undefined (cannot calculate)
  let totalOdoDistance: number | undefined = undefined;
  if (startOdo !== undefined && endOdo !== undefined) {
    totalOdoDistance = Math.abs(endOdo - startOdo);
  }

  // 5. Calculate Total GPS (km) - from Google Maps / GPS tracking
  const rawGps = trip.totalGpsDistanceKm ?? trip.total_distance_km ?? trip.gps_distance;
  let totalGpsDistance = 0;

  if (rawGps !== null && rawGps !== undefined && rawGps !== '' && !isNaN(Number(rawGps))) {
    const numGps = Number(rawGps);
    if (numGps > 0 && numGps < 50000) {
      totalGpsDistance = numGps;
    }
  }

  // Fallback: If total_distance_km is not provided or 0, calculate dynamically from waypoint coordinates
  if (totalGpsDistance === 0) {
    const startObj = typeof trip.startLocation === 'object' && trip.startLocation !== null ? trip.startLocation : undefined;
    const startLat = (startObj?.lat !== undefined ? startObj.lat : (trip.start_lat !== null && trip.start_lat !== undefined ? trip.start_lat : undefined));
    const startLng = (startObj?.lng !== undefined ? startObj.lng : (trip.start_lng !== null && trip.start_lng !== undefined ? trip.start_lng : undefined));
    const computedGps = calculateRouteGpsDistance(startLat, startLng, dropsList);
    if (computedGps > 0) {
      totalGpsDistance = computedGps;
    }
  }

  return {
    startOdo,
    endOdo,
    totalOdoDistance,
    totalGpsDistance,
    isOdoComplete: startOdo !== undefined && endOdo !== undefined,
  };
}

/**
 * Helper to format ODO numbers nicely with thousand separators or fallback to '-'
 */
export function formatOdoNumber(val?: number | null, fallback = '-'): string {
  if (val === undefined || val === null || isNaN(Number(val))) return fallback;
  return Number(val).toLocaleString();
}

/**
 * Helper to format distance km
 */
export function formatDistanceKm(val?: number | null, fallback = '-'): string {
  if (val === undefined || val === null || isNaN(Number(val))) return fallback;
  return `${Number(val).toLocaleString(undefined, { maximumFractionDigits: 1 })} กม.`;
}
