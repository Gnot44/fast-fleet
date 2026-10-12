import { describe, it, expect } from 'vitest';

export type AppRole = 'admin' | 'manager' | 'specialist';

export interface NavItem {
  icon: string;
  label: string;
  path: string;
  allowedRoles?: AppRole[];
  adminOnly?: boolean;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard', label: 'ติดตามพิกัดสด', path: '/admin/dashboard', allowedRoles: ['admin', 'manager', 'specialist'] },
  { icon: 'route', label: 'ดูเส้นทางย้อนหลัง', path: '/admin/playback', allowedRoles: ['admin', 'manager', 'specialist'] },
  { icon: 'calendar_month', label: 'ปฏิทินแผนงาน', path: '/admin/schedule', allowedRoles: ['admin', 'manager', 'specialist'] },
  { icon: 'task_alt', label: 'ประวัติและรายงาน', path: '/admin/history', allowedRoles: ['admin', 'manager', 'specialist'] },
  { icon: 'groups', label: 'ทีมการตลาด', path: '/admin/drivers', allowedRoles: ['admin', 'manager'], adminOnly: true },
  { icon: 'monitoring', label: 'รายงานและวิเคราะห์', path: '/admin/reports', allowedRoles: ['admin', 'manager'], adminOnly: true },
  { icon: 'settings', label: 'ตั้งค่าระบบ', path: '/admin/settings', allowedRoles: ['admin'], adminOnly: true },
];

export function getVisibleNavItems(role: AppRole): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => {
    if (item.allowedRoles) return item.allowedRoles.includes(role);
    return !(role === 'specialist' && item.adminOnly);
  });
}

export function shouldRedirectSpecialistRoute(role: AppRole, pathname: string): boolean {
  if (role === 'specialist') {
    const adminOnlyPaths = ['/admin/drivers', '/admin/reports', '/admin/settings'];
    return adminOnlyPaths.some((p) => pathname.startsWith(p));
  }
  if (role === 'manager') {
    const managerBlockedPaths = ['/admin/settings'];
    return managerBlockedPaths.some((p) => pathname.startsWith(p));
  }
  return false;
}

export function filterTripsForRole(
  trips: Array<{ id: string; staff_id: string; title: string }>,
  role: AppRole,
  currentUserId: string
) {
  if (role === 'specialist') {
    return trips.filter((t) => t.staff_id === currentUserId);
  }
  return trips;
}

export function canReviewAndApproveTrips(role: AppRole): boolean {
  return role === 'admin' || role === 'manager';
}

describe('Specialist RBAC & Data Isolation Tests', () => {
  it('TC-RBAC-01: Admin sees all 7 navigation items', () => {
    const adminNav = getVisibleNavItems('admin');
    expect(adminNav.length).toBe(7);
    expect(adminNav.map((n) => n.path)).toEqual([
      '/admin/dashboard',
      '/admin/playback',
      '/admin/schedule',
      '/admin/history',
      '/admin/drivers',
      '/admin/reports',
      '/admin/settings',
    ]);
  });

  it('TC-RBAC-02: Specialist sees ONLY 4 relevant items, removing Drivers, Reports, and Settings', () => {
    const specNav = getVisibleNavItems('specialist');
    expect(specNav.length).toBe(4);
    expect(specNav.map((n) => n.path)).toEqual([
      '/admin/dashboard',
      '/admin/playback',
      '/admin/schedule',
      '/admin/history',
    ]);

    // Ensure irrelevant menus are removed
    expect(specNav.some((n) => n.path === '/admin/drivers')).toBe(false);
    expect(specNav.some((n) => n.path === '/admin/reports')).toBe(false);
    expect(specNav.some((n) => n.path === '/admin/settings')).toBe(false);
  });

  it('TC-RBAC-03: Route guard intercepts Specialist visiting admin-only paths', () => {
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/drivers')).toBe(true);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/drivers/edit/123')).toBe(true);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/reports')).toBe(true);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/settings')).toBe(true);

    // Allowed paths must NOT redirect
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/dashboard')).toBe(false);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/playback')).toBe(false);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/schedule')).toBe(false);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/history')).toBe(false);
    expect(shouldRedirectSpecialistRoute('specialist', '/admin/profile')).toBe(false);

    // Admin should never be blocked
    expect(shouldRedirectSpecialistRoute('admin', '/admin/drivers')).toBe(false);
    expect(shouldRedirectSpecialistRoute('admin', '/admin/reports')).toBe(false);
    expect(shouldRedirectSpecialistRoute('admin', '/admin/settings')).toBe(false);
  });

  it('TC-RBAC-04: Specialist data isolation strictly scopes trips to current specialist ID', () => {
    const rawTrips = [
      { id: 'trip-1', staff_id: 'spec-somchai', title: 'เยี่ยมลูกค้าโซนพระราม 9' },
      { id: 'trip-2', staff_id: 'spec-malee', title: 'สำรวจตลาดอโศก' },
      { id: 'trip-3', staff_id: 'spec-somchai', title: 'ต่อสัญญาดอนเมือง' },
      { id: 'trip-4', staff_id: 'spec-thanawat', title: 'ส่งตัวอย่างสินค้าสีลม' },
    ];

    const somchaiTrips = filterTripsForRole(rawTrips, 'specialist', 'spec-somchai');
    expect(somchaiTrips.length).toBe(2);
    expect(somchaiTrips.every((t) => t.staff_id === 'spec-somchai')).toBe(true);
    expect(somchaiTrips.map((t) => t.id)).toEqual(['trip-1', 'trip-3']);

    // Admin sees all 4 trips
    const adminTrips = filterTripsForRole(rawTrips, 'admin', 'admin-id');
    expect(adminTrips.length).toBe(4);
  });

  it('TC-RBAC-05: Specialist cannot approve or reject trips (manager audit action is Admin/Manager only)', () => {
    expect(canReviewAndApproveTrips('specialist')).toBe(false);
    expect(canReviewAndApproveTrips('manager')).toBe(true);
    expect(canReviewAndApproveTrips('admin')).toBe(true);
  });

  it('TC-RBAC-06: Manager sees 6 navigation items (including Drivers & Reports, excluding Settings)', () => {
    const mgrNav = getVisibleNavItems('manager');
    expect(mgrNav.length).toBe(6);
    expect(mgrNav.map((n) => n.path)).toEqual([
      '/admin/dashboard',
      '/admin/playback',
      '/admin/schedule',
      '/admin/history',
      '/admin/drivers',
      '/admin/reports',
    ]);
    expect(mgrNav.some((n) => n.path === '/admin/settings')).toBe(false);
  });

  it('TC-RBAC-07: Route guard blocks Manager from accessing System Settings while allowing Drivers & Reports', () => {
    expect(shouldRedirectSpecialistRoute('manager', '/admin/settings')).toBe(true);
    expect(shouldRedirectSpecialistRoute('manager', '/admin/drivers')).toBe(false);
    expect(shouldRedirectSpecialistRoute('manager', '/admin/reports')).toBe(false);
    expect(shouldRedirectSpecialistRoute('manager', '/admin/dashboard')).toBe(false);
  });
});
