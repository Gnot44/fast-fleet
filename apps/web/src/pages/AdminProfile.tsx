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
    nickname: 'ศักดิ์',
    employeeId: 'ADM-MKT-01',
    email: 'admin@fastfleet.io',
    phone: '081-888-9999',
    department: language === 'th' ? 'ฝ่ายการตลาดและบริหารงานภาคสนาม' : 'Field Marketing Operations',
    position: language === 'th' ? 'หัวหน้าฝ่ายการตลาดภาคสนาม' : 'Lead Operations',
    role: 'admin',
    roleTitle: language === 'th' ? 'ผู้ดูแลระบบสูงสุด (Marketing Operations Lead)' : 'Lead Operations Administrator',
    location: language === 'th' ? 'อาคารสำนักงานใหญ่ พระราม 9 ชั้น 18' : 'Headquarters Tower, Rama 9 (18th Fl.)',
    territory: language === 'th' ? 'กรุงเทพมหานครและปริมณฑล' : 'Bangkok & Vicinity',
    vehiclePlate: '1กข-4452 กทม.',
    vehicleModel: 'Isuzu D-Max SpaceCab 1.9 Ddi',
    avatarUrl: '',
  });

  const isLoading = false;
  const initials = formData.nickname ? formData.nickname.slice(0, 2).toUpperCase() : 'AD';

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
        <div className="fixed top-20 right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/60">
                <span className="material-symbols-outlined text-[24px]">logout</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {language === 'th' ? 'ออกจากระบบหรือไม่?' : 'Sign out of Portal?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {language === 'th'
                  ? 'คุณต้องการสิ้นสุดการทำงานเซสชันปัจจุบันและกลับไปยังหน้าล็อกอินใช่หรือไม่?'
                  : 'Are you sure you want to end your current session and return to the login screen?'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer tactile-btn"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer tactile-btn"
              >
                {language === 'th' ? 'ยืนยันออกจากระบบ' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Status Badge */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-2xl">
                {formData.avatarUrl ? (
                  <img
                    alt={formData.fullName}
                    className="w-full h-full object-cover"
                    src={formData.avatarUrl}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs"></span>
            </div>

            {/* Profile Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isLoading ? 'กำลังโหลดข้อมูล...' : formData.fullName}
                </h1>
                {formData.nickname && (
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    ({formData.nickname})
                  </span>
                )}
                <span className={`font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] border ${
                  formData.role === 'specialist'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <span className="material-symbols-outlined text-[13px]">
                    {formData.role === 'specialist' ? 'badge' : 'verified_user'}
                  </span>
                  {formData.roleTitle}
                </span>
                {formData.employeeId && (
                  <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {formData.employeeId}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                {formData.position ? `${formData.position} • ` : ''}{formData.department}
              </p>

              {/* Sub-header info badges */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">mail</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formData.email}</span>
                </div>
                {formData.phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">call</span>
                    <span className="text-slate-700 dark:text-slate-300">{formData.phone}</span>
                  </div>
                )}
                {formData.location && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                    <span className="truncate max-w-xs text-slate-700 dark:text-slate-300">{formData.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Sign Out CTA */}
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer tactile-btn"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>{language === 'th' ? 'ออกจากระบบ' : 'Sign Out'}</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-200/80 dark:border-slate-800 px-6 overflow-x-auto scrollbar-hide bg-slate-50/50 dark:bg-slate-800/40">
          {[
            { key: 'personal', label: t('profile_personal_tab'), icon: 'person' },
            { key: 'security', label: t('profile_security_tab'), icon: 'lock_reset' },
            { key: 'permissions', label: t('profile_permissions_tab'), icon: 'admin_panel_settings' },
            { key: 'preferences', label: t('profile_preferences_tab'), icon: 'palette' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer tactile-btn ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
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
        <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">badge</span>
              {t('profile_personal_tab')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'th' ? 'ข้อมูลส่วนตัวผู้ใช้งานและการติดต่อ' : 'User contact and account information'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_fullname')}</label>
              <input
                type="text"
                value={formData.fullName ?? ''}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{language === 'th' ? 'ชื่อเล่น' : 'Nickname'}</label>
              <input
                type="text"
                value={formData.nickname ?? ''}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_employee_id')}</label>
              <input
                type="text"
                value={formData.employeeId ?? ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_email')}</label>
              <input
                type="email"
                value={formData.email ?? ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_phone')}</label>
              <input
                type="text"
                value={formData.phone ?? ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_department')}</label>
              <input
                type="text"
                value={formData.department ?? ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            {formData.territory && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{language === 'th' ? 'พื้นที่รับผิดชอบ (Territory)' : 'Assigned Territory'}</label>
                <input
                  type="text"
                  value={formData.territory}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            )}

            {formData.vehiclePlate && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{language === 'th' ? 'ยานพาหนะที่ได้รับมอบหมาย' : 'Assigned Vehicle'}</label>
                <input
                  type="text"
                  value={`${formData.vehicleModel} (${formData.vehiclePlate})`}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer tactile-btn"
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
          <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[20px]">shield_lock</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400">{t('profile_security_tab')}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                    Supabase Auth Protected
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {language === 'th'
                    ? 'ระบบความปลอดภัยและการเข้ารหัสรหัสผ่านได้รับการจัดการผ่าน Supabase Authentication มาตรฐานความปลอดภัยระดับสากล'
                    : 'System security and password encryption are managed through enterprise-grade Supabase Authentication.'}
                </p>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleUpdatePassword} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-6">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">key</span>
                {t('profile_security_tab')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'th' ? 'เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชีผู้ใช้งาน' : 'Update your account password'}
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_new_pwd')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwords.newPass ?? ''}
                  onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('profile_confirm_pwd')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwords.confirmPass ?? ''}
                  onChange={(e) => setPasswords({ ...passwords, confirmPass: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPwdToggle"
                  checked={Boolean(showPassword)}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="showPwdToggle" className="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer">
                  {language === 'th' ? 'แสดงรหัสผ่าน' : 'Show passwords'}
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer tactile-btn"
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
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">verified_user</span>
              {t('profile_perms_title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formData.role === 'specialist'
                ? (language === 'th' ? 'สิทธิ์การเข้าถึงสำหรับพนักงานการตลาดภาคสนาม (Marketing Specialist)' : 'Permissions for Field Marketing Specialist')
                : t('profile_perms_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(formData.role === 'specialist'
              ? [
                  {
                    title: language === 'th' ? 'ตารางงาน & จุดเข้าพบลูกค้า' : 'Schedule & Client Visits',
                    desc: language === 'th' ? 'เข้าถึงปฏิทินงาน รายชื่อนัดหมาย และรายละเอียดลูกค้าประจำวัน' : 'Access scheduled visits, client contacts, and agenda notes.',
                    icon: 'calendar_month',
                  },
                  {
                    title: language === 'th' ? 'เช็คอิน & บันทึกเลขไมล์ (Odometer)' : 'Check-in & Odometer Logging',
                    desc: language === 'th' ? 'บันทึกเวลาเข้าพบ ถ่ายรูปเลขไมล์ และบันทึกผลการประชุม' : 'Record check-in time, odometer readings, and meeting minutes.',
                    icon: 'speed',
                  },
                  {
                    title: language === 'th' ? 'บันทึกเบิกค่าใช้จ่าย & แนบสลิป' : 'Expense Claims & Receipts',
                    desc: language === 'th' ? 'ส่งเบิกค่าน้ำมัน ค่าทางด่วน ค่ารับรอง และอัปโหลดรูปใบเสร็จ' : 'Submit fuel, toll, meal expenses with receipt photo attachments.',
                    icon: 'receipt_long',
                  },
                  {
                    title: language === 'th' ? 'ส่งรายงานทริปเพื่อขออนุมัติ' : 'Trip Approval Submission',
                    desc: language === 'th' ? 'สรุปผลการเดินทางและส่งทริปให้หัวหน้างานตรวจสอบอนุมัติ' : 'Submit completed trips for manager review and approval.',
                    icon: 'task_alt',
                  },
                  {
                    title: language === 'th' ? 'ประวัติงานและส่งออกรายงาน Excel' : 'History & Excel Export',
                    desc: language === 'th' ? 'ดูประวัติการเข้าพบย้อนหลัง และส่งออกสรุปค่าใช้จ่าย/เลขไมล์' : 'View visit history and export personal expenses & odometer audit reports.',
                    icon: 'download',
                  },
                  {
                    title: language === 'th' ? 'ติดตามพิกัด GPS อัตโนมัติ' : 'Automatic GPS Tracking',
                    desc: language === 'th' ? 'บันทึกเส้นทางแบบ Background Service ระหว่างปฏิบัติหน้าที่' : 'Record real-time route telemetry during active marketing trips.',
                    icon: 'near_me',
                  },
                ]
              : [
                  {
                    title: language === 'th' ? 'ติดตามพิกัดสด & แผนที่เรียลไทม์' : 'Live Tracking & Route Inspection',
                    desc: language === 'th' ? 'สิทธิ์ดูพิกัด GPS ความเร็ว แบตเตอรี่ และเส้นทางพนักงานการตลาดทุกคน' : 'Access real-time specialist GPS telemetry and next client destinations.',
                    icon: 'navigation',
                  },
                  {
                    title: language === 'th' ? 'ตรวจรับรายงาน & อนุมัติเบิกจ่าย' : 'Trip Approvals & Expense Reimbursements',
                    desc: language === 'th' ? 'สิทธิ์ตรวจรูปถ่ายหน้างาน สลิป และสั่งส่งกลับแก้ไขหรืออนุมัติทริป' : 'Review drop confirmations, slips, and reject/approve visit reports.',
                    icon: 'task_alt',
                  },
                  {
                    title: language === 'th' ? 'จัดการบัญชีพนักงานทีมการตลาด' : 'Marketing Specialists Management',
                    desc: language === 'th' ? 'สิทธิ์เพิ่ม แก้ไข ระงับการใช้งาน และกำหนดโซนพื้นที่รับผิดชอบ' : 'Create, edit, and provision field team mobile login accounts.',
                    icon: 'groups',
                  },
                  {
                    title: language === 'th' ? 'สรุปรายงานและวิเคราะห์ KPI' : 'Reports & Analytics Intelligence',
                    desc: language === 'th' ? 'สิทธิ์ดูสถิติวาระการเข้าพบ ระยะทาง ค่าใช้จ่าย และ Export CSV' : 'Analyze visit agendas, costs, distances, and export audit datasets.',
                    icon: 'monitoring',
                  },
                  {
                    title: language === 'th' ? 'ปรับแต่ง GPS Diff & Anti-Drift Engine' : 'GPS Diff & Anti-Drift Engine Tuning',
                    desc: language === 'th' ? 'สิทธิ์ตั้งค่าเกณฑ์ความเร็ว รัศมีจับพิกัด และตัวกรองสัญญาณแกว่ง' : 'Tune smartphone tracking sensitivity, static radius, and drop filters.',
                    icon: 'tune',
                  },
                  {
                    title: language === 'th' ? 'บริหารจัดการระบบและข้อมูลบริษัท' : 'System Configuration & Company Info',
                    desc: language === 'th' ? 'สิทธิ์ตั้งชื่อองค์กร เขตเวลา และนโยบายความปลอดภัย' : 'Configure company operating hours, timezone, and global settings.',
                    icon: 'settings_suggest',
                  },
                ]
            ).map((perm, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
                <div>
                  <div className="font-extrabold text-xs text-slate-900 dark:text-white">{perm.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{perm.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Preferences (Language & Theme) */}
      {activeTab === 'preferences' && (
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">tune</span>
              {t('profile_preferences_tab')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'th' ? 'ปรับแต่งภาษาและธีมการแสดงผลของระบบ' : 'Configure display language and dark theme'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Language Selection */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">language</span>
                <span>{language === 'th' ? 'ภาษาที่ใช้แสดงผล' : 'Display Language'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('th');
                    showToast('เปลี่ยนเป็นภาษาไทยเรียบร้อย');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer tactile-btn ${
                    language === 'th'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-lg">🇹🇭</span>
                  <span className="font-extrabold text-xs">ภาษาไทย (TH)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    showToast('Language switched to English');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer tactile-btn ${
                    language === 'en'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-lg">🇬🇧</span>
                  <span className="font-extrabold text-xs">English (EN)</span>
                </button>
              </div>
            </div>

            {/* Theme Mode Selection */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">dark_mode</span>
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
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer tactile-btn ${
                      theme === thm.key
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{thm.icon}</span>
                    <span className="font-extrabold text-xs">{thm.label}</span>
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
