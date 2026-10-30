import type { RoleId } from '@/lib/dg/role-ids';
import { isDgRole } from '@/lib/dg/role-ids';
import { homePathForPermissions } from '@/lib/dg/role-access';
import { getRolePermissionMap } from '@/lib/services/role-permissions-admin';
import { homePathForRole } from '@/lib/auth/home-path-for-role';

export { homePathForRole } from '@/lib/auth/home-path-for-role';

export async function homePathForRoleId(role: RoleId): Promise<string> {
  if (isDgRole(role)) return homePathForRole(role);
  const permissions = await getRolePermissionMap(role);
  return homePathForPermissions(permissions);
}
