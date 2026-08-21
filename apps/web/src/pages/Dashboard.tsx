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
  const { t } = useLanguage();
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
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in text-xs font-medium">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header & Motion Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-on-surface tracking-tight">
              {t('live_title')}
            </h1>
            <button
              onClick={() => {
                fetchLiveSpecialists();
                setCountdown(60);
                showToast('🔄 อัปเดตพิกัดสดล่าสุดเรียบร้อยแล้ว');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="คลิกเพื่อรีเฟรชพิกัดสดทันที"
            >
              <span className="material-symbols-outlined text-[13px]">sync</span>
              <span>รีเฟรชใน {countdown}s</span>
            </button>
          </div>
          <p className="text-on-surface-variant text-xs mt-0.5">
            {t('live_subtitle')}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/50 flex-wrap">
          {(
            [
              { key: 'all', label: `ทั้งหมด (${specialists.length})` },
              { key: 'online', label: `🟢 ออนไลน์ (${specialists.filter((s) => getDerivedStatus(s).isOnline).length})` },
              { key: 'moving', label: `กำลังเดินทาง (${specialists.filter((s) => getDerivedStatus(s).isMoving).length})` },
              { key: 'stationary', label: `จอด/Standby (${specialists.filter((s) => getDerivedStatus(s).isOnline && !getDerivedStatus(s).isMoving).length})` },
              { key: 'offline', label: `⚫ ออฟไลน์ (${specialists.filter((s) => getDerivedStatus(s).isOffline || getDerivedStatus(s).isSignalLost).length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setMotionFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                motionFilter === item.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Leaflet Map (7 Cols) + Clean Specialists Cards (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[720px]">
        {/* Left 7 Cols: Interactive Map Canvas */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 overflow-hidden shadow-xs flex flex-col relative h-full">
          {/* Clean Map Sub-Header & Focus Controller Bar */}
          <div className="px-4 py-2 bg-white/95 backdrop-blur-xs border-b border-outline-variant/50 flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                {soloId || selectedSpecialist ? 'filter_center_focus' : 'location_on'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setSoloId(null);
                    showToast(t('live_show_all'));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    !selectedId && !soloId
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">public</span>
                  <span>{t('live_show_all')}</span>
                </button>

                {(selectedSpecialist || soloSpecialist) && (
                  <span className="text-xs font-bold text-slate-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <span>
                      {soloId ? 'Solo Focus' : 'โฟกัส'}: {(soloSpecialist || selectedSpecialist)?.name} ({(soloSpecialist || selectedSpecialist)?.nickname})
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
                className="text-[11px] font-bold text-primary hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-all flex items-center gap-1 cursor-pointer"
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

              {/* Draw Route Polyline from Specialist Position -> Drop 1 -> Drop 2 -> Drop 3 */}
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

              {/* Draw Drop Pins only if the specialist has an active in-progress trip */}
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
                        <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
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
                        <div className="text-slate-600 text-[11px] leading-tight">
                          📍 {drop.address}
                        </div>
                        <div className="text-blue-700 font-medium text-[11px]">
                          📋 {drop.agenda}
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {drop.lat.toFixed(5)}, {drop.lng.toFixed(5)}
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${drop.lat},${drop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-[10.5px] px-2 py-0.8 rounded-md border border-slate-200 hover:border-blue-300 transition-all shadow-2xs"
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

              {/* Live Specialist Vehicle / Presence Marker */}
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
                      <div className="font-bold text-slate-900 text-sm">{spec.name} ({spec.nickname})</div>
                      <div className={getDerivedStatus(spec).isOnline ? 'text-emerald-700 font-semibold' : getDerivedStatus(spec).isSignalLost ? 'text-amber-700 font-semibold' : 'text-slate-600 font-semibold'}>
                        {getDerivedStatus(spec).label}
                      </div>
                      <div className="text-blue-700 font-semibold">{spec.tripTitle} ({spec.tripCode})</div>
                      <div className="text-slate-600 text-[11px]">📍 พิกัดปัจจุบัน: {spec.telemetry.currentAddress}</div>
                      <div className="text-slate-500 text-[11px] py-1 border-y border-slate-200 flex justify-between">
                        <span>ความเร็ว: <strong>{spec.telemetry.speedText}</strong></span>
                        <span>แบตเตอรี่: <strong>{spec.telemetry.batteryPercent}%</strong></span>
                      </div>
                      <div className="pt-1 flex justify-end">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-[10.5px] px-2 py-0.8 rounded-md border border-slate-200 hover:border-blue-300 transition-all"
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
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[11px] flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> ออนไลน์ (Live)
              </span>
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> กำลังเดินทาง
              </span>
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span> ออฟไลน์
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Modern Compact Specialists List */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-4 shadow-xs flex flex-col h-full overflow-hidden">
          {/* Search Box */}
          <div className="relative mb-3">
            <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder={t('header_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low pl-8 pr-3 py-1.5 rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredSpecialists.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant text-xs">
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
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                      isSolo
                        ? 'bg-blue-50/90 border-blue-600 shadow-sm ring-1.5 ring-blue-500'
                        : isSelected
                        ? 'bg-blue-50/50 border-primary/80 shadow-xs'
                        : 'bg-surface-container-low/30 hover:bg-surface-container-low/80 border-outline-variant/50'
                    }`}
                  >
                    {/* Top Bar: Profile + Solo Map Button + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={spec.avatar}
                          alt={spec.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-blue-200"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-on-surface truncate flex items-center gap-1.5">
                            <span className="truncate">{spec.name}</span>
                            <span className="text-on-surface-variant font-normal">({spec.nickname})</span>
                          </div>
                          <div className="text-[10px] text-on-surface-variant truncate">
                            {spec.territory} • {spec.vehiclePlate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Compact Solo Focus Toggle Button */}
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
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                            isSolo
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white hover:bg-blue-50 text-primary border border-primary/30'
                          }`}
                          title={isSolo ? t('live_show_all') : t('live_focus_single')}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {isSolo ? 'check' : 'filter_center_focus'}
                          </span>
                          {isSolo ? 'Solo Map' : 'Solo'}
                        </button>

                        {/* Status Tag */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${derivedStatus.badgeClass}`}>
                          {derivedStatus.label}
                        </span>
                      </div>
                    </div>

                    {/* Active Trip Strip */}
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                      <span className="font-bold text-primary truncate max-w-[200px]">
                        {spec.tripTitle}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-700 shrink-0">
                        {spec.hasActiveTrip ? `${totalDropsCount} Drops (${closedCount}/${totalDropsCount})` : 'Standby / ไม่มีทริป'}
                      </span>
                    </div>

                    {/* Live Location & Telemetry (Speed, Battery, Google Maps Link) */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] gap-1">
                        <div className="flex items-center gap-1 text-slate-800 truncate min-w-0">
                          <span className="material-symbols-outlined text-[14px] text-primary shrink-0">my_location</span>
                          <span className="truncate"><strong>{t('live_current_location')}</strong> {spec.telemetry.currentAddress}</span>
                        </div>

                        {/* Google Maps External Link (Icon Only) */}
                        {spec.telemetry.hasGpsFix ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/80 hover:border-blue-300 flex items-center justify-center transition-all shrink-0 shadow-2xs"
                            title={t('live_open_google_maps')}
                          >
                            <span className="material-symbols-outlined text-[13px]">map</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium shrink-0 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            รอพิกัด
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                        <span>{t('live_speed')} <strong className="text-blue-700">{spec.telemetry.speedText}</strong></span>
                        {spec.telemetry.batteryPercent !== null ? (
                          <span className="flex items-center gap-0.5 font-bold text-emerald-700">
                            <span className="material-symbols-outlined text-[11px]">
                              {spec.telemetry.isCharging ? 'battery_charging_full' : 'battery_full'}
                            </span>
                            {spec.telemetry.batteryPercent}% ({spec.telemetry.lastPing})
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">
                            ({spec.telemetry.lastPing})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Drop Sequence & Minimalist Icon-Only Maps Link */}
                    {spec.hasActiveTrip && spec.drops.length > 0 && (() => {
                      const isExpanded = !!expandedDrops[spec.id];
                      return (
                        <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60">
                          {/* Collapsible Header Accordion */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDrops((prev) => ({
                                ...prev,
                                [spec.id]: !prev[spec.id],
                              }));
                            }}
                            className="flex items-center justify-between text-[11px] font-bold text-slate-700 cursor-pointer hover:text-primary transition-colors py-0.5 select-none"
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="material-symbols-outlined text-[13px] text-primary shrink-0">route</span>
                              <span className="shrink-0">จุดนัดหมาย ({spec.drops.length} จุด)</span>
                              {!isExpanded && nextDrop && (
                                <span className="text-[10px] font-normal text-blue-600 ml-1 truncate max-w-[130px]">
                                  • ถัดไป: #{nextDrop.dropNumber} {nextDrop.clientName}
                                </span>
                              )}
                            </div>
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md border border-slate-200/70 shrink-0 transition-all">
                              <span>{isExpanded ? 'ย่อ' : 'ขยาย'}</span>
                              <span className={`material-symbols-outlined text-[14px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                              </span>
                            </span>
                          </div>

                          {/* Expanded Drop List (Only shown when expanded) */}
                          {isExpanded && (
                            <div className="space-y-1 pt-1 animate-fade-in">
                              {spec.drops.map((d) => {
                                const isCurrentNext = nextDrop?.dropNumber === d.dropNumber;
                                return (
                                  <div
                                    key={d.dropNumber}
                                    className={`flex items-center justify-between gap-2 p-1.5 rounded-xl border text-[11px] transition-all ${
                                      d.isClosed
                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                        : isCurrentNext
                                        ? 'bg-blue-50/90 border-blue-300 text-blue-900 font-semibold ring-1 ring-blue-400/40 shadow-2xs'
                                        : 'bg-white/80 border-slate-200/80 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate min-w-0">
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

                                    {/* Icon-Only Google Maps Link Button */}
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-5 h-5 rounded-md bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 flex items-center justify-center transition-all shrink-0 shadow-2xs"
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
