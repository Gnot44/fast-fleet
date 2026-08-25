import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  resolveTripOdoAndGpsMetrics,
  resolveDropTelemetryList,
} from '../utils/telemetryUtils';

export interface PlannedDropItem {
  id: string;
  dropNumber: number;
  clientName: string;
  address: string;
  contactPerson?: string;
  contactPhone?: string;
  agenda: string;
  status: 'Scheduled' | 'Completed' | 'In Progress';
  checkedInAt?: string;
  checkedOutAt?: string;
  odometerReading?: number;
  dropOdoDistance?: number; // Drop ODO (km) = |Current ODO - Previous ODO|
  dropGpsDistance?: number; // Drop GPS (km) = Google Maps leg distance
  cumulativeGpsDistance?: number;
  meetingMinutes?: string;
  photos?: string[];
  expenses?: Array<{
    id?: string;
    category: string;
    title: string;
    amount: number;
    receiptUrl?: string;
  }>;
}

export interface DetailedExpenseItem {
  id: string;
  tripId: string;
  dropNumber?: number;
  clientName?: string;
  category: string;
  title: string;
  amount: number;
  receiptUrl?: string;
  notes?: string;
}

export interface SpecialistTripSchedule {
  id: string;
  tripCode: string;
  tripTitle: string;
  specialistId: string;
  specialistName: string;
  specialistNickname: string;
  employeeId: string;
  specialistAvatar?: string;
  specialistInitials: string;
  department: string;
  territory: string;
  assignedVehicle: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  status: 'Scheduled' | 'Completed' | 'In Progress' | 'Revision Requested' | 'Pending Approval' | 'Approved' | 'Draft';
  approvalStatus: 'approved' | 'pending' | 'revision_requested' | 'draft';
  startLocation: string;
  startOdometer?: number;
  endOdometer?: number;
  totalOdoDistanceKm?: number;
  totalGpsDistanceKm?: number;
  totalExpenses: number;
  managerFeedback?: string;
  drops: PlannedDropItem[];
  allExpenses: DetailedExpenseItem[];
}

