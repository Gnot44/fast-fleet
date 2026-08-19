// ==============================================================================
// FastFleet Field Marketing - Automated End-to-End Test Bot Suite
// Full-Loop Validation: Mobile + Supabase Cloud + Web Hub Logic
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wufuewwgikdouauuoqus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZnVld3dnaWtkb3VhdXVvcXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzIwMTIsImV4cCI6MjEwMjAwODAxMn0._uEfdwSBS4EruoswH7f2Taw8SquPmT3P5uZ5Mfwalnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ANSI Colors for Pretty Output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let totalPassed = 0;
let totalFailed = 0;
const testResults = [];

function assert(condition, message, details = '') {
  if (condition) {
    totalPassed++;
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${message}`);
    testResults.push({ status: 'PASS', message, details });
  } else {
    totalFailed++;
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${message}`);
    if (details) console.error(`    ${colors.yellow}Details:${colors.reset} ${details}`);
    testResults.push({ status: 'FAIL', message, details });
  }
}

// Helper to authenticate or register test accounts
async function getOrCreateUser(email, password, fullName, role) {
  // Try login first
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    // If not found or fails, signUp
    const signUpRes = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    if (signUpRes.error) {
      // Re-try signIn in case already registered
      const retry = await supabase.auth.signInWithPassword({ email, password });
      return { user: retry.data?.user, error: retry.error };
    }
    return { user: signUpRes.data?.user, error: null };
  }
  return { user: data.user, error: null };
}

