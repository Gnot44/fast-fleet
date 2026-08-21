import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

export interface DropExpenseItem {
  id: string;
  category: 'Toll' | 'Fuel' | 'Parking' | 'Meal' | 'Other';
  title: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  notes?: string;
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
  lat: number;
  lng: number;
  meetingMinutes?: string;
  odometerReading?: number;
  photos?: string[];
  expenses?: DropExpenseItem[];
}

export interface MarketingTripApprovalRecord {
  id: string;
  code: string;
  title: string;
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
  };
  vehicle: {
    plate: string;
    model: string;
    startOdo: number;
    endOdo: number;
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
  totalDistance: number;
  totalExpenses: number;
  allExpenses?: (DropExpenseItem & { clientName?: string; dropNumber?: number; lat?: number; lng?: number })[];
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
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') || 'All') as any;

  const [filterApproval, setFilterApproval] = useState<
    'All' | 'Pending Approval' | 'Approved' | 'Revision Requested'
  >(initialFilter === 'all' ? 'All' : (initialFilter === 'revision' ? 'Revision Requested' : 'Pending Approval'));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; location?: string; amount?: number; lat?: number; lng?: number } | string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectFeedbackText, setRejectFeedbackText] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  // Marketing Field Trips Data from Supabase
  const [tripsList, setTripsList] = useState<MarketingTripApprovalRecord[]>([]);

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
          entertainment: 'ค่าอาหาร / เลี้ยงรับรอง',
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
            const trDist = t.end_odometer && t.start_odometer ? Math.max(0, t.end_odometer - t.start_odometer) : 0;
            const totalExp = exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

            const approvalStat =
              t.approval_status === 'approved'
                ? 'Approved'
                : t.approval_status === 'revision_requested'
                ? 'Revision Requested'
                : 'Pending Approval';

            const fullName = prof.full_name || 'kosit goonlaboot';
            const nick = prof.nickname || fullName.split(' ')[0] || 'kosit';
            const revMatch = t.manager_feedback?.match(/\[(?:รอบที่|REV:)\s*(\d+)\]/i);
            const revCount = revMatch ? parseInt(revMatch[1], 10) : (t.approval_status === 'revision_requested' ? 1 : 0);
            const cleanFeedback = t.manager_feedback?.replace(/\[(?:รอบที่|REV:)\s*\d+\]\s*/i, '').trim() || t.manager_feedback || '';

            return {
              id: t.id,
              code: t.trip_code || `TRP-${t.id.slice(0, 6).toUpperCase()}`,
              title: t.title || 'เส้นทางเข้าพบลูกค้า',
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
              },
              vehicle: {
                plate: staffObj?.vehicle_plate || '1กข-4452 กทม.',
                model: staffObj?.vehicle_model || 'Isuzu D-Max',
                startOdo: t.start_odometer || 45200,
                endOdo: t.end_odometer || 45280,
              },
              startLocation: {
                name: 'สำนักงานใหญ่ / จุดปล่อยรถ (Depot)',
                address: '88 ถนนสีลม แขวงสุริยวาส เขตบางรัก กรุงเทพมหานคร 10500',
                lat: 13.7285,
                lng: 100.5345,
              },
              startTime: t.trip_date ? new Date(t.trip_date).toLocaleDateString('th-TH') : 'วันนี้',
              duration: 'ตามเวลาจริง',
              totalDistance: trDist,
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
              visits: appts.map((a: any, aIdx: number) => {
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
                  odometerReading: a.odometer_reading ? Number(a.odometer_reading) : undefined,
                  photos: parsePhotos(a.client_photo_url),
                  expenses: dropExps,
                };
              }),
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

  // Filtered trips list
  const filteredTrips = useMemo(() => {
    return tripsList.filter((trip) => {
      const matchApproval =
        filterApproval === 'All' ? true : trip.approvalStatus === filterApproval;

      const matchSearch =
        trip.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.specialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.specialist.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase());

      return matchApproval && matchSearch;
    });
  }, [tripsList, filterApproval, searchQuery]);

  // Selected Active Trip
  const selectedTrip = useMemo(() => {
    return filteredTrips.find((t) => t.id === selectedTripId) || filteredTrips[0] || null;
  }, [filteredTrips, selectedTripId]);

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

  return (
    <div className="w-full space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in text-xs font-medium">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-on-surface tracking-tight">
              {t('approvals_title')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="material-symbols-outlined text-[14px]">fact_check</span>
              Approval Hub
            </span>
          </div>
          <p className="text-on-surface-variant text-xs mt-1">
            {t('approvals_subtitle')}
          </p>
        </div>

        {/* Quick Stats Banner */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-container-low px-3.5 py-2 rounded-xl border border-outline-variant/50 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <div>
              <div className="text-[10px] text-on-surface-variant font-medium">รออนุมัติ (Pending)</div>
              <div className="font-bold text-sm text-on-surface">
                {tripsList.filter((t) => t.approvalStatus === 'Pending Approval').length} รายการ
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low px-3.5 py-2 rounded-xl border border-outline-variant/50 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <div>
              <div className="text-[10px] text-on-surface-variant font-medium">อนุมัติแล้ว (Approved)</div>
              <div className="font-bold text-sm text-on-surface">
                {tripsList.filter((t) => t.approvalStatus === 'Approved').length} รายการ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Trips List & Filter Panel (4 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-4 space-y-3">
          {/* Search and Filters */}
          <div className="space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อพนักงาน, รหัสทริป, หรือทะเบียนรถ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 border border-outline-variant/50 focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/50 text-[11px] font-bold">
              {[
                { id: 'All', label: 'ทั้งหมด' },
                { id: 'Pending Approval', label: 'รออนุมัติ' },
                { id: 'Approved', label: 'อนุมัติแล้ว' },
                { id: 'Revision Requested', label: 'ส่งแก้ไข' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterApproval(tab.id as any)}
                  className={`py-1.5 px-1 rounded-lg text-center truncate transition-all ${
                    filterApproval === tab.id
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trips Scroll List */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredTrips.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">work_history</span>
                <p className="text-xs font-bold text-slate-600">ยังไม่มีรายงานการเดินทางในระบบ</p>
                <p className="text-[11px] text-slate-400">เมื่อพนักงานบันทึกการเข้าพบและส่งรายงาน ข้อมูลจะปรากฏที่นี่</p>
              </div>
            ) : (
              filteredTrips.map((trip) => {
                const isSelected = selectedTrip?.id === trip.id;
                const statusPill =
                  trip.approvalStatus === 'Approved'
                    ? { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: '✓ อนุมัติแล้ว' }
                    : trip.approvalStatus === 'Revision Requested'
                    ? {
                        bg: 'bg-rose-50 text-rose-800 border-rose-200',
                        text: `⚠️ ส่งกลับแก้ไข${trip.revisionCount && trip.revisionCount > 0 ? ` (รอบที่ ${trip.revisionCount})` : ''}`,
                      }
                    : { bg: 'bg-amber-50 text-amber-800 border-amber-200', text: '⏳ รอผู้จัดการตรวจ' };

                return (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40'
                        : 'border-outline-variant/60 bg-surface-container-lowest hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {trip.specialist.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-on-surface truncate">
                            {trip.specialist.name}
                          </div>
                          <div className="text-[10px] text-on-surface-variant">
                            {trip.code} • {trip.startTime}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${statusPill.bg}`}>
                        {statusPill.text}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                      {trip.title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>{trip.visits.length} จุดเข้าพบ • {trip.totalDistance} กม.</span>
                      <span className="font-bold text-slate-800 font-mono">฿{trip.totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Trip Inspection & Approval Workflow (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-5 space-y-5">
          {!selectedTrip ? (
            <div className="py-24 text-center text-slate-400 space-y-2">
              <span className="material-symbols-outlined text-5xl text-slate-300">fact_check</span>
              <h3 className="font-bold text-sm text-slate-600">ไม่มีข้อมูลการเดินทางที่เลือก</h3>
              <p className="text-xs text-slate-400">เลือกรายการเดินทางจากคอลัมน์ซ้ายเพื่อตรวจรายละเอียด</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Trip Details Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {selectedTrip.code}
                    </span>
                    <h2 className="font-bold text-base text-slate-900">{selectedTrip.title}</h2>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      selectedTrip.approvalStatus === 'Approved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : selectedTrip.approvalStatus === 'Revision Requested'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {selectedTrip.approvalStatus === 'Approved'
                        ? '✓ อนุมัติแล้ว'
                        : selectedTrip.approvalStatus === 'Revision Requested'
                        ? '⚠️ ส่งกลับแก้ไข'
                        : '⏳ รอตรวจสอบ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    พนักงาน: <strong>{selectedTrip.specialist.name}</strong> • ทะเบียนรถ: <strong>{selectedTrip.vehicle.plate}</strong>
                  </p>
                </div>

                {/* Manager Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {selectedTrip.approvalStatus === 'Approved' ? (
                    <>
                      <button
                        onClick={handleOpenRejectModal}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="ส่งกลับให้พนักงานแก้ไขใหม่"
                      >
                        <span className="material-symbols-outlined text-[15px]">assignment_return</span>
                        ส่งกลับแก้ไข
                      </button>
                      <button
                        onClick={handleOpenRevokeModal}
                        className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
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
                        className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">assignment_return</span>
                        ส่งกลับแก้ไข
                      </button>
                      <button
                        onClick={handleOpenApproveModal}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        อนุมัติรายงาน
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Alert Banner */}
              {selectedTrip.approvalStatus === 'Approved' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                    <span>รายงานนี้ได้รับการอนุมัติแล้ว {selectedTrip.approvedBy ? `โดย ${selectedTrip.approvedBy}` : ''} {selectedTrip.approvedAt ? `(${selectedTrip.approvedAt})` : ''}</span>
                  </div>
                </div>
              )}

              {selectedTrip.approvalStatus === 'Revision Requested' && selectedTrip.managerFeedback && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                    <span>สิ่งที่แจ้งให้พนักงานแก้ไข (ส่งกลับรอบที่ {selectedTrip.revisionCount || 1}):</span>
                  </div>
                  <p className="text-[11.5px] italic pl-6 bg-white/70 p-2 rounded-lg border border-rose-100">
                    "{selectedTrip.managerFeedback}"
                  </p>
                </div>
              )}

              {/* Drops Completion Progress Bar */}
              {(() => {
                const totalDrops = selectedTrip.visits.length;
                const completedDrops = selectedTrip.visits.filter((v) => v.isConfirmed || v.status === 'Completed').length;
                const percent = totalDrops > 0 ? Math.round((completedDrops / totalDrops) * 100) : 0;
                const isAllDone = totalDrops > 0 && completedDrops === totalDrops;

                return (
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-primary">analytics</span>
                        ความคืบหน้าการเข้าพบลูกค้า:
                      </span>
                      <span className={`font-bold text-xs ${isAllDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {completedDrops}/{totalDrops} จุด ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isAllDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })()}

              {/* Comprehensive Trip Expenses & Receipts Breakdown Panel */}
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        สรุปค่าใช้จ่ายรวมทั้งทริป
                        <span className="text-[10px] text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full font-bold">
                          {selectedTrip.allExpenses?.length || 0} รายการ
                        </span>
                      </h4>
                      <p className="text-[10.5px] text-slate-500">รวมค่าทางด่วน, ที่จอดรถ, น้ำมัน และค่าใช้จ่ายทุกจุด</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1.5 sm:text-right">
                    <span className="text-[11px] text-slate-500 font-medium">ยอดรวมทั้งสิ้น:</span>
                    <span className="text-base font-black font-mono text-amber-700">
                      ฿{selectedTrip.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Category Aggregations Chips */}
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
                    return (
                      <div className="text-[11px] text-slate-400 py-1 italic">
                        ไม่มีการบันทึกค่าใช้จ่ายในทริปนี้ (฿0.00)
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/50">
                      {catKeys.map((catName) => (
                        <div
                          key={catName}
                          className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-amber-200 text-xs shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{catName}:</span>
                          <span className="font-mono font-bold text-amber-700">
                            ฿{catGroups[catName].total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ({catGroups[catName].count} รายการ)
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Itemized Table of All Trip Expenses with Slip Views */}
                {selectedTrip.allExpenses && selectedTrip.allExpenses.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      รายการค่าใช้จ่ายทั้งหมดในทริปนี้:
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                      {selectedTrip.allExpenses.map((exp, idx) => (
                        <div
                          key={exp.id || idx}
                          className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">
                                  {exp.category}
                                </span>
                                {exp.clientName && (
                                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-medium truncate max-w-[200px]">
                                    📍 {exp.clientName}
                                  </span>
                                )}
                              </div>
                              {exp.title && exp.title !== exp.category && (
                                <p className="text-[11px] text-slate-500 truncate">{exp.title}</p>
                              )}
                              {exp.notes && (
                                <p className="text-[10px] text-slate-400 italic truncate">"{exp.notes}"</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              ฿{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {exp.receiptUrl ? (
                              <button
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: exp.receiptUrl!,
                                    location: `${exp.clientName || 'ทริป'} • ${exp.category}`,
                                    amount: exp.amount,
                                    lat: exp.lat || 13.7563,
                                    lng: exp.lng || 100.5018,
                                  })
                                }
                                className="text-primary hover:underline flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer font-bold transition-all shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-[13px]">image</span>
                                ดูสลิป
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                ไม่มีสลิป
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Drops Breakdown List */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">location_on</span>
                  รายการจุดเข้าพบลูกค้า ({selectedTrip.visits.length} จุด)
                </h4>

                <div className="space-y-2.5">
                  {selectedTrip.visits.map((v) => (
                    <div key={v.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{v.id}. {v.clientName}</div>
                          <div className="text-[11px] text-slate-500">{v.address}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                          {v.isConfirmed ? '✓ พบสำเร็จ' : 'รอดำเนินการ'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-700">
                        <span><strong>วาระการประชุม:</strong> {v.agenda}</span>
                        {typeof v.odometerReading === 'number' && v.odometerReading > 0 && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            <span className="material-symbols-outlined text-[12px] text-primary">speed</span>
                            {v.odometerReading.toLocaleString()} กม.
                          </span>
                        )}
                      </div>

                      {v.meetingMinutes && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 italic">
                          "{v.meetingMinutes}"
                        </div>
                      )}

                      {/* Drop Expenses */}
                      {v.expenses && v.expenses.length > 0 && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-amber-600">receipt_long</span>
                              ค่าใช้จ่ายจุดนี้ ({v.expenses.length} รายการ):
                            </span>
                            <span className="text-amber-700 font-mono">
                              ฿{v.expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {v.expenses.map((exp) => (
                              <div key={exp.id} className="flex items-center justify-between text-[10px] text-slate-600">
                                <span className="truncate max-w-[200px]">• {exp.title} ({exp.category})</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono font-medium text-slate-800">฿{exp.amount.toLocaleString()}</span>
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
                                      className="text-primary hover:underline flex items-center gap-0.5 text-[9px] bg-blue-50 px-1 py-0.5 rounded border border-blue-200 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[10px]">image</span>
                                      สลิป
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.photos && v.photos.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-400">ภาพถ่ายหน้างาน:</span>
                          {v.photos.map((ph, pIdx) => (
                            <img
                              key={pIdx}
                              src={ph}
                              alt="Visit Snap"
                              onClick={() => setPreviewPhoto({ url: ph, location: v.clientName, lat: 13.7563, lng: 100.5018 })}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-all shadow-xs"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {isApproveModalOpen && selectedTrip && (() => {
        const totalDrops = selectedTrip.visits.length;
        const completedDrops = selectedTrip.visits.filter((v) => v.isConfirmed || v.status === 'Completed').length;
        const isIncomplete = completedDrops < totalDrops;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
              <div className="flex items-center gap-2.5 text-emerald-600">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-emerald-600">check_circle</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">ยืนยันการอนุมัติรายงาน</h3>
                  <p className="text-xs text-slate-500">{selectedTrip.code} • {selectedTrip.title}</p>
                </div>
              </div>

              {/* Incomplete Drops Warning */}
              {isIncomplete ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
                    <span>จุดเข้าพบยังไม่เสร็จสิ้นครบทุกจุด!</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    รายงานนี้มีการบันทึกสำเร็จเพียง <strong>{completedDrops}/{totalDrops} จุด</strong> (ยังมีอีก {totalDrops - completedDrops} จุดที่รอดำเนินการ)
                  </p>
                  <p className="text-[10.5px] text-amber-700">
                    หากยืนยันการอนุมัติ ระบบจะถือว่าผู้จัดการตรวจสอบและปิดรอบทริปนี้เรียบร้อยแล้ว
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-emerald-900 text-xs">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">task_alt</span>
                  <span>บันทึกการเข้าพบครบถ้วนทั้ง <strong>{totalDrops}/{totalDrops} จุด</strong> เรียบร้อยแล้ว</span>
                </div>
              )}

              {/* Trip Summary Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">พนักงานการตลาด:</span>
                  <span className="font-bold text-slate-900">{selectedTrip.specialist.name} ({selectedTrip.specialist.nickname})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ยานพาหนะ:</span>
                  <span className="font-medium">{selectedTrip.vehicle.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ระยะทางรวม:</span>
                  <span className="font-medium">{selectedTrip.totalDistance} กม.</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
                  <span className="text-slate-500">ยอดเบิกจ่ายค่าใช้จ่าย:</span>
                  <span className="font-bold text-blue-700 font-mono">฿{selectedTrip.totalExpenses.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmApprove}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>{isIncomplete ? 'ยืนยันอนุมัติล่วงหน้า' : 'อนุมัติรายงาน'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Revoke Approval Confirmation Modal */}
      {isRevokeModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl text-amber-700">undo</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">ยกเลิกการอนุมัติรายงาน</h3>
                <p className="text-xs text-slate-500">{selectedTrip.code} • {selectedTrip.title}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p>
                คุณต้องการยกเลิกการอนุมัติรายงานของ <strong>{selectedTrip.specialist.name}</strong> และเปลี่ยนสถานะกลับเป็น <strong>"รอตรวจสอบ (Pending Approval)"</strong> ใช่หรือไม่?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                * เมื่อยกเลิกแล้ว รายการนี้จะกลับไปอยู่ในคิวรออนุมัติ และผู้จัดการสามารถตรวจสอบใหม่หรือส่งกลับให้แก้ไขได้
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsRevokeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                <span>ยืนยันยกเลิกการอนุมัติ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-600">
              <span className="material-symbols-outlined text-[24px]">assignment_return</span>
              <h3 className="font-bold text-sm">ส่งกลับให้พนักงานแก้ไข (Request Revision)</h3>
            </div>

            <p className="text-xs text-slate-600">
              ระบุสิ่งที่ต้องการให้ <strong>{selectedTrip?.specialist.name}</strong> ตรวจสอบหรือแก้ไขเพิ่มเติม:
            </p>

            <textarea
              rows={3}
              required
              placeholder="เช่น กรุณาแนบภาพถ่ายสลิปค่าทางด่วนให้ชัดเจน..."
              value={rejectFeedbackText}
              onChange={(e) => setRejectFeedbackText(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs"
              >
                ส่งกลับแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] inline-block" onClick={(e) => e.stopPropagation()}>
            <img
              src={typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.url}
              alt="Preview"
              className="max-w-2xl max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            {typeof previewPhoto !== 'string' && (previewPhoto.location || previewPhoto.amount !== undefined) && (
              <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur-md border border-white/20 text-white rounded-xl p-3 text-xs shadow-xl flex flex-col gap-1 pointer-events-none max-w-[85%]">
                {previewPhoto.location && (
                  <div className="font-bold flex items-center gap-1 text-white truncate">
                    <span>📍</span> {previewPhoto.location}
                  </div>
                )}
                {previewPhoto.amount !== undefined && (
                  <div className="text-[11px] text-amber-300 font-mono font-bold">
                    💵 ยอดเงินตามสลิป: ฿{previewPhoto.amount.toLocaleString()}
                  </div>
                )}
                {previewPhoto.lat && (
                  <div className="font-mono text-[11px] text-sky-300">
                    🌐 GPS: {previewPhoto.lat.toFixed(5)}, {previewPhoto.lng?.toFixed(5)}
                  </div>
                )}
                <div className="text-[10px] text-slate-300">
                  🕒 {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </div>
              </div>
            )}
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
