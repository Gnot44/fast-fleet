import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  resolveTripOdoAndGpsMetrics,
  resolveDropTelemetryList,
  formatOdoNumber,
} from '../utils/telemetryUtils';

export interface DropExpenseItem {
  id: string;
  category: string;
  title: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  notes?: string;
  clientName?: string;
  dropNumber?: number;
  lat?: number;
  lng?: number;
}

export interface ClientVisitItem {
  id: number;
  clientName: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  agenda: string;
  status: 'Completed' | 'Pending';
  isConfirmed: boolean;
  checkInAt?: string;
  checkOutAt?: string;
  lat?: number;
  lng?: number;
  meetingMinutes?: string;
  odometerReading?: number;
  dropOdoDistance?: number; // Drop ODO (km) = |Current ODO - Previous ODO|
  dropGpsDistance?: number;
  photos: string[];
  expenses: DropExpenseItem[];
}

export interface MarketingTripApprovalRecord {
  id: string;
  code: string;
  title: string;
  tripDate: string;
  status: 'Completed' | 'In Progress';
  approvalStatus: 'Pending Approval' | 'Approved' | 'Revision Requested';
  revisionCount: number;
  specialist: {
    name: string;
    nickname: string;
    avatar?: string;
    initials: string;
    phone: string;
    department: string;
    territory: string;
    employeeId: string;
  };
  vehicle: {
    plate: string;
    model: string;
    startOdo?: number;
    endOdo?: number;
  };
  startLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  startTime: string;
  endTime?: string;
  duration: string;
  totalOdoDistance?: number;
  totalGpsDistance: number;
  totalDistance: number;
  totalExpenses: number;
  allExpenses?: DropExpenseItem[];
  managerFeedback?: string;
  approvedBy?: string;
  approvedAt?: string;
  visits: ClientVisitItem[];
}

function parsePhotos(photoField?: any): string[] {
  if (!photoField) return [];
  const results: string[] = [];

  const extract = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(extract);
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('"{') && trimmed.endsWith('}"')) ||
        (trimmed.startsWith('"[') && trimmed.endsWith(']"'))
      ) {
        try {
          const unescaped = trimmed.startsWith('"') && trimmed.endsWith('"') ? JSON.parse(trimmed) : trimmed;
          const parsed = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;
          extract(parsed);
          return;
        } catch (e) {}
      }
      if (trimmed.includes('||')) {
        trimmed.split('||').forEach((s) => extract(s.trim()));
        return;
      }
      if (trimmed.length > 5 && !trimmed.startsWith('[') && !trimmed.endsWith(']')) {
        results.push(trimmed);
      }
    }
  };

  extract(photoField);
  return Array.from(new Set(results));
}

