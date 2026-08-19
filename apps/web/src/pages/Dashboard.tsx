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
  
  // Active Trip Info from Mobile
  hasActiveTrip: boolean;
  tripCode: string;
  tripTitle: string;
  startTime: string;
  
  // Real-time GPS & Telemetry
  telemetry: {
    lat: number;
    lng: number;
    currentAddress: string;
    speedKmH: number;
    speedText: string;
    batteryPercent: number;
    isCharging: boolean;
    lastPing: string;
  };

  // Drops Breakdown
  drops: DropItem[];
  
  // Coordinates for Map Route Polyline
  routeCoordinates: [number, number][];
}

// Smoothly focus and fit map bounds to the selected specialist's journey
function MapFocusController({
  selectedSpecialist,
  soloId,
}: {
  selectedSpecialist: SpecialistActiveTrip | null;
  soloId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedSpecialist) {
      if (selectedSpecialist.routeCoordinates && selectedSpecialist.routeCoordinates.length > 1) {
        const bounds = L.latLngBounds(selectedSpecialist.routeCoordinates);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
      } else {
        map.flyTo(
          [selectedSpecialist.telemetry.lat, selectedSpecialist.telemetry.lng],
          14,
          { animate: true }
        );
      }
    }
  }, [selectedSpecialist, soloId, map]);

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

  const fetchLiveSpecialists = async () => {
    try {
      const { data: profiles } = await supabase
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
            assigned_vehicle
          ),
          trips (
            id,
            trip_code,
            title,
            status,
            created_at,
            appointments (
              id,
              sequence_order,
              company_name,
              destination_address,
              agenda,
              status,
              confirmation_status
            )
          )
        `)
        .eq('role', 'specialist');

      if (profiles && profiles.length > 0) {
        const mapped: SpecialistActiveTrip[] = profiles.map((p: any) => {
          const staffObj = Array.isArray(p.staff) ? p.staff[0] : p.staff;
          const activeTrip = Array.isArray(p.trips)
            ? p.trips.find((t: any) => t.status === 'in_progress' || t.status === 'pending') || p.trips[0]
            : null;

          const hasActiveTrip = !!activeTrip && activeTrip.status !== 'completed';
          const appts = activeTrip?.appointments || [];
          
          const drops: DropItem[] = appts.map((a: any, idx: number) => ({
            dropNumber: a.sequence_order || idx + 1,
            clientName: a.company_name || `ลูกค้ารายที่ ${idx + 1}`,
            address: a.destination_address || 'กรุงเทพมหานคร',
            agenda: a.agenda || 'เข้าพบและนำเสนอสินค้า',
            lat: (p.current_lat || 13.7563) + (idx * 0.005) - 0.002,
            lng: (p.current_lng || 100.5018) + (idx * 0.006) - 0.003,
            isClosed: a.status === 'completed' || a.confirmation_status === true,
          }));

          const lat = p.current_lat || 13.7563;
          const lng = p.current_lng || 100.5018;

          const routeCoords: [number, number][] = drops.length > 0
            ? drops.map((d) => [d.lat, d.lng] as [number, number])
            : [[lat, lng]];

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
            territory: staffObj?.territory || 'Bangkok Central (B2B)',
            vehiclePlate: staffObj?.assigned_vehicle || 'Isuzu D-Max (1กข-4452)',
            isOnline: p.is_online === true,
            hasActiveTrip,
            tripCode: activeTrip?.trip_code || 'STANDBY',
            tripTitle: activeTrip?.title || 'พร้อมปฏิบัติงาน (Standby)',
            startTime: activeTrip ? new Date(activeTrip.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-',
            telemetry: {
              lat,
              lng,
              currentAddress: p.current_address || 'กรุงเทพมหานคร',
              speedKmH: p.current_speed || 0,
              speedText: (p.current_speed || 0) > 0 ? `${p.current_speed} km/h` : '0 km/h (จอด/อยู่กับที่)',
              batteryPercent: p.battery_level || 95,
              isCharging: false,
              lastPing: p.is_online ? 'ออนไลน์ขณะนี้' : (p.last_seen_at ? new Date(p.last_seen_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ออฟไลน์'),
            },
            drops,
            routeCoordinates: routeCoords,
          };
        });

        setSpecialists(mapped);
        setSelectedId((prev) => prev || (mapped.length > 0 ? mapped[0].id : null));
      }
    } catch (err) {
      console.error('Error fetching live specialists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSpecialists();

    // Set up Realtime subscriptions for profiles presence changes
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
        { event: 'INSERT', schema: 'public', table: 'location_logs' },
        () => {
          fetchLiveSpecialists();
        }
      )
      .subscribe();

    const interval = setInterval(fetchLiveSpecialists, 15000);

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
    if (!spec.isOnline) {
      return {
        status: 'Offline',
        label: '⚫ ออฟไลน์ (Offline)',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
        isMoving: false,
      };
    }

    if (!spec.hasActiveTrip) {
      return {
        status: 'Online',
        label: '🟢 ออนไลน์ (พร้อมรับงาน)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
        isMoving: false,
      };
    }

    const allClosed = spec.drops.length > 0 && spec.drops.every((d) => d.isClosed);
    if (allClosed) {
      return {
        status: 'Completed',
        label: t('live_status_complete'),
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        dotClass: 'bg-purple-500',
        isMoving: false,
      };
    }
    // Smartphone GPS Engine: Speed >= 4.0 km/h is Running
    if (spec.telemetry.speedKmH >= 4.0) {
      return {
        status: 'Running',
        label: t('live_status_running'),
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
        isMoving: true,
      };
    }
    // Speed <= 1.5 km/h is Stopped
    return {
      status: 'Stopped',
      label: t('live_status_stopped'),
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
      isMoving: false,
    };
  };

  const filteredSpecialists = useMemo(() => {
    return specialists.filter((s) => {
      const derived = getDerivedStatus(s);
      let matchFilter = true;
      if (motionFilter === 'online') {
        matchFilter = s.isOnline;
      } else if (motionFilter === 'offline') {
        matchFilter = !s.isOnline;
      } else if (motionFilter === 'moving') {
        matchFilter = s.isOnline && derived.isMoving;
      } else if (motionFilter === 'stationary') {
        matchFilter = s.isOnline && !derived.isMoving;
      }

      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tripTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.territory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.drops.some((d) => d.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchFilter && matchSearch;
    });
  }, [specialists, motionFilter, searchQuery]);

  const mapVisibleSpecialists = useMemo(() => {
    if (soloId) {
      return specialists.filter((s) => s.id === soloId);
    }
    return specialists;
  }, [specialists, soloId]);

  // Clean Modern Marker Creator
  const createSpecialistLivePin = (spec: SpecialistActiveTrip) => {
    const isSelected = selectedSpecialist?.id === spec.id || soloId === spec.id;
    const isMoving = spec.telemetry.speedKmH > 0;
    const borderCol = !spec.isOnline ? '#94A3B8' : isMoving ? '#2563EB' : '#059669';
    const statusDotCol = !spec.isOnline ? '#94A3B8' : isMoving ? '#3B82F6' : '#10B981';

    return L.divIcon({
      className: 'clean-live-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
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
            <span style="color: ${!spec.isOnline ? '#CBD5E1' : isMoving ? '#93C5FD' : '#86EFAC'};">
              ${!spec.isOnline ? '(Offline)' : isMoving ? spec.telemetry.speedText : '🟢 Online'}
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
    const bg = isClosed ? '#059669' : isNext ? '#2563EB' : '#64748B';
    const label = isClosed ? '✓' : drop.dropNumber.toString();

    return L.divIcon({
      className: 'clean-drop-pin',
      html: `
        <div style="
          background: ${bg};
          color: white;
          width: ${isNext ? '28px' : '22px'};
          height: ${isNext ? '28px' : '22px'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: ${isNext ? '12px' : '10px'};
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          ${isNext ? 'animation: pulse 2s infinite;' : ''}
        ">
          ${label}
        </div>
      `,
      iconSize: [isNext ? 28 : 22, isNext ? 28 : 22],
      iconAnchor: [isNext ? 14 : 11, isNext ? 14 : 11],
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-primary border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {specialists.filter((s) => s.isOnline).length} {t('live_badge')} Online
            </span>
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
              { key: 'online', label: `🟢 ออนไลน์ (${specialists.filter((s) => s.isOnline).length})` },
              { key: 'moving', label: `กำลังเดินทาง (${specialists.filter((s) => s.isOnline && s.telemetry.speedKmH >= 4.0).length})` },
              { key: 'stationary', label: `จอด/Standby (${specialists.filter((s) => s.isOnline && s.telemetry.speedKmH < 4.0).length})` },
              { key: 'offline', label: `⚫ ออฟไลน์ (${specialists.filter((s) => !s.isOnline).length})` },
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
          {/* Floating Sub-Header inside Map */}
          <div className="px-4 py-2.5 bg-white/95 backdrop-blur-xs border-b border-outline-variant/50 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                {soloId ? 'filter_center_focus' : 'location_on'}
              </span>
              <span className="font-bold text-xs text-on-surface">
                {soloSpecialist
                  ? `${t('live_focus_single')}: ${soloSpecialist.name} (${soloSpecialist.nickname})`
                  : selectedSpecialist
                  ? `${selectedSpecialist.name} (${selectedSpecialist.nickname}) - ${selectedSpecialist.isOnline ? '🟢 Online' : '⚫ Offline'}`
                  : t('live_show_all')}
              </span>
            </div>

            {/* Reset View Button */}
            {(soloId || selectedSpecialist) && (
              <button
                onClick={() => {
                  setSoloId(null);
                  setSelectedId(null);
                  showToast(t('live_show_all'));
                }}
                className="text-[11px] font-bold text-primary hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">zoom_out_map</span>
                {t('live_show_all')}
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
              />

              {/* Draw Route Polyline if Specialist has active multi-drop route */}
              {selectedSpecialist && selectedSpecialist.hasActiveTrip && selectedSpecialist.routeCoordinates.length > 1 && (
                <Polyline
                  positions={selectedSpecialist.routeCoordinates}
                  color="#2563EB"
                  weight={4}
                  opacity={0.8}
                  dashArray="6, 6"
                />
              )}

              {/* Draw Drop Pins if single specialist is focused */}
              {(soloId ? soloSpecialist?.drops : selectedSpecialist?.drops)?.map((drop) => {
                const nextUnclosed = (soloId ? soloSpecialist : selectedSpecialist)?.drops.find((d) => !d.isClosed);
                const isNext = nextUnclosed?.dropNumber === drop.dropNumber;

                return (
                  <Marker
                    key={drop.dropNumber}
                    position={[drop.lat, drop.lng]}
                    icon={createDropPin(drop, isNext)}
                  >
                    <Popup>
                      <div className="p-1 space-y-1 font-sans text-xs">
                        <div className="font-bold text-slate-900">
                          Drop #{drop.dropNumber}: {drop.clientName}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          {drop.address}
                        </div>
                        <div className="text-blue-700 font-medium text-[11px]">
                          วัตถุประสงค์: {drop.agenda}
                        </div>
                        <div className="text-[10px] font-bold mt-1">
                          สถานะ:{' '}
                          <span
                            className={
                              drop.isClosed
                                ? 'text-emerald-700'
                                : isNext
                                ? 'text-blue-700'
                                : 'text-slate-500'
                            }
                          >
                            {drop.isClosed
                              ? `✓ เสร็จสิ้น (${drop.closedAt || 'เรียบร้อย'})`
                              : isNext
                              ? '⏳ กำลังเดินทางเข้าพบ (Next Drop)'
                              : 'ยังไม่ถึงคิว'}
                          </span>
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
                      <div className="text-emerald-700 font-semibold">{spec.isOnline ? '🟢 ออนไลน์ (Online)' : '⚫ ออฟไลน์ (Offline)'}</div>
                      <div className="text-blue-700 font-semibold">{spec.tripTitle} ({spec.tripCode})</div>
                      <div className="text-slate-600 text-[11px]">📍 พิกัดปัจจุบัน: {spec.telemetry.currentAddress}</div>
                      <div className="text-slate-500 text-[11px] py-1 border-y border-slate-200 flex justify-between">
                        <span>ความเร็ว: <strong>{spec.telemetry.speedText}</strong></span>
                        <span>แบตเตอรี่: <strong>{spec.telemetry.batteryPercent}%</strong></span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>🗺️ เปิดพิกัดสดบน Google Maps</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
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
                const lastClosedDrop = closedDrops[closedDrops.length - 1];
                const nextDrop = spec.drops.find((d) => !d.isClosed);
                const remainingDrops = spec.drops.filter((d) => !d.isClosed && d !== nextDrop);

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

                        {/* Google Maps External Link */}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${spec.telemetry.lat},${spec.telemetry.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200"
                          title={t('live_open_google_maps')}
                        >
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                          Maps
                        </a>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                        <span>{t('live_speed')} <strong className="text-blue-700">{spec.telemetry.speedText}</strong></span>
                        <span className="flex items-center gap-0.5 font-bold text-emerald-700">
                          <span className="material-symbols-outlined text-[11px]">
                            {spec.telemetry.isCharging ? 'battery_charging_full' : 'battery_full'}
                          </span>
                          {spec.telemetry.batteryPercent}% ({spec.telemetry.lastPing})
                        </span>
                      </div>
                    </div>

                    {/* Drop Sequence if active trip */}
                    {spec.hasActiveTrip && (
                      <div className="space-y-1 text-xs">
                        {/* Closed Drop */}
                        {lastClosedDrop && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50/70 px-2 py-1 rounded-lg border border-emerald-200 truncate">
                            <span className="material-symbols-outlined text-[13px] text-emerald-600 shrink-0">check_circle</span>
                            <span className="truncate">
                              Drop {lastClosedDrop.dropNumber}: {lastClosedDrop.clientName} ({lastClosedDrop.closedAt || 'เสร็จสิ้น'})
                            </span>
                          </div>
                        )}

                        {/* Next Drop (Highlight Box) */}
                        {nextDrop ? (
                          <div className="flex items-center justify-between gap-1 text-[11px] text-blue-900 bg-blue-50/80 px-2 py-1 rounded-lg border border-blue-200 truncate">
                            <div className="flex items-center gap-1 truncate min-w-0">
                              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                {nextDrop.dropNumber}
                              </span>
                              <span className="truncate font-bold">
                                {t('live_next_drop')} {nextDrop.clientName}
                              </span>
                            </div>
                            <span className="text-[10px] text-blue-700 shrink-0">
                              {nextDrop.agenda}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">task_alt</span>
                            {t('live_status_complete')}
                          </div>
                        )}

                        {/* Remaining Drops */}
                        {remainingDrops.length > 0 && (
                          <div className="text-[10px] text-on-surface-variant pl-5 truncate">
                            ➔ {remainingDrops.map((d) => d.clientName).join(' ➔ ')}
                          </div>
                        )}
                      </div>
                    )}
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
