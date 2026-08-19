import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

export interface PlannedDrop {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  agendaCategory: string;
  agendaDetail?: string;
  status: 'Scheduled' | 'Completed' | 'In Progress';
  checkedInAt?: string;
  checkedOutAt?: string;
  meetingMinutes?: string;
  photos?: string[];
  expenses?: {
    category: string;
    amount: number;
    receiptName?: string;
  }[];
}

export interface SpecialistTripSchedule {
  id: string;
  tripCode: string;
  tripTitle: string;
  specialistId: string;
  specialistName: string;
  specialistNickname: string;
  specialistAvatar?: string;
  specialistInitials: string;
  department: string;
  territory: string;
  assignedVehicle: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  status: 'Scheduled' | 'Completed' | 'In Progress' | 'Revision Requested';
  startLocation: string;
  startOdometer?: number;
  endOdometer?: number;
  totalDistanceKm?: number;
  totalExpenses?: number;
  drops: PlannedDrop[];
}

export default function SpecialistScheduleCalendar() {
  const { language, t } = useLanguage();

  // Calendar Navigation
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(7); // 0-indexed: 7 = August

  // Selected Specialist Filter ('all' or specialistId)
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('all');
  const [statusFilter] = useState<'all' | 'Scheduled' | 'Completed' | 'In Progress'>('all');

  // Selected Date or Trip for Deep Inspection Modal
  const [selectedTrip, setSelectedTrip] = useState<SpecialistTripSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'timeline'>('calendar');

  // Live Database State
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<SpecialistTripSchedule[]>([]);
  const [_loading, setLoading] = useState(true);

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

  // Load live specialists and trips from Supabase
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
              name: p.full_name || 'พนักงานการตลาด',
              nickname: p.nickname || p.full_name?.split(' ')[0] || 'พนักงาน',
              employeeId: staffObj?.staff_id || 'AITS10002772',
              department: p.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              avatar: p.avatar_url,
              initials: p.full_name?.slice(0, 2) || 'MK',
              colorBadge: colors[idx % colors.length],
            };
          });
          setSpecialists(mappedSpecs);
        } else {
          setSpecialists([]);
        }

        // 2. Fetch Real Trips
        const { data: trips } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            title,
            status,
            approval_status,
            trip_date,
            start_odometer,
            end_odometer,
            staff_id,
            profiles (
              id,
              full_name,
              nickname,
              avatar_url,
              department,
              staff (
                staff_id,
                territory,
                assigned_vehicle
              )
            ),
            appointments (
              id,
              company_name,
              destination_address,
              recipient_name,
              recipient_phone,
              agenda,
              status,
              confirmation_status,
              check_in_at,
              check_out_at,
              meeting_notes,
              client_photo_url
            ),
            expenses (
              id,
              category,
              amount
            )
          `);

        if (trips && trips.length > 0) {
          const mappedTrips: SpecialistTripSchedule[] = trips.map((t: any) => {
            const prof = t.profiles || {};
            const staffObj = Array.isArray(prof.staff) ? prof.staff[0] : prof.staff;
            const appts = t.appointments || [];
            const exps = t.expenses || [];
            const dist = t.end_odometer && t.start_odometer ? Math.max(0, t.end_odometer - t.start_odometer) : 0;
            const totalExp = exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

            const tripStat =
              t.status === 'completed'
                ? 'Completed'
                : t.status === 'in_progress'
                ? 'In Progress'
                : 'Scheduled';

            return {
              id: t.id,
              tripCode: t.trip_code || `TRP-${t.id.slice(0, 6)}`,
              tripTitle: t.title || 'เส้นทางเข้าพบลูกค้า',
              specialistId: t.staff_id || prof.id,
              specialistName: prof.full_name || 'พนักงานการตลาด',
              specialistNickname: prof.nickname || prof.full_name?.split(' ')[0] || 'พนักงาน',
              specialistAvatar: prof.avatar_url,
              specialistInitials: prof.full_name?.slice(0, 2) || 'MK',
              department: prof.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              assignedVehicle: staffObj?.assigned_vehicle || 'Isuzu D-Max (1กข-4452)',
              date: t.trip_date || new Date().toISOString().split('T')[0],
              timeSlot: '09:00 AM',
              status: tripStat as any,
              startLocation: 'Bangkok Central Hub',
              startOdometer: t.start_odometer,
              endOdometer: t.end_odometer,
              totalDistanceKm: dist,
              totalExpenses: totalExp,
              drops: appts.map((a: any) => ({
                id: a.id,
                name: a.company_name,
                address: a.destination_address,
                contactPerson: a.recipient_name || '-',
                contactPhone: a.recipient_phone || '-',
                agendaCategory: a.agenda || 'เข้าพบลูกค้า',
                status: a.confirmation_status ? 'Completed' : 'Scheduled',
                checkedInAt: a.check_in_at,
                checkedOutAt: a.check_out_at,
                meetingMinutes: a.meeting_notes,
                photos: a.client_photo_url ? [a.client_photo_url] : [],
              })),
            };
          });

          setAllTrips(mappedTrips);
        } else {
          setAllTrips([]);
        }
      } catch (err) {
        console.error('Error fetching calendar schedule:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filtered Trips by Specialist and Status
  const filteredTrips = useMemo(() => {
    return allTrips.filter((t) => {
      if (selectedSpecialistId !== 'all' && t.specialistId !== selectedSpecialistId) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [allTrips, selectedSpecialistId, statusFilter]);

  // Specialist Workload Summary
  const specialistWorkloads = useMemo(() => {
    return specialists.map((spec) => {
      const specTrips = allTrips.filter((t) => t.specialistId === spec.id);
      const scheduledCount = specTrips.filter((t) => t.status === 'Scheduled').length;
      const completedCount = specTrips.filter((t) => t.status === 'Completed').length;
      const inProgressCount = specTrips.filter((t) => t.status === 'In Progress').length;
      const totalDrops = specTrips.reduce((acc, t) => acc + t.drops.length, 0);
      const workloadPct = Math.min(100, Math.round((specTrips.length / 5) * 100));

      return {
        ...spec,
        totalTrips: specTrips.length,
        scheduledCount,
        completedCount,
        inProgressCount,
        totalDrops,
        workloadPct,
      };
    });
  }, [allTrips, specialists]);

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

    // Empty lead cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ dayNumber: null, dateStr: null, isToday: false, trips: [] });
    }

    // Month days
    const todayStr = new Date().toISOString().split('T')[0];
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

  // Next / Prev Month
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
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status: SpecialistTripSchedule['status']) => {
    switch (status) {
      case 'Completed':
        return {
          label: `✓ ${t('schedule_status_completed')}`,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'In Progress':
        return {
          label: `🚗 ${t('schedule_status_inprogress')}`,
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          dot: 'bg-blue-500 animate-pulse',
        };
      case 'Scheduled':
        return {
          label: `📅 ${t('schedule_status_scheduled')}`,
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          dot: 'bg-purple-500',
        };
      default:
        return {
          label: '⚠️ Revision',
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          dot: 'bg-rose-500',
        };
    }
  };

  const weekdays = [
    { name: t('schedule_days_sun'), color: 'text-rose-600' },
    { name: t('schedule_days_mon'), color: '' },
    { name: t('schedule_days_tue'), color: '' },
    { name: t('schedule_days_wed'), color: '' },
    { name: t('schedule_days_thu'), color: '' },
    { name: t('schedule_days_fri'), color: '' },
    { name: t('schedule_days_sat'), color: 'text-blue-600' },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-on-surface tracking-tight">
              {t('schedule_title')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-primary border border-blue-200">
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              {t('schedule_badge')}
            </span>
          </div>
          <p className="text-on-surface-variant text-xs mt-1">
            {t('schedule_subtitle')}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/50 shrink-0">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_view_month</span>
            {t('schedule_tab_calendar')}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_timeline</span>
            {t('schedule_tab_timeline')}
          </button>
        </div>
      </div>

      {/* Specialist Team Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {specialistWorkloads.map((spec) => {
          const isSelected = selectedSpecialistId === spec.id;

          return (
            <div
              key={spec.id}
              onClick={() => setSelectedSpecialistId(isSelected ? 'all' : spec.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 bg-surface-container-lowest ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/40 shadow-xs'
                  : 'border-outline-variant/60 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {spec.avatar ? (
                  <img
                    src={spec.avatar}
                    alt={spec.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs">
                    {spec.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-on-surface truncate">{spec.name}</div>
                  <div className="text-[10px] text-on-surface-variant truncate">{spec.territory}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-outline-variant/40">
                <span className="text-slate-500">แผนงานทั้งหมด:</span>
                <span className="font-bold text-slate-800">{spec.totalTrips} ทริป</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Calendar Card */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs space-y-4">
        {/* Navigation & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-on-surface">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={handleGoToday}
              className="px-2.5 py-1 text-[11px] font-bold bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg border border-outline-variant/50 transition-all"
            >
              วันนี้
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/50 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/50 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border border-outline-variant/60 rounded-xl overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 bg-surface-container-low text-center font-bold text-xs py-2 border-b border-outline-variant/60">
            {weekdays.map((w, idx) => (
              <div key={idx} className={w.color || 'text-on-surface'}>
                {w.name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-outline-variant/40">
            {calendarDays.map((d, idx) => (
              <div
                key={idx}
                className={`min-h-[90px] p-2 flex flex-col justify-between ${
                  !d.dayNumber ? 'bg-slate-50/50' : d.isToday ? 'bg-blue-50/30' : 'bg-white'
                }`}
              >
                {d.dayNumber ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold ${d.isToday ? 'text-primary' : 'text-slate-700'}`}>
                        {d.dayNumber}
                      </span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {d.trips.map((tr) => {
                        const badge = getStatusBadge(tr.status);
                        return (
                          <div
                            key={tr.id}
                            onClick={() => setSelectedTrip(tr)}
                            className={`p-1 rounded text-[10px] font-bold border truncate cursor-pointer hover:opacity-85 transition-all ${badge.bg} ${badge.text} ${badge.border}`}
                            title={`${tr.specialistName}: ${tr.tripTitle}`}
                          >
                            {tr.specialistNickname}: {tr.tripTitle}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deep Inspection Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{selectedTrip.tripTitle}</h3>
                <div className="text-xs text-slate-500">
                  {selectedTrip.tripCode} • {selectedTrip.date}
                </div>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>พนักงาน:</span>
                <strong>{selectedTrip.specialistName}</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>รถฟลีท:</span>
                <strong>{selectedTrip.assignedVehicle}</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>จุดเข้าพบ:</span>
                <strong>{selectedTrip.drops.length} จุด</strong>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-bold text-xs text-slate-800">รายการจุดเข้าพบ:</h4>
              {selectedTrip.drops.map((dp, dIdx) => (
                <div key={dIdx} className="p-2.5 bg-slate-50 rounded-xl border text-xs space-y-1">
                  <div className="font-bold text-slate-900">{dIdx + 1}. {dp.name}</div>
                  <div className="text-[11px] text-slate-500">{dp.address}</div>
                  <div className="text-[11px] text-slate-700"><strong>วาระ:</strong> {dp.agendaCategory}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
