import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

interface SpecialistRank {
  rank: number;
  name: string;
  avatar?: string;
  initials?: string;
  department: string;
  territory: string;
  visits: number;
  distanceKm: number;
  onTime: number;
  rating: number;
  totalExpenses: number;
}

interface VisitAgendaStat {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  count: number;
  colorBg: string;
  colorText: string;
  colorBar: string;
  successRate: number;
}

export default function ReportsAnalytics() {
  const { t } = useLanguage();
  // Date Range State
  const [dateRangePreset, setDateRangePreset] = useState<
    'today' | 'last7' | 'last30' | 'thisMonth' | 'custom'
  >('last30');
  
  // Custom Date range
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-19');

  // Department & Sorting filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'visits' | 'distance' | 'onTime' | 'expenses' | 'rating'>('visits');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Database State
  const [specialistsData, setSpecialistsData] = useState<SpecialistRank[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  // Raw Database Aggregate Counts
  const [dbStats, setDbStats] = useState({
    totalVisits: 0,
    totalDistance: 0,
    totalExpenses: 0,
    completionRate: 0,
    agendaCounts: {
      pitch: 0,
      renewal: 0,
      healthcheck: 0,
      demo: 0,
      other: 0,
    },
    expenseCategories: {
      fuel: 0,
      tolls: 0,
      hospitality: 0,
      parking: 0,
      other: 0,
    },
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Real Data from Supabase
  useEffect(() => {
    async function loadAnalyticsData() {
      try {
        setLoading(true);
        // 1. Fetch Real Marketing Specialists
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, avatar_url, department, position, staff(staff_id, territory, total_trips, total_distance_km, safety_score, rating)')
          .eq('role', 'specialist');

        // 2. Fetch Real Trips
        const { data: trips } = await supabase
          .from('trips')
          .select('id, staff_id, status, approval_status, start_odometer, end_odometer, appointments(*), expenses(*)');

        let totalVis = 0;
        let totalDist = 0;
        let totalExp = 0;
        let completedAppts = 0;
        let totalAppts = 0;

        const agendaMap: Record<string, number> = { pitch: 0, renewal: 0, healthcheck: 0, demo: 0, other: 0 };
        const expMap: Record<string, number> = { fuel: 0, tolls: 0, hospitality: 0, parking: 0, other: 0 };

        const specialistVisitsMap: Record<string, { visits: number; distance: number; expenses: number }> = {};

        if (trips && trips.length > 0) {
          trips.forEach((tr: any) => {
            const trDist = tr.end_odometer && tr.start_odometer ? Math.max(0, tr.end_odometer - tr.start_odometer) : 0;
            totalDist += trDist;

            const appts = tr.appointments || [];
            totalAppts += appts.length;

            appts.forEach((ap: any) => {
              if (ap.confirmation_status) {
                completedAppts++;
                totalVis++;
              }
              const ag = ap.agenda?.toLowerCase() || '';
              if (ag.includes('pitch') || ag.includes('นำเสนอ')) agendaMap.pitch++;
              else if (ag.includes('renew') || ag.includes('ต่อสัญญา')) agendaMap.renewal++;
              else if (ag.includes('health') || ag.includes('ตรวจ')) agendaMap.healthcheck++;
              else if (ag.includes('demo') || ag.includes('เดโม')) agendaMap.demo++;
              else agendaMap.other++;
            });

            const exps = tr.expenses || [];
            exps.forEach((ex: any) => {
              const amt = Number(ex.amount) || 0;
              totalExp += amt;
              const cat = ex.category?.toLowerCase() || '';
              if (cat.includes('fuel') || cat.includes('น้ำมัน')) expMap.fuel += amt;
              else if (cat.includes('toll') || cat.includes('ทางด่วน')) expMap.tolls += amt;
              else if (cat.includes('meal') || cat.includes('อาหาร') || cat.includes('รับรอง')) expMap.hospitality += amt;
              else if (cat.includes('park') || cat.includes('จอด')) expMap.parking += amt;
              else expMap.other += amt;
            });

            if (tr.staff_id) {
              if (!specialistVisitsMap[tr.staff_id]) {
                specialistVisitsMap[tr.staff_id] = { visits: 0, distance: 0, expenses: 0 };
              }
              specialistVisitsMap[tr.staff_id].visits += appts.filter((a: any) => a.confirmation_status).length;
              specialistVisitsMap[tr.staff_id].distance += trDist;
              specialistVisitsMap[tr.staff_id].expenses += exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            }
          });
        }

        const compRate = totalAppts > 0 ? (completedAppts / totalAppts) * 100 : 0;

        setDbStats({
          totalVisits: totalVis,
          totalDistance: totalDist,
          totalExpenses: totalExp,
          completionRate: Math.round(compRate * 10) / 10,
          agendaCounts: agendaMap as any,
          expenseCategories: expMap as any,
        });

        if (profiles && profiles.length > 0) {
          const ranks: SpecialistRank[] = profiles.map((p: any, idx: number) => {
            const staffObj = Array.isArray(p.staff) ? p.staff[0] : p.staff;
            const stats = specialistVisitsMap[p.id] || { visits: 0, distance: 0, expenses: 0 };

            return {
              rank: idx + 1,
              name: p.full_name || 'พนักงานการตลาด',
              avatar: p.avatar_url,
              initials: p.full_name?.slice(0, 2) || 'MK',
              department: p.department || 'ฝ่ายการตลาดและบริหารงานภาคสนาม',
              territory: staffObj?.territory || 'Bangkok Central (B2B)',
              visits: stats.visits,
              distanceKm: stats.distance,
              onTime: stats.visits > 0 ? 100 : 0,
              rating: staffObj?.rating ? Number(staffObj.rating) : 5.0,
              totalExpenses: stats.expenses,
            };
          });

          setSpecialistsData(ranks);
        } else {
          setSpecialistsData([]);
        }
      } catch (err) {
        console.error('Error fetching analytics from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalyticsData();
  }, []);

  // Date Range Preset change handler
  const handleSelectPreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom') => {
    setDateRangePreset(preset);
    const today = new Date('2026-08-19');

    if (preset === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'last30') {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'thisMonth') {
      setStartDate('2026-08-01');
      setEndDate('2026-08-31');
    }
  };

  // Overall KPI Calculations based on real database values
  const totalVisits = dbStats.totalVisits;
  const totalDistance = dbStats.totalDistance;
  const totalExpenses = dbStats.totalExpenses;
  const avgCostPerVisit = totalVisits > 0 ? (totalExpenses / totalVisits).toFixed(1) : '0';
  const visitCompletionRate = dbStats.completionRate;

  // 1. Visit Agenda Analytics (5 Real Options)
  const visitAgendas: VisitAgendaStat[] = useMemo(() => {
    return [
      {
        id: 'pitch',
        title: 'นำเสนอโปรเจกต์ (Pitch & Proposal)',
        titleEn: 'Pitch & Solution Proposal',
        icon: '💼',
        count: dbStats.agendaCounts.pitch,
        colorBg: 'bg-blue-50',
        colorText: 'text-primary',
        colorBar: 'bg-primary',
        successRate: dbStats.agendaCounts.pitch > 0 ? 100 : 0,
      },
      {
        id: 'renewal',
        title: 'ต่อสัญญา & SLA (Renewal & SLA)',
        titleEn: 'Contract Renewal & SLA Review',
        icon: '📝',
        count: dbStats.agendaCounts.renewal,
        colorBg: 'bg-emerald-50',
        colorText: 'text-emerald-700',
        colorBar: 'bg-emerald-600',
        successRate: dbStats.agendaCounts.renewal > 0 ? 100 : 0,
      },
      {
        id: 'healthcheck',
        title: 'ตรวจระบบ (Healthcheck & Integration)',
        titleEn: 'System Healthcheck & Technical Integration',
        icon: '🔧',
        count: dbStats.agendaCounts.healthcheck,
        colorBg: 'bg-purple-50',
        colorText: 'text-purple-700',
        colorBar: 'bg-purple-600',
        successRate: dbStats.agendaCounts.healthcheck > 0 ? 100 : 0,
      },
      {
        id: 'demo',
        title: 'แนะนำสินค้า & เดโม (Demo & Customer Success)',
        titleEn: 'Product Demo & Customer Success',
        icon: '🚀',
        count: dbStats.agendaCounts.demo,
        colorBg: 'bg-amber-50',
        colorText: 'text-amber-700',
        colorBar: 'bg-amber-500',
        successRate: dbStats.agendaCounts.demo > 0 ? 100 : 0,
      },
      {
        id: 'other',
        title: 'อื่นๆ (Other - ส่งเอกสาร / ติดตามด่วน)',
        titleEn: 'Other & Document Follow-up',
        icon: '📌',
        count: dbStats.agendaCounts.other,
        colorBg: 'bg-slate-100',
        colorText: 'text-slate-700',
        colorBar: 'bg-slate-500',
        successRate: dbStats.agendaCounts.other > 0 ? 100 : 0,
      },
    ];
  }, [dbStats.agendaCounts]);

  const totalAgendaVisits = visitAgendas.reduce((sum, a) => sum + a.count, 0);

  // 2. Field Expense Breakdown
  const expenseCategories = useMemo(() => {
    const { fuel, tolls, hospitality, parking, other } = dbStats.expenseCategories;
    const total = totalExpenses > 0 ? totalExpenses : 1;

    return [
      {
        label: 'ค่าน้ำมันรถ (Fuel Top-up)',
        amount: fuel,
        pct: totalExpenses > 0 ? Math.round((fuel / total) * 100) : 0,
        color: 'bg-blue-600',
        icon: 'local_gas_station',
      },
      {
        label: 'ค่าทางด่วน Easy Pass (Expressway Tolls)',
        amount: tolls,
        pct: totalExpenses > 0 ? Math.round((tolls / total) * 100) : 0,
        color: 'bg-emerald-600',
        icon: 'toll',
      },
      {
        label: 'ค่าอาหาร & เลี้ยงรับรองลูกค้า (Client Hospitality)',
        amount: hospitality,
        pct: totalExpenses > 0 ? Math.round((hospitality / total) * 100) : 0,
        color: 'bg-purple-600',
        icon: 'restaurant',
      },
      {
        label: 'ค่าที่จอดรถอาคาร/ห้าง (Parking Fees)',
        amount: parking,
        pct: totalExpenses > 0 ? Math.round((parking / total) * 100) : 0,
        color: 'bg-amber-600',
        icon: 'local_parking',
      },
      {
        label: 'ค่าใช้จ่ายอื่นๆ / เบ็ดเตล็ด (Other Expenses)',
        amount: other,
        pct: totalExpenses > 0 ? Math.round((other / total) * 100) : 0,
        color: 'bg-slate-600',
        icon: 'receipt',
      },
    ];
  }, [dbStats.expenseCategories, totalExpenses]);

  // Filtered & Sorted Specialists Ranking
  const filteredSpecialists = useMemo(() => {
    const filtered = specialistsData.filter((spec) => {
      if (selectedDepartment !== 'all' && spec.department !== selectedDepartment) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'visits') return b.visits - a.visits;
      if (sortBy === 'distance') return b.distanceKm - a.distanceKm;
      if (sortBy === 'onTime') return b.onTime - a.onTime;
      if (sortBy === 'expenses') return b.totalExpenses - a.totalExpenses;
      if (sortBy === 'rating') return b.rating - a.rating;
      return a.rank - b.rank;
    });
  }, [specialistsData, selectedDepartment, sortBy]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Name',
      'Department',
      'Territory',
      'Visits Completed',
      'Distance (km)',
      'Completion Rate (%)',
      'Rating',
      'Total Expenses (THB)',
    ];

    const rows = filteredSpecialists.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      `"${s.department}"`,
      `"${s.territory}"`,
      s.visits,
      s.distanceKm,
      `${s.onTime}%`,
      s.rating,
      s.totalExpenses,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FastFleet_Analytics_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📊 ส่งออกรายงาน CSV เรียบร้อยแล้ว');
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

      {/* Header & Date Range Control */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-on-surface tracking-tight">
              {t('reports_title')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-primary border border-blue-200">
              <span className="material-symbols-outlined text-[14px]">query_stats</span>
              Live Data
            </span>
          </div>
          <p className="text-on-surface-variant text-xs mt-1">
            {t('reports_subtitle')}
          </p>
        </div>

        {/* Action Controls: Date Range Presets & CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/50">
            {[
              { id: 'today', label: 'วันนี้' },
              { id: 'last7', label: '7 วัน' },
              { id: 'thisMonth', label: 'เดือนนี้' },
              { id: 'last30', label: '30 วัน' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id as any)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  dateRangePreset === preset.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Export CSV CTA */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {t('btn_export_csv')}
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Client Visits */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium">การเข้าพบลูกค้าทั้งหมด</span>
            <div className="text-2xl font-extrabold text-on-surface mt-0.5">{totalVisits}</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <span>{totalVisits > 0 ? `พบสำเร็จ ${totalVisits} จุด` : 'ยังไม่มีข้อมูลการเข้าพบ'}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-primary flex items-center justify-center border border-blue-200">
            <span className="material-symbols-outlined text-[22px]">storefront</span>
          </div>
        </div>

        {/* Metric 2: Total Distance Traveled */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium">ระยะทางเดินทางรวม (Fleet Distance)</span>
            <div className="text-2xl font-extrabold text-on-surface mt-0.5">
              {totalDistance.toLocaleString()} <span className="text-xs font-normal text-on-surface-variant">กม.</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <span>{totalDistance > 0 ? 'จาก Odometer จริง' : '0 กม.'}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <span className="material-symbols-outlined text-[22px]">route</span>
          </div>
        </div>

        {/* Metric 3: Total Expenses */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium">ค่าใช้จ่ายรวมภาคสนาม (Expenses)</span>
            <div className="text-2xl font-extrabold text-on-surface mt-0.5">
              ฿{totalExpenses.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <span>{totalExpenses > 0 ? `เฉลี่ย ฿${avgCostPerVisit} / จุด` : '฿0'}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          </div>
        </div>

        {/* Metric 4: Visit Completion Rate */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium">อัตราเข้าพบตามแผน (Success Rate)</span>
            <div className="text-2xl font-extrabold text-on-surface mt-0.5">
              {visitCompletionRate}%
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <span>{totalVisits > 0 ? 'ยืนยันพร้อมภาพถ่าย' : 'รอพนักงานเริ่มงาน'}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <span className="material-symbols-outlined text-[22px]">verified</span>
          </div>
        </div>
      </div>

      {/* Grid: 2 Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Card: 5 Standardized Visit Agendas */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">donut_small</span>
              <h3 className="font-bold text-sm text-on-surface">วัตถุประสงค์การเข้าพบ (Visit Agendas)</h3>
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant">
              รวม {totalAgendaVisits} ครั้ง
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {visitAgendas.map((agenda) => {
              const pct = totalAgendaVisits > 0 ? Math.round((agenda.count / totalAgendaVisits) * 100) : 0;

              return (
                <div key={agenda.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <span className="text-base">{agenda.icon}</span>
                      <span>{agenda.title}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="font-bold text-slate-900">{agenda.count} ครั้ง</span>
                      <span className="text-slate-400">({pct}%)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${agenda.colorBar} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Expense Category Breakdown */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600 text-[20px]">account_balance_wallet</span>
              <h3 className="font-bold text-sm text-on-surface">สัดส่วนค่าใช้จ่ายภาคสนาม (Field Expenses)</h3>
            </div>
            <span className="text-[11px] font-bold text-purple-700 font-mono">
              ฿{totalExpenses.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {expenseCategories.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-800">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">{cat.icon}</span>
                    <span className="font-medium">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-slate-900">฿{cat.amount.toLocaleString()}</span>
                    <span className="text-slate-400">({cat.pct}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Specialist Performance Ranking Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-4 border-b border-outline-variant/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">military_tech</span>
            <h3 className="font-bold text-sm text-on-surface">
              อันดับประสิทธิภาพพนักงานการตลาด (Marketing Specialist Leaderboard)
            </h3>
            <span className="text-xs text-slate-500 font-normal">({filteredSpecialists.length} คน)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-white px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface border border-outline-variant/60 focus:outline-none focus:border-primary"
            >
              <option value="all">ทุกฝ่าย / แผนก</option>
              <option value="Key Accounts & Enterprise">Key Accounts & Enterprise</option>
              <option value="B2B Field Marketing">B2B Field Marketing</option>
              <option value="Strategic Accounts">Strategic Accounts</option>
              <option value="Retail Expansion">Retail Expansion</option>
            </select>

            {/* Sort by Metric */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface border border-outline-variant/60 focus:outline-none focus:border-primary"
            >
              <option value="visits">เรียงตาม: จำนวนเข้าพบ</option>
              <option value="distance">เรียงตาม: ระยะทาง (กม.)</option>
              <option value="onTime">เรียงตาม: อัตราสำเร็จ (%)</option>
              <option value="expenses">เรียงตาม: ค่าใช้จ่าย (฿)</option>
              <option value="rating">เรียงตาม: คะแนนความพึงพอใจ</option>
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low/60 text-on-surface-variant font-bold border-b border-outline-variant/60">
              <tr>
                <th className="p-3.5 pl-4 text-center w-12">อันดับ</th>
                <th className="p-3.5">พนักงาน (Specialist)</th>
                <th className="p-3.5">ฝ่าย & โซนพื้นที่</th>
                <th className="p-3.5 text-center">เข้าพบสำเร็จ</th>
                <th className="p-3.5 text-center">ระยะทาง (กม.)</th>
                <th className="p-3.5 text-center">ความสำเร็จ</th>
                <th className="p-3.5 text-center">คะแนน</th>
                <th className="p-3.5 text-right pr-4">ค่าใช้จ่ายรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {filteredSpecialists.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">group_off</span>
                    <p className="text-xs">ไม่พบข้อมูลพนักงานการตลาดในระบบ</p>
                  </td>
                </tr>
              ) : (
                filteredSpecialists.map((spec, idx) => {
                  const rankBadgeColor =
                    idx === 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : idx === 1
                      ? 'bg-slate-200 text-slate-700 border-slate-300'
                      : idx === 2
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200';

                  return (
                    <tr key={idx} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="p-3.5 pl-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${rankBadgeColor}`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {spec.avatar ? (
                            <img
                              src={spec.avatar}
                              alt={spec.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs">
                              {spec.initials}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{spec.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-primary">{spec.department}</div>
                        <div className="text-[11px] text-slate-500">{spec.territory}</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-900 font-mono">
                        {spec.visits} จุด
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-700">
                        {spec.distanceKm.toLocaleString()} กม.
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-bold text-emerald-700 font-mono">{spec.onTime}%</span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-amber-600 font-bold">
                        ★ {spec.rating}
                      </td>
                      <td className="p-3.5 text-right pr-4 font-bold text-slate-900 font-mono">
                        ฿{spec.totalExpenses.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
