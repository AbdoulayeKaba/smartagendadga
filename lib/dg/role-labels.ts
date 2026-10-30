import type { DgRole } from '@/lib/dg/rbac';

export const DG_ROLE_LABELS: Record<DgRole, string> = {
  ASSISTANT: 'Assistante du DGA',
  DG: 'DGA',
  MANAGER: 'Manager',
  EXTERNAL: 'Utilisateur externe',
};

export function dgRoleLabel(role: DgRole): string {
  return DG_ROLE_LABELS[role] ?? role;
}

export function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? '';
  const b = lastName.trim()[0] ?? '';
  return (a + b).toUpperCase() || '?';
}
