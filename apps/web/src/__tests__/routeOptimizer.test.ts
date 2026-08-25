import { describe, it, expect } from 'vitest';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function getDistanceMeters(c1: Coordinates, c2: Coordinates): number {
  const R = 6371e3;
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function solveOptimalStopOrder(
  origin: Coordinates,
  stops: Array<{ latitude?: number | string; longitude?: number | string; name?: string; address?: string }>
): number[] {
  const n = stops.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  const originLat = typeof origin.latitude === 'number' ? origin.latitude : parseFloat(origin.latitude as any) || 13.7563;
  const originLng = typeof origin.longitude === 'number' ? origin.longitude : parseFloat(origin.longitude as any) || 100.5018;
  const safeOrigin: Coordinates = { latitude: originLat, longitude: originLng };

  const stopCoords: Coordinates[] = stops.map((s, idx) => {
    const lat = typeof s.latitude === 'number' ? s.latitude : parseFloat(s.latitude as any);
    const lng = typeof s.longitude === 'number' ? s.longitude : parseFloat(s.longitude as any);
    return {
      latitude: !isNaN(lat) && lat !== 0 ? lat : 13.7225 + (idx % 2 === 0 ? idx * 0.03 : -idx * 0.02),
      longitude: !isNaN(lng) && lng !== 0 ? lng : 100.5283 + (idx % 2 === 0 ? -idx * 0.02 : idx * 0.04),
    };
  });

  const indices = Array.from({ length: n }, (_, i) => i);
  let bestPerm: number[] = [...indices];
  let minCost = Infinity;

  function permute(arr: number[], m = 0) {
    if (m === arr.length - 1) {
      let cost = getDistanceMeters(safeOrigin, stopCoords[arr[0]]);
      for (let i = 0; i < arr.length - 1; i++) {
        cost += getDistanceMeters(stopCoords[arr[i]], stopCoords[arr[i + 1]]);
      }
      if (cost < minCost) {
        minCost = cost;
        bestPerm = [...arr];
      }
      return;
    }
    for (let i = m; i < arr.length; i++) {
      const temp = arr[m];
      arr[m] = arr[i];
      arr[i] = temp;
      permute(arr, m + 1);
      const temp2 = arr[m];
      arr[m] = arr[i];
      arr[i] = temp2;
    }
  }

  if (n <= 8) {
    permute(indices);
  } else {
    const remaining = new Set(indices);
    let currentPoint = safeOrigin;
    bestPerm = [];

    while (remaining.size > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      for (const idx of remaining) {
        const d = getDistanceMeters(currentPoint, stopCoords[idx]);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = idx;
        }
      }

      if (nearestIdx !== -1) {
        bestPerm.push(nearestIdx);
        remaining.delete(nearestIdx);
        currentPoint = stopCoords[nearestIdx];
      }
    }
  }

  return bestPerm;
}

describe('Route Optimization & Haversine Distance Tests', () => {
  it('TC-RO-01: calculates Haversine distance between two known points accurately', () => {
    // Bangkok HQ (13.7563, 100.5018) to Victory Monument (13.7649, 100.5383) is approx ~4.08 km (4000-4200m)
    const p1 = { latitude: 13.7563, longitude: 100.5018 };
    const p2 = { latitude: 13.7649, longitude: 100.5383 };
    const distanceMeters = getDistanceMeters(p1, p2);
    expect(distanceMeters).toBeGreaterThan(3900);
    expect(distanceMeters).toBeLessThan(4300);
  });

  it('TC-RO-02: returns 0 meters when points are identical', () => {
    const p1 = { latitude: 13.7563, longitude: 100.5018 };
    const distance = getDistanceMeters(p1, p1);
    expect(distance).toBe(0);
  });

  it('TC-RO-03: returns single index for single stop', () => {
    const origin = { latitude: 13.7563, longitude: 100.5018 };
    const stops = [{ latitude: 13.76, longitude: 100.51, name: 'Stop 1' }];
    const order = solveOptimalStopOrder(origin, stops);
    expect(order).toEqual([0]);
  });

  it('TC-RO-04: solves 3 stops in linear sequence (Nearest Neighbor Optimal Ordering)', () => {
    // Origin is at 0km. Stop 0 is 3km away, Stop 1 is 1km away, Stop 2 is 2km away.
    // Optimal order from origin should visit Stop 1 (1km) -> Stop 2 (2km) -> Stop 0 (3km)
    const origin = { latitude: 13.7000, longitude: 100.5000 };
    const stops = [
      { latitude: 13.7300, longitude: 100.5000, name: 'Stop A (Far 3km)' },   // Index 0
      { latitude: 13.7100, longitude: 100.5000, name: 'Stop B (Near 1km)' },  // Index 1
      { latitude: 13.7200, longitude: 100.5000, name: 'Stop C (Mid 2km)' },   // Index 2
    ];

    const order = solveOptimalStopOrder(origin, stops);
    // Best permutation: Near (1) -> Mid (2) -> Far (0)
    expect(order).toEqual([1, 2, 0]);
  });

  it('TC-RO-05: handles large stop set (>8 stops) via greedy nearest neighbor without crashing', () => {
    const origin = { latitude: 13.7000, longitude: 100.5000 };
    const stops = Array.from({ length: 12 }, (_, i) => ({
      latitude: 13.7000 + (i * 0.005),
      longitude: 100.5000 + (i * 0.005),
      name: `Stop ${i + 1}`,
    }));

    const order = solveOptimalStopOrder(origin, stops);
    expect(order.length).toBe(12);
    // All indices 0..11 must be present exactly once
    expect(new Set(order).size).toBe(12);
  });
});
