import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, LanguageTogglePill } from '../context/LanguageContext';
import { ThemeTogglePill } from '../context/ThemeContext';

export default function AdminLogin() {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/admin/dashboard');
    }, 600);
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-50 items-center justify-center p-4 relative">
      {/* Top Floating Controls */}
      <div className="absolute top-5 right-5 flex items-center gap-2.5 z-20">
        <LanguageTogglePill />
        <ThemeTogglePill />
      </div>

      {/* Centered Card Layout */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Left Panel: Branding & Ambient Graphic */}
        <div className="hidden md:flex flex-col justify-between w-1/2 bg-gradient-to-br from-blue-900 to-indigo-950 p-10 text-white relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-black text-base shadow-md">
                FM
              </div>
              <div>
                <div className="font-black text-base tracking-tight">{t('brand_title')}</div>
                <div className="text-[11px] font-bold text-blue-300">{t('brand_subtitle')}</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 my-auto space-y-4">
            <h3 className="text-2xl font-black leading-snug">
              {language === 'th'
                ? 'ศูนย์ควบคุมและวิเคราะห์ การเข้าพบลูกค้าเรียลไทม์'
                : 'Real-Time Field Marketing & Telemetry Intelligence'}
            </h3>
            <p className="text-xs text-blue-200 leading-relaxed">
              {language === 'th'
                ? 'ติดตามพิกัดสด ตรวจรับรายงานทริป คุมงบเบิกจ่าย และวิเคราะห์ KPI ทีมการตลาดครบวงจร'
                : 'Live GPS tracking, drop check-ins, trip approvals, expense audits, and team performance intelligence.'}
            </p>
          </div>

          <div className="relative z-10 flex justify-between items-center text-xs text-blue-300 pt-4 border-t border-white/10">
            <span>FastFleet Hub v2.4</span>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-bold text-white">{t('connected_status')}</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="w-full md:w-1/2 bg-white flex flex-col p-8 sm:p-10 justify-center relative">
          <div className="w-full max-w-sm mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {language === 'th' ? 'เข้าสู่ระบบผู้ดูแล' : 'Administrator Sign In'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'th'
                  ? 'เข้าถึงศูนย์บัญชาการ FastFleet Marketing Pro'
                  : 'Access the FastFleet Marketing Intelligence Console'}
              </p>
            </div>

            {/* Phase 1 Default Account Preset Banner */}
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[11px] text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">key</span>
                  {t('profile_phase1_badge')}
                </span>
                <span className="text-[10px] text-blue-600 font-bold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                  Developer Preset
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                {language === 'th'
                  ? 'แตะปุ่มด้านล่างเพื่อใส่ข้อมูลบัญชี Admin เฟส 1 อัตโนมัติ:'
                  : 'Tap below to autofill standard Phase 1 credentials:'}
              </p>
              <button
                type="button"
                onClick={() => handleFillDemo('admin@fastfleet.io', 'FastFleet@2026')}
                className="w-full py-1.5 px-3 bg-white hover:bg-blue-100/60 rounded-xl border border-blue-300 text-primary font-mono text-[11px] font-bold text-center transition-all flex items-center justify-center gap-2"
              >
                <span>👤 admin@fastfleet.io</span>
                <span className="text-slate-400">•</span>
                <span>FastFleet@2026</span>
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === 'th' ? 'อีเมลผู้ดูแลระบบ' : 'Administrator Email'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    mail
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="admin@fastfleet.io"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === 'th' ? 'รหัสผ่าน' : 'Password'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="••••••••"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-slate-600 font-medium">{t('remember_me')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => alert(language === 'th' ? 'กรุณาติดต่อทีมพัฒนาระบบเพื่อรีเซ็ตรหัสผ่าน' : 'Please contact dev ops to reset password')}
                  className="text-primary font-bold hover:underline"
                >
                  {language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}
                </button>
              </div>

              <button
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex justify-center items-center gap-2"
                type="submit"
              >
                {loading
                  ? (language === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing In...')
                  : (language === 'th' ? 'เข้าสู่ระบบผู้ดูแล' : 'Sign In to Portal')}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
