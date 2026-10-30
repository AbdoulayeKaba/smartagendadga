import type { DgRole } from '@/lib/dg/rbac';
import type { RoleId } from '@/lib/dg/role-ids';

export function isExternalWorkspace(
  roleId: RoleId | undefined,
  dgRole: DgRole | undefined
): boolean {
  return roleId === 'EXTERNAL' || dgRole === 'EXTERNAL';
}

export const EXTERNAL_NAV_ITEMS = [
  { id: 'board', label: 'Tableau de bord', href: '/appointments/board' },
  { id: 'history', label: 'Historique', href: '/dg/activity' },
  { id: 'notifications', label: 'Notifications', href: '/dg/notifications' },
] as const;

export type ExternalNavId = (typeof EXTERNAL_NAV_ITEMS)[number]['id'];

export function externalNavActiveId(pathname: string): ExternalNavId | null {
  if (pathname === '/dg/activity' || pathname.startsWith('/dg/activity/')) return 'history';
  if (pathname === '/dg/notifications' || pathname.startsWith('/dg/notifications/')) return 'notifications';
  if (pathname === '/appointments/board' || pathname.startsWith('/appointments/board/')) return 'board';
  return null;
}
