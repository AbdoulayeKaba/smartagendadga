import { NextResponse } from 'next/server';
import type { ServerSessionContext } from './session-server';
import type { AppRoleKey } from './rbac';
import { parseAppRole } from './rbac';

export type AppPermission =
  | 'employees.read'
  | 'employees.write'
  | 'holidays.read'
  | 'holidays.write'
  | 'leaves.read'
  | 'leaves.write'
  | 'leaves.submit'
  | 'leaves.approve'
  | 'locations.read'
  | 'locations.write'
  | 'dashboard.read'
  | 'attendance.export'
  | 'scanner.use'
  | 'audit.read';

const EMPLOYEE_PERMS: AppPermission[] = ['leaves.read', 'leaves.submit', 'locations.read'];

const AUDITOR_PERMS: AppPermission[] = [
  'employees.read',
  'holidays.read',
  'leaves.read',
  'locations.read',
  'dashboard.read',
  'attendance.export',
  'audit.read',
];

const HR_PERMS: AppPermission[] = [
  ...AUDITOR_PERMS,
  'employees.write',
  'holidays.write',
  'leaves.write',
  'leaves.approve',
  'locations.write',
  'scanner.use',
];

export function resolvePermissions(appRole: AppRoleKey): AppPermission[] {
  if (appRole === 'hr_admin') return HR_PERMS;
  if (appRole === 'hr_auditor') return AUDITOR_PERMS;
  return EMPLOYEE_PERMS;
}

export function hasPermission(
  ctx: Pick<ServerSessionContext, 'appRole'> | null,
  permission: AppPermission
): boolean {
  if (!ctx) return false;
  return resolvePermissions(ctx.appRole).includes(permission);
}

/** À partir du JWT / credential brute (ex: ancienne valeur). */
export function permissionsFromRawRole(raw: string | null | undefined): AppPermission[] {
  return resolvePermissions(parseAppRole(raw));
}

export function permissionDeniedResponse() {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}
