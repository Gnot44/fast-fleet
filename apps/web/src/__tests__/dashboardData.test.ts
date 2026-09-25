import { describe, it, expect } from 'vitest';

export interface RawProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_online: boolean;
  current_lat?: number;
  current_lng?: number;
  current_speed?: number;
  battery_level?: number;
  last_seen_at?: string;
  trips?: any[];
}

export function mapSpecialistDashboardData(profiles: RawProfile[]) {
  return profiles.map((p) => {
    // Sort trips by started_at / created_at descending (newest first)
    const sortedTrips = Array.isArray(p.trips)
      ? [...p.trips].sort((a: any, b: any) =>
          new Date(b.started_at || b.created_at || 0).getTime() -
          new Date(a.started_at || a.created_at || 0).getTime()
        )
      : [];

    const activeTrip =
      sortedTrips.find((t: any) => t.status === 'in_progress' && t.approval_status !== 'approved' && t.approval_status !== 'pending') ||
      null;

    const hasActiveTrip = !!activeTrip;
    const appts = hasActiveTrip ? activeTrip?.appointments || [] : [];
    const sortedAppts = [...appts].sort(
      (a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)
    );

    const startLoc = activeTrip?.start_location as any;
    const startLat =
      startLoc && typeof startLoc.latitude === 'number' && startLoc.latitude !== 0
        ? startLoc.latitude
        : null;
    const startLng =
      startLoc && typeof startLoc.longitude === 'number' && startLoc.longitude !== 0
        ? startLoc.longitude
        : null;

    const drops = hasActiveTrip
      ? sortedAppts.map((a: any, idx: number) => ({
          dropNumber: a.sequence_order || idx + 1,
          clientName: a.company_name || a.customer_name || `ลูกค้ารายที่ ${idx + 1}`,
          address: a.destination_address || 'กรุงเทพมหานคร',
          lat: a.destination_lat || 13.7563 + idx * 0.015,
          lng: a.destination_lng || 100.5018 + idx * 0.012,
          isClosed: a.status === 'completed' || a.confirmation_status === true,
        }))
      : [];

    const hasGps =
      typeof p.current_lat === 'number' &&
      typeof p.current_lng === 'number' &&
      p.current_lat !== 0;

    const lat = hasGps
      ? p.current_lat
      : startLat || (drops.length > 0 ? drops[0].lat : 13.7563);
    const lng = hasGps
      ? p.current_lng
      : startLng || (drops.length > 0 ? drops[0].lng : 100.5018);

    const completedDrops = drops.filter((d) => d.isClosed).length;
    const totalDrops = drops.length;

    let movementStatus: 'online' | 'moving' | 'standby' | 'offline' = 'offline';
    if (p.is_online) {
      if ((p.current_speed || 0) > 4) {
        movementStatus = 'moving';
      } else {
        movementStatus = 'standby';
      }
    }

    return {
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      hasActiveTrip,
      activeTripTitle: activeTrip?.title || null,
      activeTripCode: activeTrip?.trip_code || null,
      lat,
      lng,
      hasGps,
      movementStatus,
      completedDrops,
      totalDrops,
      drops,
    };
  });
}

describe('Web Admin Dashboard Logic & Specialist Mapping Tests', () => {
  it('TC-DASH-01: selects newest in_progress trip over older stale trips', () => {
    const rawProfiles: RawProfile[] = [
      {
        id: 'staff-1',
        first_name: 'Kosit',
        last_name: 'Goonlaboot',
        email: 'kosit@test.com',
        is_online: false,
        current_lat: 0,
        current_lng: 0,
        trips: [
          {
            id: 'trip-old',
            title: 'ไปไหน (Old Trip)',
            trip_code: 'TRP-246758',
            status: 'completed',
            created_at: '2026-08-21T09:24:06Z',
          },
          {
            id: 'trip-new',
            title: 'trssa (Latest Active Trip)',
            trip_code: 'TRP-546259',
            status: 'in_progress',
            created_at: '2026-08-25T15:59:06Z',
            start_location: { latitude: 13.9123, longitude: 100.5987, address: 'สรงประภา' },
            appointments: [
              { sequence_order: 1, company_name: 'Drop 1', status: 'completed' },
              { sequence_order: 2, company_name: 'Drop 2', status: 'pending' },
              { sequence_order: 3, company_name: 'Drop 3', status: 'pending' },
            ],
          },
        ],
      },
    ];

    const mapped = mapSpecialistDashboardData(rawProfiles);
    expect(mapped.length).toBe(1);
    expect(mapped[0].activeTripTitle).toBe('trssa (Latest Active Trip)');
    expect(mapped[0].activeTripCode).toBe('TRP-546259');
    expect(mapped[0].totalDrops).toBe(3);
    expect(mapped[0].completedDrops).toBe(1);
  });

  it('TC-DASH-02: falls back to start_location coordinates when specialist GPS is offline', () => {
    const rawProfiles: RawProfile[] = [
      {
        id: 'staff-1',
        first_name: 'Kosit',
        last_name: 'Goonlaboot',
        email: 'kosit@test.com',
        is_online: false,
        current_lat: 0, // Telemetry offline
        current_lng: 0,
        trips: [
          {
            id: 'trip-1',
            title: 'Active Trip',
            status: 'in_progress',
            created_at: '2026-08-25T15:59:06Z',
            start_location: { latitude: 13.9123, longitude: 100.5987, address: 'สรงประภา' },
            appointments: [],
          },
        ],
      },
    ];

    const mapped = mapSpecialistDashboardData(rawProfiles);
    expect(mapped[0].hasGps).toBe(false);
    expect(mapped[0].lat).toBe(13.9123);
    expect(mapped[0].lng).toBe(100.5987);
  });

  it('TC-DASH-04: maps specialist as Standby with no trip and 0 drops when all trips are completed/submitted', () => {
    const rawProfiles: RawProfile[] = [
      {
        id: 'staff-kosit',
        first_name: 'Kosit',
        last_name: 'Goonlaboot',
        email: 'kosit@test.com',
        is_online: true,
        current_lat: 13.9123,
        current_lng: 100.5987,
        trips: [
          {
            id: 'trip-done',
            title: 'Completed Trip',
            status: 'completed',
            approval_status: 'pending',
            created_at: '2026-08-26T06:54:23Z',
            appointments: [
              { sequence_order: 1, company_name: 'Drop 1', status: 'completed' },
            ],
          },
        ],
      },
    ];

    const mapped = mapSpecialistDashboardData(rawProfiles);
    expect(mapped[0].hasActiveTrip).toBe(false);
    expect(mapped[0].activeTripTitle).toBeNull();
    expect(mapped[0].totalDrops).toBe(0);
    expect(mapped[0].drops.length).toBe(0);
    expect(mapped[0].movementStatus).toBe('standby');
  });
});
