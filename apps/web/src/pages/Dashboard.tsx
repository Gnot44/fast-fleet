import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface DropItem {
  dropNumber: number;
  clientName: string;
  address: string;
  agenda: string;
  lat: number;
  lng: number;
  isClosed: boolean;
  closedAt?: string;
}

export interface SpecialistActiveTrip {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  avatar?: string;
  initials: string;
  department: string;
  territory: string;
  vehiclePlate: string;
  isOnline: boolean;
  lastSeenRaw?: string | null;
  
  // Active Trip Info from Mobile
  hasActiveTrip: boolean;
  tripCode: string;
  tripTitle: string;
  startTime: string;
  
  // Real-time GPS & Telemetry
  telemetry: {
    lat: number;
    lng: number;
    hasGpsFix: boolean;
    currentAddress: string;
    speedKmH: number;
    speedText: string;
    batteryPercent: number | null;
    isCharging: boolean;
    lastPing: string;
  };

  // Drops Breakdown
  drops: DropItem[];
  
  // Coordinates for Map Route Polyline
  routeCoordinates: [number, number][];
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) {
    return 'ยังไม่มีพิกัด';
  }
  const date = new Date(dateString);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 20) {
    return 'สด (Real-time)';
  }
  if (diffSec < 60) {
    return `${diffSec} วิที่แล้ว`;
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
  }
  if (diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)} ชม.ที่แล้ว`;
  }
  const days = Math.floor(diffSec / 86400);
  return `${days} วันที่แล้ว`;
}

// Smoothly focus and fit map bounds to the selected specialist's journey
function MapFocusController({
  selectedSpecialist,
  soloId,
  specialists,
}: {
  selectedSpecialist: SpecialistActiveTrip | null;
  soloId: string | null;
  specialists: SpecialistActiveTrip[];
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedSpecialist && selectedSpecialist.telemetry.hasGpsFix) {
      if (selectedSpecialist.hasActiveTrip && selectedSpecialist.routeCoordinates && selectedSpecialist.routeCoordinates.length > 1) {
        const bounds = L.latLngBounds(selectedSpecialist.routeCoordinates);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
      } else {
        map.flyTo(
          [selectedSpecialist.telemetry.lat, selectedSpecialist.telemetry.lng],
          14,
          { animate: true }
        );
      }
    } else if (specialists.length > 0) {
      const validPoints = specialists
        .filter((s) => s.telemetry.hasGpsFix && s.telemetry.lat && s.telemetry.lng)
        .map((s) => [s.telemetry.lat, s.telemetry.lng] as [number, number]);
      if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true });
      } else if (validPoints.length === 1) {
        map.flyTo(validPoints[0], 13, { animate: true });
      }
    }
  }, [selectedSpecialist, soloId, specialists, map]);

  return null;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [motionFilter, setMotionFilter] = useState<'all' | 'online' | 'moving' | 'stationary' | 'offline'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [soloId, setSoloId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [expandedDrops, setExpandedDrops] = useState<Record<string, boolean>>({});

  const fetchLiveSpecialists = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          nickname,
          phone,
          avatar_url,
          department,
          is_online,
          last_seen_at,
          current_lat,
          current_lng,
          current_address,
          current_speed,
          battery_level,
          staff (
            staff_id,
            territory,
            assigned_vehicle,
            vehicle_plate
          ),
          trips:trips!trips_staff_id_fkey (
            id,
            trip_code,
            title,
            status,
            created_at,
            appointments (
              id,
              sequence_order,
              company_name,
              customer_name,
              destination_address,
              destination_lat,
              destination_lng,
              agenda,
              status,
              confirmation_status
            )
          )
        `)
        .eq('role', 'specialist');

      if (error) {
        console.error('Error fetching live specialists from Supabase:', error);
      }

      if (profiles && profiles.length > 0) {
        const mapped: SpecialistActiveTrip[] = profiles.map((p: any) => {
          const staffObj = Array.isArray(p.staff) ? p.staff[0] : p.staff;
          // Only trips currently in_progress are considered active on the live map
          const activeTrip = Array.isArray(p.trips)
            ? p.trips.find((t: any) => t.status === 'in_progress')
            : null;

          const hasActiveTrip = !!activeTrip;
          const appts = hasActiveTrip ? (activeTrip?.appointments || []) : [];
          
          const hasGps = typeof p.current_lat === 'number' && typeof p.current_lng === 'number' && p.current_lat !== 0;
          const lat = hasGps ? p.current_lat : 13.7563;
          const lng = hasGps ? p.current_lng : 100.5018;

          const sortedAppts = [...appts].sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));

          const drops: DropItem[] = hasActiveTrip
            ? sortedAppts.map((a: any, idx: number) => {
                const dropLat = typeof a.destination_lat === 'number' && a.destination_lat !== 0
                  ? a.destination_lat
                  : (hasGps ? lat : 13.7563);
                const dropLng = typeof a.destination_lng === 'number' && a.destination_lng !== 0
                  ? a.destination_lng
                  : (hasGps ? lng : 100.5018);

                return {
                  dropNumber: a.sequence_order || idx + 1,
                  clientName: a.company_name || a.customer_name || `ลูกค้ารายที่ ${idx + 1}`,
                  address: a.destination_address || 'กรุงเทพมหานคร',
                  agenda: a.agenda || 'เข้าพบและนำเสนอสินค้า',
                  lat: dropLat,
                  lng: dropLng,
                  isClosed: a.status === 'completed' || a.confirmation_status === true,
                };
              })
            : [];

          const routeCoords: [number, number][] = hasActiveTrip && drops.length > 0
            ? drops.map((d) => [d.lat, d.lng] as [number, number])
            : (hasGps ? [[lat, lng]] : []);

          const realBattery = typeof p.battery_level === 'number' && p.battery_level >= 0
            ? Math.round(p.battery_level)
            : (p.is_online ? 100 : null);

          const speedVal = typeof p.current_speed === 'number' ? Math.round(p.current_speed) : 0;
          const speedText = speedVal > 0 ? `${speedVal} km/h (กำลังเดินทาง)` : '0 km/h (จอด/อยู่กับที่)';
          const currentAddress = hasGps
            ? (p.current_address || `พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            : 'ยังไม่ได้รับสัญญาณ GPS จากอุปกรณ์';

          const relativePing = formatRelativeTime(p.last_seen_at);

          const pingDiffMs = p.last_seen_at ? Date.now() - new Date(p.last_seen_at).getTime() : Infinity;
          const effectiveOnline = p.is_online === true && pingDiffMs <= 600000;

          return {
            id: p.id,
            name: p.full_name || 'พนักงานการตลาด',
            nickname: p.nickname || p.full_name?.split(' ')[0] || 'พนักงาน',
            phone: p.phone || '081-000-0000',
            avatar: p.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
            initials: p.full_name
              ? p.full_name.split(' ').slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('')
              : 'MK',
            department: p.department || 'Key Accounts & Enterprise',
            territory: staffObj?.territory || p.department || 'Wat Donmuang',
            vehiclePlate: staffObj?.vehicle_plate || p.assigned_vehicle_plate || staffObj?.assigned_vehicle || 'Isuzu D-Max SpaceCab (1กข-5555 กทม.)',
            isOnline: effectiveOnline,
            lastSeenRaw: p.last_seen_at,
            hasActiveTrip,
            tripCode: hasActiveTrip ? (activeTrip?.trip_code || 'IN_PROGRESS') : 'STANDBY',
            tripTitle: hasActiveTrip ? (activeTrip?.title || 'เส้นทางเข้าพบลูกค้า') : 'พร้อมปฏิบัติงาน (ไม่มีทริป)',
            startTime: hasActiveTrip && activeTrip?.created_at ? new Date(activeTrip.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-',
            telemetry: {
              lat,
              lng,
              hasGpsFix: hasGps,
              currentAddress,
              speedKmH: speedVal,
              speedText,
              batteryPercent: realBattery,
              isCharging: false,
              lastPing: relativePing,
            },
            drops,
            routeCoordinates: routeCoords,
          };
        });

        setSpecialists(mapped);
        const onlineSpec = mapped.find((s) => s.isOnline);
        setSelectedId((prev) => {
          if (!prev || !mapped.some((s) => s.id === prev)) {
            return onlineSpec ? onlineSpec.id : (mapped.length > 0 ? mapped[0].id : null);
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error fetching live specialists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSpecialists();

    // Set up Realtime subscriptions for profiles, trips, and appointments changes
    const channel = supabase
      .channel('live-specialists-presence-room')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchLiveSpecialists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetchLiveSpecialists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          fetchLiveSpecialists();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'location_logs' },
        () => {
          fetchLiveSpecialists();
        }
      )
      .subscribe();

    // 1-second interval to update countdown and refresh data every 60 seconds
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLiveSpecialists();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const selectedSpecialist = useMemo(() => {
    return specialists.find((s) => s.id === selectedId) || null;
  }, [specialists, selectedId]);

  const soloSpecialist = useMemo(() => {
    return specialists.find((s) => s.id === soloId) || null;
  }, [specialists, soloId]);

  const getDerivedStatus = (spec: SpecialistActiveTrip) => {
    const diffMs = spec.lastSeenRaw
      ? Date.now() - new Date(spec.lastSeenRaw).getTime()
      : Infinity;

    const isStale = diffMs > 180000 && diffMs <= 600000; // 3 - 10 minutes without ping (GPS Stale / Signal lost)
    const isVeryStale = diffMs > 600000; // > 10 minutes -> App closed or offline

    // If marked offline in DB, or ping is > 10 minutes old, or no timestamp
    if (!spec.isOnline || isVeryStale || !spec.lastSeenRaw) {
      return {
        status: 'Offline' as const,
        label: '⚫ ออฟไลน์ (Offline)',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
        isMoving: false,
        isOnline: false,
        isSignalLost: false,
        isOffline: true,
      };
    }

    // If marked online in DB but no ping for 3 - 10 minutes (temporary tunnel / signal loss / GPS turned off)
    if (isStale) {
      return {
        status: 'SignalLost' as const,
        label: '⚠️ สัญญาณขาดหาย / ปิด GPS',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        dotClass: 'bg-amber-500 animate-pulse',
        isMoving: false,
        isOnline: false,
        isSignalLost: true,
        isOffline: false,
      };
    }

    // Active Online (< 3 mins)
    if (!spec.hasActiveTrip) {
      return {
        status: 'Online' as const,
        label: '🟢 ออนไลน์ (พร้อมรับงาน)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
        isMoving: false,
        isOnline: true,
        isSignalLost: false,
        isOffline: false,
      };
    }

    const allClosed = spec.drops.length > 0 && spec.drops.every((d) => d.isClosed);
    if (allClosed) {
      return {
        status: 'Completed' as const,
        label: t('live_status_complete'),
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        dotClass: 'bg-purple-500',
        isMoving: false,
        isOnline: true,
        isSignalLost: false,
        isOffline: false,
      };
    }
    // Smartphone GPS Engine: Speed >= 4.0 km/h is Running
    if (spec.telemetry.speedKmH >= 4.0) {
      return {
        status: 'Running' as const,
        label: t('live_status_running'),
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
        isMoving: true,
        isOnline: true,
        isSignalLost: false,
        isOffline: false,
      };
    }
    // Speed < 4.0 km/h is Stopped
    return {
      status: 'Stopped' as const,
      label: t('live_status_stopped'),
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
      isMoving: false,
      isOnline: true,
      isSignalLost: false,
      isOffline: false,
    };
  };

  const filteredSpecialists = useMemo(() => {
    return specialists.filter((s) => {
      const derived = getDerivedStatus(s);
      let matchFilter = true;
      if (motionFilter === 'online') {
        matchFilter = derived.isOnline;
      } else if (motionFilter === 'offline') {
        matchFilter = derived.isOffline || derived.isSignalLost;
      } else if (motionFilter === 'moving') {
        matchFilter = derived.isMoving;
      } else if (motionFilter === 'stationary') {
        matchFilter = derived.isOnline && !derived.isMoving;
      }

      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tripTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.territory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.drops.some((d) => d.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchFilter && matchSearch;
    });
  }, [specialists, motionFilter, searchQuery, t]);

  const mapVisibleSpecialists = useMemo(() => {
    if (soloId) {
      return specialists.filter((s) => s.id === soloId);
    }
    return specialists;
  }, [specialists, soloId]);

  // Clean Modern Marker Creator with Pulse Effect
  const createSpecialistLivePin = (spec: SpecialistActiveTrip) => {
    const isSelected = selectedSpecialist?.id === spec.id || soloId === spec.id;
    const derived = getDerivedStatus(spec);
    const borderCol = derived.isOffline
      ? '#94A3B8'
      : derived.isSignalLost
      ? '#F59E0B'
      : derived.isMoving
      ? '#2563EB'
      : '#059669';

    const statusDotCol = derived.isOffline
      ? '#94A3B8'
      : derived.isSignalLost
      ? '#F59E0B'
      : derived.isMoving
      ? '#3B82F6'
      : '#10B981';

    const pulseCol = derived.isOffline
      ? 'rgba(148, 163, 184, 0.45)'
      : derived.isSignalLost
      ? 'rgba(245, 158, 11, 0.65)'
      : derived.isMoving
      ? 'rgba(37, 99, 235, 0.65)'
      : 'rgba(16, 185, 129, 0.65)';

    const statusText = derived.isOffline
      ? '(Offline)'
      : derived.isSignalLost
      ? '⚠️ GPS ขาด'
      : derived.isMoving
      ? spec.telemetry.speedText
      : '🟢 Online';

    const statusTextColor = derived.isOffline
      ? '#CBD5E1'
      : derived.isSignalLost
      ? '#FCD34D'
      : derived.isMoving
      ? '#93C5FD'
      : '#86EFAC';

    const showPulse = derived.isOnline || isSelected;

    return L.divIcon({
      className: 'clean-live-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${showPulse ? `<div class="gps-pulse-beacon" style="background: ${pulseCol}; ${isSelected ? 'transform: scale(1.15);' : ''}"></div>` : ''}
          <div style="
            position: relative;
            z-index: 2;
            background: white;
            border: 2.5px solid ${borderCol};
            color: #0F172A;
            font-weight: 800;
            font-size: 11px;
            width: ${isSelected ? '38px' : '32px'};
            height: ${isSelected ? '38px' : '32px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 12px rgba(0,0,0,0.22);
            transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
            transition: all 0.2s ease;
          ">
            ${spec.initials}
            <span style="
              position: absolute;
              top: -1px;
              right: -1px;
              width: 9px;
              height: 9px;
              border-radius: 50%;
              background: ${statusDotCol};
              border: 1.5px solid white;
            "></span>
          </div>
          <div style="
            position: relative;
            z-index: 2;
            background: rgba(15, 23, 42, 0.92);
            color: white;
            padding: 2px 6px;
            border-radius: 5px;
            font-size: 10px;
            font-weight: 600;
            margin-top: 3px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 3px;
          ">
            <span>${spec.nickname}</span>
            <span style="color: ${statusTextColor};">
              ${statusText}
            </span>
          </div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 24],
    });
  };

  const createDropPin = (drop: DropItem, isNext: boolean) => {
    const isClosed = drop.isClosed;
    const bg = isClosed ? '#10B981' : isNext ? '#2563EB' : '#475569';
    const label = isClosed ? '✓' : drop.dropNumber.toString();
    const pinSize = isNext ? 32 : 26;
    const totalHeight = isNext ? 40 : 34;

    return L.divIcon({
      className: 'clean-drop-pin',
      html: `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        ">
          <div style="
            background: ${bg};
            color: white;
            width: ${pinSize}px;
            height: ${pinSize}px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: ${isNext ? '13px' : '11px'};
            border: 2.5px solid white;
            ${isNext ? 'box-shadow: 0 0 0 3px rgba(37,99,235,0.4);' : ''}
          ">
            ${label}
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid ${bg};
            margin-top: -1px;
          "></div>
        </div>
      `,
      iconSize: [pinSize, totalHeight],
      iconAnchor: [pinSize / 2, totalHeight],
      popupAnchor: [0, -totalHeight],
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 backdrop-blur-md animate-fade-in text-xs font-semibold">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header & Motion Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <h1 className="font-extrabold text-lg sm:text-xl lg:text-2xl text-slate-900 dark:text-white tracking-tight leading-none">
              {t('live_title')}
            </h1>
            <button
              onClick={() => {
                fetchLiveSpecialists();
                setCountdown(60);
                showToast('🔄 อัปเดตพิกัดสดล่าสุดเรียบร้อยแล้ว');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 transition-all tactile-btn cursor-pointer shrink-0"
              title="คลิกเพื่อรีเฟรชพิกัดสดทันที"
            >
              <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400">sync</span>
              <span className="font-mono text-[11px] tnum">{language === 'th' ? `รีเฟรชใน ${countdown}s` : `Auto-sync in ${countdown}s`}</span>
            </button>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-normal">
            {t('live_subtitle')}
          </p>
        </div>

        {/* Filter Quick Switcher Pills (Touch scrollable on mobile/tablet) */}
        <div className="w-full md:w-auto flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-hide">
          {(
            [
              { key: 'all', label: language === 'th' ? `ทั้งหมด (${specialists.length})` : `All (${specialists.length})` },
              { key: 'online', label: language === 'th' ? `ออนไลน์ (${specialists.filter((s) => getDerivedStatus(s).isOnline).length})` : `Online (${specialists.filter((s) => getDerivedStatus(s).isOnline).length})` },
              { key: 'moving', label: language === 'th' ? `กำลังเดินทาง (${specialists.filter((s) => getDerivedStatus(s).isMoving).length})` : `Moving (${specialists.filter((s) => getDerivedStatus(s).isMoving).length})` },
              { key: 'stationary', label: language === 'th' ? `จอด/Standby (${specialists.filter((s) => getDerivedStatus(s).isOnline && !getDerivedStatus(s).isMoving).length})` : `Standby (${specialists.filter((s) => getDerivedStatus(s).isOnline && !getDerivedStatus(s).isMoving).length})` },
              { key: 'offline', label: language === 'th' ? `ออฟไลน์ (${specialists.filter((s) => getDerivedStatus(s).isOffline || getDerivedStatus(s).isSignalLost).length})` : `Offline (${specialists.filter((s) => getDerivedStatus(s).isOffline || getDerivedStatus(s).isSignalLost).length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setMotionFilter(item.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 tactile-btn cursor-pointer ${
                motionFilter === item.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Soft Tinted Minimalist Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Online Specialists - Soft Emerald Tint */}
        <div
          onClick={() => setMotionFilter('online')}
          className={`p-4 sm:p-5 rounded-3xl transition-all cursor-pointer tactile-btn soft-tint-emerald ${
            motionFilter === 'online'
              ? 'ring-2 ring-emerald-500/40 border-emerald-400 dark:border-emerald-600 shadow-xs'
              : 'hover:border-emerald-300 dark:hover:border-emerald-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {language === 'th' ? 'พนักงานออนไลน์' : 'Online Specialists'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/70 dark:border-emerald-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">radar</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-950 dark:text-emerald-100 font-mono tnum tracking-tight">
              {specialists.filter((s) => getDerivedStatus(s).isOnline).length}
            </span>
            <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium tnum">
              / {specialists.length} {language === 'th' ? 'คน' : 'staff'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{language === 'th' ? 'ส่งพิกัดสดเข้าสู่ระบบ' : 'Live GPS signal connected'}</span>
          </div>
        </div>

        {/* 2. Moving En Route - Soft Blue Tint */}
        <div
          onClick={() => setMotionFilter('moving')}
          className={`p-4 sm:p-5 rounded-3xl transition-all cursor-pointer tactile-btn soft-tint-blue ${
            motionFilter === 'moving'
              ? 'ring-2 ring-blue-500/40 border-blue-400 dark:border-blue-600 shadow-xs'
              : 'hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              {language === 'th' ? 'กำลังเดินทาง' : 'En Route / Moving'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/70 dark:border-blue-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">directions_car</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-950 dark:text-blue-100 font-mono tnum tracking-tight">
              {specialists.filter((s) => getDerivedStatus(s).isMoving).length}
            </span>
            <span className="text-xs text-blue-700/80 dark:text-blue-400/80 font-medium">
              {language === 'th' ? 'คันบนถนน' : 'active en route'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-blue-700/80 dark:text-blue-400/80 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>{language === 'th' ? 'ความเร็ว > 4.0 กม./ชม.' : 'Speed > 4.0 km/h'}</span>
          </div>
        </div>

        {/* 3. Standby / Stationary - Soft Amber Tint */}
        <div
          onClick={() => setMotionFilter('stationary')}
          className={`p-4 sm:p-5 rounded-3xl transition-all cursor-pointer tactile-btn soft-tint-amber ${
            motionFilter === 'stationary'
              ? 'ring-2 ring-amber-500/40 border-amber-400 dark:border-amber-600 shadow-xs'
              : 'hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              {language === 'th' ? 'จอดเข้าพบ / Standby' : 'Stationary / Standby'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/70 dark:border-amber-800/70 shrink-0">
              <span className="material-symbols-outlined text-[19px]">local_parking</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-950 dark:text-amber-100 font-mono tnum tracking-tight">
              {specialists.filter((s) => getDerivedStatus(s).isOnline && !getDerivedStatus(s).isMoving).length}
            </span>
            <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">
              {language === 'th' ? 'จุดลูกค้า' : 'on-site / parked'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>{language === 'th' ? 'จอดหน้างาน / พบลูกค้า' : 'Stationary at client site'}</span>
          </div>
        </div>

        {/* 4. Drop Visits Progress - Soft Purple Tint */}
        <div
          onClick={() => setMotionFilter('all')}
          className="p-4 sm:p-5 rounded-3xl transition-all cursor-pointer tactile-btn soft-tint-purple hover:border-purple-300 dark:hover:border-purple-700"
        >
          {(() => {
            const allDrops = specialists.flatMap((s) => s.drops);
            const totalDrops = allDrops.length;
            const completedDrops = allDrops.filter((d) => d.isClosed).length;
            const activeTripsCount = specialists.filter((s) => s.hasActiveTrip).length;

            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                    {language === 'th' ? 'ความคืบหน้าการเข้าพบ' : 'Drop Visits Progress'}
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-white dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/70 dark:border-purple-800/70 shrink-0">
                    <span className="material-symbols-outlined text-[19px]">task_alt</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-purple-950 dark:text-purple-100 font-mono tnum tracking-tight">
                    {completedDrops}
                  </span>
                  <span className="text-xs text-purple-700/80 dark:text-purple-400/80 font-medium tnum">
                    / {totalDrops > 0 ? totalDrops : 0} {language === 'th' ? 'จุดเสร็จสิ้น' : 'drops closed'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-purple-700/80 dark:text-purple-400/80 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  <span>
                    {language === 'th' ? `${activeTripsCount} ทริปกำลังดำเนินงาน` : `${activeTripsCount} active trips running`}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Main Split Layout: Interactive Map Canvas (7 Cols) + Specialists Telemetry Cards (5 Cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:h-[720px]">
        {/* Left 7 Cols: Interactive Map Canvas */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex flex-col relative h-[420px] sm:h-[500px] xl:h-full">
          {/* Glass HUD Focus Controller Bar */}
          <div className="px-4 sm:px-5 py-3 glass-hud border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                <span className="material-symbols-outlined text-[18px]">
                  {soloId || selectedSpecialist ? 'filter_center_focus' : 'map'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setSoloId(null);
                    showToast(t('live_show_all'));
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 tactile-btn cursor-pointer ${
                    !selectedId && !soloId
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">public</span>
                  <span>{t('live_show_all')}</span>
                </button>

                {(selectedSpecialist || soloSpecialist) && (
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/70 px-3 py-1 rounded-xl flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="truncate max-w-[150px] sm:max-w-[220px]">
                      {soloId ? 'Solo Focus' : 'โฟกัส'}: {(soloSpecialist || selectedSpecialist)?.name}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Reset / Fit All Map View Button */}
            {(soloId || selectedSpecialist) && (
              <button
                onClick={() => {
                  setSoloId(null);
                  setSelectedId(null);
                  showToast(t('live_show_all'));
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1 tactile-btn cursor-pointer"
                title="กลับสู่มุมมองภาพรวมพนักงานทั้งหมด"
              >
                <span className="material-symbols-outlined text-[14px]">zoom_out_map</span>
                <span>{t('live_show_all')}</span>
              </button>
            )}
          </div>

          <div className="flex-1 relative">
            <MapContainer
              center={[13.74, 100.54]}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapFocusController
                selectedSpecialist={selectedSpecialist}
                soloId={soloId}
                specialists={specialists}
              />

              {/* Route Polyline */}
              {selectedSpecialist && selectedSpecialist.hasActiveTrip && selectedSpecialist.drops.length > 0 && (
                <Polyline
                  positions={[
                    ...(selectedSpecialist.telemetry.hasGpsFix ? [[selectedSpecialist.telemetry.lat, selectedSpecialist.telemetry.lng] as [number, number]] : []),
                    ...selectedSpecialist.drops.map((d) => [d.lat, d.lng] as [number, number]),
                  ]}
                  color="#2563EB"
                  weight={4}
                  opacity={0.85}
                  dashArray="6, 6"
                />
              )}

              {/* Drop Pins */}
              {(soloId ? soloSpecialist : selectedSpecialist)?.hasActiveTrip &&
                (soloId ? soloSpecialist?.drops : selectedSpecialist?.drops)?.map((drop) => {
                const nextUnclosed = (soloId ? soloSpecialist : selectedSpecialist)?.drops.find((d) => !d.isClosed);
                const isNext = nextUnclosed?.dropNumber === drop.dropNumber;

                return (
                  <Marker
                    key={drop.dropNumber}
                    position={[drop.lat, drop.lng]}
                    icon={createDropPin(drop, isNext)}
                  >
                    <Popup>
                      <div className="p-1 space-y-1.5 font-sans text-xs min-w-[210px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                          <span className="text-[13px]">Drop #{drop.dropNumber}: {drop.clientName}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              drop.isClosed
                                ? 'bg-emerald-100 text-emerald-800'
                                : isNext
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {drop.isClosed ? '✓ เสร็จแล้ว' : isNext ? 'กำลังเข้าพบ' : 'รอคิว'}
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-tight">
                          📍 {drop.address}
                        </div>
                        <div className="text-blue-700 dark:text-blue-400 font-medium text-[11px]">
                          📋 {drop.agenda}
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-mono tnum">
                            {drop.lat.toFixed(5)}, {drop.lng.toFixed(5)}
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${drop.lat},${drop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-slate-700 dark:text-slate-300 hover:text-blue-700 font-semibold text-[10.5px] px-2 py-0.8 rounded-md border border-slate-200 dark:border-slate-700 transition-all tactile-btn"
                            title="เปิดใน Google Maps"
                          >
                            <span className="material-symbols-outlined text-[13px] text-blue-600">map</span>
                            <span>Google Maps</span>
                            <span className="material-symbols-outlined text-[10px] opacity-60">open_in_new</span>
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Live Specialist Markers */}
              {mapVisibleSpecialists.map((spec) => (
                <Marker
                  key={spec.id}
                  position={[spec.telemetry.lat, spec.telemetry.lng]}
                  icon={createSpecialistLivePin(spec)}
                  eventHandlers={{
                    click: () => setSelectedId(spec.id),
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1 font-sans text-xs">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{spec.name} ({spec.nickname})</div>
                      <div className={getDerivedStatus(spec).isOnline ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-semibold'}>
                        {getDerivedStatus(spec).label}
                      </div>
                      <div className="text-blue-600 font-semibold">{spec.tripTitle} ({spec.tripCode})</div>
                      <div className="text-slate-600 dark:text-slate-300 text-[11px]">📍 พิกัด: {spec.telemetry.currentAddress}</div>
                      <div className="text-slate-500 text-[11px] py-1 border-y border-slate-200 dark:border-slate-700 flex justify-between font-mono tnum">
                        <span>ความเร็ว: <strong>{spec.telemetry.speedText}</strong></span>
                        <span>แบตเตอรี่: <strong>{spec.telemetry.batteryPercent}%</strong></span>
                      </div>
                      <div className="pt-1 flex justify-end">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10.5px] px-2 py-0.8 rounded-md border border-slate-200 dark:border-slate-700 transition-all tactile-btn"
                          title="เปิดพิกัดสดบน Google Maps"
                        >
                          <span className="material-symbols-outlined text-[13px] text-blue-600">map</span>
                          <span>Google Maps</span>
                          <span className="material-symbols-outlined text-[10px] opacity-60">open_in_new</span>
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] glass-hud px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md text-[11px] flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ออนไลน์
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> เดินทาง
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span> ออฟไลน์
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Specialist Telemetry Cards */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 flex flex-col h-[540px] xl:h-full overflow-hidden">
          {/* Search Box */}
          <div className="relative mb-3.5">
            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder={t('header_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/90 dark:bg-slate-800/60 pl-10 pr-3.5 py-2.5 rounded-2xl text-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700/70 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredSpecialists.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                {loading ? 'กำลังโหลดข้อมูลพนักงานภาคสนาม...' : 'ไม่พบข้อมูลพนักงานตามเงื่อนไขที่ค้นหา'}
              </div>
            ) : (
              filteredSpecialists.map((spec) => {
                const isSelected = selectedSpecialist?.id === spec.id;
                const isSolo = soloId === spec.id;
                const derivedStatus = getDerivedStatus(spec);
                const totalDropsCount = spec.drops.length;
                const closedDrops = spec.drops.filter((d) => d.isClosed);
                const closedCount = closedDrops.length;
                const nextDrop = spec.drops.find((d) => !d.isClosed);

                return (
                  <div
                    key={spec.id}
                    onClick={() => setSelectedId(spec.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                      isSolo
                        ? 'soft-tint-blue ring-2 ring-blue-500/50 border-blue-400 dark:border-blue-600 shadow-xs'
                        : isSelected
                        ? 'bg-slate-50/90 dark:bg-slate-800/80 border-blue-400/80 dark:border-blue-600/80'
                        : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 border-slate-200/80 dark:border-slate-800/80'
                    }`}
                  >
                    {/* Profile Header & Solo Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {spec.avatar ? (
                          <img
                            src={spec.avatar}
                            alt={spec.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
                            {spec.initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            <span className="truncate">{spec.name}</span>
                            <span className="text-slate-400 font-normal text-xs">({spec.nickname})</span>
                          </div>
                          <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {spec.territory} • {spec.vehiclePlate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSolo) {
                              setSoloId(null);
                              showToast(t('live_show_all'));
                            } else {
                              setSoloId(spec.id);
                              setSelectedId(spec.id);
                              showToast(`${t('live_focus_single')}: ${spec.nickname}`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 tactile-btn cursor-pointer ${
                            isSolo
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                          title={isSolo ? t('live_show_all') : t('live_focus_single')}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {isSolo ? 'check' : 'filter_center_focus'}
                          </span>
                          {isSolo ? 'Solo Map' : 'Solo'}
                        </button>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${derivedStatus.badgeClass}`}>
                          {derivedStatus.label}
                        </span>
                      </div>
                    </div>

                    {/* Active Trip Strip */}
                    <div className="flex items-center justify-between text-[11px] px-3 py-2 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-bold text-blue-600 dark:text-blue-400 truncate max-w-[200px]">
                        {spec.tripTitle}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0 font-mono tnum">
                        {spec.hasActiveTrip ? `${totalDropsCount} Drops (${closedCount}/${totalDropsCount})` : 'Standby'}
                      </span>
                    </div>

                    {/* Live Telemetry Info Bar */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] gap-1">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 truncate min-w-0">
                          <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400 shrink-0">my_location</span>
                          <span className="truncate text-slate-600 dark:text-slate-300 font-medium">
                            {spec.telemetry.currentAddress}
                          </span>
                        </div>

                        {spec.telemetry.hasGpsFix ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all shrink-0 tactile-btn shadow-2xs"
                            title={t('live_open_google_maps')}
                          >
                            <span className="material-symbols-outlined text-[13px]">map</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            รอพิกัด
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 font-mono tnum">
                        <span>Speed: <strong className="text-blue-600 dark:text-blue-400">{spec.telemetry.speedText}</strong></span>
                        {spec.telemetry.batteryPercent !== null ? (
                          <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="material-symbols-outlined text-[13px]">
                              {spec.telemetry.isCharging ? 'battery_charging_full' : 'battery_full'}
                            </span>
                            {spec.telemetry.batteryPercent}% ({spec.telemetry.lastPing})
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            ({spec.telemetry.lastPing})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Drop Sequence */}
                    {spec.hasActiveTrip && spec.drops.length > 0 && (() => {
                      const isExpanded = !!expandedDrops[spec.id];
                      return (
                        <div className="space-y-1.5 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDrops((prev) => ({
                                ...prev,
                                [spec.id]: !prev[spec.id],
                              }));
                            }}
                            className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600 transition-colors py-0.5 select-none"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="material-symbols-outlined text-[14px] text-blue-600 dark:text-blue-400 shrink-0">route</span>
                              <span className="shrink-0">แผนจุดนัด ({spec.drops.length} จุด)</span>
                              {!isExpanded && nextDrop && (
                                <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400 ml-1 truncate max-w-[130px]">
                                  • ถัดไป: #{nextDrop.dropNumber} {nextDrop.clientName}
                                </span>
                              )}
                            </div>
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 shrink-0 transition-all">
                              <span>{isExpanded ? 'ย่อ' : 'ขยาย'}</span>
                              <span className={`material-symbols-outlined text-[14px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                              </span>
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="space-y-1.5 pt-1">
                              {spec.drops.map((d) => {
                                const isCurrentNext = nextDrop?.dropNumber === d.dropNumber;
                                return (
                                  <div
                                    key={d.dropNumber}
                                    className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-[11px] transition-all ${
                                      d.isClosed
                                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                                        : isCurrentNext
                                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold shadow-2xs'
                                        : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate min-w-0">
                                      <span
                                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                                          d.isClosed
                                            ? 'bg-emerald-600 text-white'
                                            : isCurrentNext
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-400 text-white'
                                        }`}
                                      >
                                        {d.isClosed ? '✓' : d.dropNumber}
                                      </span>
                                      <div className="truncate min-w-0">
                                        <div className="truncate font-bold flex items-center gap-1">
                                          <span className="truncate">{d.clientName}</span>
                                          {isCurrentNext && (
                                            <span className="text-[8.5px] px-1 py-0.2 bg-blue-600 text-white rounded font-black shrink-0">
                                              ถัดไป
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[9.5px] opacity-75 truncate">{d.address}</div>
                                      </div>
                                    </div>

                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-5 h-5 rounded-md bg-white dark:bg-slate-700 hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 dark:border-slate-600 flex items-center justify-center transition-all shrink-0 tactile-btn"
                                      title={`เปิด Google Maps: ${d.clientName}`}
                                    >
                                      <span className="material-symbols-outlined text-[13px]">map</span>
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
