import { isDgRole, parseRoleId, type RoleId } from '@/lib/dg/role-ids';
import { dgRoleLabel } from '@/lib/dg/role-labels';
import { PERMISSION_CATALOG } from '@/lib/dg/permission-catalog';
import { getRolesPermissionsAdmin } from '@/lib/services/role-permissions-admin';

export type AssignableRoleOption = {
  id: RoleId;
  label: string;
  archived: boolean;
  isCustom: boolean;
};

/** Rôles actifs (non archivés) proposés à la création / édition d'utilisateur. */
export async function listAssignableRoles(): Promise<AssignableRoleOption[]> {
  const data = await getRolesPermissionsAdmin();
  return data.roles
    .filter((r) => !r.archived)
    .map((r) => ({
      id: r.id as RoleId,
      label: r.label,
      archived: r.archived,
      isCustom: r.isCustom,
    }));
}

export async function validateAssignableRoleId(raw: string): Promise<RoleId | null> {
  const roleId = parseRoleId(raw.trim());
  if (!roleId) return null;
  const active = await listAssignableRoles();
  return active.some((r) => r.id === roleId) ? roleId : null;
}

/** Autorise le rôle actuel d'un utilisateur même s'il n'est plus assignable (ex. archivé). */
export async function resolveRoleForUserUpdate(
  raw: string,
  currentRoleId: RoleId | null | undefined
): Promise<RoleId | null> {
  const roleId = parseRoleId(raw.trim());
  if (!roleId) return null;
  const assignable = await validateAssignableRoleId(raw);
  if (assignable) return assignable;
  if (currentRoleId && roleId === currentRoleId) return roleId;
  return null;
}

export async function buildRoleLabelMap(): Promise<Record<string, string>> {
  const data = await getRolesPermissionsAdmin();
  const map: Record<string, string> = {};
  for (const r of data.roles) {
    map[r.id] = r.label;
  }
  return map;
}

export function roleDisplayLabel(roleId: string, labels?: Record<string, string>): string {
  if (labels?.[roleId]) return labels[roleId];
  if (isDgRole(roleId)) return dgRoleLabel(roleId);
  return roleId;
}

/** Libellés des permissions actives pour un rôle (matrice persistée). */
export async function activePermissionLabelsForRole(roleId: RoleId): Promise<string[]> {
  const data = await getRolesPermissionsAdmin();
  const map = data.permissions[roleId];
  if (!map) {
    if (isDgRole(roleId)) {
      const { permissionsForRole } = await import('@/lib/dg/role-permissions');
      return permissionsForRole(roleId);
    }
    return [];
  }
  return PERMISSION_CATALOG.filter((p) => map[p.id]).map((p) => p.label);
}
