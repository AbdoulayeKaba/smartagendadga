/**
 * Contrôle d’accès applicatif (RBAC).
 * `hr_auditor` : lecture / exports / journal — pas de paramétrage ni borne scanner.
 */

export type AppRoleKey = 'employee' | 'hr_admin' | 'hr_auditor';

export function parseAppRole(raw: string | null | undefined): AppRoleKey {
  if (raw === 'hr_admin') return 'hr_admin';
  if (raw === 'hr_auditor') return 'hr_auditor';
  return 'employee';
}

export function isHrPrivileged(role: AppRoleKey): boolean {
  return role === 'hr_admin';
}

export function isHrFamily(role: AppRoleKey): boolean {
  return role === 'hr_admin' || role === 'hr_auditor';
}
