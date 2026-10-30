import type { DgRole } from '@/lib/dg/rbac';
import { isCustomRoleId, isDgRole } from '@/lib/dg/role-ids';

/** État minimal partagé entre le stockage réel et le mock. */
export type RoleTrashRecord = {
  archived: string[];
  purged: DgRole[];
  permissions: Record<string, Record<string, boolean>>;
  descriptions: Partial<Record<DgRole, string>>;
  labels: Partial<Record<DgRole, string>>;
  customRoles: { id: string }[];
};

export function sanitizePurgedRoleIds(raw: unknown): DgRole[] {
  if (!Array.isArray(raw)) return [];
  const ids: DgRole[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !isDgRole(id) || id === 'ASSISTANT') continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Retire un rôle de la corbeille sans le remettre dans la liste active.
 * Un rôle système est masqué via `purged`. Un rôle personnalisé est supprimé.
 */
export function purgeTrashedRole(
  record: RoleTrashRecord,
  roleId: string
): 'purged' | 'protected' | 'unknown' {
  if (roleId === 'ASSISTANT') return 'protected';

  record.archived = record.archived.filter((id) => id !== roleId);

  if (isCustomRoleId(roleId)) {
    record.customRoles = record.customRoles.filter((role) => role.id !== roleId);
    delete record.permissions[roleId];
    return 'purged';
  }

  if (!isDgRole(roleId)) return 'unknown';

  if (!record.purged.includes(roleId)) record.purged.push(roleId);
  delete record.descriptions[roleId];
  delete record.labels[roleId];
  return 'purged';
}