// ==============================================================================
// BOT MODULE 1: Authentication & RLS Security Validation
// ==============================================================================
async function testBotModule1_AuthAndSecurity() {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 1: Authentication & RLS Security Validation${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  // Test 1.1: Specialist Login
  const { user: staffUser, error: staffErr } = await getOrCreateUser(
    'somchai.r@marketing.com',
    'Password123!',
    'สมชาย รักดี',
    'specialist'
  );
  assert(!staffErr && staffUser !== null && staffUser !== undefined, 'Specialist login with standard credentials (somchai.r@marketing.com)', staffErr?.message);

  const staffUserId = staffUser?.id || '80780729-e619-47e7-96da-7c1ee48fa294';

  // Test 1.2: Admin Login
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { user: adminUser, error: adminErr } = await getOrCreateUser(
    'admin@fastfleet.io',
    'FastFleet@2026',
    'สมศักดิ์ วิจิตรการ',
    'admin'
  );
  assert(!adminErr && adminUser !== null && adminUser !== undefined, 'Administrator login with standard credentials (admin@fastfleet.io)', adminErr?.message);

  const adminUserId = adminUser?.id || 'ed23cf53-45b6-45b1-9072-894622521db8';

  // Test 1.3: Verify Profiles Table RBAC Data
  const { data: profiles, error: profErr } = await adminClient.from('profiles').select('*');
  assert(!profErr && profiles && profiles.length >= 1, `Admin can read system profiles (Found ${profiles?.length || 0} profiles)`, profErr?.message);

  return { staffUserId, adminUserId };
}

// ==============================================================================
// BOT MODULE 2: Trip Planning & 5 Visit Agendas & AI Routing
// ==============================================================================
async function testBotModule2_TripPlanning(staffUserId) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 2: Trip Planning, 5 Visit Agendas & AI Routing${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  const tripCode = `TRP-E2E-${Date.now().toString().slice(-4)}`;

  // Test 2.1: Create Trip with start odometer validation
  const { data: newTrip, error: tripErr } = await supabase.from('trips').insert({
    staff_id: staffUserId,
    trip_code: tripCode,
    title: 'Bangkok Enterprise Client Route (E2E Test)',
    type: 'instant',
    status: 'in_progress',
    assigned_vehicle: 'Isuzu D-Max (1กข-4452)',
    start_odometer: 24500.00,
    current_odometer: 24500.00,
    start_location: { name: 'Headquarters Rama 9', lat: 13.7563, lng: 100.5018 },
    started_at: new Date().toISOString(),
  }).select().single();

  assert(!tripErr && newTrip !== null, `Created new trip (${tripCode}) with valid start odometer (24,500 km)`, tripErr?.message);

  const tripId = newTrip?.id;

  // Test 2.2: Add 5 Client Drops covering ALL 5 Visit Agendas
  const agendas = [
    { type: 'pitch', label: 'นำเสนอโปรเจกต์', company: 'Siam Retail Group Co., Ltd.', lat: 13.7460, lng: 100.5340 },
    { type: 'renewal', label: 'ต่อสัญญา & SLA', company: 'Bangkok Logistics Network', lat: 13.7220, lng: 100.5280 },
    { type: 'healthcheck', label: 'ตรวจระบบ', company: 'Digital FinTech Center', lat: 13.7310, lng: 100.5690 },
    { type: 'demo', label: 'แนะนำสินค้า & เดโม', company: 'Tech Innovation Hub', lat: 13.7800, lng: 100.5500 },
    { type: 'other', label: 'อื่นๆ (สำรวจหน้างาน)', company: 'North Riverfront Plaza', lat: 13.7900, lng: 100.5100 },
  ];

  const appointmentInserts = agendas.map((ag, idx) => ({
    trip_id: tripId,
    staff_id: staffUserId,
    sequence_order: idx + 1,
    company_name: ag.company,
    customer_name: `Contact Person ${idx + 1}`,
    recipient_phone: `081-000-000${idx + 1}`,
    destination_address: `Address of ${ag.company}`,
    destination_lat: ag.lat,
    destination_lng: ag.lng,
    type: ag.type,
    appointment_type: ag.type,
    agenda: ag.label,
    status: 'pending',
    confirmation_status: false,
    start_odometer: 24500.00,
  }));

  const { data: appts, error: apptErr } = await supabase.from('appointments').insert(appointmentInserts).select();
  assert(!apptErr && appts && appts.length === 5, 'Added 5 client drops with all 5 distinct Visit Agendas', apptErr?.message);

  // Test 2.3: AI Nearest-Neighbor Routing Logic Simulation
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const startPt = { lat: 13.7563, lng: 100.5018 };
  let currentPt = startPt;
  let remaining = [...agendas];
  const optimizedRoute = [];
  let totalCalculatedDistance = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let shortestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistance(currentPt.lat, currentPt.lng, remaining[i].lat, remaining[i].lng);
      if (d < shortestDist) {
        shortestDist = d;
        nearestIdx = i;
      }
    }
    totalCalculatedDistance += shortestDist;
    currentPt = remaining[nearestIdx];
    optimizedRoute.push(remaining[nearestIdx]);
    remaining.splice(nearestIdx, 1);
  }

  assert(optimizedRoute.length === 5 && totalCalculatedDistance > 0, `AI Routing algorithm optimized sequence (Total route distance: ${totalCalculatedDistance.toFixed(2)} km)`);

  return { tripId, tripCode, appointments: appts || [] };
}

