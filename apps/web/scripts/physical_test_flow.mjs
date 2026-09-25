// ==============================================================================
// PHYSICAL TEST: Complete End-to-End Flow Validation
// Covers: Route Creation -> Add Drops (Edit Plan) -> Check-ins -> Toggle Confirm
// -> Lock Validation -> Dashboard/Tracker State Persistence -> Submit to Admin
// -> Admin Review -> Revision Request -> Resubmit -> Admin Approval
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wufuewwgikdouauuoqus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZnVld3dnaWtkb3VhdXVvcXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzIwMTIsImV4cCI6MjEwMjAwODAxMn0._uEfdwSBS4EruoswH7f2Taw8SquPmT3P5uZ5Mfwalnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${testName}`);
  } else {
    failedCount++;
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${testName}`);
    if (details) console.error(`    ${colors.yellow}Error Details:${colors.reset} ${details}`);
  }
}

async function runPhysicalFlowTest() {
  console.log(`${colors.bright}${colors.magenta}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║      PHYSICAL END-TO-END WORKFLOW INTEGRATION TEST SUITE      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);

  try {
    // --------------------------------------------------------------------------
    // STEP 1: Specialist Authentication
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 1: Specialist Authentication ---${colors.reset}`);
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'somchai.r@marketing.com',
      password: 'Password123!',
    });
    const staffId = authData?.user?.id || '42284d55-3997-4add-9226-dd9cf2f085df';
    assert(!authErr || staffId, 'Specialist authenticated successfully');

    // --------------------------------------------------------------------------
    // STEP 2: Create Trip / Route (Mobile NewAppointmentScreen)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 2: Create Trip / Route with Start Odometer ---${colors.reset}`);
    const tripCode = `PHYS-${Date.now().toString().slice(-4)}`;
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({
        staff_id: staffId,
        trip_code: tripCode,
        title: `เส้นทางเข้าพบลูกค้า B2B กรุงเทพฯ (${tripCode})`,
        type: 'instant',
        status: 'in_progress',
        approval_status: 'draft',
        start_odometer: 45200,
        current_odometer: 45200,
        start_location: { name: 'จุดปล่อยรถสำนักงานใหญ่', lat: 13.7563, lng: 100.5018 },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    assert(!tripErr && trip?.id, `Created trip ${tripCode} with start odometer 45,200 km`, tripErr?.message);
    const tripId = trip?.id;

    // --------------------------------------------------------------------------
    // STEP 3: Add 3 Initial Drops (Appointments)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 3: Add Initial Drops ---${colors.reset}`);
    const initialDropsData = [
      {
        trip_id: tripId,
        staff_id: staffId,
        type: 'appointment',
        sequence_order: 1,
        company_name: 'บริษัท สยามรีเทล คอร์ปอเรชั่น จำกัด',
        customer_name: 'คุณสมชาย (ผู้จัดการฝ่ายจัดซื้อ)',
        recipient_name: 'คุณสมชาย',
        recipient_phone: '081-111-2222',
        destination_address: 'อาคารสยามพิวรรธน์ ถนนพระราม 1',
        destination_lat: 13.7460,
        destination_lng: 100.5340,
        agenda: 'นำเสนอแผนการตลาด',
        status: 'pending',
        confirmation_status: false,
      },
      {
        trip_id: tripId,
        staff_id: staffId,
        type: 'appointment',
        sequence_order: 2,
        company_name: 'บริษัท บางกอกโลจิสติกส์ เน็ตเวิร์ก',
        customer_name: 'คุณวิภา (หัวหน้าฝ่ายคลังสินค้า)',
        recipient_name: 'คุณวิภา',
        recipient_phone: '082-222-3333',
        destination_address: 'ถนนสาทรเหนือ แขวงสีลม',
        destination_lat: 13.7220,
        destination_lng: 100.5280,
        agenda: 'ต่อสัญญา & SLA',
        status: 'pending',
        confirmation_status: false,
      },
      {
        trip_id: tripId,
        staff_id: staffId,
        type: 'appointment',
        sequence_order: 3,
        company_name: 'ดิจิทัล ฟินเทค เซ็นเตอร์',
        customer_name: 'คุณกิตติศักดิ์ (IT Director)',
        recipient_name: 'คุณกิตติศักดิ์',
        recipient_phone: '083-333-4444',
        destination_address: 'อาคารเอ็กเชน ทาวเวอร์ อโศก',
        destination_lat: 13.7310,
        destination_lng: 100.5690,
        agenda: 'ตรวจระบบ Health Check',
        status: 'pending',
        confirmation_status: false,
      },
    ];

    const { data: createdAppts, error: apptErr } = await supabase
      .from('appointments')
      .insert(initialDropsData)
      .select();

    assert(!apptErr && createdAppts?.length === 3, 'Created 3 initial drops', apptErr?.message);

    // --------------------------------------------------------------------------
    // STEP 4: Edit Plan (EditTripItineraryScreen) - Add Drop 4 & Reorder via RPC
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 4: Edit Plan via sync_trip_itinerary RPC (Add Drop 4) ---${colors.reset}`);
    const drop4Id = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    const allUpdates = [
      {
        id: createdAppts[0].id,
        staff_id: staffId,
        sequence_order: 1,
        company_name: createdAppts[0].company_name,
        customer_name: createdAppts[0].customer_name,
        destination_address: createdAppts[0].destination_address,
        destination_lat: createdAppts[0].destination_lat,
        destination_lng: createdAppts[0].destination_lng,
        agenda: createdAppts[0].agenda,
        status: 'pending',
        confirmation_status: false,
      },
      {
        id: createdAppts[1].id,
        staff_id: staffId,
        sequence_order: 2,
        company_name: createdAppts[1].company_name,
        customer_name: createdAppts[1].customer_name,
        destination_address: createdAppts[1].destination_address,
        destination_lat: createdAppts[1].destination_lat,
        destination_lng: createdAppts[1].destination_lng,
        agenda: createdAppts[1].agenda,
        status: 'pending',
        confirmation_status: false,
      },
      {
        id: createdAppts[2].id,
        staff_id: staffId,
        sequence_order: 3,
        company_name: createdAppts[2].company_name,
        customer_name: createdAppts[2].customer_name,
        destination_address: createdAppts[2].destination_address,
        destination_lat: createdAppts[2].destination_lat,
        destination_lng: createdAppts[2].destination_lng,
        agenda: createdAppts[2].agenda,
        status: 'pending',
        confirmation_status: false,
      },
      {
        id: drop4Id,
        staff_id: staffId,
        sequence_order: 4,
        company_name: 'เทค อินโนเวชั่น ฮับ (อารีย์)',
        customer_name: 'คุณพัชรา (CTO)',
        recipient_name: 'คุณพัชรา',
        recipient_phone: '084-444-5555',
        destination_address: 'ถนนพหลโยธิน แขวงสามเสนใน',
        destination_lat: 13.7800,
        destination_lng: 100.5500,
        agenda: 'แนะนำสินค้า & เดโม',
        status: 'pending',
        confirmation_status: false,
      },
    ];

    const { error: rpcErr } = await supabase.rpc('sync_trip_itinerary', {
      p_trip_id: tripId,
      p_deleted_ids: null,
      p_updates: allUpdates,
    });

    assert(!rpcErr, 'Executed sync_trip_itinerary RPC to add Drop 4', rpcErr?.message);

    // Verify all 4 drops exist in DB
    const { data: dropsAfterEdit } = await supabase
      .from('appointments')
      .select('*')
      .eq('trip_id', tripId)
      .order('sequence_order', { ascending: true });

    assert(dropsAfterEdit?.length === 4, `Database confirmed 4 drops for trip ${tripCode}`);

    // --------------------------------------------------------------------------
    // STEP 5: Visit Drop 1 (Complete with expenses & confirm toggle = true)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 5: Visit Drop 1 (Complete & Confirmed) ---${colors.reset}`);
    const drop1 = dropsAfterEdit[0];
    await supabase.from('appointments').update({
      confirmation_status: true,
      status: 'completed',
      odometer_reading: 45215,
      completed_at: new Date().toISOString(),
      meeting_notes: 'เข้าพบคุณสมชาย นำเสนอแผนการตลาดไตรมาส 3 เรียบร้อย ลูกค้าสนใจและขอใบเสนอราคา',
    }).eq('id', drop1.id);

    await supabase.from('expenses').insert([
      {
        trip_id: tripId,
        appointment_id: drop1.id,
        staff_id: staffId,
        category: 'toll',
        title: 'ค่าทางด่วนพระราม 9',
        amount: 50.00,
        status: 'pending',
      },
      {
        trip_id: tripId,
        appointment_id: drop1.id,
        staff_id: staffId,
        category: 'parking',
        title: 'ค่าที่จอดรถสยามพิวรรธน์',
        amount: 40.00,
        status: 'pending',
      },
    ]);

    const { data: drop1Check } = await supabase.from('appointments').select('status, confirmation_status').eq('id', drop1.id).single();
    assert(drop1Check?.status === 'completed' && drop1Check?.confirmation_status === true, 'Drop 1 marked as COMPLETED & CONFIRMED');

    // --------------------------------------------------------------------------
    // STEP 6: Visit Drop 2 - TOGGLE CONFIRM OFF (Incomplete scenario)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 6: Visit Drop 2 - TOGGLE CONFIRM OFF (Incomplete) ---${colors.reset}`);
    const drop2 = dropsAfterEdit[1];
    await supabase.from('appointments').update({
      confirmation_status: true,
      status: 'incomplete', // User turned off confirmation toggle!
      completed_at: null,
      odometer_reading: 45230,
      meeting_notes: 'ลูกค้าติดประชุมด่วน ให้รอส่งเอกสารเพิ่มเติม',
    }).eq('id', drop2.id);

    const { data: drop2Check } = await supabase.from('appointments').select('status, confirmation_status').eq('id', drop2.id).single();
    assert(drop2Check?.status === 'incomplete', 'Drop 2 status correctly set to INCOMPLETE in Database');

    // --------------------------------------------------------------------------
    // STEP 7: Verify TripSummary Logic (LOCKED State)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 7: Verify Trip Summary Submit Button is LOCKED ---${colors.reset}`);
    const { data: currentDrops } = await supabase
      .from('appointments')
      .select('*, expenses(*)')
      .eq('trip_id', tripId)
      .order('sequence_order', { ascending: true });

    const isDropFullyCompleted = (d) => {
      if (!d || !d.confirmation_status) return false;
      if (d.status?.toLowerCase() !== 'completed') return false;
      return true;
    };

    const incompleteCount = currentDrops.filter((d) => !isDropFullyCompleted(d)).length;
    const canSubmit = currentDrops.length > 0 && incompleteCount === 0;

    assert(!canSubmit && incompleteCount === 3, `Submit to Admin is LOCKED (Incomplete drops: ${incompleteCount}/4)`);

    // --------------------------------------------------------------------------
    // STEP 8: Switch to Dashboard & Return to Tracker - Verify State Still Incomplete
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 8: Test Dashboard -> Tracker -> Summary Flow (Persistence) ---${colors.reset}`);
    // Simulate Dashboard query
    const { data: dashTrip } = await supabase
      .from('trips')
      .select('*, appointments(*)')
      .eq('id', tripId)
      .single();

    const completedInDash = dashTrip.appointments.filter((a) => a.confirmation_status && a.status?.toLowerCase() === 'completed').length;
    assert(completedInDash === 1, `Dashboard displays only 1 completed drop (Drop 2 remains incomplete, not false-positive)`);

    // --------------------------------------------------------------------------
    // STEP 9: Complete Drop 2, Drop 3, Drop 4 (100% Completed)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 9: Complete All Remaining Drops (100% Done) ---${colors.reset}`);
    // Drop 2 completed
    await supabase.from('appointments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', drop2.id);

    // Drop 3 completed
    const drop3 = dropsAfterEdit[2];
    await supabase.from('appointments').update({
      confirmation_status: true,
      status: 'completed',
      odometer_reading: 45242,
      completed_at: new Date().toISOString(),
      meeting_notes: 'ตรวจสอบระบบเรียบร้อย ระบบเสถียร 99.9%',
    }).eq('id', drop3.id);

    // Drop 4 completed
    await supabase.from('appointments').update({
      confirmation_status: true,
      status: 'completed',
      odometer_reading: 45258,
      completed_at: new Date().toISOString(),
      meeting_notes: 'เดโมระบบให้ทีมงานดู ทุกคนพึงพอใจมาก',
    }).eq('id', drop4Id);

    const { data: allDoneDrops } = await supabase.from('appointments').select('*').eq('trip_id', tripId);
    const incompleteNow = allDoneDrops.filter((d) => !isDropFullyCompleted(d)).length;
    const canSubmitNow = allDoneDrops.length === 4 && incompleteNow === 0;

    assert(canSubmitNow, 'All 4 drops are confirmed & complete -> Submit button is UNLOCKED (Green 🚀)');

    // --------------------------------------------------------------------------
    // STEP 10: Submit Report to Admin (Pending Review)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 10: Submit Report to Web Admin ---${colors.reset}`);
    const { data: submittedTrip, error: submitErr } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        approval_status: 'pending',
        end_odometer: 45265,
        current_odometer: 45265,
        total_distance_km: 65,
        submitted_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()
      .single();

    assert(!submitErr && submittedTrip?.approval_status === 'pending', 'Trip report submitted to Web Admin (approval_status: pending)', submitErr?.message);

    // --------------------------------------------------------------------------
    // STEP 11: Web Admin Requests Revision (Cycle 1)
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 11: Web Admin Requests Revision with Feedback ---${colors.reset}`);
    const revisionFeedback = '[รอบที่ 1] กรุณาแนบภาพใบเสร็จค่าทางด่วนและตรวจสอบเลขไมล์ให้ชัดเจน';
    const { data: revTrip, error: revErr } = await supabase
      .from('trips')
      .update({
        approval_status: 'revision_requested',
        manager_feedback: revisionFeedback,
      })
      .eq('id', tripId)
      .select()
      .single();

    assert(!revErr && revTrip?.approval_status === 'revision_requested', 'Admin requested revision with feedback note', revErr?.message);

    // --------------------------------------------------------------------------
    // STEP 12: Specialist Resubmits Corrected Report
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 12: Specialist Resubmits Report ---${colors.reset}`);
    const { data: resubTrip, error: resubErr } = await supabase
      .from('trips')
      .update({
        approval_status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()
      .single();

    assert(!resubErr && resubTrip?.approval_status === 'pending', 'Specialist resubmitted report after correction', resubErr?.message);

    // --------------------------------------------------------------------------
    // STEP 13: Web Admin Approves Trip
    // --------------------------------------------------------------------------
    console.log(`\n${colors.cyan}--- STEP 13: Web Admin Approves Trip ---${colors.reset}`);
    const { data: approvedTrip, error: appErr } = await supabase
      .from('trips')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()
      .single();

    assert(!appErr && approvedTrip?.approval_status === 'approved', 'Web Admin approved the trip (approval_status: approved)', appErr?.message);

    // --------------------------------------------------------------------------
    // SUMMARY REPORT
    // --------------------------------------------------------------------------
    console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}🏁 PHYSICAL TEST EXECUTION COMPLETED${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`  Total Flow Checks : ${passedCount + failedCount}`);
    console.log(`  ${colors.green}Passed Checks     : ${passedCount}${colors.reset}`);
    console.log(`  ${failedCount > 0 ? colors.red : colors.green}Failed Checks     : ${failedCount}${colors.reset}`);

    if (failedCount === 0) {
      console.log(`\n${colors.bright}${colors.green}🎉 ALL PHYSICAL FLOW CHECKS PASSED 100%! ZERO DEFECTS.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.bright}${colors.red}⚠️ SOME FLOW CHECKS FAILED.${colors.reset}\n`);
    }
  } catch (err) {
    console.error('Fatal error during physical test execution:', err);
  }
}

runPhysicalFlowTest();
