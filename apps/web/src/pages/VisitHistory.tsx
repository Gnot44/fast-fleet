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
  managerFeedback?: string;
  approvedBy?: string;
  approvedAt?: string;
  visits: ClientVisitItem[];
}

export default function VisitHistory() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') || 'All') as any;

  const [filterApproval, setFilterApproval] = useState<
    'All' | 'Pending Approval' | 'Approved' | 'Revision Requested'
  >(initialFilter === 'pending' ? 'Pending Approval' : 'All');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [_previewReceipt] = useState<DropExpenseItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);

  // Reject / Revision Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectFeedbackText, setRejectFeedbackText] = useState('');

  // Marketing Field Trips Data from Supabase
  const [tripsList, setTripsList] = useState<MarketingTripApprovalRecord[]>([]);

  useEffect(() => {
    async function loadTrips() {
      try {
        setLoading(true);
        const { data: trips } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            title,
            status,
            approval_status,
            start_odometer,
            end_odometer,
            trip_date,
            created_at,
            manager_feedback,
            profiles (
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
              client_photo_url
            ),
            expenses (
              id,
              category,
              description,
              amount,
              payment_method,
              receipt_url,
              notes
            )
          `)
          .order('created_at', { ascending: false });

        if (trips && trips.length > 0) {
          const mapped: MarketingTripApprovalRecord[] = trips.map((t: any) => {
            const prof = t.profiles || {};
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

            return {
              id: t.id,
              code: t.trip_code || `TRP-${t.id.slice(0, 6)}`,
              title: t.title || 'เส้นทางเข้าพบลูกค้า',
              status: t.status === 'completed' ? 'Completed' : 'In Progress',
              approvalStatus: approvalStat as any,
              revisionCount: t.approval_status === 'revision_requested' ? 1 : 0,
              specialist: {
                name: prof.full_name || 'พนักงานการตลาด',
                nickname: prof.nickname || prof.full_name?.split(' ')[0] || 'พนักงาน',
                avatar: prof.avatar_url,
                initials: prof.full_name?.slice(0, 2) || 'MK',
                phone: prof.phone || '081-000-0000',
                department: prof.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
                territory: staffObj?.territory || 'Bangkok Central (B2B)',
              },
              vehicle: {
                plate: staffObj?.vehicle_plate || (staffObj?.assigned_vehicle?.match(/\((.+?)\)/)?.[1]) || '1กข-4452 กทม.',
                model: staffObj?.vehicle_model || (staffObj?.assigned_vehicle?.split('(')[0]?.trim()) || 'Isuzu D-Max',
                startOdo: t.start_odometer || 0,
                endOdo: t.end_odometer || 0,
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
              managerFeedback: t.manager_feedback,
              visits: appts.map((a: any, aIdx: number) => ({
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
                photos: a.client_photo_url ? [a.client_photo_url] : [],
                expenses: exps,
              })),
            };
          });

          setTripsList(mapped);
          if (mapped.length > 0) {
            setSelectedTripId(mapped[0].id);
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
    return tripsList.find((t) => t.id === selectedTripId) || filteredTrips[0] || null;
  }, [tripsList, selectedTripId, filteredTrips]);

  // Approve Trip Action
  const handleApproveTrip = async (tripId: string) => {
    const tripToApprove = tripsList.find((t) => t.id === tripId);
    if (!tripToApprove) return;

    try {
      await supabase.from('trips').update({ approval_status: 'approved' }).eq('id', tripId);
    } catch (err) {
      console.warn('Error updating approval status in DB:', err);
    }

    setTripsList((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              approvalStatus: 'Approved',
              approvedBy: 'ผู้จัดการฝ่ายการตลาด (คุณสมศักดิ์)',
              approvedAt: 'เมื่อสักครู่',
            }
          : t
      )
    );

    showToast(`✓ อนุมัติรายงาน ${tripToApprove.code} ของ ${tripToApprove.specialist.name} เรียบร้อยแล้ว`);
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

    try {
      await supabase
        .from('trips')
        .update({
          approval_status: 'revision_requested',
          manager_feedback: rejectFeedbackText.trim(),
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
              revisionCount: (t.revisionCount || 0) + 1,
              managerFeedback: rejectFeedbackText.trim(),
            }
          : t
      )
    );

    setIsRejectModalOpen(false);
    showToast(`⚠️ ส่งรายงานกลับให้ ${selectedTrip.specialist.nickname} แก้ไขเรียบร้อยแล้ว (จะแจ้งเตือนใน Mobile App)`);
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
                    ? { bg: 'bg-rose-50 text-rose-800 border-rose-200', text: '⚠️ ส่งกลับแก้ไข' }
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
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {selectedTrip.code}
                    </span>
                    <h2 className="font-bold text-base text-slate-900">{selectedTrip.title}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    พนักงาน: <strong>{selectedTrip.specialist.name}</strong> • ทะเบียนรถ: <strong>{selectedTrip.vehicle.plate}</strong>
                  </p>
                </div>

                {/* Manager Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenRejectModal}
                    className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">assignment_return</span>
                    ส่งกลับแก้ไข
                  </button>
                  <button
                    onClick={() => handleApproveTrip(selectedTrip.id)}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    อนุมัติรายงาน
                  </button>
                </div>
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

                      <div className="text-[11px] text-slate-700">
                        <strong>วาระการประชุม:</strong> {v.agenda}
                      </div>

                      {v.meetingMinutes && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 italic">
                          "{v.meetingMinutes}"
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
                              onClick={() => setPreviewPhoto(ph)}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-all"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={previewPhoto} alt="Preview" className="max-w-2xl max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20" />
        </div>
      )}
    </div>
  );
}