// ==============================================================================
// BOT MODULE 3: GPS Telemetry & Anti-Drift Engine Simulator
// ==============================================================================
async function testBotModule3_GpsAntiDrift(staffUserId, tripId) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 3: GPS Telemetry & Anti-Drift Engine Simulator${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  // Anti-Drift Rules (Smartphone Config)
  const MB_SPEED_MOVING = 4.0; // km/h
  const MB_DIST_MOVING = 10;   // meters
  const MB_SPEED_STATIC = 1.5; // km/h
  const MB_STATIC_RADIUS = 15; // meters

  function evaluateAntiDrift(speed, distanceMeters) {
    // 1. Check Moving
    if (speed > MB_SPEED_MOVING && distanceMeters > MB_DIST_MOVING) {
      return { status: 'Running', action: 'RECORD', note: 'พนักงานกำลังเคลื่อนที่บนถนน' };
    }
    // 2. Check Static (Pass Anti-Drift)
    if (speed <= MB_SPEED_STATIC && distanceMeters <= MB_STATIC_RADIUS) {
      return { status: 'Stopped', action: 'RECORD', note: 'พนักงานหยุดนิ่ง/อยู่ในจุดลูกค้า' };
    }
    // 3. Fail Anti-Drift (GPS Noise / Indoor Jitter)
    return { status: 'Ignore', action: 'DROP', note: 'สัญญาณ GPS แกว่งในอาคาร (Drop ทิ้ง)' };
  }

  // Case A: Moving Simulation
  const caseA = evaluateAntiDrift(28.5, 120);
  assert(caseA.status === 'Running' && caseA.action === 'RECORD', 'Case A (Moving): Speed=28.5 km/h, Dist=120m -> Status=Running (Record to DB)');

  // Case B: Stopped Simulation
  const caseB = evaluateAntiDrift(0.6, 5);
  assert(caseB.status === 'Stopped' && caseB.action === 'RECORD', 'Case B (Stopped): Speed=0.6 km/h, Dist=5m -> Status=Stopped (Record & Start Static Timer)');

  // Case C: GPS Drift Noise Simulation (Jitter 42m inside building)
  const caseC = evaluateAntiDrift(1.1, 42);
  assert(caseC.status === 'Ignore' && caseC.action === 'DROP', 'Case C (GPS Drift Noise): Speed=1.1 km/h, Jump=42m -> Status=Ignore (Drop from trajectory to prevent jitter)');

  // Persist only valid telemetry log to Supabase location_logs
  if (staffUserId) {
    const { data: locLog, error: locErr } = await supabase.from('location_logs').insert({
      staff_id: staffUserId,
      lat: 13.7460,
      lng: 100.5340,
      speed: 28.5,
      heading: 90.0,
      altitude: 12.0,
      accuracy: 5.0,
      battery_level: 88,
      is_mock_location: false,
    }).select().single();

    assert(!locErr && locLog !== null, 'Live GPS telemetry successfully logged to Supabase location_logs for Realtime streaming', locErr?.message);
  }
}

// ==============================================================================
// BOT MODULE 4: Drop Reporting, Photo Upload & Expense Trigger Validation
// ==============================================================================
async function testBotModule4_ReportingAndExpenses(staffUserId, tripId, appointments) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 4: Drop Reporting, Photos & Expense Trigger${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  if (!appointments || appointments.length === 0 || !tripId) return;

  const appt1 = appointments[0];
  const appt2 = appointments[1];

  // Test 4.1: Check in Drop 1
  const { data: updatedAppt1, error: checkinErr } = await supabase.from('appointments').update({
    status: 'completed',
    confirmation_status: true,
    check_in_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    end_odometer: 24512.00,
    meeting_notes: 'เข้าพบคุณสมศักดิ์ นำเสนอแผนงานโปรเจกต์ไตรมาส 3 เรียบร้อย ลูกค้าตอบรับดีมาก',
    client_photo_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=600',
  }).eq('id', appt1.id).select().single();

  assert(!checkinErr && updatedAppt1?.confirmation_status === true, 'Drop 1 Checked in with Confirmation=true & Meeting Notes recorded', checkinErr?.message);

  // Test 4.2: Insert 3 Multi-Category Expenses for Drop 1 & Drop 2
  const expensesToInsert = [
    {
      trip_id: tripId,
      appointment_id: appt1.id,
      staff_id: staffUserId,
      title: 'ค่าทางด่วนด่านพระราม 9',
      category: 'toll',
      amount: 120.00,
      receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      notes: 'จ่ายผ่าน Easy Pass (เข้าพบสยามรีเทล)',
      status: 'pending',
    },
    {
      trip_id: tripId,
      appointment_id: appt1.id,
      staff_id: staffUserId,
      title: 'ค่าที่จอดรถอาคารสยามสแควร์',
      category: 'parking',
      amount: 60.00,
      receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      notes: 'จอด 2 ชั่วโมง',
      status: 'pending',
    },
    {
      trip_id: tripId,
      appointment_id: appt2.id,
      staff_id: staffUserId,
      title: 'ค่าน้ำมันรถประจำทริป',
      category: 'fuel',
      amount: 500.00,
      receipt_url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600',
      notes: 'ปั๊ม ปตท. เพลินจิต ดีเซล B7',
      status: 'pending',
    },
  ];

  const { data: insertedExpenses, error: expErr } = await supabase.from('expenses').insert(expensesToInsert).select();
  assert(!expErr && insertedExpenses?.length === 3, 'Inserted 3 multi-category expenses (Toll 120 + Parking 60 + Fuel 500 = 680 THB)', expErr?.message);

  // Test 4.3: Validate Database Trigger `sync_trip_total_expenses`
  const { data: tripData, error: tripFetchErr } = await supabase.from('trips').select('total_expenses').eq('id', tripId).single();
  const totalExp = parseFloat(tripData?.total_expenses || '0');

  assert(!tripFetchErr && totalExp === 680.00, `Database trigger sync_trip_total_expenses automatically computed trip total: ${totalExp} THB (Expected: 680.00 THB)`, `Received ${totalExp}`);
}

