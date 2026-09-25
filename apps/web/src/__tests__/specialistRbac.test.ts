import { describe, it, expect } from 'vitest';

export interface NavItem {
  icon: string;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard', label: 'ติดตามพิกัดสด', path: '/admin/dashboard' },
  { icon: 'route', label: 'ดูเส้นทางย้อนหลัง', path: '/admin/playback' },
  { icon: 'calendar_month', label: 'ปฏิทินแผนงาน', path: '/admin/schedule' },
  { icon: 'task_alt', label: 'ประวัติและรายงาน', path: '/admin/history' },
  { icon: 'groups', label: 'ทีมการตลาด', path: '/admin/drivers', adminOnly: true },
  { icon: 'monitoring', label: 'รายงานและวิเคราะห์', path: '/admin/reports', adminOnly: true },
  { icon: 'settings', label: 'ตั้งค่าระบบ', path: '/admin/settings', adminOnly: true },
];

export function getVisibleNavItems(role: 'admin' | 'specialist'): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => !(role === 'specialist' && item.adminOnly));
}

export function shouldRedirectSpecialistRoute(role: 'admin' | 'specialist', pathname: string): boolean {
  if (role !== 'specialist') return false;
  const adminOnlyPaths = ['/admin/drivers', '/admin/reports', '/admin/settings'];
  return adminOnlyPaths.some((p) => pathname.startsWith(p));
}

export function filterTripsForRole(
  trips: Array<{ id: string; staff_id: string; title: string }>,
  role: 'admin' | 'specialist',
  currentUserId: string
) {
  if (role === 'specialist') {
    return trips.filter((t) => t.staff_id === currentUserId);
  }
  return trips;
}

export function canReviewAndApproveTrips(role: 'admin' | 'specialist'): boolean {
  return role === 'admin';
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

  it('TC-RBAC-05: Specialist cannot approve or reject trips (manager audit action is Admin only)', () => {
    expect(canReviewAndApproveTrips('specialist')).toBe(false);
    expect(canReviewAndApproveTrips('admin')).toBe(true);
  });
});
