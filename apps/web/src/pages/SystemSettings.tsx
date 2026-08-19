import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function SystemSettings() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'general' | 'gps_engine' | 'policies' | 'api'>('general');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // General Settings State
  const [companyName, setCompanyName] = useState('FastFleet Field Marketing Co., Ltd.');
  const [timezone, setTimezone] = useState('Asia/Bangkok (GMT+7)');
  const [operatingHours, setOperatingHours] = useState({ start: '08:00', end: '19:00' });

  // Notifications State
  const [notifications, setNotifications] = useState({
    tripSubmitted: true,
    tripRevision: true,
    dropCheckin: true,
    lowBattery: true,
  });

  // GPS Diff & Anti-Drift Engine State (Smartphone Optimized Defaults)
  const [gpsSettings, setGpsSettings] = useState({
    mbSpeedMoving: 4.0, // km/h (ความเร็วขั้นต่ำ)
    mbDistMoving: 10.0, // meters (ระยะขยับขั้นต่ำ)
    mbSpeedStatic: 1.5, // km/h (ความเร็วสูงสุดขณะหยุดนิ่ง)
    mbStaticRadius: 15.0, // meters (รัศมีหยุดนิ่ง)
    dropIgnoreData: true, // กรองพิกัด Ignore ทิ้ง ไม่บันทึก DB
  });

  // Live Test State
  const [testSpeed, setTestSpeed] = useState<number>(6.5);
  const [testDist, setTestDist] = useState<number>(12.0);
  const [testRadius, setTestRadius] = useState<number>(8.0);

  // Approval Rules State
  const [approvalRules, setApprovalRules] = useState({
    requireAllDropsConfirmed: true,
    requireReceiptSlips: true,
    maxExpensePerTrip: 3000,
    requireStartOdometer: true,
  });

  // API State
  const [apiKey, setApiKey] = useState('flt_live_mkt_99a8b7c6d5e4f3a2b1c0987654321');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [wsStreamUrl] = useState('wss://api.fastfleet.io/v1/telemetry/stream');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Evaluate Smartphone GPS Status based on exact user logic
  const evaluateGpsState = (speed: number, dist: number, radius: number) => {
    // 1. Check Moving: Speed > MB_Speed_Moving AND Dist > MB_Dist_Moving
    if (speed > gpsSettings.mbSpeedMoving && dist > gpsSettings.mbDistMoving) {
      return {
        status: 'Running',
        label: '🚗 Running (กำลังเดินทาง)',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dotColor: 'bg-emerald-500 animate-pulse',
        isDropped: false,
        summary: `ผ่านเกณฑ์เคลื่อนที่: Speed (${speed} > ${gpsSettings.mbSpeedMoving} km/h) & Dist (${dist} > ${gpsSettings.mbDistMoving} m)`,
      };
    }

    // 2. Check Anti-Drift: Speed <= MB_Speed_Static AND Pos <= MB_Static_Radius
    if (speed <= gpsSettings.mbSpeedStatic && radius <= gpsSettings.mbStaticRadius) {
      return {
        status: 'Stopped',
        label: '📍 Stopped (หยุดนิ่ง / ณ จุดลูกค้า)',
        badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
        dotColor: 'bg-blue-500',
        isDropped: false,
        summary: `ผ่าน Anti-Drift: Speed (${speed} <= ${gpsSettings.mbSpeedStatic} km/h) & Radius (${radius} <= ${gpsSettings.mbStaticRadius} m) ➔ นับเวลา Static_Time`,
      };
    }

    // 3. Fail Anti-Drift -> Ignore
    return {
      status: 'Ignore',
      label: '⚠️ Ignore (GPS แกว่ง)',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
      dotColor: 'bg-rose-500',
      isDropped: gpsSettings.dropIgnoreData,
      summary: `ไม่ผ่าน Anti-Drift: พิกัดคลาดเคลื่อน ➔ ${gpsSettings.dropIgnoreData ? 'กรองทิ้ง ไม่บันทึก DB เพื่อป้องกัน GPS เด้ง' : 'Flagged as Ignore'}`,
    };
  };

  const testResult = evaluateGpsState(testSpeed, testDist, testRadius);

  const resetToMobileDefaults = () => {
    setGpsSettings({
      mbSpeedMoving: 4.0,
      mbDistMoving: 10.0,
      mbSpeedStatic: 1.5,
      mbStaticRadius: 15.0,
      dropIgnoreData: true,
    });
    showToast('🔄 คืนค่าเริ่มต้นสำหรับ Smartphone เรียบร้อย');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-700 text-xs font-semibold animate-scale-up">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[22px]">tune</span>
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight">
              {t('settings_title')}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {t('settings_subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={() => showToast(language === 'th' ? '✓ บันทึกการตั้งค่าแล้ว' : '✓ Settings saved!')}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {t('btn_save_changes')}
        </button>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
        {[
          { id: 'general', label: t('settings_tab_general'), icon: 'translate' },
          { id: 'gps_engine', label: t('settings_tab_gps'), icon: 'smartphone' },
          { id: 'policies', label: t('settings_tab_policies'), icon: 'task_alt' },
          { id: 'api', label: t('settings_tab_api'), icon: 'terminal' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined text-[17px] ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL (ภาษา & ธีม) */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="space-y-4 text-xs">
          {/* Language Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-primary text-[18px]">language</span>
              {t('settings_language_label')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLanguage('th');
                  showToast('เปลี่ยนภาษาเป็น: ภาษาไทย');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  language === 'th'
                    ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇹🇭</span>
                <div>
                  <div className="font-bold text-xs">ภาษาไทย (TH)</div>
                  <div className="text-[10px] text-slate-400">ระบบเมนูและรายงานภาษาไทย</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  showToast('Language changed to: English');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  language === 'en'
                    ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇬🇧</span>
                <div>
                  <div className="font-bold text-xs">English (EN)</div>
                  <div className="text-[10px] text-slate-400">International English</div>
                </div>
              </button>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-primary text-[18px]">dark_mode</span>
              {t('settings_theme_label')}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'light', label: t('settings_theme_light'), desc: 'Clean White' },
                { key: 'dark', label: t('settings_theme_dark'), desc: 'Sleek Dark' },
                { key: 'system', label: t('settings_theme_system'), desc: 'Auto Match OS' },
              ].map((thm) => (
                <button
                  key={thm.key}
                  onClick={() => {
                    setTheme(thm.key as any);
                    showToast(`Theme: ${thm.label}`);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    theme === thm.key
                      ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">{thm.label}</div>
                  <div className="text-[10px] text-slate-400">{thm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Organization & Schedule */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
              {t('settings_company_name')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">ชื่อหน่วยงาน</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">เขตเวลา</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-primary"
                >
                  <option value="Asia/Bangkok (GMT+7)">Asia/Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore (GMT+8)">Asia/Singapore (GMT+8)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">เวลาทำการภาคสนาม</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={operatingHours.start}
                    onChange={(e) => setOperatingHours({ ...operatingHours, start: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 font-semibold focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">➔</span>
                  <input
                    type="time"
                    value={operatingHours.end}
                    onChange={(e) => setOperatingHours({ ...operatingHours, end: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-primary text-[18px]">notifications_active</span>
              {t('settings_notifications_title')}
            </h3>

            <div className="divide-y divide-slate-100">
              {[
                { key: 'tripSubmitted', label: 'แจ้งเตือนเมื่อมีทริปส่งรายงานรออนุมัติ (Pending Approval)' },
                { key: 'tripRevision', label: 'แจ้งเตือนเมื่อมีการส่งกลับแก้ไขรายงาน (Revision Requested)' },
                { key: 'dropCheckin', label: 'แจ้งเตือนเมื่อพนักงานเช็คอินเข้าพบลูกค้าแต่ละ Drop' },
                { key: 'lowBattery', label: 'แจ้งเตือนเมื่อแบตเตอรี่มือถือพนักงานต่ำกว่า 20%' },
              ].map((notif) => (
                <div key={notif.key} className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">{notif.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(notifications as any)[notif.key]}
                      onChange={(e) =>
                        setNotifications({ ...notifications, [notif.key]: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GPS DIFF & ANTI-DRIFT ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'gps_engine' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6 text-xs">
          {/* Header & Reset Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">radar</span>
                <h3 className="font-bold text-sm text-slate-900">
                  {t('settings_gps_title')}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('settings_gps_desc')}
              </p>
            </div>

            <button
              onClick={resetToMobileDefaults}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              {t('settings_gps_reset_btn')}
            </button>
          </div>

          {/* 4 Core Threshold Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Moving Check Controls */}
            <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200/70 space-y-3.5">
              <div className="flex items-center justify-between text-emerald-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">directions_car</span>
                  {t('settings_gps_moving_header')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{t('settings_gps_moving_speed')}</span>
                    <span className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {gpsSettings.mbSpeedMoving} km/h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="15.0"
                    step="0.5"
                    value={gpsSettings.mbSpeedMoving}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, mbSpeedMoving: parseFloat(e.target.value) })
                    }
                    className="w-full cursor-pointer accent-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{t('settings_gps_moving_dist')}</span>
                    <span className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {gpsSettings.mbDistMoving} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={gpsSettings.mbDistMoving}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, mbDistMoving: parseFloat(e.target.value) })
                    }
                    className="w-full cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* 2. Anti-Drift Controls */}
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200/70 space-y-3.5">
              <div className="flex items-center justify-between text-blue-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">shield</span>
                  {t('settings_gps_static_header')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{t('settings_gps_static_speed')}</span>
                    <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {gpsSettings.mbSpeedStatic} km/h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={gpsSettings.mbSpeedStatic}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, mbSpeedStatic: parseFloat(e.target.value) })
                    }
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{t('settings_gps_static_radius')}</span>
                    <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {gpsSettings.mbStaticRadius} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={gpsSettings.mbStaticRadius}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, mbStaticRadius: parseFloat(e.target.value) })
                    }
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Database Policy Row */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600 text-[18px]">filter_alt_off</span>
                <span>{t('settings_gps_drop_label')}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {t('settings_gps_drop_desc')}
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={gpsSettings.dropIgnoreData}
                onChange={(e) =>
                  setGpsSettings({ ...gpsSettings, dropIgnoreData: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Real-time Interactive Test Sandbox */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">science</span>
                {t('settings_gps_sandbox_title')}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Live Simulator</span>
            </div>

            {/* Test Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-300">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>ความเร็ว:</span>
                  <span className="font-mono text-white font-bold">{testSpeed.toFixed(1)} km/h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={testSpeed}
                  onChange={(e) => setTestSpeed(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>ระยะขยับ:</span>
                  <span className="font-mono text-white font-bold">{testDist.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={testDist}
                  onChange={(e) => setTestDist(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>รัศมีแกว่ง:</span>
                  <span className="font-mono text-white font-bold">{testRadius.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={testRadius}
                  onChange={(e) => setTestRadius(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Test Output Strip */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${testResult.badgeBg}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${testResult.dotColor}`} />
                <span className="font-bold text-xs">{testResult.label}</span>
                <span className="text-[11px] opacity-80 hidden sm:inline">• {testResult.summary}</span>
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/90 border border-black/10 shrink-0">
                DB: {testResult.isDropped ? '❌ ไม่บันทึก' : '💾 บันทึก'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: APPROVAL & EXPENSE POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-primary text-[18px]">task_alt</span>
            นโยบายการส่งรายงานทริปและค่าใช้จ่าย (Approval & Expense Rules)
          </h3>

          <div className="space-y-2.5">
            {[
              {
                key: 'requireAllDropsConfirmed',
                title: 'บังคับยืนยันเข้าพบครบ 100% ทุกจุด ก่อนกดส่งรายงาน',
                desc: 'บน Mobile App จะส่งรายงานได้ก็ต่อเมื่อทุก Drop ถูกกด Confirmed แล้วเท่านั้น',
              },
              {
                key: 'requireReceiptSlips',
                title: 'บังคับแนบรูปถ่ายสลิปใบเสร็จ ทุกรายการเบิกจ่าย',
                desc: 'ค่าน้ำมัน, ค่าทางด่วน, ค่าที่จอดรถ และค่าเลี้ยงรับรอง ต้องมีรูปสลิปประกอบ',
              },
              {
                key: 'requireStartOdometer',
                title: 'บังคับระบุเลขไมล์เริ่มต้นก่อนออกเดินทาง',
                desc: 'ใช้ในการตรวจนับและยืนยันระยะทางวิ่งจริง (Verified Odometer Delta)',
              },
            ].map((rule) => (
              <div
                key={rule.key}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900">{rule.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{rule.desc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={(approvalRules as any)[rule.key]}
                    onChange={(e) =>
                      setApprovalRules({ ...approvalRules, [rule.key]: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            ))}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="font-bold text-slate-900 block">
                วงเงินเบิกจ่ายสูงสุดต่อทริปโดยไม่ต้องขออนุมัติพิเศษ (Max Expense)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">฿</span>
                <input
                  type="number"
                  value={approvalRules.maxExpensePerTrip}
                  onChange={(e) =>
                    setApprovalRules({ ...approvalRules, maxExpensePerTrip: parseInt(e.target.value) || 0 })
                  }
                  className="w-32 p-2 rounded-lg border border-slate-200 font-bold text-slate-900 focus:outline-none focus:border-primary"
                />
                <span className="text-slate-400">บาท / ทริป</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: API & DEVELOPER */}
      {/* ========================================================================= */}
      {activeTab === 'api' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
            API & Real-time WebSockets
          </h3>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">WebSocket Telemetry Stream Endpoint</label>
              <input
                type="text"
                readOnly
                value={wsStreamUrl}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-primary bg-slate-50 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Production Secret API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type={isKeyVisible ? 'text' : 'password'}
                  readOnly
                  value={apiKey}
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 font-mono text-xs bg-slate-50 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setIsKeyVisible(!isKeyVisible)}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isKeyVisible ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newKey =
                      'flt_live_mkt_' +
                      Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15);
                    setApiKey(newKey);
                    showToast('⚡ สุ่มสร้าง Secret Key ใหม่เรียบร้อย');
                  }}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 font-bold"
                >
                  สุ่มใหม่
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    showToast('📋 คัดลอก API Key แล้ว');
                  }}
                  className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  คัดลอก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
