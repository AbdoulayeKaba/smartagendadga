import type { DgRole } from '@/lib/dg/rbac';

export type WorkspaceModule =
  | 'dashboard'
  | 'tasks'
  | 'decisions'
  | 'mail'
  | 'contacts'
  | 'audiences'
  | 'invitations'
  | 'missions'
  | 'hotel-reservations'
  | 'deadlines'
  | 'documents';

const ASSISTANT_MODULES: WorkspaceModule[] = [
  'dashboard',
  'tasks',
  'decisions',
  'mail',
  'contacts',
  'audiences',
  'invitations',
  'missions',
  'hotel-reservations',
  'deadlines',
  'documents',
];

const DG_READ_MODULES: WorkspaceModule[] = [
  'dashboard',
  'tasks',
  'decisions',
  'audiences',
  'missions',
  'hotel-reservations',
  'documents',
];

export function canAccessAssistantWorkspace(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}

export function canManageWorkspace(role: DgRole) {
  return role === 'ASSISTANT';
}

export function canAccessWorkspaceModule(role: DgRole, module: WorkspaceModule) {
  if (!canAccessAssistantWorkspace(role)) return false;
  if (role === 'ASSISTANT') return ASSISTANT_MODULES.includes(module);
  return DG_READ_MODULES.includes(module);
}

export function canExportWorkspace(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}