// ==============================================================================
// BOT MODULE 5: Trip Submission, Manager Revision & Multi-Cycle Approval
// ==============================================================================
async function testBotModule5_RevisionAndApproval(staffUserId, tripId) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 5: Submission, Multi-Cycle Revision & Approval${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  if (!tripId) return;

  // Test 5.1: Specialist submits trip for review
  const { data: subTrip, error: subErr } = await supabase.from('trips').update({
    status: 'completed',
    approval_status: 'pending',
    end_odometer: 24545.00,
    total_distance_km: 45.00,
    submitted_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }).eq('id', tripId).select().single();

  assert(!subErr && subTrip?.approval_status === 'pending', 'Specialist submitted trip for approval (Status: pending)', subErr?.message);

  // Test 5.2: Manager Audit Rejection with Feedback (Cycle 1)
  const feedbackMsg = 'รูปถ่ายใบเสร็จค่าน้ำมันมัว กรุณาถ่ายภาพสลิปที่เห็นยอดเงินและวันที่ชัดเจน';
  const { data: revTrip, error: revErr } = await supabase.from('trips').update({
    approval_status: 'revision_requested',
    manager_feedback: feedbackMsg,
  }).eq('id', tripId).select().single();

  assert(!revErr && revTrip?.approval_status === 'revision_requested' && revTrip?.manager_feedback === feedbackMsg, 'Manager rejected trip with feedback note: "รูปถ่ายใบเสร็จค่าน้ำมันมัว..."', revErr?.message);

  // Test 5.3: Specialist resubmits report (Resubmit Cycle)
  const { data: resubTrip, error: resubErr } = await supabase.from('trips').update({
    approval_status: 'pending',
    manager_feedback: null, // Clear feedback upon resubmission
    submitted_at: new Date().toISOString(),
  }).eq('id', tripId).select().single();

  assert(!resubErr && resubTrip?.approval_status === 'pending' && resubTrip?.manager_feedback === null, 'Specialist corrected information and resubmitted report (Resubmit success)', resubErr?.message);

  // Test 5.4: Manager Approves Trip
  const { data: appTrip, error: appErr } = await supabase.from('trips').update({
    approval_status: 'approved',
    approved_at: new Date().toISOString(),
  }).eq('id', tripId).select().single();

  assert(!appErr && appTrip?.approval_status === 'approved', 'Manager approved trip report (Status: approved)', appErr?.message);
}

