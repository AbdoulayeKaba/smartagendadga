import type { DgRole } from '@/lib/dg/rbac';

export type RoleId = DgRole | `custom_${string}`;

const DG_ROLES: DgRole[] = ['ASSISTANT', 'DG', 'MANAGER', 'EXTERNAL'];

export function isDgRole(id: string): id is DgRole {
  return (DG_ROLES as string[]).includes(id);
}

export function isCustomRoleId(id: string): id is `custom_${string}` {
  return id.startsWith('custom_');
}

export function parseRoleId(raw: string): RoleId | null {
  if (isDgRole(raw)) return raw;
  if (isCustomRoleId(raw) && raw.length > 7) return raw;
  return null;
}

export function newCustomRoleId(): `custom_${string}` {
  return `custom_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
