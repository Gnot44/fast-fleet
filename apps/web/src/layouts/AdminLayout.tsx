import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLanguage, LanguageTogglePill } from '../context/LanguageContext';
import { ThemeTogglePill } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'specialist'>(getInitialRole);
  const [userProfile, setUserProfile] = useState(getInitialProfile);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      localStorage.removeItem('fastfleet_user_role');
      localStorage.removeItem('fastfleet_user_name');
      localStorage.removeItem('fastfleet_user_nick');
      localStorage.removeItem('fastfleet_user_avatar');
      navigate('/admin/login', { replace: true });
    }
  };

  // Auth Guard: verify session and keep role/profile synced with DB
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        if (isMounted) {
          setCurrentUserId(session.user.id);
          // Authoritative profile check from Supabase DB
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, full_name, nickname, role, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();

          if (prof) {
            const verifiedRole = prof.role === 'specialist' ? 'specialist' : 'admin';
            setUserRole(verifiedRole);
            setUserProfile({
              name: prof.full_name || 'Administrator',
              nickname: prof.nickname || (verifiedRole === 'specialist' ? 'Specialist' : 'Admin'),
              avatar: prof.avatar_url || undefined,
              initials: (prof.nickname || prof.full_name || 'AD').slice(0, 2).toUpperCase(),
            });
            localStorage.setItem('fastfleet_user_role', verifiedRole);
            if (prof.full_name) localStorage.setItem('fastfleet_user_name', prof.full_name);
            if (prof.nickname) localStorage.setItem('fastfleet_user_nick', prof.nickname);
            if (prof.avatar_url) localStorage.setItem('fastfleet_user_avatar', prof.avatar_url);
          }
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        if (isMounted) {
          navigate('/admin/login', { replace: true });
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        localStorage.removeItem('fastfleet_user_role');
        localStorage.removeItem('fastfleet_user_name');
        localStorage.removeItem('fastfleet_user_nick');
        localStorage.removeItem('fastfleet_user_avatar');
        navigate('/admin/login', { replace: true });
      } else if (session) {
        setCurrentUserId(session.user.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Route Protection: prevent specialist from accessing admin-only pages
  useEffect(() => {
    if (!isCheckingAuth && userRole === 'specialist') {
      const adminOnlyPaths = ['/admin/drivers', '/admin/reports', '/admin/settings'];
      if (adminOnlyPaths.some(p => location.pathname.startsWith(p))) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [isCheckingAuth, userRole, location.pathname, navigate]);

  const allNavItems = [
    { icon: 'dashboard', label: t('nav_dashboard'), path: '/admin/dashboard' },
    { icon: 'route', label: t('nav_playback'), path: '/admin/playback' },
    { icon: 'calendar_month', label: t('nav_schedule'), path: '/admin/schedule' },
    { 
      icon: 'task_alt', 
      label: userRole === 'specialist' ? (language === 'th' ? 'ประวัติและรายงาน' : 'Trip History') : t('nav_history'), 
      path: '/admin/history' 
    },
    { icon: 'groups', label: t('nav_drivers'), path: '/admin/drivers', adminOnly: true },
    { icon: 'monitoring', label: t('nav_reports'), path: '/admin/reports', adminOnly: true },
    { icon: 'settings', label: t('nav_settings'), path: '/admin/settings', adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => !(userRole === 'specialist' && item.adminOnly));

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md ring-1 ring-white/20 animate-pulse">
            FM
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            <span>Verifying authenticated session...</span>
          </div>
        </div>
      </div>
    );
  }

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
          isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
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
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
          className={`p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between transition-colors ${
            isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2' : ''
          }`}
        >
          <div
            className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
            onClick={() => navigate('/admin/profile')}
            title="View Profile"
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
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSignOut();
              }}
              title={language === 'th' ? 'ออกจากระบบ' : 'Sign Out'}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all tactile-btn cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen relative transition-all duration-300 ${
          isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        } pl-0`}
      >
        {/* TopNavBar Component */}
        <header
          className={`fixed top-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center px-3 sm:px-6 z-40 transition-all duration-300 ${
            isSidebarCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'
          }`}
        >
          {/* Left: Hamburger Menu & Search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex shrink-0 tactile-btn cursor-pointer"
              title="Open Navigation"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>

            {/* Desktop Sidebar Collapse Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all shrink-0 tactile-btn cursor-pointer"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>

            {/* Global Search Bar */}
            <div className="hidden lg:flex items-center bg-slate-100/80 dark:bg-slate-800/60 rounded-xl px-3.5 py-1.5 border border-slate-200/70 dark:border-slate-700/60 w-56 xl:w-72 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all text-xs">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 mr-2 text-[18px]">search</span>
              <input
                className="bg-transparent border-none outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 text-slate-900 dark:text-slate-100 font-medium"
                placeholder={t('header_search_placeholder')}
                type="text"
              />
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Telemetry Ping Heartbeat Status */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
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
              className="hidden sm:flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-xs bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl px-2.5 sm:px-3 py-1.5 border border-slate-200/80 dark:border-slate-700/80 transition-all tactile-btn cursor-pointer"
            >
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[17px]">calendar_month</span>
              <span className="hidden md:inline">{t('header_calendar_btn')}</span>
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

            {/* Top Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-1.5 transition-all cursor-pointer tactile-btn"
              title={language === 'th' ? 'ออกจากระบบ (Sign Out)' : 'Sign Out'}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </header>

        {/* Page Content Canvas */}
        <main className="flex-1 min-w-0 mt-16 mb-7 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 bg-white dark:bg-slate-950 pb-16">
          <Outlet context={{ userRole, userProfile, currentUserId }} />
        </main>

        {/* Footer Component */}
        <footer
          className={`fixed bottom-0 right-0 h-7 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center px-3 sm:px-6 z-30 transition-all duration-300 ${
            isSidebarCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'
          } text-[11px]`}
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
