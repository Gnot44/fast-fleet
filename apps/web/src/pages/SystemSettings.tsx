import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

export default function SystemSettings() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial tab from URL param or localStorage
  const tabParam = searchParams.get('tab') as 'general' | 'gps_engine' | 'policies' | 'api' | null;
  const [activeTab, setActiveTab] = useState<'general' | 'gps_engine' | 'policies' | 'api'>(() => {
    if (tabParam && ['general', 'gps_engine', 'policies', 'api'].includes(tabParam)) {
      return tabParam;
    }
    const saved = localStorage.getItem('fastfleet_settings_active_tab') as any;
    if (saved && ['general', 'gps_engine', 'policies', 'api'].includes(saved)) {
      return saved;
    }
    return 'general';
  });

  const handleTabChange = (newTab: 'general' | 'gps_engine' | 'policies' | 'api') => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
    localStorage.setItem('fastfleet_settings_active_tab', newTab);
  };

  // Sync state if URL query param changes externally
  useEffect(() => {
    if (tabParam && ['general', 'gps_engine', 'policies', 'api'].includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
      localStorage.setItem('fastfleet_settings_active_tab', tabParam);
    }
  }, [tabParam, activeTab]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

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
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Settings from Supabase + localStorage cache fallback
  const fetchSettings = async () => {
    try {
      setIsLoading(true);

      // Check localStorage first for instant hydration
      const cached = localStorage.getItem('fastfleet_system_settings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.companyName) setCompanyName(parsed.companyName);
          if (parsed.timezone) setTimezone(parsed.timezone);
          if (parsed.operatingHours) setOperatingHours(parsed.operatingHours);
          if (parsed.notifications) setNotifications(parsed.notifications);
          if (parsed.gpsSettings) setGpsSettings(parsed.gpsSettings);
          if (parsed.approvalRules) setApprovalRules(parsed.approvalRules);
          if (parsed.apiKey) setApiKey(parsed.apiKey);
          if (parsed.lastSavedAt) setLastSavedAt(new Date(parsed.lastSavedAt));
        } catch (e) {
          console.warn('Error reading localStorage settings:', e);
        }
      }

      // Fetch active row from Supabase
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Supabase fetch system_settings warning:', error);
        return;
      }

      if (data) {
        setSettingsId(data.id);
        if (data.company_name) setCompanyName(data.company_name);
        if (data.timezone) setTimezone(data.timezone);
        if (data.operating_hours && typeof data.operating_hours === 'object' && !Array.isArray(data.operating_hours)) {
          const oph = data.operating_hours as Record<string, any>;
          setOperatingHours({
            start: oph.start || '08:00',
            end: oph.end || '19:00',
          });
        }
        if (data.notifications_config && typeof data.notifications_config === 'object' && !Array.isArray(data.notifications_config)) {
          const notif = data.notifications_config as Record<string, any>;
          setNotifications({
            tripSubmitted: notif.tripSubmitted ?? true,
            tripRevision: notif.tripRevision ?? true,
            dropCheckin: notif.dropCheckin ?? true,
            lowBattery: notif.lowBattery ?? true,
          });
        }
        if (data.gps_config && typeof data.gps_config === 'object' && !Array.isArray(data.gps_config)) {
          const gps = data.gps_config as Record<string, any>;
          setGpsSettings({
            mbSpeedMoving: Number(gps.mbSpeedMoving) || 4.0,
            mbDistMoving: Number(gps.mbDistMoving) || 10.0,
            mbSpeedStatic: Number(gps.mbSpeedStatic) || 1.5,
            mbStaticRadius: Number(gps.mbStaticRadius) || 15.0,
            dropIgnoreData: gps.dropIgnoreData ?? true,
          });
        }
        if (data.approval_rules && typeof data.approval_rules === 'object' && !Array.isArray(data.approval_rules)) {
          const rules = data.approval_rules as Record<string, any>;
          setApprovalRules({
            requireAllDropsConfirmed: rules.requireAllDropsConfirmed ?? true,
            requireReceiptSlips: rules.requireReceiptSlips ?? true,
            maxExpensePerTrip: Number(rules.maxExpensePerTrip) || 3000,
            requireStartOdometer: rules.requireStartOdometer ?? true,
          });
        }
        if (data.api_key) setApiKey(data.api_key);
        if (data.updated_at) setLastSavedAt(new Date(data.updated_at));
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('system_settings_live_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const row: any = payload.new;
            if (row.id) setSettingsId(row.id);
            if (row.company_name) setCompanyName(row.company_name);
            if (row.timezone) setTimezone(row.timezone);
            if (row.operating_hours && typeof row.operating_hours === 'object') {
              setOperatingHours({
                start: row.operating_hours.start || '08:00',
                end: row.operating_hours.end || '19:00',
              });
            }
            if (row.notifications_config && typeof row.notifications_config === 'object') {
              setNotifications({
                tripSubmitted: row.notifications_config.tripSubmitted ?? true,
                tripRevision: row.notifications_config.tripRevision ?? true,
                dropCheckin: row.notifications_config.dropCheckin ?? true,
                lowBattery: row.notifications_config.lowBattery ?? true,
              });
            }
            if (row.gps_config && typeof row.gps_config === 'object') {
              setGpsSettings({
                mbSpeedMoving: Number(row.gps_config.mbSpeedMoving) || 4.0,
                mbDistMoving: Number(row.gps_config.mbDistMoving) || 10.0,
                mbSpeedStatic: Number(row.gps_config.mbSpeedStatic) || 1.5,
                mbStaticRadius: Number(row.gps_config.mbStaticRadius) || 15.0,
                dropIgnoreData: row.gps_config.dropIgnoreData ?? true,
              });
            }
            if (row.approval_rules && typeof row.approval_rules === 'object') {
              setApprovalRules({
                requireAllDropsConfirmed: row.approval_rules.requireAllDropsConfirmed ?? true,
                requireReceiptSlips: row.approval_rules.requireReceiptSlips ?? true,
                maxExpensePerTrip: Number(row.approval_rules.maxExpensePerTrip) || 3000,
                requireStartOdometer: row.approval_rules.requireStartOdometer ?? true,
              });
            }
            if (row.api_key) setApiKey(row.api_key);
            if (row.updated_at) setLastSavedAt(new Date(row.updated_at));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save Settings to Supabase + localStorage
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);

      const payload = {
        company_name: companyName,
        timezone: timezone,
        operating_hours: operatingHours,
        notifications_config: notifications,
        gps_config: gpsSettings,
        approval_rules: approvalRules,
        api_key: apiKey,
        updated_at: new Date().toISOString(),
      };

      let savedId = settingsId;

      if (settingsId) {
        const { error } = await supabase
          .from('system_settings')
          .update(payload)
          .eq('id', settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('system_settings')
          .upsert(payload)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          savedId = data.id;
          setSettingsId(data.id);
        }
      }

      // Save to localStorage
      localStorage.setItem(
        'fastfleet_system_settings',
        JSON.stringify({
          id: savedId,
          companyName,
          timezone,
          operatingHours,
          notifications,
          gpsSettings,
          approvalRules,
          apiKey,
          lastSavedAt: new Date().toISOString(),
        })
      );

      const now = new Date();
      setLastSavedAt(now);
      showToast(
        language === 'th'
          ? '✓ บันทึกการตั้งค่าระบบลงฐานข้อมูล Cloud เรียบร้อยแล้ว'
          : '✓ System settings saved to Cloud database!'
      );
    } catch (err: any) {
      console.error('Error saving system settings:', err);

      // Fallback save to localStorage
      localStorage.setItem(
        'fastfleet_system_settings',
        JSON.stringify({
          id: settingsId,
          companyName,
          timezone,
          operatingHours,
          notifications,
          gpsSettings,
          approvalRules,
          apiKey,
          lastSavedAt: new Date().toISOString(),
        })
      );
      setLastSavedAt(new Date());
      showToast(
        language === 'th'
          ? '✓ บันทึกการตั้งค่าลง Local Storage แล้ว'
          : '✓ Settings saved locally!'
      );
    } finally {
      setIsSaving(false);
    }
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
    showToast('🔄 คืนค่าเริ่มต้นสำหรับ Smartphone เรียบร้อย (กดบันทึกเพื่อใช้งาน)');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-700 text-xs font-semibold animate-scale-up">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200/60 dark:border-blue-800/60">
            <span className="material-symbols-outlined text-[22px]">tune</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                {t('settings_title')}
              </h1>
              {isLoading && (
                <span className="text-[10px] text-slate-400 animate-pulse font-medium">กำลังโหลด...</span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {t('settings_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {lastSavedAt && (
            <span className="text-[11px] text-slate-400 hidden sm:inline font-mono font-medium">
              บันทึกล่าสุด: {lastSavedAt.toLocaleTimeString('th-TH')}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className={`px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer tactile-btn ${
              isSaving ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${isSaving ? 'animate-spin' : ''}`}>
              {isSaving ? 'autorenew' : 'save'}
            </span>
            <span>{isSaving ? 'กำลังบันทึก...' : t('btn_save_changes')}</span>
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs (Responsive scroll on mobile) */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-hide">
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
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex-1 min-w-[140px] sm:min-w-0 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 sm:shrink cursor-pointer tactile-btn ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200/60 dark:border-slate-750'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined text-[17px] ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
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
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">language</span>
              {t('settings_language_label')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLanguage('th');
                  showToast('เปลี่ยนภาษาเป็น: ภาษาไทย');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer tactile-btn ${
                  language === 'th'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-850 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">🇹🇭</span>
                <div>
                  <div className="font-extrabold text-xs">ภาษาไทย (TH)</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">ระบบเมนูและรายงานภาษาไทย</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  showToast('Language changed to: English');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer tactile-btn ${
                  language === 'en'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-850 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">🇬🇧</span>
                <div>
                  <div className="font-extrabold text-xs">English (EN)</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">International English</div>
                </div>
              </button>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">dark_mode</span>
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
                  type="button"
                  onClick={() => {
                    setTheme(thm.key as any);
                    showToast(`Theme: ${thm.label}`);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer tactile-btn ${
                    theme === thm.key
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-850 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="font-extrabold text-xs">{thm.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{thm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Organization & Schedule */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">domain</span>
              {t('settings_company_name')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">ชื่อหน่วยงาน / องค์กร</label>
                <input
                  type="text"
                  value={companyName ?? ''}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">เขตเวลา (Timezone)</label>
                <select
                  value={timezone ?? 'Asia/Bangkok (GMT+7)'}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Asia/Bangkok (GMT+7)">Asia/Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore (GMT+8)">Asia/Singapore (GMT+8)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">เวลาทำการภาคสนาม (Operating Hours)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={operatingHours?.start ?? '08:00'}
                    onChange={(e) => setOperatingHours({ ...operatingHours, start: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">➔</span>
                  <input
                    type="time"
                    value={operatingHours?.end ?? '19:00'}
                    onChange={(e) => setOperatingHours({ ...operatingHours, end: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">notifications_active</span>
              {t('settings_notifications_title')}
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'tripSubmitted', label: 'แจ้งเตือนเมื่อมีทริปส่งรายงานรออนุมัติ (Pending Approval)' },
                { key: 'tripRevision', label: 'แจ้งเตือนเมื่อมีการส่งกลับแก้ไขรายงาน (Revision Requested)' },
                { key: 'dropCheckin', label: 'แจ้งเตือนเมื่อพนักงานเช็คอินเข้าพบลูกค้าแต่ละ Drop' },
                { key: 'lowBattery', label: 'แจ้งเตือนเมื่อแบตเตอรี่มือถือพนักงานต่ำกว่า 20%' },
              ].map((notif) => (
                <div key={notif.key} className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{notif.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((notifications as any)?.[notif.key])}
                      onChange={(e) =>
                        setNotifications({ ...notifications, [notif.key]: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-6 text-xs">
          {/* Header & Reset Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">radar</span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {t('settings_gps_title')}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('settings_gps_desc')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetToMobileDefaults}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer tactile-btn"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                {t('settings_gps_reset_btn')}
              </button>
            </div>
          </div>

          {/* 4 Core Threshold Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Moving Check Controls */}
            <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 space-y-3.5">
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">directions_car</span>
                  {t('settings_gps_moving_header')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t('settings_gps_moving_speed')}</span>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
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
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t('settings_gps_moving_dist')}</span>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
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
            <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 space-y-3.5">
              <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">shield</span>
                  {t('settings_gps_static_header')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t('settings_gps_static_speed')}</span>
                    <span className="font-mono font-bold text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
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
                    className="w-full cursor-pointer accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t('settings_gps_static_radius')}</span>
                    <span className="font-mono font-bold text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
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
                    className="w-full cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Database Policy Row */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600 text-[18px]">filter_alt_off</span>
                <span>{t('settings_gps_drop_label')}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
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
              <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Real-time Interactive Test Sandbox */}
          <div className="p-4.5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60 space-y-3.5">
            <div className="flex items-center justify-between border-b border-blue-200/50 dark:border-blue-800/50 pb-2.5">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">science</span>
                {t('settings_gps_sandbox_title')}
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md font-mono">
                Live Simulator
              </span>
            </div>

            {/* Test Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-slate-700 dark:text-slate-300">
              <div className="space-y-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="flex justify-between items-center text-[11px] font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">ความเร็วจำลอง:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    {testSpeed.toFixed(1)} km/h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={testSpeed}
                  onChange={(e) => setTestSpeed(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-blue-600 mt-1"
                />
              </div>

              <div className="space-y-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="flex justify-between items-center text-[11px] font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">ระยะขยับจำลอง:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    {testDist.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={testDist}
                  onChange={(e) => setTestDist(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-blue-600 mt-1"
                />
              </div>

              <div className="space-y-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="flex justify-between items-center text-[11px] font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">รัศมีแกว่งจำลอง:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    {testRadius.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={testRadius}
                  onChange={(e) => setTestRadius(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-blue-600 mt-1"
                />
              </div>
            </div>

            {/* Test Output Strip */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${testResult.badgeBg} shadow-2xs`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${testResult.dotColor}`} />
                <span className="font-bold text-xs">{testResult.label}</span>
                <span className="text-[11px] opacity-85 hidden sm:inline">• {testResult.summary}</span>
              </div>
              <span className="font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 border border-black/10 dark:border-white/10 shadow-2xs shrink-0">
                DB: {testResult.isDropped ? '❌ กรองทิ้ง (ไม่บันทึก)' : '💾 บันทึกลงฐานข้อมูล'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: APPROVAL & EXPENSE POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4 text-xs">
          <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">task_alt</span>
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
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white">{rule.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{rule.desc}</div>
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
                  <div className="w-8 h-4.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <label className="font-extrabold text-slate-900 dark:text-white block">
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
                  className="w-32 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono tnum"
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
        <div className="space-y-4 text-xs">
          {/* API Credentials Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">terminal</span>
              API & Real-time WebSockets
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">WebSocket Telemetry Stream Endpoint</label>
                <input
                  type="text"
                  readOnly
                  value={wsStreamUrl}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Production Secret API Key</label>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type={isKeyVisible ? 'text' : 'password'}
                    readOnly
                    value={apiKey}
                    className="flex-1 min-w-[200px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setIsKeyVisible(!isKeyVisible)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer shrink-0 tactile-btn"
                    title={isKeyVisible ? 'ซ่อนรหัส' : 'แสดงรหัส'}
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
                      showToast('⚡ สุ่มสร้าง Secret Key ใหม่เรียบร้อย (กดบันทึกด้านบนเพื่อใช้งาน)');
                    }}
                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-bold cursor-pointer shrink-0 tactile-btn"
                  >
                    สุ่มใหม่
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(apiKey);
                      showToast('📋 คัดลอก API Key แล้ว');
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 tactile-btn"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    คัดลอก
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Official API Documentation Download & Reference Banner */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                    FastFleet API Documentation (English Version)
                  </h3>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md text-[10px] font-mono font-bold">
                    v1.4 Official
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs max-w-2xl leading-relaxed">
                  Official Developer Integration Guide with complete REST endpoints, WebSocket event schemas, authentication headers, error codes, and live code examples (cURL, Python, Node.js).
                </p>
              </div>

              {/* Download Action */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                <a
                  href="/FastFleet_API_Documentation.md"
                  download="FastFleet_API_Documentation.md"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-none tactile-btn"
                >
                  <span className="material-symbols-outlined text-[17px]">download</span>
                  Download Doc (.MD)
                </a>
              </div>
            </div>

            {/* Quick API Snippet Preview */}
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 font-mono text-[11px] space-y-2 text-slate-800 dark:text-slate-200 overflow-x-auto">
              <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-700 pb-1.5 font-sans">
                <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">code</span>
                  Quick cURL Request Sample:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const snippet = `curl -X GET "https://api.fastfleet.io/v1/telemetry/live" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json"`;
                    navigator.clipboard.writeText(snippet);
                    showToast('📋 คัดลอก cURL snippet แล้ว');
                  }}
                  className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 text-[10px] cursor-pointer font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">content_copy</span>
                  Copy
                </button>
              </div>
              <pre className="text-slate-900 dark:text-slate-100 select-all overflow-x-auto font-medium">
{`curl -X GET "https://api.fastfleet.io/v1/telemetry/live" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json"`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
