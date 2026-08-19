import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AdminProfile() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'permissions' | 'preferences'>('personal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: language === 'th' ? 'สมศักดิ์ วิจิตรการ' : 'Somsak Wijitkarn',
    employeeId: 'ADM-MKT-01',
    email: 'admin@fastfleet.io',
    phone: '081-888-9999',
    department: language === 'th' ? 'ฝ่ายการตลาดและบริหารงานภาคสนาม' : 'Field Marketing Operations',
    role: language === 'th' ? 'ผู้ดูแลระบบสูงสุด (Marketing Operations Lead)' : 'Lead Operations Administrator',
    location: language === 'th' ? 'อาคารสำนักงานใหญ่ พระราม 9 ชั้น 18' : 'Headquarters Tower, Rama 9 (18th Fl.)',
  });

  // Password State
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirmPass: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(t('profile_pwd_updated_toast'));
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.newPass || !passwords.confirmPass) {
      showToast(language === 'th' ? 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน' : 'Please fill in new password fields');
      return;
    }
    if (passwords.newPass !== passwords.confirmPass) {
      showToast(language === 'th' ? 'รหัสผ่านใหม่ไม่ตรงกัน' : 'New passwords do not match');
      return;
    }
    setPasswords({ current: '', newPass: '', confirmPass: '' });
    showToast(language === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จ!' : 'Password updated successfully!');
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(false);
    navigate('/admin/login');
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <span className="material-symbols-outlined text-[24px]">logout</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {language === 'th' ? 'ออกจากระบบผู้ดูแลหรือไม่?' : 'Sign out of Administrator Portal?'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {language === 'th'
                  ? 'คุณต้องการสิ้นสุดการทำงานเซสชันปัจจุบันและกลับไปยังหน้าล็อกอินใช่หรือไม่?'
                  : 'Are you sure you want to end your current session and return to the login screen?'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                {language === 'th' ? 'ยืนยันออกจากระบบ' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Status Badge */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden bg-slate-100 flex items-center justify-center">
                <img
                  alt={formData.fullName}
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCw2A56zCCL7L7w91BaGyMaoQ4OfZB9p0aAjBKzWFbN-6V77aCn-DXTGsVs4-5EnF8IO90J19J5nA9bpgN4Y805kpEpaFZWo7jboptf_5xNah4zgQytaGvIB1Xxf0ShBOyvFGFfQinno60jb8NIwy1mhW5OAPy7z1-Tb7qyDzsF44_LhYs-LVJK-Dh3PmyaXxP5gRuuHAfLU_4cACcXx0HITAyT8S89MJogEJv6qyQj_9FnuNz39U_hifGUzDmsgRliQMrfIxJx0hU"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"></span>
            </div>

            {/* Profile Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {formData.fullName}
                </h1>
                <span className="bg-blue-50 text-primary font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] border border-blue-200">
                  <span className="material-symbols-outlined text-[13px]">verified_user</span>
                  {formData.role}
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {formData.employeeId}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-3">{formData.department}</p>

              {/* Sub-header info badges */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">mail</span>
                  <span className="font-mono text-slate-700">{formData.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">call</span>
                  <span>{formData.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                  <span>{formData.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Sign Out CTA */}
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>{language === 'th' ? 'ออกจากระบบ' : 'Sign Out'}</span>
          </button>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="flex border-t border-slate-200 px-6 overflow-x-auto scrollbar-hide bg-slate-50/50">
          {[
            { key: 'personal', label: t('profile_personal_tab'), icon: 'person' },
            { key: 'security', label: t('profile_security_tab'), icon: 'lock_reset' },
            { key: 'permissions', label: t('profile_permissions_tab'), icon: 'admin_panel_settings' },
            { key: 'preferences', label: t('profile_preferences_tab'), icon: 'palette' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Personal Details */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
              {t('profile_personal_tab')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'th' ? 'ข้อมูลส่วนตัวผู้ดูแลระบบและการติดต่อ' : 'Administrative contact and account information'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_fullname')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_employee_id')}</label>
              <input
                type="text"
                value={formData.employeeId}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_phone')}</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_department')}</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_location')}</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{t('btn_save_changes')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Notice */}
          <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[20px]">shield_lock</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-primary">{t('profile_security_tab')}</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                    Supabase Auth Protected
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {language === 'th'
                    ? 'ระบบความปลอดภัยและการเข้ารหัสรหัสผ่านได้รับการจัดการผ่าน Supabase Authentication มาตรฐานระดับสากล'
                    : 'System security and password encryption are managed through enterprise-grade Supabase Authentication.'}
                </p>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleUpdatePassword} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">key</span>
                {t('profile_security_tab')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'th' ? 'เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชีผู้ดูแล' : 'Update your administrator password'}
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_current_pwd')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_new_pwd')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwords.newPass}
                  onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('profile_confirm_pwd')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwords.confirmPass}
                  onChange={(e) => setPasswords({ ...passwords, confirmPass: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPwdToggle"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="showPwdToggle" className="text-xs text-slate-600 font-medium cursor-pointer">
                  {language === 'th' ? 'แสดงรหัสผ่าน' : 'Show passwords'}
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                <span>{t('profile_update_pwd_btn')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Roles & Permissions */}
      {activeTab === 'permissions' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
              {t('profile_perms_title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('profile_perms_desc')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: language === 'th' ? 'ติดตามพิกัดสด & แผนที่เรียลไทม์' : 'Live Tracking & Route Inspection',
                desc: language === 'th' ? 'สิทธิ์ดูพิกัด GPS ความเร็ว แบตเตอรี่ และเส้นทางพนักงานการตลาดทุกคน' : 'Access real-time specialist GPS telemetry and next client destinations.',
                icon: 'navigation',
                granted: true,
              },
              {
                title: language === 'th' ? 'ตรวจรับรายงาน & อนุมัติเบิกจ่าย' : 'Trip Approvals & Expense Reimbursements',
                desc: language === 'th' ? 'สิทธิ์ตรวจรูปถ่ายหน้างาน สลิป และสั่งส่งกลับแก้ไขหรืออนุมัติทริป' : 'Review drop confirmations, slips, and reject/approve visit reports.',
                icon: 'task_alt',
                granted: true,
              },
              {
                title: language === 'th' ? 'จัดการบัญชีพนักงานทีมการตลาด' : 'Marketing Specialists Management',
                desc: language === 'th' ? 'สิทธิ์เพิ่ม แก้ไข ระงับการใช้งาน และกำหนดโซนพื้นที่รับผิดชอบ' : 'Create, edit, and provision field team mobile login accounts.',
                icon: 'groups',
                granted: true,
              },
              {
                title: language === 'th' ? 'สรุปรายงานและวิเคราะห์ KPI' : 'Reports & Analytics Intelligence',
                desc: language === 'th' ? 'สิทธิ์ดูสถิติวาระการเข้าพบ ระยะทาง ค่าใช้จ่าย และ Export CSV' : 'Analyze visit agendas, costs, distances, and export audit datasets.',
                icon: 'monitoring',
                granted: true,
              },
              {
                title: language === 'th' ? 'ปรับแต่ง GPS Diff & Anti-Drift Engine' : 'GPS Diff & Anti-Drift Engine Tuning',
                desc: language === 'th' ? 'สิทธิ์ตั้งค่าเกณฑ์ความเร็ว รัศมีจับพิกัด และตัวกรองสัญญาณแกว่ง' : 'Tune smartphone tracking sensitivity, static radius, and drop filters.',
                icon: 'tune',
                granted: true,
              },
              {
                title: language === 'th' ? 'บริหารจัดการระบบและข้อมูลบริษัท' : 'System Configuration & Company Info',
                desc: language === 'th' ? 'สิทธิ์ตั้งชื่อองค์กร เขตเวลา และนโยบายความปลอดภัย' : 'Configure company operating hours, timezone, and global settings.',
                icon: 'settings_suggest',
                granted: true,
              },
            ].map((perm, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">{perm.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{perm.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Preferences (Language & Theme) */}
      {activeTab === 'preferences' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
              {t('profile_preferences_tab')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'th' ? 'ปรับแต่งภาษาและธีมการแสดงผลของหน้าผู้ดูแล' : 'Configure display language and dark theme'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Language Selection */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="material-symbols-outlined text-primary text-[18px]">language</span>
                <span>{language === 'th' ? 'ภาษาที่ใช้แสดงผล' : 'Display Language'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('th');
                    showToast('เปลี่ยนเป็นภาษาไทยเรียบร้อย');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    language === 'th'
                      ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-lg">🇹🇭</span>
                  <span className="font-bold text-xs">ภาษาไทย (TH)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    showToast('Language switched to English');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    language === 'en'
                      ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-lg">🇬🇧</span>
                  <span className="font-bold text-xs">English (EN)</span>
                </button>
              </div>
            </div>

            {/* Theme Mode Selection */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="material-symbols-outlined text-primary text-[18px]">dark_mode</span>
                <span>{language === 'th' ? 'ธีมการแสดงผล' : 'Appearance Theme'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'light', label: language === 'th' ? 'สว่าง' : 'Light', icon: 'light_mode' },
                  { key: 'dark', label: language === 'th' ? 'มืด' : 'Dark', icon: 'dark_mode' },
                  { key: 'system', label: language === 'th' ? 'ตามระบบ' : 'System', icon: 'desktop_windows' },
                ].map((thm) => (
                  <button
                    key={thm.key}
                    type="button"
                    onClick={() => {
                      setTheme(thm.key as any);
                      showToast(`Theme: ${thm.label}`);
                    }}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      theme === thm.key
                        ? 'border-primary bg-blue-50/70 text-primary ring-2 ring-primary/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{thm.icon}</span>
                    <span className="font-bold text-xs">{thm.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