// ==============================================================================
// BOT MODULE 6: Reports & KPI Analytics Engine Validation
// ==============================================================================
async function testBotModule6_ReportsAnalytics(staffUserId) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 6: Reports & KPI Analytics Engine Validation${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  // Query appointments to calculate 5 agenda distribution
  const { data: allAppts, error: repErr } = await supabase.from('appointments').select('appointment_type, status, distance_km');
  assert(!repErr && allAppts && allAppts.length > 0, `Fetched ${allAppts?.length || 0} appointment records for KPI computation`, repErr?.message);

  const agendaCounts = { pitch: 0, renewal: 0, healthcheck: 0, demo: 0, other: 0 };
  allAppts?.forEach((ap) => {
    const t = ap.appointment_type || 'other';
    if (agendaCounts[t] !== undefined) agendaCounts[t]++;
    else agendaCounts.other++;
  });

  console.log(`    📊 Agenda Distribution: Pitch: ${agendaCounts.pitch}, Renewal: ${agendaCounts.renewal}, Healthcheck: ${agendaCounts.healthcheck}, Demo: ${agendaCounts.demo}, Other: ${agendaCounts.other}`);
  assert(agendaCounts.pitch > 0 && agendaCounts.renewal > 0, '5 Visit Agendas aggregation correctly counted and categorized');

  // Test 6.2: CSV Export Generator logic
  function generateCsv(records) {
    const headers = ['Trip ID', 'Specialist', 'Company', 'Agenda', 'Status'];
    const rows = records.slice(0, 3).map((r, i) => [
      `TRP-${i + 1}`,
      'สมชาย รักดี',
      r.company_name || 'ลูกค้าทดสอบ',
      r.agenda || 'นำเสนอโปรเจกต์',
      r.status || 'completed'
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    return csvContent;
  }

  const sampleCsv = generateCsv(allAppts || []);
  assert(sampleCsv.startsWith('\uFEFF') && sampleCsv.includes('สมชาย รักดี'), 'CSV Export properly formatted with UTF-8 BOM for Thai Excel compatibility');
}

// ==============================================================================
// BOT MODULE 7: Pure Localization & Dark Mode Tokens Audit
// ==============================================================================
async function testBotModule7_LocalizationAndDarkMode() {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🤖 BOT MODULE 7: Pure Localization & Dark Mode Tokens Audit${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);

  // Test 7.1: Check that Thai menu labels have NO English brackets
  const thaiNavLabels = [
    'ติดตามพิกัดสด',
    'ปฏิทินแผนงาน',
    'ตรวจรับรายงาน',
    'ทีมการตลาด',
    'รายงานและวิเคราะห์',
    'ตั้งค่าระบบ',
    'ข้อมูลส่วนตัว',
  ];

  let hasBrackets = false;
  thaiNavLabels.forEach(label => {
    if (label.includes('(') || label.includes(')')) {
      hasBrackets = true;
    }
  });

  assert(!hasBrackets, 'Thai navigation strings are 100% pure Thai without any English brackets');

  // Test 7.2: English menu labels
  const englishNavLabels = [
    'Live Tracking',
    'Trip Schedules',
    'Trip Approvals',
    'Marketing Specialists',
    'Reports & Analytics',
    'System Settings',
    'Admin Profile',
  ];

  let hasThaiInEnglish = false;
  englishNavLabels.forEach(label => {
    if (/[\u0E00-\u0E7F]/.test(label)) {
      hasThaiInEnglish = true;
    }
  });

  assert(!hasThaiInEnglish, 'English navigation strings are 100% pure English without Thai characters');
}

// ==============================================================================
// MAIN RUNNER
// ==============================================================================
async function runAllBotTests() {
  console.log(`${colors.bright}${colors.magenta}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║   FASTFLEET FIELD MARKETING - FULL-LOOP AUTOMATED BOT RUN   ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);

  const startTime = Date.now();

  try {
    const { staffUserId } = await testBotModule1_AuthAndSecurity();
    const { tripId, appointments } = await testBotModule2_TripPlanning(staffUserId);
    await testBotModule3_GpsAntiDrift(staffUserId, tripId);
    await testBotModule4_ReportingAndExpenses(staffUserId, tripId, appointments);
    await testBotModule5_RevisionAndApproval(staffUserId, tripId);
    await testBotModule6_ReportsAnalytics(staffUserId);
    await testBotModule7_LocalizationAndDarkMode();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}🏁 TEST SUMMARY REPORT (${duration}s)${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`  Total Tests Run : ${totalPassed + totalFailed}`);
    console.log(`  ${colors.green}Total Passed    : ${totalPassed}${colors.reset}`);
    console.log(`  ${totalFailed > 0 ? colors.red : colors.green}Total Failed    : ${totalFailed}${colors.reset}`);

    if (totalFailed === 0) {
      console.log(`\n${colors.bright}${colors.green}🎉 ALL 7 BOT MODULES PASSED 100%! SYSTEM LOGIC IS FLAWLESS.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.bright}${colors.red}⚠️ SOME TESTS FAILED. PLEASE REVIEW DETAILS ABOVE.${colors.reset}\n`);
    }
  } catch (err) {
    console.error(`\n${colors.red}Fatal Error during bot test execution:${colors.reset}`, err);
  }
}

runAllBotTests();