export default function SpecialistScheduleCalendar() {
  const { language, t } = useLanguage();

  // User Role & Profile Scope
  const userRole = (localStorage.getItem('fastfleet_user_role') || 'admin') as 'admin' | 'specialist';
  const currentUserName = localStorage.getItem('fastfleet_user_name') || 'kosit goonlaboot';

  // Navigation & Date States
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  // Date Range Presets: 'today' | 'week' | 'month' | 'all' | 'custom'
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // View Mode: 'calendar' | 'list' | 'table' | 'summary'
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'table' | 'summary'>('calendar');

  // Filters
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [selectedTrip, setSelectedTrip] = useState<SpecialistTripSchedule | null>(null);
  const [selectedDaySchedule, setSelectedDaySchedule] = useState<{
    dayNumber: number;
    dateStr: string;
    trips: SpecialistTripSchedule[];
  } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; location?: string; amount?: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Database State
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<SpecialistTripSchedule[]>([]);
  const [_loading, setLoading] = useState(true);

  // Helper: Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Month Names (TH & EN)
  const monthNamesTh = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthNames = language === 'th' ? monthNamesTh : monthNamesEn;

  // Load Real Trips & Specialist Profiles from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. Fetch Real Specialists
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, avatar_url, department, position, staff(staff_id, territory, assigned_vehicle, vehicle_plate, vehicle_model)')
          .eq('role', 'specialist');

        const colors = [
          'border-blue-500 bg-blue-50 text-blue-700',
          'border-purple-500 bg-purple-50 text-purple-700',
          'border-emerald-500 bg-emerald-50 text-emerald-700',
          'border-amber-500 bg-amber-50 text-amber-700',
        ];

        let mappedSpecs: any[] = [];
        if (profs && profs.length > 0) {
          mappedSpecs = profs.map((p: any, idx: number) => {
            const staffObj = Array.isArray(p.staff) ? p.staff[0] : p.staff;
            return {
              id: p.id,
              name: p.full_name || 'kosit goonlaboot',
              nickname: p.nickname || p.full_name?.split(' ')[0] || 'kosit',
              employeeId: staffObj?.staff_id || 'AITS10002772',
              department: p.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              assignedVehicle: staffObj?.vehicle_plate || staffObj?.assigned_vehicle || 'Isuzu D-Max (1กข-4452)',
              avatar: p.avatar_url,
              initials: p.full_name?.slice(0, 2).toUpperCase() || 'KG',
              colorBadge: colors[idx % colors.length],
            };
          });
          setSpecialists(mappedSpecs);
        } else {
          setSpecialists([
            {
              id: 'spec-kosit',
              name: 'kosit goonlaboot',
              nickname: 'kosit',
              employeeId: 'AITS10002772',
              department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: 'Bangkok Central & Don Mueang',
              assignedVehicle: 'Isuzu D-Max (1กข-4452)',
              avatar: undefined,
              initials: 'KG',
              colorBadge: 'border-blue-500 bg-blue-50 text-blue-700',
            },
          ]);
        }

        // 2. Fetch Trips from Supabase with correct column total_distance_km
        const { data: trips, error: tripsErr } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            title,
            status,
            approval_status,
            trip_date,
            created_at,
            start_odometer,
            end_odometer,
            total_distance_km,
            manager_feedback,
            staff_id,
            profiles:profiles!trips_staff_id_fkey (
              id,
              full_name,
              nickname,
              avatar_url,
              department,
              staff (
                staff_id,
                territory,
                assigned_vehicle,
                vehicle_plate,
                vehicle_model
              )
            ),
            appointments (
              id,
              sequence_order,
              company_name,
              destination_address,
              recipient_name,
              recipient_phone,
              agenda,
              status,
              confirmation_status,
              check_in_at,
              check_out_at,
              destination_lat,
              destination_lng,
              meeting_notes,
              odometer_reading,
              client_photo_url
            ),
            expenses (
              id,
              appointment_id,
              category,
              title,
              amount,
              receipt_url,
              receipt_image_path,
              notes
            )
          `)
          .order('created_at', { ascending: false });

        if (tripsErr) {
          console.error('Error fetching calendar schedule:', tripsErr);
        }

        if (trips && trips.length > 0) {
          const mappedTrips: SpecialistTripSchedule[] = trips.map((t: any) => {
            const rawProf = t.profiles;
            const prof = (Array.isArray(rawProf) ? rawProf[0] : rawProf) || {};
            const staffObj = Array.isArray(prof.staff) ? prof.staff[0] : prof.staff;
            const appts = (t.appointments || []).sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));
            const exps = t.expenses || [];

            const rawAppStat = t.approval_status || 'draft';
            let tripStat: SpecialistTripSchedule['status'] = 'Draft';
            if (rawAppStat === 'approved') tripStat = 'Approved';
            else if (rawAppStat === 'pending') tripStat = 'Pending Approval';
            else if (rawAppStat === 'revision_requested') tripStat = 'Revision Requested';
            else if (t.status === 'completed') tripStat = 'Completed';
            else if (t.status === 'in_progress') tripStat = 'In Progress';
            else tripStat = 'Scheduled';

            const rawDate = t.trip_date || (t.created_at ? t.created_at.split('T')[0] : '2026-08-24');
            const dateOnly = typeof rawDate === 'string' ? rawDate.split('T')[0] : '2026-08-24';
            const fullName = prof.full_name || 'kosit goonlaboot';
            const nick = prof.nickname || fullName.split(' ')[0] || 'kosit';
            const empId = staffObj?.staff_id || 'AITS10002772';

            // 1. Resolve Trip Telemetry
            const odoMetrics = resolveTripOdoAndGpsMetrics({
              start_odometer: t.start_odometer,
              end_odometer: t.end_odometer,
              total_distance_km: t.total_distance_km,
              startLocation: { lat: 13.7285, lng: 100.5345 },
              appointments: appts,
            });

            // 2. Resolve Individual Drop Telemetry (Drop ODO km delta & Drop GPS km)
            const dropTelemList = resolveDropTelemetryList(
              odoMetrics.startOdo,
              13.7285,
              100.5345,
              appts,
              odoMetrics.totalGpsDistance
            );

            const drops: PlannedDropItem[] = appts.map((a: any, idx: number) => {
              const matchedTelem = dropTelemList.find((g) => g.dropId === a.id || g.dropNumber === (a.sequence_order || idx + 1));
              return {
                id: a.id || `drop-${idx}`,
                dropNumber: a.sequence_order || idx + 1,
                clientName: a.company_name || 'ลูกค้าองค์กร',
                address: a.destination_address || 'กรุงเทพมหานคร',
                contactPerson: a.recipient_name,
                contactPhone: a.recipient_phone,
                agenda: a.agenda || 'เข้าพบลูกค้า',
                status: a.confirmation_status ? 'Completed' : 'Scheduled',
                checkedInAt: a.check_in_at,
                checkedOutAt: a.check_out_at,
                odometerReading: matchedTelem?.odometerReading,
                dropOdoDistance: matchedTelem?.dropOdoDistance,
                dropGpsDistance: matchedTelem?.dropGpsDistance,
                cumulativeGpsDistance: matchedTelem?.cumulativeGpsDistance,
                meetingMinutes: a.meeting_notes,
                photos: a.client_photo_url ? [a.client_photo_url] : [],
                expenses: exps
                  .filter((e: any) => e.appointment_id === a.id)
                  .map((e: any) => ({
                    id: e.id,
                    category: e.category || 'Toll Fee',
                    title: e.title || e.category || 'ค่าใช้จ่าย',
                    amount: Number(e.amount) || 0,
                    receiptUrl: e.receipt_url || e.receipt_image_path,
                  })),
              };
            });

            const totalExp = exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

            const allExpenses: DetailedExpenseItem[] = exps.map((e: any) => {
              const matchedDrop = drops.find((d) => d.id === e.appointment_id);
              return {
                id: e.id,
                tripId: t.id,
                dropNumber: matchedDrop?.dropNumber,
                clientName: matchedDrop?.clientName,
                category: e.category || 'Toll Fee',
                title: e.title || e.category || 'ค่าใช้จ่าย',
                amount: Number(e.amount) || 0,
                receiptUrl: e.receipt_url || e.receipt_image_path,
                notes: e.notes,
              };
            });

            return {
              id: t.id,
              tripCode: t.trip_code || `TRP-${t.id.slice(0, 6).toUpperCase()}`,
              tripTitle: t.title || 'เส้นทางเข้าพบลูกค้า',
              specialistId: t.staff_id || prof.id,
              specialistName: fullName,
              specialistNickname: nick,
              employeeId: empId,
              specialistAvatar: prof.avatar_url,
              specialistInitials: fullName.slice(0, 2).toUpperCase(),
              department: prof.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              assignedVehicle: staffObj?.vehicle_plate || staffObj?.assigned_vehicle || 'Isuzu D-Max (1กข-4452)',
              date: dateOnly,
              timeSlot: '09:00 AM',
              status: tripStat,
              approvalStatus: rawAppStat as any,
              startLocation: 'Bangkok Central Hub',
              startOdometer: odoMetrics.startOdo,
              endOdometer: odoMetrics.endOdo,
              totalOdoDistanceKm: odoMetrics.totalOdoDistance,
              totalGpsDistanceKm: odoMetrics.totalGpsDistance,
              totalExpenses: totalExp,
              managerFeedback: t.manager_feedback,
              drops,
              allExpenses,
            };
          });

          setAllTrips(mappedTrips);
        } else {
          setAllTrips(getSampleTrips());
        }
      } catch (err) {
        console.error('Error fetching calendar schedule:', err);
        setAllTrips(getSampleTrips());
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Supabase Live Subscription
    const channel = supabase
      .channel('calendar-schedule-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realistic Sample Dataset Distributed across August 2026 with accurate ODO rules
  function getSampleTrips(): SpecialistTripSchedule[] {
    const rawSamples = [
      {
        id: 't-939275',
        tripCode: 'TRP-939275',
        tripTitle: 'ไปส่งกระเช้า',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Bangkok Central & Don Mueang',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-24', // วันนี้ (Monday 24 Aug)
        timeSlot: '09:00 - 16:30',
        status: 'Approved' as const,
        approvalStatus: 'approved' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 55649,
        endOdometer: undefined, // Resolved dynamically from drop #2
        totalGpsDistanceKm: 45.0,
        totalExpenses: 55,
        drops: [
          {
            id: 'd-1',
            dropNumber: 1,
            clientName: 'ร้านไปรษณีย์ไทย หลักสี่ 202 (สรงประภา)',
            address: '202 ถ.สรงประภา แขวงดอนเมือง เขตดอนเมือง กรุงเทพฯ',
            agenda: 'ส่งกระเช้าและเอกสารสัญญา',
            status: 'Completed' as const,
            odometerReading: 55668,
            checkedInAt: '10:15 น.',
            expenses: [
              {
                id: 'exp-1',
                category: 'Toll Fee',
                title: 'Toll Fee',
                amount: 55,
                receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/e929a7cd-44f6-433c-8853-f0cbc91e8927.jpeg',
              },
            ],
          },
          {
            id: 'd-2',
            dropNumber: 2,
            clientName: 'International Network System Public Company Limited (ITNS)',
            address: 'อาคาร ITNS ถ.วิภาวดีรังสิต',
            agenda: 'เข้าพบผู้บริหารและส่งมอบกระเช้าปีใหม่',
            status: 'Completed' as const,
            odometerReading: 55694,
            checkedInAt: '13:45 น.',
          },
        ],
        allExpenses: [
          {
            id: 'exp-1',
            tripId: 't-939275',
            dropNumber: 1,
            clientName: 'ร้านไปรษณีย์ไทย หลักสี่ 202 (สรงประภา)',
            category: 'Toll Fee',
            title: 'Toll Fee',
            amount: 55,
            receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/e929a7cd-44f6-433c-8853-f0cbc91e8927.jpeg',
          },
        ],
      },
      {
        id: 't-571009',
        tripCode: 'TRP-571009',
        tripTitle: 'ลูกค้ารายใหญ่',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Bangkok East & Bangna',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-22', // เสาร์ 22 Aug
        timeSlot: '09:30 - 17:30',
        status: 'Draft' as const,
        approvalStatus: 'draft' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: undefined, // Not entered
        endOdometer: undefined,
        totalGpsDistanceKm: 86.0,
        totalExpenses: 0,
        drops: [
          { id: 'd-571-1', dropNumber: 1, clientName: 'บริษัท วิงสแปน เซอร์วิสเซส จำกัด', address: 'เขตคลองเตย กรุงเทพฯ', agenda: 'เจรจาสัญญาบริการ', status: 'Scheduled' as const },
          { id: 'd-571-2', dropNumber: 2, clientName: 'บมจ. ล็อกซเล่ย์', address: 'ถ.พระราม 4 กรุงเทพฯ', agenda: 'ประชุมประจำไตรมาส', status: 'Scheduled' as const },
          { id: 'd-571-3', dropNumber: 3, clientName: 'หนองปรือ', address: 'สมุทรปราการ', agenda: 'สำรวจคลังสินค้า', status: 'Scheduled' as const },
        ],
        allExpenses: [],
      },
      {
        id: 't-246758',
        tripCode: 'TRP-246758',
        tripTitle: 'ไปไหน',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Bangkok North / Rangsit',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-21', // ศุกร์ 21 Aug
        timeSlot: '11:00 - 17:00',
        status: 'Draft' as const,
        approvalStatus: 'draft' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 56658,
        endOdometer: undefined,
        totalGpsDistanceKm: 81.7,
        totalExpenses: 0,
        drops: [
          {
            id: 'd-246-1',
            dropNumber: 1,
            clientName: 'ฟิวเจอร์พาร์คและสเปลล์',
            address: '99 ถ.พหลโยธิน ต.ประชาธิปัตย์ อ.ธัญบุรี ปทุมธานี',
            agenda: 'ตรวจสอบบูธและสำรวจพื้นที่',
            status: 'Completed' as const,
            odometerReading: 56688,
          },
          {
            id: 'd-246-2',
            dropNumber: 2,
            clientName: 'ซอย รัชดาภิเษก 36',
            address: 'ซอย รัชดาภิเษก 36 แขวงจันทรเกษม เขตจตุจักร กรุงเทพฯ',
            agenda: 'พบปะลูกค้าโซนรัชดา',
            status: 'Scheduled' as const,
          },
        ],
        allExpenses: [],
      },
      {
        id: 't-510761',
        tripCode: 'TRP-510761',
        tripTitle: 'ไปโซนดอนเมือง',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Bangkok Don Mueang & Lak Si',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-21', // ศุกร์ 21 Aug
        timeSlot: '08:30 - 16:00',
        status: 'Pending Approval' as const,
        approvalStatus: 'pending' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 65336,
        endOdometer: undefined, // Not entered -> left blank
        totalGpsDistanceKm: 67.5,
        totalExpenses: 500,
        drops: [
          { id: 'd-510-1', dropNumber: 1, clientName: 'วิทยาลัยเทคนิคดอนเมือง', address: 'ดอนเมือง กรุงเทพฯ', agenda: 'นำเสนอหลักสูตรและอุปกรณ์', status: 'Completed' as const },
          { id: 'd-510-2', dropNumber: 2, clientName: 'วัดดอนเมือง พระอารามหลวง', address: 'ดอนเมือง กรุงเทพฯ', agenda: 'ติดต่อประสานงานโครงการ', status: 'Completed' as const },
          { id: 'd-510-3', dropNumber: 3, clientName: 'เขตหลักสี่', address: 'หลักสี่ กรุงเทพฯ', agenda: 'ส่งมอบเอกสารและเข้าพบเจ้าหน้าที่', status: 'Completed' as const },
          {
            id: 'd-510-4',
            dropNumber: 4,
            clientName: 'วัดหลักสี่ พระอารามหลวง',
            address: 'หลักสี่ กรุงเทพฯ',
            agenda: 'ประสานงานและเลี้ยงรับรอง',
            status: 'Completed' as const,
            expenses: [
              {
                id: 'exp-510',
                category: 'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
                title: 'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
                amount: 500,
                receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/1000005647.jpg',
              },
            ],
          },
        ],
        allExpenses: [
          {
            id: 'exp-510',
            tripId: 't-510761',
            dropNumber: 4,
            clientName: 'วัดหลักสี่ พระอารามหลวง',
            category: 'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
            title: 'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
            amount: 500,
            receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/1000005647.jpg',
          },
        ],
      },
      {
        id: 't-347959',
        tripCode: 'TRP-347959',
        tripTitle: 'ไปสัมนา',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Nonthaburi & Bangkok North',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-19', // พุธ 19 Aug
        timeSlot: '08:00 - 18:00',
        status: 'Pending Approval' as const,
        approvalStatus: 'pending' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 59822,
        endOdometer: undefined,
        totalGpsDistanceKm: 183.9,
        totalExpenses: 150,
        drops: [
          {
            id: 'd-347-1',
            dropNumber: 1,
            clientName: 'เมืองทองธานี com',
            address: 'อิมแพ็ค เมืองทองธานี',
            agenda: 'เข้าร่วมสัมมนาวิชาการ',
            status: 'Completed' as const,
            expenses: [{ id: 'exp-347-1', category: 'toll', title: 'ค่าทางด่วน', amount: 60, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/28982ffb-483e-4236-ab66-6eaf962c05b4.jpeg' }],
          },
          {
            id: 'd-347-2',
            dropNumber: 2,
            clientName: 'Toyota bangna',
            address: 'ถ.บางนา-ตราด',
            agenda: 'ติดต่อฝ่ายจัดซื้อ',
            status: 'Completed' as const,
            expenses: [{ id: 'exp-347-2', category: 'toll', title: 'ค่าทางด่วน', amount: 90, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/41b09357-4550-46c1-b807-daaca45127e7.jpeg' }],
          },
          { id: 'd-347-3', dropNumber: 3, clientName: 'ซอย สุขุมวิท 50', address: 'พระโขนง กรุงเทพฯ', agenda: 'ส่งมอบแคตตาล็อก', status: 'Completed' as const },
          { id: 'd-347-4', dropNumber: 4, clientName: 'มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต', address: 'ปทุมธานี', agenda: 'ประชุมโครงการความร่วมมือ', status: 'Completed' as const },
          { id: 'd-347-5', dropNumber: 5, clientName: 'วิทยาลัยเทคนิคดอนเมือง', address: 'ดอนเมือง กรุงเทพฯ', agenda: 'ตรวจเช็คอุปกรณ์หน้างาน', status: 'Completed' as const },
        ],
        allExpenses: [
          { id: 'exp-347-1', tripId: 't-347959', dropNumber: 1, clientName: 'เมืองทองธานี com', category: 'toll', title: 'ค่าทางด่วน', amount: 60, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/28982ffb-483e-4236-ab66-6eaf962c05b4.jpeg' },
          { id: 'exp-347-2', tripId: 't-347959', dropNumber: 2, clientName: 'Toyota bangna', category: 'toll', title: 'ค่าทางด่วน', amount: 90, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/41b09357-4550-46c1-b807-daaca45127e7.jpeg' },
        ],
      },
      {
        id: 't-043974',
        tripCode: 'TRP-043974',
        tripTitle: 'หาลูกค้า',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Pathum Thani & Don Mueang',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-18', // อังคาร 18 Aug
        timeSlot: '09:00 - 15:30',
        status: 'Approved' as const,
        approvalStatus: 'approved' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 56888,
        endOdometer: undefined,
        totalGpsDistanceKm: 119.2,
        totalExpenses: 200,
        drops: [
          { id: 'd-043-1', dropNumber: 1, clientName: 'เขตส่งเสริมอุตสาหกรรม นวนคร ปทุมธานี', address: 'นวนคร ปทุมธานี', agenda: 'แนะนำสินค้าใหม่', status: 'Completed' as const },
          { id: 'd-043-2', dropNumber: 2, clientName: 'ฟิวเจอร์พาร์คและสเปลล์', address: 'รังสิต ปทุมธานี', agenda: 'ติดตามโปรโมชั่น', status: 'Completed' as const },
          {
            id: 'd-043-3',
            dropNumber: 3,
            clientName: 'วัดดอนเมือง พระอารามหลวง',
            address: 'ดอนเมือง กรุงเทพฯ',
            agenda: 'ประสานงาน',
            status: 'Completed' as const,
            odometerReading: 57007,
            expenses: [{ id: 'exp-043', category: 'Toll Fee', title: 'Toll Fee', amount: 200, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/374e9769-6aa5-4f64-a4e0-d60bcbe67b1c.jpeg' }],
          },
        ],
        allExpenses: [
          { id: 'exp-043', tripId: 't-043974', dropNumber: 3, clientName: 'วัดดอนเมือง พระอารามหลวง', category: 'Toll Fee', title: 'Toll Fee', amount: 200, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/374e9769-6aa5-4f64-a4e0-d60bcbe67b1c.jpeg' },
        ],
      },
      {
        id: 't-681781',
        tripCode: 'TRP-681781',
        tripTitle: 'สากาสกสหว',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Northern Region / Lampang',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-20', // พฤหัสบดี 20 Aug
        timeSlot: '08:00 - 19:00',
        status: 'Approved' as const,
        approvalStatus: 'approved' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: 45444,
        endOdometer: undefined,
        totalGpsDistanceKm: 1551.2,
        totalExpenses: 600,
        drops: [
          {
            id: 'd-681-1',
            dropNumber: 1,
            clientName: 'ฟิวเจอร์พาร์คและสเปลล์',
            address: 'รังสิต',
            agenda: 'จุดนัดพบแรก',
            status: 'Completed' as const,
            expenses: [{ id: 'exp-681-1', category: 'toll', title: 'ค่าทางด่วน', amount: 300, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/Photo-1278.jpg' }],
          },
          {
            id: 'd-681-2',
            dropNumber: 2,
            clientName: 'ซอย บ้านปงสนุก 9',
            address: 'ลำปาง',
            agenda: 'ส่งสินค้าและตรวจเช็คระบบ',
            status: 'Completed' as const,
            odometerReading: 46995,
            expenses: [
              { id: 'exp-681-2', category: 'Toll Fee', title: 'Toll Fee', amount: 100, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/162d0426-31fd-4e52-ba1b-3a7e686d64e6.jpeg' },
              { id: 'exp-681-3', category: 'toll', title: 'ค่าทางด่วน', amount: 200, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/Photo-2363.jpg' },
            ],
          },
        ],
        allExpenses: [
          { id: 'exp-681-1', tripId: 't-681781', dropNumber: 1, clientName: 'ฟิวเจอร์พาร์คและสเปลล์', category: 'toll', title: 'ค่าทางด่วน', amount: 300, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/Photo-1278.jpg' },
          { id: 'exp-681-2', tripId: 't-681781', dropNumber: 2, clientName: 'ซอย บ้านปงสนุก 9', category: 'Toll Fee', title: 'Toll Fee', amount: 100, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/162d0426-31fd-4e52-ba1b-3a7e686d64e6.jpeg' },
          { id: 'exp-681-3', tripId: 't-681781', dropNumber: 2, clientName: 'ซอย บ้านปงสนุก 9', category: 'toll', title: 'ค่าทางด่วน', amount: 200, receiptUrl: 'https://wufuewwgikdouauuoqus.supabase.co/storage/v1/object/public/expense_receipts/uploads/Photo-2363.jpg' },
        ],
      },
      {
        id: 't-881234',
        tripCode: 'TRP-881234',
        tripTitle: 'เข้าพบกลุ่มโรงพยาบาลกรุงเทพ',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Bangkok East & Bangna',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-26', // พุธ 26 Aug
        timeSlot: '09:00 - 16:00',
        status: 'Scheduled' as const,
        approvalStatus: 'draft' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: undefined,
        endOdometer: undefined,
        totalGpsDistanceKm: 75.0,
        totalExpenses: 0,
        drops: [
          { id: 'd-881-1', dropNumber: 1, clientName: 'รพ.กรุงเทพ สำนักงานใหญ่', address: 'ซอยศูนย์วิจัย ถ.เพชรบุรีตัดใหม่', agenda: 'นำเสนอระบบเทเลเมทรีและอุปกรณ์', status: 'Scheduled' as const },
          { id: 'd-881-2', dropNumber: 2, clientName: 'รพ.บำรุงราษฎร์', address: 'สุขุมวิท 3', agenda: 'ตรวจเช็คอุปกรณ์หน้างาน', status: 'Scheduled' as const },
        ],
        allExpenses: [],
      },
      {
        id: 't-992144',
        tripCode: 'TRP-992144',
        tripTitle: 'ส่งมอบสัญญาและอุปกรณ์โซนชลบุรี',
        specialistId: 'spec-kosit',
        specialistName: 'kosit goonlaboot',
        specialistNickname: 'kosit',
        employeeId: 'AITS10002772',
        specialistInitials: 'KG',
        department: 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
        territory: 'Chonburi & Eastern Seaboard',
        assignedVehicle: 'Isuzu D-Max (1กข-4452)',
        date: '2026-08-28', // ศุกร์ 28 Aug
        timeSlot: '08:00 - 17:30',
        status: 'Scheduled' as const,
        approvalStatus: 'draft' as const,
        startLocation: 'สำนักงานใหญ่',
        startOdometer: undefined,
        endOdometer: undefined,
        totalGpsDistanceKm: 195.0,
        totalExpenses: 0,
        drops: [
          { id: 'd-992-1', dropNumber: 1, clientName: 'นิคมอุตสาหกรรมอมตะซิตี้', address: 'ชลบุรี', agenda: 'ส่งมอบแคตตาล็อกและสัญญา', status: 'Scheduled' as const },
          { id: 'd-992-2', dropNumber: 2, clientName: 'ท่าเรือแหลมฉบัง', address: 'แหลมฉบัง ชลบุรี', agenda: 'ประชุมประจำไตรมาส', status: 'Scheduled' as const },
        ],
        allExpenses: [],
      },
    ];

    return rawSamples.map((s) => {
      const odoMetrics = resolveTripOdoAndGpsMetrics({
        startOdometer: s.startOdometer,
        endOdometer: s.endOdometer,
        totalGpsDistanceKm: s.totalGpsDistanceKm,
        drops: s.drops,
      });

      return {
        ...s,
        startOdometer: odoMetrics.startOdo,
        endOdometer: odoMetrics.endOdo,
        totalOdoDistanceKm: odoMetrics.totalOdoDistance,
        totalGpsDistanceKm: odoMetrics.totalGpsDistance,
      };
    });
  }

  // Filter Logic based on Date Range, Specialist, Status, and Search Query
  const filteredTrips = useMemo(() => {
    return allTrips.filter((t) => {
      // 1. Specialist Filter
      if (selectedSpecialistId !== 'all' && t.specialistId !== selectedSpecialistId) return false;

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'approved' && t.approvalStatus !== 'approved') return false;
        if (statusFilter === 'pending' && t.approvalStatus !== 'pending') return false;
        if (statusFilter === 'draft' && t.approvalStatus !== 'draft') return false;
        if (statusFilter === 'revision' && t.approvalStatus !== 'revision_requested') return false;
        if (statusFilter === 'in_progress' && t.status !== 'In Progress') return false;
      }

      // 3. Date Range Filter
      if (datePreset === 'today') {
        const todayStr = '2026-08-24';
        if (t.date !== todayStr) return false;
      } else if (datePreset === 'week') {
        const firstStr = '2026-08-23';
        const lastStr = '2026-08-29';
        if (t.date < firstStr || t.date > lastStr) return false;
      } else if (datePreset === 'month') {
        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        if (!t.date.startsWith(monthPrefix)) return false;
      } else if (datePreset === 'custom') {
        if (customStartDate && t.date < customStartDate) return false;
        if (customEndDate && t.date > customEndDate) return false;
      }

      // 4. Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = t.tripCode.toLowerCase().includes(q);
        const matchTitle = t.tripTitle.toLowerCase().includes(q);
        const matchSpec = t.specialistName.toLowerCase().includes(q) || t.specialistNickname.toLowerCase().includes(q);
        const matchDrops = t.drops.some((d) => d.clientName.toLowerCase().includes(q) || d.address.toLowerCase().includes(q));
        const matchExp = t.allExpenses.some((e) => e.category.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
        if (!matchCode && !matchTitle && !matchSpec && !matchDrops && !matchExp) return false;
      }

      return true;
    });
  }, [allTrips, selectedSpecialistId, statusFilter, datePreset, currentYear, currentMonth, customStartDate, customEndDate, searchQuery]);

  // Aggregate Metrics for 4 Soft-Tinted KPI Cards
  const metrics = useMemo(() => {
    const totalTrips = filteredTrips.length;
    const totalDrops = filteredTrips.reduce((acc, t) => acc + t.drops.length, 0);
    const completedDrops = filteredTrips.reduce((acc, t) => acc + t.drops.filter((d) => d.status === 'Completed').length, 0);
    const totalOdoDist = filteredTrips.reduce((acc, t) => acc + (t.totalOdoDistanceKm || 0), 0);
    const totalGpsDist = filteredTrips.reduce((acc, t) => acc + (t.totalGpsDistanceKm || 0), 0);
    const totalExpenses = filteredTrips.reduce((acc, t) => acc + (t.totalExpenses || 0), 0);

    return {
      totalTrips,
      totalDrops,
      completedDrops,
      totalOdoDist,
      totalGpsDist,
      totalExpenses,
    };
  }, [filteredTrips]);

  // Flattened Table Items (1 row per Drop & Expense, with full comprehensive metadata)
  const flattenedReportRows = useMemo(() => {
    const rows: Array<{
      tripCode: string;
      planName: string;
      date: string;
      specialistName: string;
      nickname: string;
      employeeId: string;
      department: string;
      territory: string;
      assignedVehicle: string;
      tripStartOdo?: number | string;
      tripEndOdo?: number | string;
      totalOdoDistance?: number | string;
      totalGpsDistance?: number | string;
      totalTripExpenses?: number | string;
      approvalStatus: string;
      dropNo?: number | string;
      clientDestination?: string;
      destinationAddress?: string;
      agenda?: string;
      checkInAt?: string;
      dropGpsDistance?: number | string;
      dropOdoDistance?: number | string;
      dropOdometerReading?: number | string;
      meetingMinutes?: string;
      expenseCategory?: string;
      expenseTitle?: string;
      expenseAmount?: number | string;
      receiptUrl?: string;
    }> = [];

    filteredTrips.forEach((trip) => {
      const odoMetrics = resolveTripOdoAndGpsMetrics(trip);
      const totalOdoStr = odoMetrics.totalOdoDistance !== undefined ? odoMetrics.totalOdoDistance : '';
      const totalGpsStr = odoMetrics.totalGpsDistance !== undefined ? odoMetrics.totalGpsDistance : '';
      const totalExpStr = trip.totalExpenses !== undefined ? trip.totalExpenses : '';

      const dropTelemList = resolveDropTelemetryList(
        odoMetrics.startOdo,
        13.7285,
        100.5345,
        trip.drops,
        odoMetrics.totalGpsDistance
      );

      if (trip.drops.length > 0) {
        trip.drops.forEach((drop, dIdx) => {
          const telem = dropTelemList.find((g) => g.dropId === drop.id || g.dropNumber === drop.dropNumber) || dropTelemList[dIdx];
          const legGps = drop.dropGpsDistance !== undefined ? drop.dropGpsDistance : telem?.dropGpsDistance;
          const legOdo = drop.dropOdoDistance !== undefined ? drop.dropOdoDistance : telem?.dropOdoDistance;
          const odoReading = drop.odometerReading !== undefined ? drop.odometerReading : telem?.odometerReading;

          if (drop.expenses && drop.expenses.length > 0) {
            drop.expenses.forEach((exp) => {
              rows.push({
                tripCode: trip.tripCode,
                planName: trip.tripTitle,
                date: trip.date,
                specialistName: trip.specialistName,
                nickname: trip.specialistNickname,
                employeeId: trip.employeeId,
                department: trip.department,
                territory: trip.territory,
                assignedVehicle: trip.assignedVehicle,
                tripStartOdo: odoMetrics.startOdo,
                tripEndOdo: odoMetrics.endOdo,
                totalOdoDistance: totalOdoStr,
                totalGpsDistance: totalGpsStr,
                totalTripExpenses: totalExpStr,
                approvalStatus: trip.approvalStatus,
                dropNo: drop.dropNumber,
                clientDestination: drop.clientName,
                destinationAddress: drop.address,
                agenda: drop.agenda,
                checkInAt: drop.checkedInAt || '',
                dropGpsDistance: legGps !== undefined ? legGps : '',
                dropOdoDistance: legOdo !== undefined ? legOdo : '',
                dropOdometerReading: odoReading !== undefined ? odoReading : '',
                meetingMinutes: drop.meetingMinutes || '',
                expenseCategory: exp.category,
                expenseTitle: exp.title,
                expenseAmount: exp.amount,
                receiptUrl: exp.receiptUrl || '',
              });
            });
          } else {
            rows.push({
              tripCode: trip.tripCode,
              planName: trip.tripTitle,
              date: trip.date,
              specialistName: trip.specialistName,
              nickname: trip.specialistNickname,
              employeeId: trip.employeeId,
              department: trip.department,
              territory: trip.territory,
              assignedVehicle: trip.assignedVehicle,
              tripStartOdo: odoMetrics.startOdo,
              tripEndOdo: odoMetrics.endOdo,
              totalOdoDistance: totalOdoStr,
              totalGpsDistance: totalGpsStr,
              totalTripExpenses: totalExpStr,
              approvalStatus: trip.approvalStatus,
              dropNo: drop.dropNumber,
              clientDestination: drop.clientName,
              destinationAddress: drop.address,
              agenda: drop.agenda,
              checkInAt: drop.checkedInAt || '',
              dropGpsDistance: legGps !== undefined ? legGps : '',
              dropOdoDistance: legOdo !== undefined ? legOdo : '',
              dropOdometerReading: odoReading !== undefined ? odoReading : '',
              meetingMinutes: drop.meetingMinutes || '',
              expenseCategory: '',
              expenseTitle: '',
              expenseAmount: '',
              receiptUrl: '',
            });
          }
        });
      } else {
        rows.push({
          tripCode: trip.tripCode,
          planName: trip.tripTitle,
          date: trip.date,
          specialistName: trip.specialistName,
          nickname: trip.specialistNickname,
          employeeId: trip.employeeId,
          department: trip.department,
          territory: trip.territory,
          assignedVehicle: trip.assignedVehicle,
          tripStartOdo: odoMetrics.startOdo,
          tripEndOdo: odoMetrics.endOdo,
          totalOdoDistance: totalOdoStr,
          totalGpsDistance: totalGpsStr,
          totalTripExpenses: totalExpStr,
          approvalStatus: trip.approvalStatus,
          dropNo: '',
          clientDestination: '',
          destinationAddress: '',
          agenda: '',
          checkInAt: '',
          dropGpsDistance: '',
          dropOdoDistance: '',
          dropOdometerReading: '',
          meetingMinutes: '',
          expenseCategory: '',
          expenseTitle: '',
          expenseAmount: '',
          receiptUrl: '',
        });
      }
    });

    return rows;
  }, [filteredTrips]);

  // One-Click Excel (CSV with UTF-8 BOM) Exporter
  const handleExportExcel = () => {
    if (flattenedReportRows.length === 0) {
      showToast('⚠️ ไม่มีข้อมูลการเดินทางสำหรับการส่งออก');
      return;
    }

    const headers = [
      'Trip Code',
      'Plan / Route Name',
      'Date',
      'Specialist Name',
      'Nickname',
      'Employee ID',
      'Department',
      'Territory',
      'Assigned Vehicle',
      'Start ODO',
      'End ODO',
      'Total ODO (km)',
      'Total GPS (km)',
      'Trip Exp. (฿)',
      'Approval Status',
      'Drop #',
      'Client / Destination',
      'Destination Address',
      'Agenda',
      'Check-in Time',
      'Drop GPS (km)',
      'Drop ODO (km)',
      'Drop ODO Reading',
      'Meeting Notes',
      'Expense Cat.',
      'Expense Title',
      'Amount (฿)',
      'Receipt URL',
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined || str === '') return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...flattenedReportRows.map((r) =>
          [
            escapeCsv(r.tripCode),
            escapeCsv(r.planName),
            escapeCsv(r.date),
            escapeCsv(r.specialistName),
            escapeCsv(r.nickname),
            escapeCsv(r.employeeId),
            escapeCsv(r.department),
            escapeCsv(r.territory),
            escapeCsv(r.assignedVehicle),
            escapeCsv(r.tripStartOdo !== undefined ? Number(r.tripStartOdo).toLocaleString() : '-'),
            escapeCsv(r.tripEndOdo !== undefined ? Number(r.tripEndOdo).toLocaleString() : '-'),
            escapeCsv(r.totalOdoDistance !== '' && r.totalOdoDistance !== undefined && r.totalOdoDistance !== '-' ? Number(r.totalOdoDistance).toLocaleString() : '-'),
            escapeCsv(r.totalGpsDistance !== '' && r.totalGpsDistance !== undefined && r.totalGpsDistance !== '-' ? Number(r.totalGpsDistance).toLocaleString() : '-'),
            escapeCsv(r.totalTripExpenses !== '' && r.totalTripExpenses !== undefined && r.totalTripExpenses !== '-' ? `฿${Number(r.totalTripExpenses).toLocaleString()}` : '฿0'),
            escapeCsv(r.approvalStatus),
            escapeCsv(r.dropNo ? `#${r.dropNo}` : '-'),
            escapeCsv(r.clientDestination || '-'),
            escapeCsv(r.destinationAddress || '-'),
            escapeCsv(r.agenda || '-'),
            escapeCsv(r.checkInAt || '-'),
            escapeCsv(r.dropGpsDistance !== '' && r.dropGpsDistance !== undefined && r.dropGpsDistance !== '-' ? Number(r.dropGpsDistance).toLocaleString() : '-'),
            escapeCsv(r.dropOdoDistance !== '' && r.dropOdoDistance !== undefined && r.dropOdoDistance !== '-' ? Number(r.dropOdoDistance).toLocaleString() : '-'),
            escapeCsv(r.dropOdometerReading !== '' && r.dropOdometerReading !== undefined && r.dropOdometerReading !== '-' ? Number(r.dropOdometerReading).toLocaleString() : '-'),
            escapeCsv(r.meetingMinutes || '-'),
            escapeCsv(r.expenseCategory || '-'),
            escapeCsv(r.expenseTitle || '-'),
            escapeCsv(r.expenseAmount !== '' && r.expenseAmount !== undefined ? `฿${Number(r.expenseAmount).toLocaleString()}` : '-'),
            escapeCsv(r.receiptUrl || '-'),
          ].join(',')
        ),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `FastFleet_Trip_Schedule_Report_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('📊 ส่งออกรายงาน Excel (.csv) เรียบร้อยแล้ว');
  };

  // Calendar Grid Days Calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

    const days: Array<{
      dayNumber: number | null;
      dateStr: string | null;
      isToday: boolean;
      trips: SpecialistTripSchedule[];
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ dayNumber: null, dateStr: null, isToday: false, trips: [] });
    }

    const todayStr = '2026-08-24';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrips = filteredTrips.filter((t) => t.date === dateStr);
      days.push({
        dayNumber: d,
        dateStr,
        isToday: dateStr === todayStr,
        trips: dayTrips,
      });
    }

    return days;
  }, [currentYear, currentMonth, filteredTrips]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setDatePreset('today');
  };

  const getStatusBadge = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st.includes('approved')) {
      return {
        label: '✓ อนุมัติแล้ว',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200/80 dark:border-emerald-800/60',
        dot: 'bg-emerald-500',
      };
    }
    if (st.includes('pending')) {
      return {
        label: '⏳ รออนุมัติ',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200/80 dark:border-blue-800/60',
        dot: 'bg-blue-500 animate-pulse',
      };
    }
    if (st.includes('revision')) {
      return {
        label: '⚠️ ส่งกลับแก้ไข',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200/80 dark:border-rose-800/60',
        dot: 'bg-rose-500',
      };
    }
    if (st.includes('in progress') || st.includes('in_progress')) {
      return {
        label: '🚗 กำลังเดินทาง',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200/80 dark:border-amber-800/60',
        dot: 'bg-amber-500 animate-pulse',
      };
    }
    if (st.includes('completed')) {
      return {
        label: '✓ เสร็จสิ้น',
        bg: 'bg-teal-50 dark:bg-teal-950/40',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-200/80 dark:border-teal-800/60',
        dot: 'bg-teal-500',
      };
    }
    return {
      label: '📝 แบบร่าง (Draft)',
      bg: 'bg-slate-100 dark:bg-slate-800/60',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200/80 dark:border-slate-700/60',
      dot: 'bg-slate-400',
    };
  };

  const weekdays = [
    { name: t('schedule_days_sun'), color: 'text-rose-600 dark:text-rose-400' },
    { name: t('schedule_days_mon'), color: '' },
    { name: t('schedule_days_tue'), color: '' },
    { name: t('schedule_days_wed'), color: '' },
    { name: t('schedule_days_thu'), color: '' },
    { name: t('schedule_days_fri'), color: '' },
    { name: t('schedule_days_sat'), color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in text-xs font-semibold">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Dual Persona Switcher */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
              {language === 'th' ? 'ตารางงาน & สรุปการเดินทาง' : 'Trip Schedule & Execution Hub'}
            </h1>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70">
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              {userRole === 'admin' ? 'Manager & Specialist Hub' : 'My Schedule & Summary'}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {language === 'th'
              ? 'ดูภาพรวมการเดินทางของทีมหรือเฉพาะตนเอง ตรวจสอบ ODO, รายการเข้าพบลูกค้า, ค่าใช้จ่าย และดาวน์โหลดรายงาน Excel'
              : 'Monitor team & personal schedules, ODO metrics, client visit agendas, itemized expenses, and export Excel reports'}
          </p>
        </div>

        {/* Action Controls: Export Excel & 4 View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
          {/* Export to Excel CTA Button */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all tactile-btn cursor-pointer"
            title="ดาวน์โหลดข้อมูลเป็นไฟล์ Excel (.csv)"
          >
            <span className="material-symbols-outlined text-[17px]">table_view</span>
            <span>{language === 'th' ? `ส่งออก Excel (${flattenedReportRows.length} แถว)` : `Export Excel (${flattenedReportRows.length} rows)`}</span>
          </button>

          {/* 4 View Modes */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-hide">
            {[
              { id: 'calendar', label: language === 'th' ? 'ปฏิทิน' : 'Calendar', icon: 'calendar_view_month' },
              { id: 'list', label: language === 'th' ? 'รายการทริป' : 'Trip Cards', icon: 'view_list' },
              { id: 'table', label: language === 'th' ? 'ตารางแจกแจง' : 'Detailed Table', icon: 'receipt_long' },
              { id: 'summary', label: language === 'th' ? 'สรุปผล' : 'Summary', icon: 'monitoring' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer tactile-btn whitespace-nowrap shrink-0 ${
                  viewMode === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Specialist Team & Persona Selector Ribbon */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">badge</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {language === 'th' ? 'เลือกมุมมองพนักงาน (Specialist Scope):' : 'Select Specialist Scope:'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium font-mono tnum">
            {language === 'th' ? `พบ ${filteredTrips.length} ทริป` : `${filteredTrips.length} trips matching`}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {/* 'All Specialists' Pill */}
          <button
            onClick={() => setSelectedSpecialistId('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 border tactile-btn cursor-pointer ${
              selectedSpecialistId === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            <span>{language === 'th' ? `ภาพรวมทั้งทีม (${allTrips.length})` : `All Team (${allTrips.length})`}</span>
          </button>

          {/* Individual Specialists */}
          {specialists.map((spec) => {
            const isSelected = selectedSpecialistId === spec.id;
            const specTripsCount = allTrips.filter((t) => t.specialistId === spec.id).length;
            const isCurrentUser = spec.name.toLowerCase().includes(currentUserName.toLowerCase());

            return (
              <button
                key={spec.id}
                onClick={() => setSelectedSpecialistId(spec.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 border tactile-btn cursor-pointer ${
                  isSelected
                    ? 'soft-tint-blue border-blue-500 ring-2 ring-blue-500/30 text-blue-900 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                {spec.avatar ? (
                  <img src={spec.avatar} alt={spec.name} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] flex items-center justify-center">
                    {spec.initials}
                  </div>
                )}
                <div className="text-left">
                  <div className="truncate max-w-[150px] flex items-center gap-1">
                    <span>{spec.name}</span>
                    {isCurrentUser && (
                      <span className="text-[9px] px-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-black">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tnum">
                    {spec.employeeId} • {specTripsCount} ทริป
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range & Status Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col xl:flex-row gap-3.5 items-stretch xl:items-center justify-between">
        {/* Search Box */}
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder="ค้นหารหัสทริป (TRP-xxx), วาระเข้าพบ, ชื่อลูกค้า, หรือประเภทค่าใช้จ่าย..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50/90 dark:bg-slate-800/60 pl-10 pr-4 py-2 rounded-2xl text-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700/70 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Date Presets & Pickers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-hide">
            {[
              { id: 'today', label: 'วันนี้' },
              { id: 'week', label: 'สัปดาห์นี้' },
              { id: 'month', label: 'เดือนนี้' },
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'custom', label: 'กำหนดเอง' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all tactile-btn cursor-pointer whitespace-nowrap shrink-0 ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none px-1.5 cursor-pointer"
              />
              <span className="text-slate-400 font-bold text-xs">➔</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none px-1.5 cursor-pointer"
              />
            </div>
          )}

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 focus:outline-none cursor-pointer"
          >
            <option value="all">สถานะทริปทั้งหมด</option>
            <option value="approved">✓ อนุมัติแล้ว (Approved)</option>
            <option value="pending">⏳ รออนุมัติ (Pending)</option>
            <option value="revision">⚠️ ส่งกลับแก้ไข (Revision)</option>
            <option value="in_progress">🚗 กำลังเดินทาง (In Progress)</option>
            <option value="draft">📝 แบบร่าง (Draft)</option>
          </select>
        </div>
      </div>

      {/* 4 Soft Tinted Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Trips */}
        <div className="soft-tint-blue p-5 rounded-3xl transition-all hover:shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              {language === 'th' ? 'จำนวนทริปทั้งหมด' : 'Total Trips'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/70 dark:border-blue-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">route</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-950 dark:text-blue-100 font-mono tnum tracking-tight">
              {metrics.totalTrips}
            </span>
            <span className="text-xs text-blue-700/80 dark:text-blue-400/80 font-medium">
              {language === 'th' ? 'ทริปในเงื่อนไข' : 'trips'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-blue-700/80 dark:text-blue-400/80 font-medium">
            {metrics.totalTrips > 0 ? 'ตามช่วงเวลาที่กำหนด' : 'ไม่มีทริปในช่วงนี้'}
          </div>
        </div>

        {/* Metric 2: Completed Drops */}
        <div className="soft-tint-emerald p-5 rounded-3xl transition-all hover:shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {language === 'th' ? 'จุดเข้าพบลูกค้า' : 'Client Drops'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/70 dark:border-emerald-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">storefront</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-950 dark:text-emerald-100 font-mono tnum tracking-tight">
              {metrics.completedDrops}
            </span>
            <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium tnum">
              / {metrics.totalDrops} {language === 'th' ? 'จุดเสร็จสิ้น' : 'visited'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
            อัตราสำเร็จ {metrics.totalDrops > 0 ? Math.round((metrics.completedDrops / metrics.totalDrops) * 100) : 0}%
          </div>
        </div>

        {/* Metric 3: Total Distance */}
        <div className="soft-tint-purple p-5 rounded-3xl transition-all hover:shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              {language === 'th' ? 'ระยะทางรวม ODO / GPS' : 'Total Distance'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/70 dark:border-purple-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">speed</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-950 dark:text-purple-100 font-mono tnum tracking-tight">
              {metrics.totalGpsDist.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-purple-700/80 dark:text-purple-400/80 font-medium">กม. (GPS)</span>
          </div>
          <div className="mt-1 text-[11px] text-purple-700/80 dark:text-purple-400/80 font-medium tnum">
            ODO รวม: {metrics.totalOdoDist > 0 ? `${metrics.totalOdoDist.toLocaleString()} กม.` : '-'}
          </div>
        </div>

        {/* Metric 4: Total Expenses */}
        <div className="soft-tint-amber p-5 rounded-3xl transition-all hover:shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              {language === 'th' ? 'ยอดเบิกจ่ายรวม' : 'Total Expenses'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/70 dark:border-amber-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-950 dark:text-amber-100 font-mono tnum tracking-tight">
              ฿{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">
            ทางด่วน, ที่จอดรถ, น้ำมัน และเลี้ยงรับรอง
          </div>
        </div>
      </div>

      {/* Main Content Areas based on selected View Mode */}
      {viewMode === 'calendar' && (
        /* ========================================================================= */
        /* VIEW 1: MONTHLY CALENDAR VIEW */
        /* ========================================================================= */
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-4">
          {/* Navigation Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <button
                onClick={handleGoToday}
                className="px-3 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer tactile-btn"
              >
                วันนี้
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer tactile-btn"
                title="เดือนก่อนหน้า"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer tactile-btn"
                title="เดือนถัดไป"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="min-w-[580px] sm:min-w-0">
                {/* Weekday Header */}
                <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800/80 text-center font-bold text-xs py-2.5 border-b border-slate-200/80 dark:border-slate-800">
                  {weekdays.map((w, idx) => (
                    <div key={idx} className={w.color || 'text-slate-700 dark:text-slate-300'}>
                      {w.name}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
                  {calendarDays.map((d, idx) => (
                    <div
                      key={idx}
                      className={`min-h-[110px] sm:min-h-[125px] p-2 flex flex-col justify-start transition-colors ${
                        !d.dayNumber
                          ? 'bg-slate-50/40 dark:bg-slate-800/20'
                          : d.isToday
                          ? 'bg-blue-50/40 dark:bg-blue-950/30'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-850/40'
                      }`}
                    >
                      {d.dayNumber ? (
                        <>
                          <div
                            onClick={() => {
                              if (d.trips.length > 0 && d.dateStr) {
                                setSelectedDaySchedule({
                                  dayNumber: d.dayNumber!,
                                  dateStr: d.dateStr,
                                  trips: d.trips,
                                });
                              }
                            }}
                            className={`flex items-center justify-between text-xs pb-1 select-none ${
                              d.trips.length > 0 ? 'cursor-pointer group' : ''
                            }`}
                            title={d.trips.length > 0 ? `ดูสรุปทั้ง ${d.trips.length} ทริปของวันนี้` : undefined}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold font-mono tnum ${
                                  d.isToday
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 w-6 h-6 rounded-full flex items-center justify-center -ml-0.5'
                                    : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                }`}
                              >
                                {d.dayNumber}
                              </span>
                              {d.isToday && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                                  วันนี้
                                </span>
                              )}
                            </div>

                            {d.trips.length > 0 && (
                              <span className="text-[9.5px] font-bold font-mono text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md transition-colors">
                                {d.trips.length} ทริป
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 mt-1 flex-1">
                            {/* Render all trips if <= 4, or first 3 + interactive button if > 4 */}
                            {(d.trips.length <= 4 ? d.trips : d.trips.slice(0, 3)).map((tr) => {
                              const badge = getStatusBadge(tr.status);
                              return (
                                <div
                                  key={tr.id}
                                  onClick={() => setSelectedTrip(tr)}
                                  className={`p-1.5 rounded-xl text-[10.5px] font-bold border truncate cursor-pointer hover:opacity-85 hover:scale-[1.01] transition-all tactile-btn flex items-center justify-between gap-1 shadow-2xs ${badge.bg} ${badge.text} ${badge.border}`}
                                  title={`${tr.specialistName}: ${tr.tripTitle} (${tr.tripCode})`}
                                >
                                  <span className="truncate">{tr.tripTitle}</span>
                                  {tr.totalExpenses > 0 && (
                                    <span className="text-[9px] opacity-80 shrink-0 font-mono">฿{tr.totalExpenses}</span>
                                  )}
                                </div>
                              );
                            })}

                            {d.trips.length > 4 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (d.dateStr) {
                                    setSelectedDaySchedule({
                                      dayNumber: d.dayNumber!,
                                      dateStr: d.dateStr,
                                      trips: d.trips,
                                    });
                                  }
                                }}
                                className="w-full text-[9.5px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-lg py-1 px-1.5 transition-all text-center border border-blue-200/70 dark:border-blue-800/70 cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                              >
                                <span>+{d.trips.length - 3} ทริปเพิ่มเติม</span>
                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                              </button>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        /* ========================================================================= */
        /* VIEW 2: TRIP CARDS LIST VIEW */
        /* ========================================================================= */
        <div className="space-y-3.5">
          {filteredTrips.length === 0 ? (
            <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">event_busy</span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่พบข้อมูลการเดินทางตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400">ลองเปลี่ยนช่วงเวลา, ตัวกรองพนักงาน, หรือคำค้นหา</p>
            </div>
          ) : (
            filteredTrips.map((tr) => {
              const badge = getStatusBadge(tr.status);
              const closedDrops = tr.drops.filter((d) => d.status === 'Completed').length;

              return (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTrip(tr)}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer space-y-3.5 shadow-2xs tactile-btn"
                >
                  {/* Top Bar: Code, Title, Specialist, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-sm shrink-0 border border-blue-200/80 dark:border-blue-800/70">
                        {tr.specialistInitials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                            {tr.tripCode}
                          </span>
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{tr.tripTitle}</h3>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {tr.specialistName} ({tr.specialistNickname}) • {tr.assignedVehicle} • {tr.territory}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl font-mono">
                        📅 {tr.date}
                      </span>
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Strip: ODO, GPS Distance, Drops, Expenses */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
                    <div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">ODO เริ่ม / จบ:</div>
                      <div className="font-extrabold text-slate-900 dark:text-white font-mono tnum">
                        {tr.startOdometer ? tr.startOdometer.toLocaleString() : '-'} ➔ {tr.endOdometer ? tr.endOdometer.toLocaleString() : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">ระยะทาง ODO / GPS:</div>
                      <div className="font-extrabold text-blue-600 dark:text-blue-400 font-mono tnum">
                        {tr.totalOdoDistanceKm !== undefined ? `${tr.totalOdoDistanceKm} km` : '-'} ({tr.totalGpsDistanceKm || 0} GPS)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">ความคืบหน้าจุดนัด:</div>
                      <div className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tnum">
                        {closedDrops}/{tr.drops.length} จุด ({tr.drops.length > 0 ? Math.round((closedDrops / tr.drops.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">ค่าใช้จ่ายรวม:</div>
                      <div className="font-extrabold text-amber-600 dark:text-amber-400 font-mono tnum">
                        ฿{tr.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Drops Checklist preview */}
                  {tr.drops.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        จุดเข้าพบ ({tr.drops.length} จุด):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {tr.drops.map((dp) => (
                          <div
                            key={dp.id}
                            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                #{dp.dropNumber} {dp.clientName}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{dp.address}</div>
                              {dp.odometerReading && (
                                <div className="text-[10px] text-blue-600 font-mono">ODO: {dp.odometerReading.toLocaleString()}</div>
                              )}
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${dp.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {dp.status === 'Completed' ? '✓' : 'รอ'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === 'table' && (
        /* ========================================================================= */
        /* VIEW 3: DETAILED DROPS & EXPENSES TABLE (Exact Excel Schema) */
        /* ========================================================================= */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {language === 'th' ? 'ตารางแจกแจงทริป, จุดเข้าพบ และค่าใช้จ่าย (Report Breakdown)' : 'Detailed Itemized Report Breakdown'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'th'
                  ? `End ODO และ Total ODO ดึงจากจุดล่าสุดที่มี หากไม่ได้ใส่จะเว้นว่างไว้ (-) • ทั้งหมด ${flattenedReportRows.length} แถว`
                  : `End ODO & Total ODO resolved from latest drop entered (or blank if unentered) • ${flattenedReportRows.length} rows`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold font-mono border border-emerald-200 dark:border-emerald-800">
                {flattenedReportRows.length} รายการแถว
              </span>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 pl-4">Trip Code</th>
                  <th className="p-3">Plan / Route Name</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Specialist Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3 text-right">Start ODO</th>
                  <th className="p-3 text-right">End ODO</th>
                  <th className="p-3 text-right">Total ODO (km)</th>
                  <th className="p-3 text-right">Total GPS (km)</th>
                  <th className="p-3 text-right">Trip Exp. (฿)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Drop #</th>
                  <th className="p-3">Client / Destination</th>
                  <th className="p-3 text-right">Drop GPS (km)</th>
                  <th className="p-3 text-right">Drop ODO (km)</th>
                  <th className="p-3 text-right">Drop ODO</th>
                  <th className="p-3">Expense Cat.</th>
                  <th className="p-3">Expense Title</th>
                  <th className="p-3 text-right">Amount (฿)</th>
                  <th className="p-3 text-center pr-4">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {flattenedReportRows.map((r, idx) => {
                  const badge = getStatusBadge(r.approvalStatus);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 pl-4 font-mono font-bold text-blue-600 dark:text-blue-400">{r.tripCode}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">{r.planName}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{r.date}</td>
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{r.specialistName}</td>
                      <td className="p-3 font-mono text-slate-500">{r.employeeId}</td>
                      <td className="p-3 text-right font-mono tnum">{r.tripStartOdo !== undefined ? Number(r.tripStartOdo).toLocaleString() : '-'}</td>
                      <td className="p-3 text-right font-mono tnum">{r.tripEndOdo !== undefined ? Number(r.tripEndOdo).toLocaleString() : '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600 tnum">
                        {r.totalOdoDistance !== '' && r.totalOdoDistance !== undefined && r.totalOdoDistance !== '-' ? Number(r.totalOdoDistance).toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 tnum">
                        {r.totalGpsDistance !== '' && r.totalGpsDistance !== undefined && r.totalGpsDistance !== '-' ? Number(r.totalGpsDistance).toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-600 tnum">
                        {r.totalTripExpenses !== '' && r.totalTripExpenses !== undefined && r.totalTripExpenses !== '-' ? `฿${Number(r.totalTripExpenses).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {r.approvalStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">{r.dropNo ? `#${r.dropNo}` : '-'}</td>
                      <td className="p-3 max-w-[220px] truncate text-slate-800 dark:text-slate-200">{r.clientDestination || '-'}</td>
                      <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400 font-medium tnum">
                        {r.dropGpsDistance !== '' && r.dropGpsDistance !== undefined && r.dropGpsDistance !== '-' ? `${Number(r.dropGpsDistance).toLocaleString()} km` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 tnum">
                        {r.dropOdoDistance !== '' && r.dropOdoDistance !== undefined && r.dropOdoDistance !== '-' ? `${Number(r.dropOdoDistance).toLocaleString()} km` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400 tnum">
                        {r.dropOdometerReading !== '' && r.dropOdometerReading !== undefined && r.dropOdometerReading !== '-' ? Number(r.dropOdometerReading).toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{r.expenseCategory || '-'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">{r.expenseTitle || '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 tnum">
                        {r.expenseAmount !== '' && r.expenseAmount !== undefined ? `฿${Number(r.expenseAmount).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-center pr-4">
                        {r.receiptUrl ? (
                          <button
                            onClick={() =>
                              setPreviewPhoto({
                                url: r.receiptUrl!,
                                location: `${r.clientDestination || r.planName} • ${r.expenseCategory}`,
                                amount: typeof r.expenseAmount === 'number' ? r.expenseAmount : undefined,
                              })
                            }
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-all tactile-btn cursor-pointer"
                            title="คลิกเพื่อดูสลิปหลักฐาน"
                          >
                            <span className="material-symbols-outlined text-[14px]">image</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'summary' && (
        /* ========================================================================= */
        /* VIEW 4: CATEGORY BREAKDOWN & STATS SUMMARY */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Expenses by Category Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">donut_small</span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">หมวดหมู่ค่าใช้จ่าย (Expense Categories)</h3>
              </div>
              <span className="font-bold font-mono text-xs text-amber-600">
                รวม ฿{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {(() => {
              const catTotals: Record<string, number> = {};
              filteredTrips.forEach((t) => {
                t.allExpenses.forEach((e) => {
                  const cat = e.category || 'อื่นๆ';
                  catTotals[cat] = (catTotals[cat] || 0) + e.amount;
                });
              });

              const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

              return (
                <div className="space-y-3">
                  {entries.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">ไม่มีรายการค่าใช้จ่ายในเงื่อนไขที่เลือก</div>
                  ) : (
                    entries.map(([cat, amt]) => {
                      const pct = metrics.totalExpenses > 0 ? Math.round((amt / metrics.totalExpenses) * 100) : 0;
                      return (
                        <div key={cat} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{cat}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              ฿{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>

          {/* Trips by Status Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">fact_check</span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">สถานะการอนุมัติ (Approval Status)</h3>
              </div>
              <span className="font-bold font-mono text-xs text-blue-600">รวม {filteredTrips.length} ทริป</span>
            </div>

            {(() => {
              const approvedCount = filteredTrips.filter((t) => t.approvalStatus === 'approved').length;
              const pendingCount = filteredTrips.filter((t) => t.approvalStatus === 'pending').length;
              const revisionCount = filteredTrips.filter((t) => t.approvalStatus === 'revision_requested').length;
              const draftCount = filteredTrips.filter((t) => t.approvalStatus === 'draft').length;

              const items = [
                { label: '✓ อนุมัติแล้ว (Approved)', count: approvedCount, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
                { label: '⏳ รออนุมัติ (Pending Approval)', count: pendingCount, color: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
                { label: '⚠️ ส่งกลับแก้ไข (Revision)', count: revisionCount, color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
                { label: '📝 แบบร่าง (Draft)', count: draftCount, color: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-400' },
              ];

              return (
                <div className="space-y-3">
                  {items.map((it) => {
                    const pct = filteredTrips.length > 0 ? Math.round((it.count / filteredTrips.length) * 100) : 0;
                    return (
                      <div key={it.label} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${it.text}`}>{it.label}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {it.count} ทริป ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${it.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Day Schedule Overview Modal */}
      {selectedDaySchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[22px]">calendar_today</span>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    ตารางทริปวันที่ {selectedDaySchedule.dayNumber} {monthNames[currentMonth]} {currentYear}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  มีทั้งหมด <strong>{selectedDaySchedule.trips.length} ทริป</strong> ในวันนี้
                </p>
              </div>
              <button
                onClick={() => setSelectedDaySchedule(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Day Quick Summary Stats */}
            {(() => {
              const dayDrops = selectedDaySchedule.trips.reduce((acc, t) => acc + t.drops.length, 0);
              const dayCompletedDrops = selectedDaySchedule.trips.reduce(
                (acc, t) => acc + t.drops.filter((d) => d.status === 'Completed').length,
                0
              );
              const dayGpsDist = selectedDaySchedule.trips.reduce((acc, t) => acc + (t.totalGpsDistanceKm || 0), 0);
              const dayExp = selectedDaySchedule.trips.reduce((acc, t) => acc + (t.totalExpenses || 0), 0);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs">
                  <div>
                    <div className="text-[10.5px] text-slate-500 font-medium">จำนวนทริป:</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {selectedDaySchedule.trips.length} ทริป
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500 font-medium">จุดเข้าพบ:</div>
                    <div className="font-mono font-bold text-emerald-600 text-sm">
                      {dayCompletedDrops}/{dayDrops} จุด
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500 font-medium">ระยะทางรวม:</div>
                    <div className="font-mono font-bold text-purple-600 text-sm">
                      {dayGpsDist.toLocaleString(undefined, { maximumFractionDigits: 1 })} กม.
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500 font-medium">ค่าใช้จ่ายรวม:</div>
                    <div className="font-mono font-bold text-amber-600 text-sm">
                      ฿{dayExp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Trips List for the day */}
            <div className="space-y-3">
              {selectedDaySchedule.trips.map((tr, idx) => {
                const badge = getStatusBadge(tr.status);
                const closedDrops = tr.drops.filter((d) => d.status === 'Completed').length;
                return (
                  <div
                    key={tr.id || idx}
                    onClick={() => {
                      setSelectedTrip(tr);
                    }}
                    className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer shadow-2xs hover:shadow-xs space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                          {tr.tripCode}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {tr.tripTitle}
                        </h4>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>👤 {tr.specialistName} ({tr.specialistNickname})</span>
                      <span>🚗 {tr.assignedVehicle}</span>
                      <span>⏱️ {tr.timeSlot}</span>
                    </div>

                    {/* Drops Strip */}
                    {tr.drops.length > 0 && (
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          📍 จุดเข้าพบ ({closedDrops}/{tr.drops.length} สำเร็จ):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tr.drops.map((dp, dIdx) => (
                            <span
                              key={dp.id || dIdx}
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${
                                dp.status === 'Completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              #{dp.dropNumber} {dp.clientName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metrics strip */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                        <span>
                          🛰️ GPS: <strong className="font-mono text-purple-600">{tr.totalGpsDistanceKm || 0} km</strong>
                        </span>
                        {tr.totalExpenses > 0 && (
                          <span>
                            💰 เบิกจ่าย:{' '}
                            <strong className="font-mono text-amber-600">
                              ฿{tr.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </span>
                        )}
                      </div>
                      <div className="text-blue-600 dark:text-blue-400 font-bold text-[11px] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>ดูรายละเอียดทริป</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Deep Inspection Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {selectedTrip.tripCode}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{selectedTrip.tripTitle}</h3>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  พนักงาน: <strong>{selectedTrip.specialistName}</strong> ({selectedTrip.employeeId}) • 📅 {selectedTrip.date}
                </div>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Telemetry Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs">
              <div>
                <div className="text-[10.5px] text-slate-500 font-medium">ODO Start / End:</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white tnum">
                  {selectedTrip.startOdometer ? selectedTrip.startOdometer.toLocaleString() : '-'} ➔{' '}
                  {selectedTrip.endOdometer ? selectedTrip.endOdometer.toLocaleString() : '-'}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 font-medium">ระยะทาง ODO:</div>
                <div className="font-mono font-bold text-blue-600 tnum">
                  {selectedTrip.totalOdoDistanceKm !== undefined ? `${selectedTrip.totalOdoDistanceKm} km` : '-'}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 font-medium">ระยะทาง GPS:</div>
                <div className="font-mono font-bold text-purple-600 tnum">{selectedTrip.totalGpsDistanceKm || 0} km</div>
              </div>
              <div>
                <div className="text-[10.5px] text-slate-500 font-medium">ค่าใช้จ่ายรวม:</div>
                <div className="font-mono font-bold text-amber-600 tnum">
                  ฿{selectedTrip.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Planned Drops Details */}
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[16px]">location_on</span>
                รายการจุดเข้าพบลูกค้า ({selectedTrip.drops.length} จุด)
              </h4>
              <div className="space-y-2">
                {selectedTrip.drops.map((dp) => (
                  <div
                    key={dp.id}
                    className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        Drop #{dp.dropNumber}: {dp.clientName}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${dp.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {dp.status === 'Completed' ? '✓ เข้าพบแล้ว' : 'รอดำเนินการ'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">📍 {dp.address}</div>
                    <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">📋 วาระ: {dp.agenda}</div>
                    <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
                      {dp.dropGpsDistance !== undefined && (
                        <div className="text-[10.5px] text-purple-600 dark:text-purple-400 font-mono font-bold">
                          🛰️ GPS จุดนี้: {dp.dropGpsDistance.toLocaleString()} กม.
                        </div>
                      )}
                      {dp.dropOdoDistance !== undefined ? (
                        <div className="text-[10.5px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                          🚗 ODO จุดนี้: {dp.dropOdoDistance.toLocaleString()} กม.
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-slate-400 font-mono italic">🚗 ODO (km): -</div>
                      )}
                      {dp.odometerReading ? (
                        <div className="text-[10.5px] text-slate-600 dark:text-slate-300 font-mono font-bold">
                          🔢 เลขไมล์: {dp.odometerReading.toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-slate-400 font-mono italic">🔢 เลขไมล์: ยังไม่ระบุ</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Expenses & Slip view */}
            {selectedTrip.allExpenses.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">receipt_long</span>
                  รายการค่าใช้จ่ายและสลิป ({selectedTrip.allExpenses.length} รายการ)
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden">
                  {selectedTrip.allExpenses.map((exp, eIdx) => (
                    <div key={eIdx} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between text-xs gap-2">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{exp.category}</span>
                          {exp.clientName && <span className="text-[10px] text-blue-600 font-normal">({exp.clientName})</span>}
                        </div>
                        <div className="text-[10.5px] text-slate-500">{exp.title}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ฿{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {exp.receiptUrl && (
                          <button
                            onClick={() =>
                              setPreviewPhoto({
                                url: exp.receiptUrl!,
                                location: `${exp.clientName || selectedTrip.tripTitle} • ${exp.category}`,
                                amount: exp.amount,
                              })
                            }
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">image</span>
                            ดูสลิป
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slip Image Lightbox Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhoto.url}
              alt="Receipt Preview"
              className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl border border-white/20"
            />
            <div className="mt-3 bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-4 border border-slate-700 w-full">
              <div>
                <div className="font-bold">{previewPhoto.location || 'สลิปค่าใช้จ่าย'}</div>
                {previewPhoto.amount !== undefined && (
                  <div className="text-amber-400 font-mono font-extrabold">
                    ยอดเงิน: ฿{previewPhoto.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
