import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, LanguageTogglePill } from '../context/LanguageContext';
import { ThemeTogglePill } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

export default function AdminLogin() {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage(
        language === 'th'
          ? 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน'
          : 'Please enter both email and password'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Try Supabase Auth Sign In
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(
          language === 'th'
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
            : error.message || 'Invalid login credentials'
        );
        setLoading(false);
        return;
      }

      if (authData?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, role, avatar_url')
          .eq('id', authData.user.id)
          .maybeSingle();

        const role = prof?.role === 'specialist' ? 'specialist' : 'admin';
        localStorage.setItem('fastfleet_user_role', role);
        if (prof?.full_name) localStorage.setItem('fastfleet_user_name', prof.full_name);
        if (prof?.nickname) localStorage.setItem('fastfleet_user_nick', prof.nickname);
        if (prof?.avatar_url) localStorage.setItem('fastfleet_user_avatar', prof.avatar_url);

        if (role === 'specialist') {
          navigate('/admin/schedule');
          return;
        }
      } else {
        localStorage.setItem('fastfleet_user_role', 'admin');
      }

      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(
        language === 'th'
          ? 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง'
          : err?.message || 'Connection error. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="flex w-full min-h-screen bg-white dark:bg-slate-950 items-center justify-center p-4 sm:p-6 relative selection:bg-blue-600/20 selection:text-blue-600">
      {/* Top Floating Controls */}
      <div className="absolute top-5 right-5 flex items-center gap-2.5 z-20">
        <LanguageTogglePill />
        <ThemeTogglePill />
      </div>

      {/* Centered Telemetry Card Layout */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
        {/* Left Panel: Telemetry Mission Control */}
        <div className="hidden md:flex flex-col justify-between w-1/2 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-8 lg:p-10 text-white relative border-r border-slate-800/60 overflow-hidden">
          {/* Subtle Grid Ambient Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-md ring-1 ring-white/20">
                FM
              </div>
              <div>
                <div className="font-extrabold text-base tracking-tight leading-tight">{t('brand_title')}</div>
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{t('brand_subtitle')}</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 my-auto space-y-5 py-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-[11px] font-semibold text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Telematics & Fleet Operations</span>
            </div>

            <h3 className="text-2xl font-black leading-snug tracking-tight">
              {language === 'th'
                ? 'ศูนย์ควบคุม & ติดตาม พิกัดพนักงานการตลาดเรียลไทม์'
                : 'Real-Time Field Marketing & Telemetry Intelligence'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[42ch]">
              {language === 'th'
                ? 'ระบบติดตาม GPS สด ตรวจรับรายงานทริป คุมงบเบิกจ่าย และวิเคราะห์ KPI ทีมงานภาคสนามครบวงจร'
                : 'High-precision GPS tracking, drop check-ins, trip audits, expense verification, and field performance analytics.'}
            </p>

            {/* Live Telemetry Mini Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GPS Ping Rate</div>
                <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">15s Active</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Sync</div>
                <div className="text-sm font-black text-blue-400 font-mono mt-0.5">Supabase Realtime</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-800/80">
            <span className="font-mono text-[11px]">Console v2.4</span>
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-bold text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{t('connected_status')}</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="w-full md:w-1/2 bg-white dark:bg-slate-900 flex flex-col p-6 sm:p-10 justify-center relative">
          <div className="w-full max-w-sm mx-auto space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {language === 'th' ? 'เข้าสู่ระบบผู้ดูแล' : 'Administrator Sign In'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'th'
                  ? 'เข้าถึงศูนย์บัญชาการ FastFleet Marketing Intelligence'
                  : 'Access the FastFleet Marketing Intelligence Console'}
              </p>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'th' ? 'อีเมลผู้ดูแลระบบ' : 'Administrator Email'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    mail
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="admin@fastfleet.io"
                    required
                    type="email"
                    value={email ?? ''}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'th' ? 'รหัสผ่าน' : 'Password'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password ?? ''}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(rememberMe)}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{t('remember_me')}</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      language === 'th'
                        ? 'กรุณาติดต่อทีมพัฒนาระบบเพื่อรีเซ็ตรหัสผ่าน'
                        : 'Please contact DevOps to reset password'
                    )
                  }
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  {language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}
                </button>
              </div>

              <button
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex justify-center items-center gap-2 tactile-btn cursor-pointer disabled:opacity-60"
                type="submit"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>{language === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <span>{language === 'th' ? 'เข้าสู่ระบบผู้ดูแล' : 'Sign In to Portal'}</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Chips */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Quick Demo Access:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fillQuickDemo('admin@fastfleet.io', 'FastFleet@2026')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 transition-all tactile-btn"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('somchai.r@marketing.com', 'Password123!')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 transition-all tactile-btn"
                >
                  📍 Specialist
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

