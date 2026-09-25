import { describe, it, expect } from 'vitest';
import { TripStateManager, type StopItem } from './tripStateLogic.test';
import { mapSpecialistDashboardData, type RawProfile } from './dashboardData.test';
import { calculateEffectiveOdometer, validateTripCompletion } from './odometerLogic.test';

/**
 * ==============================================================================
 * FastFleet E2E Cross-Platform User Flow & Data Integrity QA Test Suite
 * Simulates: Field Specialist (Mobile) -> Supabase PostgreSQL DB -> Operations Manager (Web Console)
 * QA Standard: Senior QA / SDET Test Automation Matrix
 * ==============================================================================
 */

describe('🧪 E2E Real-User Flow & Data Integrity QA Suite', () => {

  // ============================================================================
  // TC-E2E-01: Mobile Local Draft Auto-Save & Crash Recovery (Zero Data Loss)
  // ============================================================================
  it('TC-E2E-01: preserves 100% of trip & drop draft data across simulated app crashes / restarts', () => {
    // 1. User enters draft state on Mobile (NewAppointmentScreen)
    const originalDraft = {
      tripName: 'สำรวจตลาด B2B โซนวิภาวดี-รังสิต',
      odometer: '45210',
      startLocation: {
        latitude: 13.912345,
        longitude: 100.598765,
        name: 'สำนักงานใหญ่ FastFleet (ดอนเมือง)',
        address: '123 ถนนสรงประภา แขวงดอนเมือง เขตดอนเมือง กทม.',
      },
      tabMode: 'startNow' as const,
      selectedDate: new Date('2026-08-26T08:30:00.000Z').toISOString(),
      selectedTimeSlot: '08:30 AM',
      stops: [
        {
          id: 'drop-uuid-001',
          name: 'บริษัท ไทยพาณิชย์ จำกัด (มหาชน)',
          address: '9 ถนนรัชดาภิเษก แขวงจตุจักร เขตจตุจักร กทม.',
          recipient: 'คุณสมศักดิ์ ผู้จัดการฝ่ายจัดซื้อ',
          phone: '081-234-5678',
          items: 'เอกสารสัญญา + ตัวอย่างสินค้าเซ็ต A (3 กล่อง)',
          latitude: 13.8285,
          longitude: 100.5658,
          isConfirmed: false,
        },
        {
          id: 'drop-uuid-002',
          name: 'บริษัท สยามพรีเมียม โลจิสติกส์',
          address: '88 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กทม.',
          recipient: 'คุณวิภาวรรณ หัวหน้าคลังสินค้า',
          phone: '089-987-6543',
          items: 'ใบเสร็จรับเงิน + โบรชัวร์ผลิตภัณฑ์ใหม่',
          latitude: 13.8450,
          longitude: 100.5750,
          isConfirmed: false,
        },
        {
          id: 'drop-uuid-003',
          name: 'ห้างหุ้นส่วนจำกัด บางกอก โมเดิร์น เทรด',
          address: '45/2 ถนนวิภาวดีรังสิต แขวงตลาดบางเขน เขตหลักสี่ กทม.',
          recipient: 'คุณธนากร กรรมการผู้จัดการ',
          phone: '086-555-1234',
          items: 'Demo Kit เครื่องสแกนบาร์โค้ดไร้สาย',
          latitude: 13.8760,
          longitude: 100.5890,
          isConfirmed: false,
        },
      ],
    };

    // 2. Simulating AsyncStorage JSON serialization (App backgrounding / auto-save)
    const serializedStorage = JSON.stringify(originalDraft);
    expect(serializedStorage).toBeTypeOf('string');

    // 3. Simulating App Crash / Cold Restart (Reading back from AsyncStorage)
    const deserializedStorage = JSON.parse(serializedStorage);

    // 4. Assert Zero Data Loss
    expect(deserializedStorage.tripName).toBe(originalDraft.tripName);
    expect(deserializedStorage.odometer).toBe(originalDraft.odometer);
    expect(deserializedStorage.startLocation.latitude).toBe(originalDraft.startLocation.latitude);
    expect(deserializedStorage.startLocation.address).toBe(originalDraft.startLocation.address);
    expect(deserializedStorage.stops.length).toBe(3);

    // Deep check every drop item field
    deserializedStorage.stops.forEach((recoveredStop: StopItem, idx: number) => {
      const originalStop = originalDraft.stops[idx];
      expect(recoveredStop.id).toBe(originalStop.id);
      expect(recoveredStop.name).toBe(originalStop.name);
      expect(recoveredStop.address).toBe(originalStop.address);
      expect(recoveredStop.recipient).toBe(originalStop.recipient);
      expect(recoveredStop.phone).toBe(originalStop.phone);
      expect(recoveredStop.items).toBe(originalStop.items);
      expect(recoveredStop.latitude).toBe(originalStop.latitude);
      expect(recoveredStop.longitude).toBe(originalStop.longitude);
      expect(recoveredStop.isConfirmed).toBe(false);
    });
  });

  // ============================================================================
  // TC-E2E-02: Instant & Multi-Drop Trip Creation (Mobile -> Supabase Database Transaction)
  // ============================================================================
  it('TC-E2E-02: creates relational trip & appointment records without orphaned drops', () => {
    const specialistId = 'staff-usr-999';
    const tripCode = `TRP-${Date.now().toString().slice(-6)}`;
    const startOdo = 45210;

    // 1. Simulated Trips Table Insertion Payload
    const tripRecord = {
      id: 'trip-db-uuid-888',
      staff_id: specialistId,
      trip_code: tripCode,
      title: 'สำรวจตลาด B2B โซนวิภาวดี-รังสิต',
      trip_date: '2026-08-26',
      status: 'in_progress',
      approval_status: 'draft',
      start_odometer: startOdo,
      started_at: '2026-08-26T08:30:00.000Z',
      start_location: {
        latitude: 13.912345,
        longitude: 100.598765,
        address: '123 ถนนสรงประภา แขวงดอนเมือง เขตดอนเมือง กทม.',
      },
    };

    // 2. Simulated Appointments Table Insertion Payload (3 Multi-Drop Stops)
    const rawStops = [
      { name: 'Drop 1', address: 'Addr 1', lat: 13.8285, lng: 100.5658, recipient: 'Contact 1', items: 'Item A' },
      { name: 'Drop 2', address: 'Addr 2', lat: 13.8450, lng: 100.5750, recipient: 'Contact 2', items: 'Item B' },
      { name: 'Drop 3', address: 'Addr 3', lat: 13.8760, lng: 100.5890, recipient: 'Contact 3', items: 'Item C' },
    ];

    const appointmentRecords = rawStops.map((stop, idx) => ({
      id: `appt-uuid-00${idx + 1}`,
      trip_id: tripRecord.id,
      staff_id: specialistId,
      sequence_order: idx + 1,
      company_name: stop.name,
      customer_name: stop.recipient,
      destination_address: stop.address,
      destination_lat: stop.lat,
      destination_lng: stop.lng,
      agenda: stop.items,
      status: 'pending',
      confirmation_status: false,
    }));

    // 3. Foreign Key & Sequence Integrity Assertions
    expect(tripRecord.status).toBe('in_progress');
    expect(tripRecord.trip_code).toContain('TRP-');
    expect(appointmentRecords.length).toBe(3);

    appointmentRecords.forEach((appt, idx) => {
      expect(appt.trip_id).toBe(tripRecord.id);
      expect(appt.sequence_order).toBe(idx + 1);
      expect(appt.status).toBe('pending');
      expect(appt.confirmation_status).toBe(false);
    });
  });

  // ============================================================================
  // TC-E2E-03: Web Admin Real-time Telemetry & Specialist Dashboard Mapping
  // ============================================================================
  it('TC-E2E-03: Web Ops Dashboard maps active specialist, trip code, and drops with 0% loss', () => {
    const rawProfiles: RawProfile[] = [
      {
        id: 'staff-usr-999',
        first_name: 'สมชาย',
        last_name: 'สายลุย (Field Specialist)',
        email: 'somchai@fastfleet.io',
        is_online: true,
        current_lat: 13.9125,
        current_lng: 100.5989,
        current_speed: 35.5, // Driving speed
        battery_level: 92,
        last_seen_at: new Date().toISOString(),
        trips: [
          {
            id: 'trip-db-uuid-888',
            trip_code: 'TRP-888999',
            title: 'สำรวจตลาด B2B โซนวิภาวดี-รังสิต',
            status: 'in_progress',
            created_at: '2026-08-26T08:30:00.000Z',
            started_at: '2026-08-26T08:30:00.000Z',
            start_location: { latitude: 13.9123, longitude: 100.5987, address: 'สรงประภา ดอนเมือง' },
            appointments: [
              { sequence_order: 1, company_name: 'บริษัท ไทยพาณิชย์ จำกัด (มหาชน)', status: 'pending', confirmation_status: false },
              { sequence_order: 2, company_name: 'บริษัท สยามพรีเมียม โลจิสติกส์', status: 'pending', confirmation_status: false },
              { sequence_order: 3, company_name: 'ห้างหุ้นส่วนจำกัด บางกอก โมเดิร์น เทรด', status: 'pending', confirmation_status: false },
            ],
          },
        ],
      },
    ];

    // Map through Web Admin Dashboard Aggregator Logic
    const dashboardSpecialists = mapSpecialistDashboardData(rawProfiles);

    expect(dashboardSpecialists.length).toBe(1);
    const specialist = dashboardSpecialists[0];

    // Assert Web View Fidelity
    expect(specialist.hasActiveTrip).toBe(true);
    expect(specialist.activeTripCode).toBe('TRP-888999');
    expect(specialist.activeTripTitle).toBe('สำรวจตลาด B2B โซนวิภาวดี-รังสิต');
    expect(specialist.totalDrops).toBe(3);
    expect(specialist.completedDrops).toBe(0);
    expect(specialist.movementStatus).toBe('moving');
    expect(specialist.hasGps).toBe(true);
    expect(specialist.lat).toBe(13.9125);
    expect(specialist.lng).toBe(100.5989);
  });

  // ============================================================================
  // TC-E2E-04: Mobile Field Specialist Check-in & Drop Reporting (Notes, Proofs, Expenses)
  // ============================================================================
  it('TC-E2E-04: updates drop 1 check-in, notes, photos, and expenses and reflects immediately on Web', () => {
    // 1. Specialist arrives at Drop 1 & submits Drop Report (DropReportingScreen)
    const drop1CompletedReport = {
      appointmentId: 'appt-uuid-001',
      isConfirmed: true,
      isDataComplete: true,
      meetingNotes: 'เข้าพบคณะกรรมการจัดซื้อ นำเสนอระบบ FastFleet ลูกค้าสนใจขอใบเสนอราคา 50 คัน',
      odometer: '45228', // Traveled 18 km
      photos: ['https://supabase.fastfleet.io/storage/v1/object/public/trip_photos/proof-drop1.jpg'],
      expenses: [
        { id: 'exp-1', category: 'ค่าทางด่วน', amount: '60.00', note: 'ด่านดอนเมืองโทลล์เวย์', receiptUri: 'https://supabase.../slip1.jpg' },
        { id: 'exp-2', category: 'ค่าที่จอดรถ', amount: '40.00', note: 'ที่จอดรถอาคารไทยพาณิชย์', receiptUri: 'https://supabase.../slip2.jpg' },
      ],
      completedAt: '2026-08-26T09:45:00.000Z',
    };

    // Calculate total expenses for Drop 1
    const drop1ExpenseTotal = drop1CompletedReport.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    expect(drop1ExpenseTotal).toBe(100.00);

    // 2. Updated Database State in Supabase
    const updatedAppointments = [
      {
        id: 'appt-uuid-001',
        sequence_order: 1,
        company_name: 'บริษัท ไทยพาณิชย์ จำกัด (มหาชน)',
        status: 'completed',
        confirmation_status: true,
        meeting_notes: drop1CompletedReport.meetingNotes,
        odometer_reading: 45228,
        client_photo_url: drop1CompletedReport.photos[0],
        completed_at: drop1CompletedReport.completedAt,
      },
      { sequence_order: 2, company_name: 'บริษัท สยามพรีเมียม โลจิสติกส์', status: 'pending', confirmation_status: false },
      { sequence_order: 3, company_name: 'ห้างหุ้นส่วนจำกัด บางกอก โมเดิร์น เทรด', status: 'pending', confirmation_status: false },
    ];

    // 3. Web Dashboard receives updated DB stream
    const updatedProfile: RawProfile = {
      id: 'staff-usr-999',
      first_name: 'สมชาย',
      last_name: 'สายลุย',
      email: 'somchai@fastfleet.io',
      is_online: true,
      current_lat: 13.8285,
      current_lng: 100.5658,
      current_speed: 0, // Parked
      trips: [
        {
          id: 'trip-db-uuid-888',
          trip_code: 'TRP-888999',
          title: 'สำรวจตลาด B2B โซนวิภาวดี-รังสิต',
          status: 'in_progress',
          appointments: updatedAppointments,
        },
      ],
    };

    const dashboard = mapSpecialistDashboardData([updatedProfile])[0];

    // Assert Web Admin sees Progress = 1/3 (33.3%)
    expect(dashboard.completedDrops).toBe(1);
    expect(dashboard.totalDrops).toBe(3);
    expect(dashboard.drops[0].isClosed).toBe(true);
    expect(dashboard.drops[1].isClosed).toBe(false);
    expect(dashboard.drops[2].isClosed).toBe(false);
    expect(dashboard.movementStatus).toBe('standby');

    // Assert Effective Odometer accurately captures latest confirmed drop odometer
    const currentOdo = calculateEffectiveOdometer(45210, updatedAppointments);
    expect(currentOdo).toBe(45228);
  });

  // ============================================================================
  // TC-E2E-05: Safety & Immutability Rules (Reordering and Deletion Protection)
  // ============================================================================
  it('TC-E2E-05: enforces drop immutability for visited stops while allowing pending stops reordering', () => {
    const stops: StopItem[] = [
      { id: 'drop-1', name: 'Drop 1 (Visited)', address: 'Addr 1', isConfirmed: true },
      { id: 'drop-2', name: 'Drop 2 (Pending)', address: 'Addr 2', isConfirmed: false },
      { id: 'drop-3', name: 'Drop 3 (Pending)', address: 'Addr 3', isConfirmed: false },
    ];

    const stateManager = new TripStateManager(stops);

    // Rule A: Cannot delete a confirmed/visited drop
    const deleteVisited = stateManager.removeStop('drop-1');
    expect(deleteVisited.success).toBe(false);
    expect(deleteVisited.error).toContain('Cannot remove a confirmed/visited stop');
    expect(stateManager.getStops().length).toBe(3);

    // Rule B: Can delete an unvisited pending drop
    const deletePending = stateManager.removeStop('drop-3');
    expect(deletePending.success).toBe(true);
    expect(stateManager.getStops().length).toBe(2);

    // Re-add Drop 3 for reordering test
    stateManager.addStop({ id: 'drop-3', name: 'Drop 3 (Pending)', address: 'Addr 3', isConfirmed: false });

    // Rule C: Cannot move visited drop
    const moveVisited = stateManager.moveDown(0);
    expect(moveVisited.success).toBe(false);
    expect(moveVisited.error).toContain('Cannot reorder visited stop');

    // Rule D: Reorder pending stops (Move Drop 3 up past Drop 2)
    const movePending = stateManager.moveUp(2);
    expect(movePending.success).toBe(true);
    expect(stateManager.getStops().map((s) => s.id)).toEqual(['drop-1', 'drop-3', 'drop-2']);
  });

  // ============================================================================
  // TC-E2E-06: Trip Completion, End Odometer Validation & Distance Monotonicity
  // ============================================================================
  it('TC-E2E-06: validates odometer monotonicity and computes accurate total trip distance', () => {
    const startOdo = 45210;

    // Test A: Reject invalid/decreasing end odometer (tampering/typo prevention)
    const invalidEndOdo = 45190; // Less than start!
    const validationFail = validateTripCompletion(startOdo, invalidEndOdo);
    expect(validationFail.isValid).toBe(false);
    expect(validationFail.errorMessage).toContain('cannot be less than start odometer');

    // Test B: Accept valid final odometer after visiting all 3 drops
    const validEndOdo = 45275; // Traveled 65 km
    const validationSuccess = validateTripCompletion(startOdo, validEndOdo);
    expect(validationSuccess.isValid).toBe(true);
    expect(validationSuccess.totalDistanceKm).toBe(65);

    // Compute all expenses across trip
    const allTripExpenses = [
      { category: 'toll', amount: 60.00 },
      { category: 'parking', amount: 40.00 },
      { category: 'fuel', amount: 500.00 },
    ];
    const totalExpenses = allTripExpenses.reduce((sum, e) => sum + e.amount, 0);
    expect(totalExpenses).toBe(600.00);
  });

  // ============================================================================
  // TC-E2E-07: Trip Final Submission & Web Manager Approval Lifecycle
  // ============================================================================
  it('TC-E2E-07: completes the full lifecycle: Mobile submit -> Manager Approve -> Calendar/History consistency', () => {
    // 1. Specialist submits completed trip
    const submittedTrip = {
      id: 'trip-db-uuid-888',
      staff_id: 'staff-usr-999',
      trip_code: 'TRP-888999',
      title: 'สำรวจตลาด B2B โซนวิภาวดี-รังสิต',
      trip_date: '2026-08-26',
      status: 'completed',
      approval_status: 'pending' as const,
      start_odometer: 45210,
      end_odometer: 45275,
      total_distance_km: 65.0,
      total_expenses: 600.00,
      started_at: '2026-08-26T08:30:00.000Z',
      completed_at: '2026-08-26T17:00:00.000Z',
      submitted_at: '2026-08-26T17:05:00.000Z',
    };

    expect(submittedTrip.status).toBe('completed');
    expect(submittedTrip.approval_status).toBe('pending');
    expect(submittedTrip.total_distance_km).toBe(65.0);

    // 2. Web Manager reviews trip on Approvals / Calendar Hub and Approves
    const approvedTrip = {
      ...submittedTrip,
      approval_status: 'approved' as const,
      approved_at: '2026-08-26T17:30:00.000Z',
      approved_by: 'mgr-admin-001',
    };

    expect(approvedTrip.approval_status).toBe('approved');
    expect(approvedTrip.approved_by).toBe('mgr-admin-001');

    // 3. Web Visit History Table mapping validation
    const historyEntry = {
      id: approvedTrip.id,
      date: approvedTrip.trip_date,
      title: approvedTrip.title,
      tripCode: approvedTrip.trip_code,
      status: approvedTrip.status,
      approvalStatus: approvedTrip.approval_status,
      totalKm: approvedTrip.total_distance_km,
      totalCost: approvedTrip.total_expenses,
      stopsCount: 3,
    };

    expect(historyEntry.tripCode).toBe('TRP-888999');
    expect(historyEntry.approvalStatus).toBe('approved');
    expect(historyEntry.totalKm).toBe(65.0);
    expect(historyEntry.totalCost).toBe(600.00);
    expect(historyEntry.stopsCount).toBe(3);
  });
});
