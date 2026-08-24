import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLanguage, LanguageTogglePill } from '../context/LanguageContext';
import { ThemeTogglePill } from '../context/ThemeContext';

const getInitialRole = (): 'admin' | 'specialist' => {
  const cached = localStorage.getItem('fastfleet_user_role');
  if (cached === 'specialist' || cached === 'admin') return cached;
  return 'admin';
};

const getInitialProfile = () => {
  const role = getInitialRole();
  const name = localStorage.getItem('fastfleet_user_name') || (role === 'specialist' ? 'พนักงานการตลาด' : 'System Administrator');
  const nickname = localStorage.getItem('fastfleet_user_nick') || (role === 'specialist' ? 'Specialist' : 'Admin');
  const avatar = localStorage.getItem('fastfleet_user_avatar') || undefined;
  const initials = nickname ? nickname.slice(0, 2).toUpperCase() : name ? name.slice(0, 2).toUpperCase() : 'AD';
  return { name, nickname, avatar, initials };
};

export default function AdminLayout() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole] = useState<'admin' | 'specialist'>(getInitialRole);
  const [userProfile] = useState(getInitialProfile);
  const location = useLocation();

  const navItems = [
    { icon: 'dashboard', label: t('nav_dashboard'), path: '/admin/dashboard' },
    { icon: 'route', label: t('nav_playback'), path: '/admin/playback' },
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
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-body-md antialiased h-screen overflow-hidden flex selection:bg-primary/20 selection:text-primary">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SideNavBar Component (Desktop Fixed + Mobile Slide-out Drawer) */}
      <nav
        className={`fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col z-50 transition-all duration-300 shadow-sm ${
          isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } ${
          isSidebarCollapsed ? 'md:w-sidebar-collapsed' : 'md:w-sidebar-expanded'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm ring-1 ring-white/20 shrink-0">
              FM
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight leading-none truncate">
                  {t('brand_title')}
                </div>
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{t('brand_subtitle')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Close button on mobile drawer */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 tactile-btn ${
                  isActive
                    ? 'bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold border border-blue-200/80 dark:border-blue-800/60 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                } ${isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r-full"></span>
                  )}
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 transition-colors ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  {(!isSidebarCollapsed || isMobileMenuOpen) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* User Profile Footer in Sidebar */}
        <div
          className={`p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer ${
            isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2' : ''
          }`}
          onClick={() => navigate('/admin/profile')}
        >
          {userProfile.avatar ? (
            <img
              alt={userProfile.name}
              src={userProfile.avatar}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0 font-bold text-xs">
              {userProfile.initials}
            </div>
          )}
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                {userProfile.name}
              </span>
              <span className="text-[10px] font-semibold flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
                <span className={`w-1.5 h-1.5 rounded-full ${userRole === 'specialist' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                {userRole === 'specialist'
                  ? (language === 'th' ? 'พนักงานการตลาด' : 'Specialist')
                  : t('role_admin')}
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col h-screen relative transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-sidebar-collapsed' : 'md:ml-sidebar-expanded'
        } ml-0`}
      >
        {/* TopNavBar Component */}
        <header
          className={`fixed top-0 right-0 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center px-4 sm:px-6 z-40 transition-all duration-300 ${
            isSidebarCollapsed ? 'md:w-[calc(100%-76px)]' : 'md:w-[calc(100%-250px)]'
          } w-full`}
        >
          {/* Left: Hamburger Menu & Search */}
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex shrink-0 tactile-btn"
              title="Open Navigation"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>

            {/* Desktop Sidebar Collapse Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all shrink-0 tactile-btn"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>

            {/* Global Search Bar */}
            <div className="hidden sm:flex items-center bg-slate-100/80 dark:bg-slate-800/60 rounded-xl px-3.5 py-1.5 border border-slate-200/70 dark:border-slate-700/60 w-64 md:w-80 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all text-xs">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 mr-2 text-[18px]">search</span>
              <input
                className="bg-transparent border-none outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 text-slate-900 dark:text-slate-100 font-medium"
                placeholder={t('header_search_placeholder')}
                type="text"
              />
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live Telemetry Ping Heartbeat Status */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="tracking-tight font-mono">LIVE GPS</span>
            </div>

            {/* Global Language Switcher */}
            <LanguageTogglePill />

            {/* Global Dark/Light Switcher */}
            <ThemeTogglePill />

            {/* Schedule Navigation Button */}
            <button
              onClick={() => navigate('/admin/schedule')}
              className="hidden lg:flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-xs bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl px-3 py-1.5 border border-slate-200/80 dark:border-slate-700/80 transition-all tactile-btn cursor-pointer"
            >
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[17px]">calendar_month</span>
              <span>{t('header_calendar_btn')}</span>
            </button>

            {/* Notifications */}
            <button
              className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-1.5 transition-all relative cursor-pointer tactile-btn"
              title="การแจ้งเตือน (Notifications)"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-1 ring-white dark:ring-slate-900"></span>
            </button>

            {/* Profile Avatar */}
            {userProfile.avatar ? (
              <img
                alt={userProfile.name}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all ml-1"
                src={userProfile.avatar}
                onClick={() => navigate('/admin/profile')}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-blue-500 cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all ml-1"
                onClick={() => navigate('/admin/profile')}
              >
                {userProfile.initials}
              </div>
            )}
          </div>
        </header>

        {/* Page Content Canvas */}
        <main className="flex-1 mt-16 mb-7 overflow-y-auto p-3 sm:p-5 lg:p-6 bg-white dark:bg-slate-950 pb-16">
          <Outlet />
        </main>

        {/* Footer Component */}
        <footer
          className={`fixed bottom-0 right-0 h-7 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center px-4 sm:px-6 z-30 transition-all duration-300 ${
            isSidebarCollapsed ? 'md:w-[calc(100%-76px)]' : 'md:w-[calc(100%-250px)]'
          } w-full text-[11px]`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium truncate">
            <span className="truncate">
              {t('brand_title')} • {t('brand_subtitle')} © {new Date().getFullYear()} FastFleet Intelligence Hub
            </span>
          </div>
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t('connected_status')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
