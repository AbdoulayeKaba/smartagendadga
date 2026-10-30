import type { DgRole } from '@/lib/dg/rbac';
import { hasAnyAdminMenuPermission } from '@/lib/dg/permission-catalog';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';

export function hasAnyPermission(
  permissionMap: Record<string, boolean>,
  permissionIds: string[]
): boolean {
  return permissionIds.some((id) => Boolean(permissionMap[id]));
}

/** Rôle métier effectif pour les helpers RBAC (rôles personnalisés inclus). */
export function resolveEffectiveDgRole(
  roleId: RoleId,
  permissionMap: Record<string, boolean>
): DgRole {
  if (isDgRole(roleId)) return roleId;
  if (hasAnyAdminMenuPermission(permissionMap) || permissionMap['admin.platform']) {
    return 'ASSISTANT';
  }
  if (
    permissionMap['menu.appointments_list'] ||
    permissionMap['appointments.review']
  ) {
    return 'DG';
  }
  if (permissionMap['menu.plan'] || permissionMap['appointments.request']) return 'MANAGER';
  return 'EXTERNAL';
}

/** Page d'accueil après connexion selon les permissions effectives. */
export function homePathForPermissions(permissionMap: Record<string, boolean>): string {
  if (
    hasAnyAdminMenuPermission(permissionMap) ||
    permissionMap['admin.platform'] ||
    permissionMap['menu.assistant'] ||
    permissionMap['appointments.review']
  ) {
    return '/dg/assistant';
  }
  if (permissionMap['menu.dashboard'] || permissionMap['dashboard.dg']) return '/dg/dashboard';
  if (permissionMap['menu.plan']) return '/dg/plan';
  if (permissionMap['menu.room_slots'] || permissionMap['menu.room_reservations']) {
    return '/dg/availability';
  }
  return '/appointments/board';
}
