import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLanguage, LanguageTogglePill } from '../context/LanguageContext';
import { ThemeTogglePill } from '../context/ThemeContext';

export default function AdminLayout() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { icon: 'dashboard', label: t('nav_dashboard'), path: '/admin/dashboard' },
    { icon: 'calendar_month', label: t('nav_schedule'), path: '/admin/schedule' },
    { icon: 'task_alt', label: t('nav_history'), path: '/admin/history' },
    { icon: 'groups', label: t('nav_drivers'), path: '/admin/drivers' },
    { icon: 'monitoring', label: t('nav_reports'), path: '/admin/reports' },
    { icon: 'settings', label: t('nav_settings'), path: '/admin/settings' },
  ];

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="bg-background text-on-surface font-body-md antialiased h-screen overflow-hidden flex">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SideNavBar Component (Desktop Fixed + Mobile Slide-out Drawer) */}
      <nav
        className={`fixed top-0 left-0 h-full bg-surface-container-lowest border-r border-outline-variant flex flex-col z-50 transition-all duration-300 ${
          isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } ${
          isSidebarCollapsed ? 'md:w-sidebar-collapsed' : 'md:w-sidebar-expanded'
        }`}
      >
        {/* Brand Logo & Mobile Close */}
        <div className="px-5 py-5 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isSidebarCollapsed || isMobileMenuOpen ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                  FM
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900 leading-tight">{t('brand_title')}</div>
                  <div className="text-[10px] font-bold text-primary">{t('brand_subtitle')}</div>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold text-xs shadow-xs mx-auto">
                FM
              </div>
            )}
          </div>

          {/* Close button on mobile drawer */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-body-md text-xs font-bold ${
                  isActive
                    ? 'text-primary bg-blue-50/80 shadow-2xs'
                    : 'text-slate-600 hover:text-primary hover:bg-slate-50'
                } ${isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center px-2' : ''}`
              }
              title={item.label}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                {item.icon}
              </span>
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Admin Profile Footer in Sidebar */}
        <div
          className={`p-3.5 border-t border-outline-variant flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
            isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center' : ''
          }`}
          onClick={() => navigate('/admin/profile')}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden border border-slate-200 shrink-0 font-bold text-xs">
            SW
          </div>
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-slate-900 truncate">
                {language === 'th' ? 'สมศักดิ์ วิจิตรการ' : 'Somsak W.'}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {t('role_admin')}
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col h-screen relative transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-sidebar-expanded'
        } ml-0`}
      >
        {/* TopNavBar Component */}
        <header
          className={`fixed top-0 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-4 sm:px-6 z-40 transition-all duration-300 ${
            isSidebarCollapsed ? 'md:w-[calc(100%-72px)]' : 'md:w-[calc(100%-240px)]'
          } w-full`}
        >
          {/* Left: Hamburger Menu & Search */}
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-all flex shrink-0"
              title="Open Navigation"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>

            {/* Desktop Sidebar Collapse Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>

            {/* Global Search Bar */}
            <div className="hidden sm:flex items-center bg-slate-100/80 rounded-xl px-3.5 py-1.5 border border-slate-200 w-64 md:w-80 focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all text-xs">
              <span className="material-symbols-outlined text-slate-400 mr-2 text-[18px]">search</span>
              <input
                className="bg-transparent border-none outline-none w-full placeholder:text-slate-400 p-0 text-slate-900 font-medium"
                placeholder={t('header_search_placeholder')}
                type="text"
              />
            </div>
          </div>

          {/* Right Header Controls with Global Language & Theme Toggles */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Language Toggle Switcher */}
            <LanguageTogglePill />

            {/* Global Dark/Light Mode Switcher */}
            <ThemeTogglePill />

            <button
              onClick={() => (window.location.href = '/admin/schedule')}
              className="hidden lg:flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <span className="material-symbols-outlined text-primary text-[16px]">calendar_month</span>
              {t('header_calendar_btn')}
            </button>

            {/* Notifications */}
            <button
              className="text-slate-600 hover:bg-slate-100 rounded-xl p-2 transition-all relative"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            </button>

            {/* Profile Avatar */}
            <img
              alt="User Avatar"
              className="w-8 h-8 rounded-full border border-slate-200 object-cover cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all ml-1"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnZHPiyrEU89_d8Y-NwwO4oVoBKTYyDFZrQYiomlg421u_lnI-Wsm8OQjaUmItepgXWrEGKg3wzLelE_Mq9zycXpXV7NhzlbNFHFr9Mo1SBWxVDDcljaqvasXMGHt9UN6jFGIYiNlH5oOLbtIrxMfjaIbZgG1AnRO33Be2aYLn04FMA-4YJXyuMqHgGYFDoUyI7DHjdR9BIyzCQUtv0c-_W0HZbKySa6eTZm97BFiIWto5BUVexeqPli_uywL82Iky9wg8sEuMfOc"
              onClick={() => navigate('/admin/profile')}
            />
          </div>
        </header>

        {/* Page Content Canvas */}
        <main className="flex-1 mt-16 mb-8 overflow-y-auto p-3 sm:p-5 lg:p-6 bg-slate-50/50 pb-20">
          <Outlet />
        </main>

        {/* Footer Component */}
        <footer
          className={`fixed bottom-0 right-0 h-8 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant flex justify-between items-center px-4 sm:px-6 z-30 transition-all duration-300 ${
            isSidebarCollapsed ? 'md:w-[calc(100%-72px)]' : 'md:w-[calc(100%-240px)]'
          } w-full text-[11px]`}
        >
          <span className="text-slate-500 font-medium truncate">
            {t('brand_title')} • {t('data_refresh')} {new Date().toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-2 font-bold text-emerald-700 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t('connected_status')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