export default function VisitHistory() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') || 'All') as any;

  const [filterApproval, setFilterApproval] = useState<
    'All' | 'Pending Approval' | 'Approved' | 'Revision Requested'
  >(initialFilter === 'all' ? 'All' : (initialFilter === 'revision' ? 'Revision Requested' : 'Pending Approval'));

  // Dynamic Date Range Filter States (Default: 'all' to show full history, or presets)
  const now = new Date();
  const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonthStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'last7' | 'thisMonth' | 'last30' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>(startOfMonthStr);
  const [endDate, setEndDate] = useState<string>(endOfMonthStr);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'drops' | 'expenses' | 'summary'>('drops');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; location?: string; amount?: number; lat?: number; lng?: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectFeedbackText, setRejectFeedbackText] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  // Marketing Field Trips Data from Supabase
  const [tripsList, setTripsList] = useState<MarketingTripApprovalRecord[]>([]);

  const handleSelectPreset = (preset: 'all' | 'today' | 'last7' | 'thisMonth' | 'last30' | 'custom') => {
    setDateRangePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      // no date restriction
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(startOfMonth.toISOString().split('T')[0]);
      setEndDate(endOfMonth.toISOString().split('T')[0]);
    } else if (preset === 'last30') {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    setStartDate(val);
    setDateRangePreset('custom');
  };

  const handleCustomEndDateChange = (val: string) => {
    setEndDate(val);
    setDateRangePreset('custom');
  };

  useEffect(() => {
    async function loadTrips() {
      try {
        setLoading(true);
        const { data: trips, error } = await supabase
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
              phone,
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
              payment_method,
              receipt_url,
              receipt_image_path,
              notes
            )
          `)
          .in('approval_status', ['pending', 'approved', 'revision_requested'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching visit trips from Supabase:', error);
        }

        const catMapTh: Record<string, string> = {
          toll: 'ค่าทางด่วน',
          parking: 'ค่าที่จอดรถ',
          fuel: 'ค่าน้ำมัน',
          entertainment: 'ค่าอาหาร / เลี้ยงรับรองลูกค้า',
          other: 'อื่นๆ',
        };

        const submittedTrips = (trips || []).filter(
          (t: any) =>
            t.approval_status === 'pending' ||
            t.approval_status === 'approved' ||
            t.approval_status === 'revision_requested'
        );

        if (submittedTrips && submittedTrips.length > 0) {
          const mapped: MarketingTripApprovalRecord[] = submittedTrips.map((t: any) => {
            const rawProf = t.profiles;
            const prof = (Array.isArray(rawProf) ? rawProf[0] : rawProf) || {};
            const staffObj = Array.isArray(prof.staff) ? prof.staff[0] : prof.staff;
            const appts = (t.appointments || []).sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));
            const exps = t.expenses || [];
            
            // Unified Telemetry Resolution: Total ODO strictly from ODO logs, Total GPS from Google Maps
            const odoMetrics = resolveTripOdoAndGpsMetrics({
              start_odometer: t.start_odometer,
              end_odometer: t.end_odometer,
              total_distance_km: t.total_distance_km,
              startLocation: { lat: 13.7285, lng: 100.5345 },
              appointments: appts,
            });

            const totalExp = exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

            const approvalStat =
              t.approval_status === 'approved'
                ? 'Approved'
                : t.approval_status === 'revision_requested'
                ? 'Revision Requested'
                : 'Pending Approval';

            const fullName = prof.full_name || 'kosit goonlaboot';
            const nick = prof.nickname || fullName.split(' ')[0] || 'kosit';
            const empId = staffObj?.staff_id || 'AITS10002772';
            const revMatch = t.manager_feedback?.match(/\[(?:รอบที่|REV:)\s*(\d+)\]/i);
            const revCount = revMatch ? parseInt(revMatch[1], 10) : (t.approval_status === 'revision_requested' ? 1 : 0);
            const cleanFeedback = t.manager_feedback?.replace(/\[(?:รอบที่|REV:)\s*\d+\]\s*/i, '').trim() || t.manager_feedback || '';

            const rawDate = t.trip_date || (t.created_at ? t.created_at.split('T')[0] : '');
            const tripDateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';

            return {
              id: t.id,
              code: t.trip_code || `TRP-${t.id.slice(0, 6).toUpperCase()}`,
              title: t.title || 'เส้นทางเข้าพบลูกค้า',
              tripDate: tripDateStr,
              status: t.status === 'completed' ? 'Completed' : 'In Progress',
              approvalStatus: approvalStat as any,
              revisionCount: revCount,
              managerFeedback: cleanFeedback,
              specialist: {
                name: fullName,
                nickname: nick,
                avatar: prof.avatar_url,
                initials: fullName.slice(0, 2).toUpperCase(),
                phone: prof.phone || '096-410-5303',
                department: prof.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
                territory: staffObj?.territory || 'Bangkok Central (B2B)',
                employeeId: empId,
              },
              vehicle: {
                plate: staffObj?.vehicle_plate || '1กข-4452 กทม.',
                model: staffObj?.vehicle_model || 'Isuzu D-Max',
                startOdo: odoMetrics.startOdo,
                endOdo: odoMetrics.endOdo,
              },
              startLocation: {
                name: 'สำนักงานใหญ่ / จุดปล่อยรถ (Depot)',
                address: '88 ถนนสีลม แขวงสุริยวาส เขตบางรัก กรุงเทพมหานคร 10500',
                lat: 13.7285,
                lng: 100.5345,
              },
              startTime: t.trip_date ? new Date(t.trip_date).toLocaleDateString('th-TH') : (t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH') : 'วันนี้'),
              duration: 'ตามเวลาจริง',
              totalOdoDistance: odoMetrics.totalOdoDistance,
              totalGpsDistance: odoMetrics.totalGpsDistance,
              totalDistance: odoMetrics.totalGpsDistance || odoMetrics.totalOdoDistance || 0,
              totalExpenses: totalExp,
              allExpenses: exps.map((e: any) => {
                const matchedApptIdx = appts.findIndex((a: any) => a.id === e.appointment_id);
                const matchedAppt = matchedApptIdx >= 0 ? appts[matchedApptIdx] : null;
                const cName = matchedAppt ? (matchedAppt.company_name || matchedAppt.customer_name || `จุดที่ ${matchedApptIdx + 1}`) : 'ค่าใช้จ่ายทั่วไปของทริป';
                return {
                  id: e.id,
                  category: catMapTh[e.category] || e.category || 'ค่าใช้จ่ายเข้าพบ',
                  title: e.title || catMapTh[e.category] || e.category || 'ค่าใช้จ่าย',
                  amount: Number(e.amount) || 0,
                  paymentMethod: e.payment_method || 'เงินสด',
                  receiptUrl: e.receipt_url || e.receipt_image_path,
                  notes: e.notes,
                  clientName: cName,
                  dropNumber: matchedApptIdx >= 0 ? matchedApptIdx + 1 : undefined,
                  lat: matchedAppt?.destination_lat,
                  lng: matchedAppt?.destination_lng,
                };
              }),
              visits: (() => {
                const dropTelemList = resolveDropTelemetryList(
                  odoMetrics.startOdo,
                  13.7285,
                  100.5345,
                  appts,
                  odoMetrics.totalGpsDistance
                );
                return appts.map((a: any, aIdx: number) => {
                  const dropExps = exps
                    .filter((e: any) => e.appointment_id === a.id)
                    .map((e: any) => ({
                      id: e.id,
                      category: catMapTh[e.category] || e.category || 'ค่าใช้จ่ายเข้าพบ',
                      title: e.title || catMapTh[e.category] || e.category || 'ค่าใช้จ่าย',
                      amount: Number(e.amount) || 0,
                      paymentMethod: e.payment_method || 'เงินสด',
                      receiptUrl: e.receipt_url || e.receipt_image_path,
                      notes: e.notes,
                    }));

                  const matchedTelem = dropTelemList.find((g) => g.dropId === a.id || g.dropNumber === (a.sequence_order || aIdx + 1));

                  return {
                    id: aIdx + 1,
                    clientName: a.company_name || 'ลูกค้าองค์กร',
                    address: a.destination_address || 'กรุงเทพมหานคร',
                    contactPerson: a.recipient_name || '-',
                    contactPhone: a.recipient_phone || '-',
                    agenda: a.agenda || 'เข้าพบลูกค้า',
                    status: a.confirmation_status ? 'Completed' : 'Pending',
                    isConfirmed: !!a.confirmation_status,
                    checkInAt: a.check_in_at ? new Date(a.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : undefined,
                    checkOutAt: a.check_out_at ? new Date(a.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : undefined,
                    lat: a.destination_lat || 13.75,
                    lng: a.destination_lng || 100.5,
                    meetingMinutes: a.meeting_notes,
                    odometerReading: matchedTelem?.odometerReading,
                    dropOdoDistance: matchedTelem?.dropOdoDistance,
                    dropGpsDistance: matchedTelem?.dropGpsDistance,
                    photos: parsePhotos(a.client_photo_url),
                    expenses: dropExps,
                  };
                });
              })(),
            };
          });

          setTripsList(mapped);
          if (mapped.length > 0) {
            setSelectedTripId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
          }
        } else {
          setTripsList([]);
          setSelectedTripId('');
        }
      } catch (err) {
        console.error('Error fetching trips from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTrips();

    const channel = supabase
      .channel('visit-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadTrips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadTrips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        loadTrips();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered trips list by Approval status, Date range, and Search query
  const filteredTrips = useMemo(() => {
    return tripsList.filter((trip) => {
      const matchApproval =
        filterApproval === 'All' ? true : trip.approvalStatus === filterApproval;

      const matchDate =
        dateRangePreset === 'all'
          ? true
          : trip.tripDate ? trip.tripDate >= startDate && trip.tripDate <= endDate : true;

      const matchSearch =
        trip.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.specialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.specialist.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase());

      return matchApproval && matchDate && matchSearch;
    });
  }, [tripsList, filterApproval, dateRangePreset, startDate, endDate, searchQuery]);

  // Selected Active Trip
  const selectedTrip = useMemo(() => {
    return filteredTrips.find((t) => t.id === selectedTripId) || filteredTrips[0] || null;
  }, [filteredTrips, selectedTripId]);

  // Summary Metrics computed dynamically based on the selected date range
  const overallMetrics = useMemo(() => {
    const baseList = tripsList.filter((trip) => {
      if (dateRangePreset === 'all') return true;
      return trip.tripDate ? trip.tripDate >= startDate && trip.tripDate <= endDate : true;
    });

    const pendingCount = baseList.filter((t) => t.approvalStatus === 'Pending Approval').length;
    const pendingAmount = baseList.filter((t) => t.approvalStatus === 'Pending Approval').reduce((s, t) => s + t.totalExpenses, 0);
    const approvedCount = baseList.filter((t) => t.approvalStatus === 'Approved').length;
    const approvedAmount = baseList.filter((t) => t.approvalStatus === 'Approved').reduce((s, t) => s + t.totalExpenses, 0);
    const revisionCount = baseList.filter((t) => t.approvalStatus === 'Revision Requested').length;
    const totalGps = baseList.reduce((s, t) => s + t.totalGpsDistance, 0);
    const totalOdo = baseList.reduce((s, t) => s + (t.totalOdoDistance || 0), 0);

    return {
      totalCount: baseList.length,
      pendingCount,
      pendingAmount,
      approvedCount,
      approvedAmount,
      revisionCount,
      totalGps,
      totalOdo,
    };
  }, [tripsList, dateRangePreset, startDate, endDate]);

  // Approve Trip Action
  const handleOpenApproveModal = () => {
    if (!selectedTrip) return;
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedTrip) return;
    const tripId = selectedTrip.id;

    try {
      await supabase.from('trips').update({
        approval_status: 'approved',
        status: 'completed',
        approved_at: new Date().toISOString(),
      }).eq('id', tripId);

      await supabase.from('expenses').update({
        status: 'approved',
      }).eq('trip_id', tripId);
    } catch (err) {
      console.warn('Error updating approval status in DB:', err);
    }

    setTripsList((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              approvalStatus: 'Approved',
              status: 'Completed',
              approvedBy: 'ผู้จัดการฝ่ายการตลาด',
              approvedAt: 'เมื่อสักครู่',
            }
          : t
      )
    );

    setIsApproveModalOpen(false);
    showToast(`✓ อนุมัติรายงาน ${selectedTrip.code} ของ ${selectedTrip.specialist.name} เรียบร้อยแล้ว`);
  };

  // Revoke Approval Action
  const handleOpenRevokeModal = () => {
    if (!selectedTrip) return;
    setIsRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!selectedTrip) return;
    const tripId = selectedTrip.id;

    try {
      await supabase.from('trips').update({
        approval_status: 'pending',
        approved_at: null,
      }).eq('id', tripId);
    } catch (err) {
      console.warn('Error resetting approval status in DB:', err);
    }

    setTripsList((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              approvalStatus: 'Pending Approval',
              approvedBy: undefined,
              approvedAt: undefined,
            }
          : t
      )
    );

    setIsRevokeModalOpen(false);
    showToast(`↺ ยกเลิกการอนุมัติรายงาน ${selectedTrip.code} และเปลี่ยนสถานะกลับเป็น "รอตรวจสอบ" เรียบร้อยแล้ว`);
  };

  // Reject / Request Revision Action
  const handleOpenRejectModal = () => {
    setRejectFeedbackText('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedTrip) return;
    if (!rejectFeedbackText.trim()) {
      alert('กรุณาระบุสิ่งที่ต้องการให้พนักงานแก้ไข');
      return;
    }

    const nextRev = (selectedTrip.revisionCount || 0) + 1;
    const formattedFeedback = `[รอบที่ ${nextRev}] ${rejectFeedbackText.trim()}`;

    try {
      await supabase
        .from('trips')
        .update({
          approval_status: 'revision_requested',
          manager_feedback: formattedFeedback,
          status: 'in_progress',
        })
        .eq('id', selectedTrip.id);
    } catch (err) {
      console.warn('Error saving revision request to DB:', err);
    }

    setTripsList((prev) =>
      prev.map((t) =>
        t.id === selectedTrip.id
          ? {
              ...t,
              approvalStatus: 'Revision Requested',
              status: 'In Progress',
              revisionCount: nextRev,
              managerFeedback: rejectFeedbackText.trim(),
            }
          : t
      )
    );

    setIsRejectModalOpen(false);
    showToast(`⚠️ ส่งรายงานกลับให้ ${selectedTrip.specialist.nickname} แก้ไขเรียบร้อยแล้ว (รอบที่ ${nextRev})`);
  };

  const getStatusPill = (status: string, revCount?: number) => {
    if (status === 'Approved') {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        text: '✓ อนุมัติแล้ว',
        dot: 'bg-emerald-500',
      };
    }
    if (status === 'Revision Requested') {
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        text: `⚠️ ส่งกลับแก้ไข${revCount && revCount > 0 ? ` (รอบที่ ${revCount})` : ''}`,
        dot: 'bg-rose-500',
      };
    }
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      text: '⏳ รอผู้จัดการตรวจ',
      dot: 'bg-amber-500 animate-pulse',
    };
  };

  return (
    <div className="w-full space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in text-xs font-semibold">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Executive Stats Ribbon */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
                {language === 'th' ? 'ศูนย์ตรวจสอบ & อนุมัติการเดินทาง' : 'Trip Approvals & Audit Hub'}
              </h1>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Manager Audit Studio
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              {language === 'th'
                ? 'ตรวจสอบความถูกต้องของเลขไมล์ ODO, ระยะทาง GPS จาก Google Maps, บันทึกการเข้าพบลูกค้า และสลิปค่าใช้จ่ายภาคสนาม'
                : 'Audit verified Odometer readings, Google Maps GPS telemetry, client meeting minutes, and itemized drop receipts'}
            </p>
          </div>
        </div>

        {/* Date & Time Range Filter Selector Bar */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-blue-600">calendar_month</span>
              <span>ช่วงเวลา:</span>
            </span>
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'today', label: 'วันนี้' },
              { id: 'last7', label: '7 วันล่าสุด' },
              { id: 'thisMonth', label: 'เดือนนี้' },
              { id: 'last30', label: '30 วันล่าสุด' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all tactile-btn cursor-pointer ${
                  dateRangePreset === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">ตั้งแต่:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomStartDateChange(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-slate-400">-</span>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">ถึง:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomEndDateChange(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              />
            </div>

            {dateRangePreset !== 'all' && (
              <button
                onClick={() => handleSelectPreset('all')}
                className="p-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
                title="ล้างตัวกรองวันที่ (แสดงทั้งหมด)"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Soft-Tinted Executive Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          {/* Card 1: Pending Approvals */}
          <div className="soft-tint-amber p-4 rounded-2xl transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                รออนุมัติ (Pending)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-950 dark:text-amber-100 font-mono tnum">
                {overallMetrics.pendingCount}
              </span>
              <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">รายการ</span>
            </div>
            <div className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-mono">
              ยอดรอเบิก: ฿{overallMetrics.pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Card 2: Approved Trips */}
          <div className="soft-tint-emerald p-4 rounded-2xl transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                อนุมัติแล้ว (Approved)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono tnum">
                {overallMetrics.approvedCount}
              </span>
              <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">รายการ</span>
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-mono">
              อนุมัติแล้ว: ฿{overallMetrics.approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Card 3: Revisions Requested */}
          <div className="soft-tint-purple p-4 rounded-2xl transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                ส่งกลับแก้ไข (Revision)
              </span>
              <span className="material-symbols-outlined text-[16px] text-purple-600 dark:text-purple-400">assignment_return</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-950 dark:text-purple-100 font-mono tnum">
                {overallMetrics.revisionCount}
              </span>
              <span className="text-xs text-purple-700/80 dark:text-purple-400/80 font-medium">รายการ</span>
            </div>
            <div className="mt-0.5 text-[11px] text-purple-700/80 dark:text-purple-400/80 font-medium">
              รอพนักงานอัปเดตข้อมูล
            </div>
          </div>

          {/* Card 4: Total Distance Telemetry */}
          <div className="soft-tint-blue p-4 rounded-2xl transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                ระยะทางรวม GPS / ODO
              </span>
              <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400">speed</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-950 dark:text-blue-100 font-mono tnum">
                {overallMetrics.totalGps.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-xs text-blue-700/80 dark:text-blue-400/80 font-medium">กม. (GPS)</span>
            </div>
            <div className="mt-0.5 text-[11px] text-blue-700/80 dark:text-blue-400/80 font-mono">
              ODO รวม: {overallMetrics.totalOdo > 0 ? `${overallMetrics.totalOdo.toLocaleString()} กม.` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Trips Queue & Search Filter (5 cols) */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-4 sm:p-5 space-y-3.5">
          {/* Search and Tabs */}
          <div className="space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อพนักงาน, รหัสทริป, หรือทะเบียนรถ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 rounded-2xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200/80 dark:border-slate-700/80 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold">
              {[
                { id: 'All', label: 'ทั้งหมด' },
                { id: 'Pending Approval', label: 'รออนุมัติ' },
                { id: 'Approved', label: 'อนุมัติแล้ว' },
                { id: 'Revision Requested', label: 'ส่งแก้ไข' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterApproval(tab.id as any)}
                  className={`py-1.5 px-1 rounded-xl text-center truncate transition-all tactile-btn cursor-pointer ${
                    filterApproval === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trip Queue Cards List */}
          <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {filteredTrips.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">inbox</span>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">ไม่พบรายการทริปในเงื่อนไขที่เลือก</p>
                {dateRangePreset !== 'all' && (
                  <button
                    onClick={() => handleSelectPreset('all')}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    ล้างตัวกรองวันที่เพื่อดูทั้งหมด
                  </button>
                )}
              </div>
            ) : (
              filteredTrips.map((trip) => {
                const isSelected = selectedTrip?.id === trip.id;
                const statusPill = getStatusPill(trip.approvalStatus, trip.revisionCount);
                const doneDrops = trip.visits.filter((v) => v.isConfirmed || v.status === 'Completed').length;

                return (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 tactile-btn ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-slate-100/60 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    {/* Top Row: Specialist, Trip Code, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {trip.specialist.avatar ? (
                          <img src={trip.specialist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-xs shrink-0 border border-blue-200 dark:border-blue-800">
                            {trip.specialist.initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {trip.specialist.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {trip.code} • 📅 {trip.startTime}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1 ${statusPill.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`}></span>
                        <span>{statusPill.text}</span>
                      </span>
                    </div>

                    {/* Route Title */}
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {trip.title}
                    </div>

                    {/* 3 Telemetry Summary Badges */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10.5px]">
                      {/* ODO Metric */}
                      <div className="bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <span className="text-[9px] text-slate-400 block font-medium">ODO ที่กรอก</span>
                        <span className="font-bold font-mono text-blue-600 dark:text-blue-400 tnum">
                          {trip.totalOdoDistance !== undefined ? `${trip.totalOdoDistance} km` : '-'}
                        </span>
                      </div>

                      {/* GPS Metric */}
                      <div className="bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <span className="text-[9px] text-slate-400 block font-medium">GPS Maps</span>
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-400 tnum">
                          {trip.totalGpsDistance > 0 ? `${trip.totalGpsDistance} km` : '-'}
                        </span>
                      </div>

                      {/* Expenses Metric */}
                      <div className="bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <span className="text-[9px] text-slate-400 block font-medium">ค่าใช้จ่าย</span>
                        <span className="font-bold font-mono text-amber-600 dark:text-amber-400 tnum">
                          ฿{trip.totalExpenses.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Drops Progress */}
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 pt-0.5">
                      <span>{trip.visits.length} จุดเข้าพบ ({doneDrops} เสร็จสิ้น)</span>
                      <span className="text-slate-400 font-mono">{trip.vehicle.plate}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Trip Inspection & Approval Workflow (7 cols) */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5 sm:p-6 space-y-4">
          {!selectedTrip ? (
            <div className="py-24 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">fact_check</span>
              <h3 className="font-bold text-sm text-slate-600 dark:text-slate-400">ไม่มีข้อมูลการเดินทางที่เลือก</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">เลือกรายการเดินทางจากคอลัมน์ซ้ายเพื่อตรวจรายละเอียด</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Trip Details Header with Manager Action Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                      {selectedTrip.code}
                    </span>
                    <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">{selectedTrip.title}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusPill(selectedTrip.approvalStatus, selectedTrip.revisionCount).bg}`}>
                      {getStatusPill(selectedTrip.approvalStatus, selectedTrip.revisionCount).text}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    พนักงาน: <strong className="text-slate-800 dark:text-slate-200">{selectedTrip.specialist.name}</strong> ({selectedTrip.specialist.employeeId}) • ทะเบียนรถ: <strong className="text-slate-800 dark:text-slate-200">{selectedTrip.vehicle.plate}</strong>
                  </p>
                </div>

                {/* Manager Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
                  {selectedTrip.approvalStatus === 'Approved' ? (
                    <>
                      <button
                        onClick={handleOpenRejectModal}
                        className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer tactile-btn"
                        title="ส่งกลับให้พนักงานแก้ไขใหม่"
                      >
                        <span className="material-symbols-outlined text-[15px]">assignment_return</span>
                        ส่งกลับแก้ไข
                      </button>
                      <button
                        onClick={handleOpenRevokeModal}
                        className="px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs tactile-btn"
                        title="ยกเลิกการอนุมัติและเปลี่ยนสถานะกลับเป็นรอตรวจสอบ"
                      >
                        <span className="material-symbols-outlined text-[15px]">undo</span>
                        ยกเลิกการอนุมัติ
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleOpenRejectModal}
                        className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer tactile-btn"
                      >
                        <span className="material-symbols-outlined text-[15px]">assignment_return</span>
                        ส่งกลับแก้ไข
                      </button>
                      <button
                        onClick={handleOpenApproveModal}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer tactile-btn"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        อนุมัติรายงาน
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 4 Dedicated Telemetry & Expense Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs">
                {/* 1. ODO Start / End */}
                <div>
                  <div className="text-[10.5px] text-slate-500 font-medium">ODO เริ่ม ➔ จบ:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white tnum mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{formatOdoNumber(selectedTrip.vehicle.startOdo)} ➔ {formatOdoNumber(selectedTrip.vehicle.endOdo, 'ไม่ได้บันทึก')}</span>
                    {selectedTrip.vehicle.startOdo !== undefined && selectedTrip.vehicle.endOdo !== undefined && selectedTrip.vehicle.endOdo < selectedTrip.vehicle.startOdo && (
                      <span className="text-[9.5px] px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold rounded border border-rose-300">
                        ⚠️ ถอยหลัง
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] font-bold mt-0.5 ${selectedTrip.totalOdoDistance !== undefined ? (selectedTrip.vehicle.endOdo && selectedTrip.vehicle.startOdo && selectedTrip.vehicle.endOdo < selectedTrip.vehicle.startOdo ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-blue-600 dark:text-blue-400') : 'text-slate-400 italic'}`}>
                    Total: {selectedTrip.totalOdoDistance !== undefined ? `${selectedTrip.totalOdoDistance.toLocaleString()} กม.` : 'คำนวณไม่ได้'}
                  </div>
                </div>

                {/* 2. Total ODO (from manual entries) */}
                <div>
                  <div className="text-[10.5px] text-slate-500 font-medium">Total ODO (ที่กรอก):</div>
                  <div className={`font-mono font-extrabold tnum text-sm mt-0.5 ${selectedTrip.totalOdoDistance !== undefined ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                    {selectedTrip.totalOdoDistance !== undefined ? `${selectedTrip.totalOdoDistance.toLocaleString()} กม.` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {selectedTrip.totalOdoDistance !== undefined ? 'จากเลขไมล์รถจริง' : 'คำนวณไม่ได้ (ไม่ได้บันทึกเลขไมล์)'}
                  </div>
                </div>

                {/* 3. Total GPS (from Google Maps) */}
                <div>
                  <div className="text-[10.5px] text-slate-500 font-medium">Total GPS (Google Maps):</div>
                  <div className="font-mono font-extrabold text-purple-600 dark:text-purple-400 tnum text-sm mt-0.5">
                    {selectedTrip.totalGpsDistance > 0 ? `${selectedTrip.totalGpsDistance.toLocaleString()} กม.` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {selectedTrip.totalGpsDistance > 0 ? 'จากเส้นทางดาวเทียม' : 'ไม่มีพิกัด GPS'}
                  </div>
                </div>

                {/* 4. Total Expenses */}
                <div>
                  <div className="text-[10.5px] text-slate-500 font-medium">ยอดเบิกจ่ายรวม:</div>
                  <div className="font-mono font-extrabold text-amber-600 dark:text-amber-400 tnum text-sm mt-0.5">
                    ฿{selectedTrip.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium mt-0.5">
                    {selectedTrip.allExpenses?.length || 0} รายการค่าใช้จ่าย
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {selectedTrip.approvalStatus === 'Approved' && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">verified</span>
                    <span>รายงานนี้ได้รับการอนุมัติแล้ว {selectedTrip.approvedBy ? `โดย ${selectedTrip.approvedBy}` : ''} {selectedTrip.approvedAt ? `(${selectedTrip.approvedAt})` : ''}</span>
                  </div>
                </div>
              )}

              {selectedTrip.approvalStatus === 'Revision Requested' && selectedTrip.managerFeedback && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-2xl border border-rose-200 dark:border-rose-800/80 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[18px]">error</span>
                    <span>สิ่งที่แจ้งให้พนักงานแก้ไข (ส่งกลับรอบที่ {selectedTrip.revisionCount || 1}):</span>
                  </div>
                  <p className="text-[11.5px] italic pl-6 bg-white/70 dark:bg-slate-900/80 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/60 text-slate-800 dark:text-slate-200">
                    "{selectedTrip.managerFeedback}"
                  </p>
                </div>
              )}

              {/* Interactive Tabs: Drops, Expenses, Summary */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('drops')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer tactile-btn ${
                    activeTab === 'drops'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span>จุดเข้าพบลูกค้า ({selectedTrip.visits.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer tactile-btn ${
                    activeTab === 'expenses'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  <span>สลิปค่าใช้จ่าย ({selectedTrip.allExpenses?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer tactile-btn ${
                    activeTab === 'summary'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">donut_small</span>
                  <span>สรุปภาพรวม</span>
                </button>
              </div>

              {/* TAB 1: DROPS BREAKDOWN TIMELINE */}
              {activeTab === 'drops' && (
                <div className="space-y-3">
                  <div className="space-y-3">
                    {selectedTrip.visits.map((v, vIdx) => (
                      <div
                        key={v.id}
                        className="p-4 bg-slate-50/90 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-black text-[10.5px] flex items-center justify-center shrink-0">
                                {v.id}
                              </span>
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                                {v.clientName}
                              </h4>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                              <span className="truncate">{v.address}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${v.isConfirmed ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {v.isConfirmed ? '✓ พบสำเร็จ' : 'รอดำเนินการ'}
                          </span>
                        </div>

                        {/* Agenda, Drop GPS, Drop ODO (km) & ODO Reading */}
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div className="text-slate-700 dark:text-slate-300">
                            <strong className="text-slate-900 dark:text-white">วาระ:</strong> {v.agenda}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {typeof v.dropGpsDistance === 'number' && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10.5px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800 font-bold">
                                <span className="material-symbols-outlined text-[12px]">explore</span>
                                GPS: {v.dropGpsDistance} กม.
                              </span>
                            )}
                            {typeof v.dropOdoDistance === 'number' ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10.5px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 font-bold">
                                <span className="material-symbols-outlined text-[12px]">speed</span>
                                ODO: {v.dropOdoDistance.toLocaleString()} กม.
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono italic">ODO (km): -</span>
                            )}
                            {typeof v.odometerReading === 'number' && v.odometerReading > 0 ? (
                              <span className={`inline-flex items-center gap-1 font-mono text-[10.5px] px-2 py-0.5 rounded-lg border font-medium ${
                                (() => {
                                  const prevDropOdo = selectedTrip.visits.slice(0, vIdx).reverse().find((pv) => typeof pv.odometerReading === 'number' && pv.odometerReading > 0)?.odometerReading ?? selectedTrip.vehicle.startOdo;
                                  return (prevDropOdo !== undefined && v.odometerReading < prevDropOdo)
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                                })()
                              }`}>
                                เลขไมล์: {v.odometerReading.toLocaleString()}
                                {(() => {
                                  const prevDropOdo = selectedTrip.visits.slice(0, vIdx).reverse().find((pv) => typeof pv.odometerReading === 'number' && pv.odometerReading > 0)?.odometerReading ?? selectedTrip.vehicle.startOdo;
                                  return (prevDropOdo !== undefined && v.odometerReading < prevDropOdo) ? ' (⚠️ ถอยหลัง)' : '';
                                })()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono italic">เลขไมล์: ยังไม่ระบุ</span>
                            )}
                          </div>
                        </div>

                        {/* Meeting Minutes */}
                        {v.meetingMinutes && (
                          <div className="p-2.5 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 italic">
                            "{v.meetingMinutes}"
                          </div>
                        )}

                        {/* Drop Expenses */}
                        {v.expenses && v.expenses.length > 0 && (
                          <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-1.5">
                            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                              <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                ค่าใช้จ่ายจุดนี้ ({v.expenses.length} รายการ):
                              </span>
                              <span className="text-amber-700 dark:text-amber-400 font-mono font-extrabold">
                                ฿{v.expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {v.expenses.map((exp) => (
                                <div key={exp.id} className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-slate-400">
                                  <span className="truncate max-w-[200px]">• {exp.title} ({exp.category})</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">฿{exp.amount.toLocaleString()}</span>
                                    {exp.receiptUrl && (
                                      <button
                                        onClick={() =>
                                          setPreviewPhoto({
                                            url: exp.receiptUrl!,
                                            location: `${v.clientName} (${exp.category})`,
                                            amount: exp.amount,
                                            lat: v.lat || 13.7563,
                                            lng: v.lng || 100.5018,
                                          })
                                        }
                                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 cursor-pointer font-bold"
                                      >
                                        <span className="material-symbols-outlined text-[11px]">image</span>
                                        สลิป
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Visit Photos */}
                        {v.photos && v.photos.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] text-slate-400 font-medium">รูปถ่าย:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {v.photos.map((pUrl, pIdx) => (
                                <button
                                  key={pIdx}
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: pUrl,
                                      location: `${v.clientName} (ภาพที่ ${pIdx + 1})`,
                                      lat: v.lat || 13.7563,
                                      lng: v.lng || 100.5018,
                                    })
                                  }
                                  className="px-2 py-1 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-lg text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 hover:border-blue-400 cursor-pointer shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                                  <span>รูปที่ {pIdx + 1}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: ITEMIZED EXPENSES & RECEIPTS AUDIT */}
              {activeTab === 'expenses' && (
                <div className="space-y-3.5">
                  {selectedTrip.allExpenses && selectedTrip.allExpenses.length > 0 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span>รายการค่าใช้จ่ายทั้งหมด ({selectedTrip.allExpenses.length} รายการ)</span>
                        <span className="font-mono text-amber-600 font-extrabold">
                          รวม ฿{selectedTrip.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedTrip.allExpenses.map((exp, idx) => (
                          <div
                            key={exp.id || idx}
                            className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-extrabold text-slate-900 dark:text-white block text-sm">
                                  {exp.category}
                                </span>
                                {exp.clientName && (
                                  <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 font-medium inline-block mt-0.5">
                                    📍 {exp.clientName}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                                ฿{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {exp.title && exp.title !== exp.category && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{exp.title}</p>
                            )}

                            <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">ชำระ: {exp.paymentMethod || 'เงินสด'}</span>
                              {exp.receiptUrl ? (
                                <button
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: exp.receiptUrl!,
                                      location: `${exp.clientName || selectedTrip.title} • ${exp.category}`,
                                      amount: exp.amount,
                                    })
                                  }
                                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl text-[10.5px] font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[13px]">image</span>
                                  ดูสลิป
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">ไม่มีสลิป</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      ไม่มีรายการค่าใช้จ่ายในทริปนี้ (฿0.00)
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: EXECUTIVE SUMMARY & CATEGORY BREAKDOWN */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Category Breakdown */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-[18px]">donut_small</span>
                      สัดส่วนค่าใช้จ่ายตามหมวดหมู่
                    </h4>
                    {(() => {
                      const catGroups = (selectedTrip.allExpenses || []).reduce((acc: Record<string, { count: number; total: number }>, item) => {
                        const cat = item.category || 'อื่นๆ';
                        if (!acc[cat]) acc[cat] = { count: 0, total: 0 };
                        acc[cat].count += 1;
                        acc[cat].total += item.amount;
                        return acc;
                      }, {});

                      const catKeys = Object.keys(catGroups);
                      if (catKeys.length === 0) {
                        return <div className="text-slate-400 text-xs py-2">ไม่มีการบันทึกค่าใช้จ่าย</div>;
                      }

                      return (
                        <div className="space-y-2">
                          {catKeys.map((catName) => {
                            const pct = selectedTrip.totalExpenses > 0 ? Math.round((catGroups[catName].total / selectedTrip.totalExpenses) * 100) : 0;
                            return (
                              <div key={catName} className="space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{catName}</span>
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    ฿{catGroups[catName].total.toLocaleString()} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Drops summary */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                    <h4 className="font-extrabold text-slate-900 dark:text-white">ข้อมูลสรุปการเดินทาง</h4>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                      <div>จุดเริ่มต้น: {selectedTrip.startLocation.name}</div>
                      <div>ยานพาหนะ: {selectedTrip.vehicle.model} ({selectedTrip.vehicle.plate})</div>
                      <div>วันที่เดินทาง: {selectedTrip.startTime}</div>
                      <div>พนักงาน: {selectedTrip.specialist.name} ({selectedTrip.specialist.employeeId})</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Photo / Slip Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.url}
              alt="Preview"
              className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl border border-white/20"
            />
            {typeof previewPhoto !== 'string' && previewPhoto.location && (
              <div className="mt-3 bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-4 border border-slate-700 w-full">
                <div>
                  <div className="font-bold">{previewPhoto.location}</div>
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
            )}
          </div>
        </div>
      )}

      {/* Modal: Confirm Approve */}
      {isApproveModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                ยืนยันการอนุมัติรายงานการเดินทาง
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                คุณกำลังจะอนุมัติทริป <strong>{selectedTrip.code}</strong> ({selectedTrip.title}) ของ <strong>{selectedTrip.specialist.name}</strong>
              </p>
            </div>

            {/* Quick Summary Strip */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">ระยะทาง ODO ที่กรอก:</span>
                <span className="font-mono font-bold text-blue-600">
                  {selectedTrip.totalOdoDistance !== undefined ? `${selectedTrip.totalOdoDistance} กม.` : 'คำนวณไม่ได้ (ไม่ได้บันทึก)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ระยะทาง GPS Google Maps:</span>
                <span className="font-mono font-bold text-purple-600">
                  {selectedTrip.totalGpsDistance > 0 ? `${selectedTrip.totalGpsDistance} กม.` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดเบิกจ่ายรวม:</span>
                <span className="font-mono font-extrabold text-amber-600">
                  ฿{selectedTrip.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmApprove}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                ยืนยันอนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Request Revision */}
      {isRejectModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">assignment_return</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                ส่งรายงานกลับให้พนักงานแก้ไข
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ส่งกลับ <strong>{selectedTrip.specialist.name}</strong> (รอบที่ {(selectedTrip.revisionCount || 0) + 1})
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                ระบุเหตุผลหรือสิ่งที่ต้องแก้ไข <span className="text-rose-500">*</span>:
              </label>
              <textarea
                value={rejectFeedbackText}
                onChange={(e) => setRejectFeedbackText(e.target.value)}
                placeholder="เช่น ใบเสร็จค่าทางด่วนไม่ชัดเจน หรือเลขไมล์จุดที่ 2 ไม่ตรงกับระยะทางจริง..."
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                ส่งกลับแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Revoke Approval */}
      {isRevokeModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">undo</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                ยกเลิกการอนุมัติรายงาน
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                สถานะของทริป <strong>{selectedTrip.code}</strong> จะเปลี่ยนกลับเป็น "รอตรวจสอบ"
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsRevokeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
