import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Leaflet default icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Telemetry Point Interface
export interface TelemetryPoint {
  id: string | number;
  no: string | number;
  timestamp: string;
  timeOnly: string;
  rawTime: number;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  alert: string;
  status: 'running' | 'idle' | 'parked';
  statusText: string;
  locationName: string;
  distanceAccumKm: number;
}

// Clean Journey Segment Interface
export interface JourneySegment {
  id: string;
  isStop: boolean;
  type: 'stop' | 'running';
  title: string;
  fromTime: string;
  toTime: string;
  durationText: string;
  fromLocation: string;
  toLocation: string;
  distanceKm?: number;
  avgSpeed?: number;
  topSpeed?: number;
  engineStatusText?: string;
  startIndex: number;
  endIndex: number;
  subLogs: TelemetryPoint[];
  alertsCount: number;
}

// Custom Leaflet Vehicle & Waypoint Icons
function createVehiclePlaybackIcon(heading: number, speed: number, status: 'running' | 'idle' | 'parked') {
  const isMoving = status === 'running' && speed > 3;
  const bgColor = isMoving ? '#2563eb' : status === 'idle' ? '#f59e0b' : '#64748b';

  return L.divIcon({
    className: 'custom-vehicle-playback-pin',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        ${isMoving ? '<div class="absolute -inset-1 rounded-full bg-blue-400/40 animate-ping"></div>' : ''}
        <div class="relative w-8 h-8 rounded-2xl shadow-lg border-2 border-white flex items-center justify-center text-white font-black transition-transform duration-200"
             style="background: ${bgColor}; transform: rotate(${heading}deg);">
          <span class="material-symbols-outlined text-[18px]">navigation</span>
        </div>
        <div class="absolute -bottom-3 bg-slate-900 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-md shadow whitespace-nowrap">
          ${speed} km/h
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createWaypointPin(title: string, color: string, icon: string) {
  return L.divIcon({
    className: 'custom-waypoint-pin',
    html: `
      <div class="flex items-center gap-1.5 bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-slate-200 text-xs font-bold text-slate-800 whitespace-nowrap hover:scale-105 transition-transform">
        <span class="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[11px]" style="background-color: ${color}">
          <span class="material-symbols-outlined text-[13px]">${icon}</span>
        </span>
        <span>${title}</span>
      </div>
    `,
    iconSize: [130, 30],
    iconAnchor: [65, 15],
  });
}

// Controller to smoothly pan to current vehicle position
function MapPlaybackController({
  activePoint,
  allPoints,
  autoPan,
}: {
  activePoint: TelemetryPoint | null;
  allPoints: TelemetryPoint[];
  autoPan: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (allPoints.length === 1) {
      map.setView([allPoints[0].lat, allPoints[0].lng], 15);
    }
  }, [allPoints, map]);

  useEffect(() => {
    if (autoPan && activePoint) {
      map.panTo([activePoint.lat, activePoint.lng], { animate: true, duration: 0.25 });
    }
  }, [activePoint, autoPan, map]);

  return null;
}

export default function RoutePlayback() {
  const { language } = useLanguage();
  // Specialists State
  const [specialistsList, setSpecialistsList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  // Date & Time Range States (Defaults to Today 00:00 to 23:59)
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(todayStr);
  const [endTime, setEndTime] = useState('23:59');
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | '24h' | '3days' | '7days' | 'custom'>('today');

  // Playback Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 4x, 8x
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [autoPan, setAutoPan] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  const [mobileTab, setMobileTab] = useState<'map' | 'timeline'>('map');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'stops' | 'running'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Telemetry Data State
  const [telemetryPoints, setTelemetryPoints] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const playIntervalRef = useRef<any>(null);

  // Quick Preset Handlers
  const handleSelectPreset = (preset: 'today' | 'yesterday' | '24h' | '3days' | '7days') => {
    setActivePreset(preset);
    const now = new Date();
    const todayFormatted = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayFormatted);
      setStartTime('00:00');
      setEndDate(todayFormatted);
      setEndTime('23:59');
    } else if (preset === 'yesterday') {
      const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      setStartDate(yest);
      setStartTime('00:00');
      setEndDate(yest);
      setEndTime('23:59');
    } else if (preset === '24h') {
      const past24 = new Date(Date.now() - 86400000);
      setStartDate(past24.toISOString().split('T')[0]);
      setStartTime(past24.toTimeString().slice(0, 5));
      setEndDate(todayFormatted);
      setEndTime(now.toTimeString().slice(0, 5));
    } else if (preset === '3days') {
      const past3 = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
      setStartDate(past3);
      setStartTime('00:00');
      setEndDate(todayFormatted);
      setEndTime('23:59');
    } else if (preset === '7days') {
      const past7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      setStartDate(past7);
      setStartTime('00:00');
      setEndDate(todayFormatted);
      setEndTime('23:59');
    }
  };

  // Load specialists from Supabase
  useEffect(() => {
    async function loadSpecialists() {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          nickname,
          avatar_url,
          department,
          staff:staff (
            staff_id,
            assigned_vehicle,
            vehicle_plate,
            territory
          )
        `)
        .eq('role', 'specialist');

      if (data && data.length > 0) {
        setSpecialistsList(data);
        // Default to kosit if present, otherwise first specialist
        const kositUser = data.find((s) => s.nickname === 'kosit' || s.full_name?.toLowerCase().includes('kosit'));
        if (kositUser) {
          setSelectedStaffId(kositUser.id);
        } else {
          setSelectedStaffId(data[0].id);
        }
      }
    }
    loadSpecialists();
  }, []);

  // Fetch Production Telemetry Data from Supabase
  const loadRouteHistoryData = async () => {
    if (!selectedStaffId) return;

    setLoading(true);
    setIsPlaying(false);
    setIsPresetsModalOpen(false);

    try {
      // Convert local date-time to UTC ISO strings
      const startLocal = new Date(`${startDate}T${startTime}:00`);
      const endLocal = new Date(`${endDate}T${endTime}:59`);
      const startIso = startLocal.toISOString();
      const endIso = endLocal.toISOString();

      const { data: logs, error } = await supabase
        .from('location_logs')
        .select('*')
        .eq('staff_id', selectedStaffId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true })
        .limit(5000);

      if (error) {
        console.error('Supabase query error:', error);
        setTelemetryPoints([]);
        setLoading(false);
        return;
      }

      if (logs && logs.length > 0) {
        let accumDist = 0;
        const mappedPoints: TelemetryPoint[] = logs.map((log, idx) => {
          const prev = idx > 0 ? logs[idx - 1] : null;
          if (prev) {
            const dLat = (log.lat - prev.lat) * 111.32;
            const dLng = (log.lng - prev.lng) * 111.32 * Math.cos(log.lat * (Math.PI / 180));
            const stepDist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (stepDist > 0.005) {
              accumDist += stepDist;
            }
          }

          const speed = log.speed || 0;
          const status = speed > 3 ? 'running' : speed > 0 ? 'idle' : 'parked';
          const dt = new Date(log.created_at);
          const timeOnly = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const rawTime = dt.getHours() * 3600 + dt.getMinutes() * 60 + dt.getSeconds();

          let locName = log.address;
          if (!locName || locName === '-') {
            // Friendly default for base Don Mueang area
            if (Math.abs(log.lat - 13.9335) < 0.005 && Math.abs(log.lng - 100.5834) < 0.005) {
              locName = '183 อาคาร 60 สรงประภา แขวงสีกัน ดอนเมือง';
            } else {
              locName = `พิกัด ${log.lat.toFixed(4)}, ${log.lng.toFixed(4)}`;
            }
          }

          return {
            id: log.id,
            no: idx + 1,
            timestamp: dt.toLocaleDateString('th-TH') + ' ' + timeOnly,
            timeOnly,
            rawTime,
            lat: log.lat,
            lng: log.lng,
            speed: Math.round(speed),
            heading: log.heading || 0,
            alert: log.event_type || '-',
            status,
            statusText: status === 'running' ? 'รถวิ่ง' : status === 'idle' ? 'จอดไม่ดับเครื่อง' : 'จอดดับเครื่อง',
            locationName: locName,
            distanceAccumKm: parseFloat(accumDist.toFixed(1)),
          };
        });

        setTelemetryPoints(mappedPoints);
        setCurrentIndex(0);
      } else {
        setTelemetryPoints([]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Error loading route playback data:', err);
      setTelemetryPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStaffId) {
      loadRouteHistoryData();
    }
  }, [selectedStaffId, startDate, endDate]);

  const activePoint = telemetryPoints[currentIndex] || telemetryPoints[0] || null;

  const routePolylineCoords = useMemo(() => {
    return telemetryPoints.map((p) => [p.lat, p.lng] as [number, number]);
  }, [telemetryPoints]);

  // Group telemetry points into clean, high-level Journey Segments
  const journeySegments = useMemo<JourneySegment[]>(() => {
    if (telemetryPoints.length === 0) return [];

    const segs: JourneySegment[] = [];
    let i = 0;

    while (i < telemetryPoints.length) {
      const startPt = telemetryPoints[i];
      const isStop = startPt.speed <= 3;

      if (isStop) {
        let j = i + 1;
        while (j < telemetryPoints.length && telemetryPoints[j].speed <= 3) {
          j++;
        }
        const endPt = telemetryPoints[j - 1] || startPt;
        const durationSec = Math.max(60, endPt.rawTime - startPt.rawTime);
        const durHours = Math.floor(durationSec / 3600);
        const durMins = Math.floor((durationSec % 3600) / 60);
        const durationText = durHours > 0 ? `${durHours} ชม. ${durMins} นาที` : `${durMins} นาที`;

        segs.push({
          id: `seg-stop-${segs.length + 1}`,
          isStop: true,
          type: 'stop',
          title: startPt.locationName.includes('Client') || startPt.locationName.includes('ลูกค้า')
            ? '🏢 จุดจอดเข้าพบลูกค้า'
            : '🅿️ จุดจอดพักรถ / ดับเครื่อง',
          fromTime: startPt.timeOnly,
          toTime: endPt.timeOnly,
          durationText: `จอด ${durationText}`,
          fromLocation: startPt.locationName,
          toLocation: startPt.locationName,
          engineStatusText: 'ดับเครื่องยนต์ (Engine Off)',
          startIndex: i,
          endIndex: j - 1,
          subLogs: telemetryPoints.slice(i, j),
          alertsCount: 0,
        });

        i = j;
      } else {
        let j = i + 1;
        let spdSum = startPt.speed;
        let maxSpd = startPt.speed;
        let alerts = startPt.alert !== '-' ? 1 : 0;

        while (j < telemetryPoints.length && telemetryPoints[j].speed > 3) {
          spdSum += telemetryPoints[j].speed;
          maxSpd = Math.max(maxSpd, telemetryPoints[j].speed);
          if (telemetryPoints[j].alert !== '-') alerts++;
          j++;
        }

        const endPt = telemetryPoints[j - 1] || startPt;
        const count = j - i;
        const distanceKm = Math.max(0.1, endPt.distanceAccumKm - startPt.distanceAccumKm);
        const durationSec = Math.max(60, endPt.rawTime - startPt.rawTime);
        const durHours = Math.floor(durationSec / 3600);
        const durMins = Math.floor((durationSec % 3600) / 60);
        const durationText = durHours > 0 ? `${durHours} ชม. ${durMins} นาที` : `${durMins} นาที`;

        segs.push({
          id: `seg-run-${segs.length + 1}`,
          isStop: false,
          type: 'running',
          title: `🚗 ช่วงเดินทาง: ${startPt.locationName}`,
          fromTime: startPt.timeOnly,
          toTime: endPt.timeOnly,
          durationText: `วิ่ง ${durationText}`,
          fromLocation: startPt.locationName.split('➔')[0]?.trim() || startPt.locationName,
          toLocation: startPt.locationName.split('➔')[1]?.trim() || endPt.locationName,
          distanceKm: parseFloat(distanceKm.toFixed(1)),
          avgSpeed: Math.round(spdSum / count),
          topSpeed: maxSpd,
          startIndex: i,
          endIndex: j - 1,
          subLogs: telemetryPoints.slice(i, j),
          alertsCount: alerts,
        });

        i = j;
      }
    }

    return segs;
  }, [telemetryPoints]);

  // Playback Loop Engine
  useEffect(() => {
    if (isPlaying) {
      const stepMs = Math.max(35, Math.floor(450 / playbackSpeed));
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= telemetryPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepMs);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, telemetryPoints.length]);

  const handleTogglePlay = () => {
    if (currentIndex >= telemetryPoints.length - 1) setCurrentIndex(0);
    setIsPlaying(!isPlaying);
  };

  // Filtered timeline items
  const filteredSegments = useMemo(() => {
    return journeySegments.filter((seg) => {
      if (timelineFilter === 'stops' && !seg.isStop) return false;
      if (timelineFilter === 'running' && seg.isStop) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          seg.title.toLowerCase().includes(q) ||
          seg.fromLocation.toLowerCase().includes(q) ||
          seg.toLocation.toLowerCase().includes(q) ||
          seg.fromTime.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [journeySegments, timelineFilter, searchQuery]);

  // Metrics summary
  const totalKm = telemetryPoints.length > 0 ? telemetryPoints[telemetryPoints.length - 1].distanceAccumKm : 0;
  const topSpeed = telemetryPoints.reduce((max, p) => Math.max(max, p.speed), 0);
  const totalAlerts = telemetryPoints.filter((p) => p.alert !== '-' && p.alert).length;
  const totalStopsCount = journeySegments.filter((s) => s.isStop).length;

  const currentSpecialist = specialistsList.find((s) => s.id === selectedStaffId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* 1. Header Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Driver / Vehicle Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl shadow-2xs transition-all">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">directions_car</span>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              {specialistsList.map((spec) => (
                <option key={spec.id} value={spec.id} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {spec.staff?.[0]?.vehicle_plate || 'Isuzu D-Max'} • {spec.full_name} ({spec.nickname})
                </option>
              ))}
            </select>
          </div>

          {/* Unified Compact Date & Time Inputs */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl shadow-2xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 pl-1.5 focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400 dark:text-slate-500 font-black text-xs px-0.5">➔</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 pl-1.5 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Presets Modal Trigger */}
          <button
            onClick={() => setIsPresetsModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/80 transition-all tactile-btn cursor-pointer"
            title="ปุ่มลัดเลือกช่วงเวลา"
          >
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[16px]">bolt</span>
            <span>ช่วงด่วน</span>
          </button>

          {/* Search Button */}
          <button
            onClick={loadRouteHistoryData}
            disabled={loading}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all tactile-btn cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {loading ? 'hourglass_top' : 'search'}
            </span>
            <span>{loading ? 'ค้นหา...' : 'ค้นหา'}</span>
          </button>
        </div>

        {/* Compact Telemetry Metrics */}
        <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0">
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[16px]">distance</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{language === 'th' ? 'ระยะทาง:' : 'Distance:'}</span>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white font-mono tnum">{totalKm} km</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[16px]">local_parking</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{language === 'th' ? 'จุดจอด:' : 'Stops:'}</span>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white font-mono tnum">{totalStopsCount} {language === 'th' ? 'จุด' : 'pts'}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[16px]">speed</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{language === 'th' ? 'สูงสุด:' : 'Max:'}</span>
              <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 font-mono tnum">{topSpeed} km/h</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[16px]">warning</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Alerts:</span>
              <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 font-mono tnum">{totalAlerts}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Presets Modal */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                </span>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">เลือกช่วงเวลายอดนิยม</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">เลือกช่วงเวลาด่วนเพื่อดูประวัติเส้นทาง</p>
                </div>
              </div>
              <button
                onClick={() => setIsPresetsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSelectPreset('today')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer tactile-btn ${
                  activePreset === 'today'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">🌟 วันนี้ (Today)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">00:00 - 23:59</div>
              </button>

              <button
                onClick={() => handleSelectPreset('yesterday')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer tactile-btn ${
                  activePreset === 'yesterday'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">🌟 เมื่อวาน (Yesterday)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">00:00 - 23:59</div>
              </button>

              <button
                onClick={() => handleSelectPreset('24h')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer tactile-btn ${
                  activePreset === '24h'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">⏱️ 24 ชั่วโมงที่แล้ว</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">นับถอยหลังจากตอนนี้</div>
              </button>

              <button
                onClick={() => handleSelectPreset('3days')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer tactile-btn ${
                  activePreset === '3days'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">📅 3 วันล่าสุด</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">ย้อนหลัง 3 วัน</div>
              </button>

              <button
                onClick={() => handleSelectPreset('7days')}
                className={`col-span-2 p-3 rounded-2xl border text-left transition-all cursor-pointer tactile-btn ${
                  activePreset === '7days'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">🗓️ 7 วันที่ผ่านมา (สูงสุดตาม Retention Policy)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">ครอบคลุมทั้งสัปดาห์</div>
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsPresetsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                ปิด
              </button>
              <button
                onClick={loadRouteHistoryData}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all tactile-btn cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span>ยืนยันและค้นหา</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'map' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">map</span>
          <span>แผนที่เส้นทาง</span>
        </button>
        <button
          onClick={() => setMobileTab('timeline')}
          className={`flex-1 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'timeline' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">timeline</span>
          <span>จุดจอด & การเดินทาง ({journeySegments.length})</span>
        </button>
      </div>

      {/* 2. Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: Map & Playback Bar */}
        <div className={`flex-1 flex flex-col relative h-full bg-white dark:bg-slate-950 ${mobileTab === 'timeline' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex-1 relative">
            <MapContainer
              center={[13.9335, 100.5834]}
              zoom={14}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {/* Main Travel Route Polyline */}
              {routePolylineCoords.length > 1 && (
                <Polyline
                  positions={routePolylineCoords}
                  pathOptions={{
                    color: '#2563EB',
                    weight: 4.5,
                    opacity: 0.85,
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Waypoints & Stops Markers */}
              {journeySegments
                .filter((seg) => seg.isStop)
                .map((seg, idx) => {
                  const pt = telemetryPoints[seg.startIndex];
                  if (!pt) return null;
                  const isClient = seg.title.includes('ลูกค้า');
                  return (
                    <Marker
                      key={`waypoint-${idx}`}
                      position={[pt.lat, pt.lng]}
                      icon={createWaypointPin(
                        isClient ? `Drop #${idx + 1}` : `จุดจอด #${idx + 1}`,
                        isClient ? '#10b981' : '#64748b',
                        isClient ? 'storefront' : 'local_parking'
                      )}
                      eventHandlers={{
                        click: () => setCurrentIndex(seg.startIndex),
                      }}
                    >
                      <Popup>
                        <div className="p-1 font-sans text-xs space-y-1">
                          <div className="font-extrabold text-slate-900 dark:text-white">{seg.title}</div>
                          <div className="text-slate-600 dark:text-slate-300 text-[11px]">{seg.fromLocation}</div>
                          <div className="text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                            {seg.durationText} ({seg.fromTime} - {seg.toTime})
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {/* Active Animated Vehicle Pin */}
              {activePoint && (
                <Marker
                  position={[activePoint.lat, activePoint.lng]}
                  icon={createVehiclePlaybackIcon(activePoint.heading, activePoint.speed, activePoint.status)}
                >
                  <Popup>
                    <div className="font-sans text-xs space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {currentSpecialist?.staff?.[0]?.vehicle_plate || 'ยานพาหนะ'} • {currentSpecialist?.full_name}
                      </div>
                      <div>สถานะ: {activePoint.statusText}</div>
                      <div>ความเร็ว: {activePoint.speed} km/h</div>
                      <div>เวลา: {activePoint.timestamp}</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              <MapPlaybackController
                activePoint={activePoint}
                allPoints={telemetryPoints}
                autoPan={autoPan}
              />
            </MapContainer>

            {/* Empty State Overlay */}
            {telemetryPoints.length === 0 && !loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[400]">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                    <span className="material-symbols-outlined text-[28px]">route</span>
                  </div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">ไม่พบประวัติพิกัดในช่วงเวลาที่เลือก</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ลองเลือกวันและเวลาอื่น หรือเปิดแอปพลิเคชันมือถือเพื่อเริ่มส่งพิกัดตำแหน่งจริงเข้าสู่ระบบ
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleSelectPreset('today')}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs cursor-pointer tactile-btn"
                    >
                      ดูวันนี้
                    </button>
                    <button
                      onClick={() => handleSelectPreset('7days')}
                      className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer tactile-btn"
                    >
                      ดู 7 วันล่าสุด
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top-Left Floating Glass HUD Card */}
            {activePoint && (
              <div className="absolute top-3 left-3 z-[400] glass-hud rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md p-2.5 max-w-xs space-y-1.5 text-slate-800 dark:text-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white font-mono">{activePoint.timeOnly}</span>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full ${
                      activePoint.status === 'running'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                        : activePoint.status === 'idle'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {activePoint.statusText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[8px] text-slate-400 font-bold uppercase">ความเร็ว</div>
                    <div className="font-extrabold text-sm text-blue-600 dark:text-blue-400 font-mono">{activePoint.speed} <span className="text-[9px] text-slate-400 font-normal">km/h</span></div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[8px] text-slate-400 font-bold uppercase">ระยะสะสม</div>
                    <div className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{activePoint.distanceAccumKm} <span className="text-[9px] text-slate-400 font-normal">km</span></div>
                  </div>
                </div>

                <div className="text-[10px] bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 truncate">
                  <div className="text-[8px] text-slate-400 font-bold uppercase">พิกัด / สถานที่</div>
                  <div className="truncate font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{activePoint.locationName}</div>
                </div>

                {activePoint.alert !== '-' && activePoint.alert && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800">
                    <span className="material-symbols-outlined text-[13px]">warning</span>
                    <span>{activePoint.alert}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Playback Bar */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-5 py-2.5 shadow-md z-[400] space-y-1.5">
            {/* Scrubber Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 w-11 text-right font-mono">
                {activePoint?.timeOnly || '00:00'}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, telemetryPoints.length - 1)}
                value={currentIndex}
                disabled={telemetryPoints.length <= 1}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg disabled:opacity-50"
              />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-11 font-mono">
                {telemetryPoints.length > 0 ? telemetryPoints[telemetryPoints.length - 1].timeOnly : '23:59'}
              </span>
            </div>

            {/* Controls & Speeds */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Playback Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 5))}
                  disabled={telemetryPoints.length <= 1}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all tactile-btn cursor-pointer disabled:opacity-40"
                  title="ย้อนหลัง 5 จุด"
                >
                  <span className="material-symbols-outlined text-[16px]">replay_5</span>
                </button>
                <button
                  onClick={handleTogglePlay}
                  disabled={telemetryPoints.length <= 1}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs transition-all tactile-btn cursor-pointer disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                  <span>{isPlaying ? 'พักเล่น' : 'เล่น'}</span>
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(telemetryPoints.length - 1, prev + 5))}
                  disabled={telemetryPoints.length <= 1}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all tactile-btn cursor-pointer disabled:opacity-40"
                  title="ไปข้างหน้า 5 จุด"
                >
                  <span className="material-symbols-outlined text-[16px]">forward_5</span>
                </button>
              </div>

              {/* Speed Multipliers */}
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 px-1">สปีด:</span>
                {[1, 2, 4, 8].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded-lg font-bold text-[11px] transition-all tactile-btn cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Action Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAutoPan(!autoPan)}
                  className={`px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all tactile-btn cursor-pointer ${
                    autoPan
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {autoPan ? 'gps_fixed' : 'gps_not_fixed'}
                  </span>
                  <span>ติดตามรถ</span>
                </button>

                <button
                  onClick={() => setShowGraph(!showGraph)}
                  className={`px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all tactile-btn cursor-pointer ${
                    showGraph
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">monitoring</span>
                  <span>{showGraph ? 'ซ่อนกราฟ' : 'ดูกราฟ'}</span>
                </button>
              </div>
            </div>

            {/* Speed Sparkline Graph */}
            {showGraph && telemetryPoints.length > 1 && (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 font-mono">
                  <span>Speed Profile (km/h)</span>
                  <span className="text-blue-600 dark:text-blue-400">{totalKm} km • Max {topSpeed} km/h</span>
                </div>
                <div
                  className="h-12 w-full bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden flex items-end cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, clickX / rect.width));
                    const targetIdx = Math.round(pct * (telemetryPoints.length - 1));
                    setCurrentIndex(targetIdx);
                  }}
                >
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path
                      d={`M 0 100 ${telemetryPoints
                        .map((p, idx) => {
                          const x = (idx / (telemetryPoints.length - 1)) * 100;
                          const y = 100 - (p.speed / Math.max(1, topSpeed)) * 80;
                          return `L ${x} ${y}`;
                        })
                        .join(' ')} L 100 100 Z`}
                      fill="rgba(37, 99, 235, 0.15)"
                    />
                    <path
                      d={`M 0 100 ${telemetryPoints
                        .map((p, idx) => {
                          const x = (idx / (telemetryPoints.length - 1)) * 100;
                          const y = 100 - (p.speed / Math.max(1, topSpeed)) * 80;
                          return `L ${x} ${y}`;
                        })
                        .join(' ')}`}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                    />
                  </svg>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-600 shadow-md pointer-events-none"
                    style={{
                      left: `${(currentIndex / Math.max(1, telemetryPoints.length - 1)) * 100}%`,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-rose-600 -ml-[3px] -mt-1 shadow-md"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Journey Timeline & Segments */}
        <div className={`w-full lg:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col h-full overflow-hidden shrink-0 shadow-sm ${mobileTab === 'map' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Timeline Header & Filters */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/80 space-y-2 bg-slate-50/70 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">timeline</span>
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">สรุปจุดจอด & การเดินทาง</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
                {journeySegments.length} ช่วง
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <button
                onClick={() => setTimelineFilter('all')}
                className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-all tactile-btn cursor-pointer ${
                  timelineFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setTimelineFilter('stops')}
                className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-all tactile-btn cursor-pointer ${
                  timelineFilter === 'stops' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                จุดจอด ({totalStopsCount})
              </button>
              <button
                onClick={() => setTimelineFilter('running')}
                className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-all tactile-btn cursor-pointer ${
                  timelineFilter === 'running' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                ช่วงวิ่ง
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-[15px]">
                search
              </span>
              <input
                type="text"
                placeholder="ค้นหาจุดจอด, เวลา, สถานที่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Timeline Cards List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredSegments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs space-y-1">
                <span className="material-symbols-outlined text-[32px] text-slate-300">search_off</span>
                <p>ไม่พบกิจกรรมตามเงื่อนไขที่เลือก</p>
              </div>
            ) : (
              filteredSegments.map((seg) => {
                const isCurrentActive =
                  activePoint &&
                  activePoint.rawTime >= (telemetryPoints[seg.startIndex]?.rawTime || 0) &&
                  activePoint.rawTime <= (telemetryPoints[seg.endIndex]?.rawTime || 0);

                return (
                  <div
                    key={seg.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isCurrentActive
                        ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800/80'
                    }`}
                  >
                    <div
                      onClick={() => {
                        setCurrentIndex(seg.startIndex);
                        if (window.innerWidth < 1024) setMobileTab('map');
                      }}
                      className="p-3 space-y-1.5 cursor-pointer"
                    >
                      {/* Top Bar: Icon + Title + Duration */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 ${
                              seg.isStop
                                ? seg.title.includes('ลูกค้า')
                                  ? 'bg-emerald-600'
                                  : 'bg-slate-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {seg.isStop ? (seg.title.includes('ลูกค้า') ? 'storefront' : 'local_parking') : 'directions_car'}
                            </span>
                          </span>
                          <div className="min-w-0">
                            <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">{seg.title}</div>
                            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                              {seg.durationText}
                            </div>
                          </div>
                        </div>

                        {/* From - To Time Pill */}
                        <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap font-mono">
                          {seg.fromTime} - {seg.toTime}
                        </span>
                      </div>

                      {/* Location Information */}
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        {seg.isStop ? (
                          <div className="flex items-start gap-1">
                            <span className="material-symbols-outlined text-slate-400 text-[13px] shrink-0 mt-0.5">location_on</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{seg.fromLocation}</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="truncate">จาก: <strong className="text-slate-800 dark:text-slate-200">{seg.fromLocation}</strong></span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                              <span className="truncate">ถึง: <strong className="text-slate-800 dark:text-slate-200">{seg.toLocation}</strong></span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Running Stats */}
                      {!seg.isStop && (
                        <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 pt-0.5 font-mono">
                          <span>ระยะ: <strong className="text-blue-600 dark:text-blue-400 font-bold">{seg.distanceKm} km</strong></span>
                          <span>เฉลี่ย: <strong className="text-slate-800 dark:text-slate-200 font-bold">{seg.avgSpeed} km/h</strong></span>
                          <span>สูงสุด: <strong className="text-slate-800 dark:text-slate-200 font-bold">{seg.topSpeed} km/h</strong></span>
                        </div>
                      )}
                    </div>
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
