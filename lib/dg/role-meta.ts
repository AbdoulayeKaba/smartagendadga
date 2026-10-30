import type { DgRole } from '@/lib/dg/rbac';
import { dgRoleLabel } from '@/lib/dg/role-labels';

export type RoleMeta = {
  id: DgRole;
  label: string;
  description: string;
};

export const DG_ROLE_META: Record<DgRole, Omit<RoleMeta, 'id'>> = {
  ASSISTANT: {
    label: dgRoleLabel('ASSISTANT'),
    description: 'Administratrice du cabinet : utilisateurs, paramètres, validation des RDV.',
  },
  DG: {
    label: dgRoleLabel('DG'),
    description: 'DGA : pilotage agenda, validation et exports.',
  },
  MANAGER: {
    label: dgRoleLabel('MANAGER'),
    description: 'Manager interne : demande et suivi de rendez-vous avec le DGA.',
  },
  EXTERNAL: {
    label: dgRoleLabel('EXTERNAL'),
    description: 'Partenaire ou invité externe : demande de rendez-vous limitée.',
  },
};

export const SYSTEM_ROLES: DgRole[] = ['ASSISTANT', 'DG', 'MANAGER', 'EXTERNAL'];
