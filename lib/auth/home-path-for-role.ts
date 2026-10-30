import type { RoleId } from '@/lib/dg/role-ids';

/** Redirection après connexion selon le rôle système (sans accès base de données). */
export function homePathForRole(role: RoleId): string {
  switch (role) {
    case 'ASSISTANT':
      return '/dg/assistant';
    case 'DG':
      return '/dg/dashboard';
    case 'MANAGER':
    case 'EXTERNAL':
      return '/appointments/board';
    default:
      return '/appointments/board';
  }
}
