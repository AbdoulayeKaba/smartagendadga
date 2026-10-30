import type { DgRole } from '@/lib/dg/rbac';

export type PermissionDefinition = {
  id: string;
  label: string;
  categoryId: string;
};

export type PermissionCategory = {
  id: string;
  label: string;
  icon?:
    | 'admin'
    | 'calendar'
    | 'appointments'
    | 'audit'
    | 'pilotage'
    | 'mon_espace'
    | 'menu'
    | 'actions'
    | 'contacts'
    | 'missions'
    | 'documents'
    | 'rooms'
    | 'users'
    | 'referentials'
    | 'settings';
};

/** Catalogue affiché dans Gestion des rôles. */
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { id: 'pilotage', label: 'Pilotage', icon: 'pilotage' },
  { id: 'mon_espace', label: 'Mon espace', icon: 'mon_espace' },
  { id: 'menu', label: 'Menu', icon: 'menu' },
  { id: 'actions', label: 'Actions rendez-vous', icon: 'actions' },
  { id: 'actions_contacts', label: 'Actions contacts stratégiques', icon: 'contacts' },
  { id: 'actions_documents', label: 'Actions compte rendu', icon: 'documents' },
  { id: 'actions_rooms', label: 'Actions réservations salles', icon: 'rooms' },
  { id: 'actions_users', label: 'Actions utilisateurs', icon: 'users' },
  { id: 'actions_referentials', label: 'Actions référentiels', icon: 'referentials' },
  { id: 'actions_settings', label: 'Actions paramètres système', icon: 'settings' },
  { id: 'administration', label: 'Administration', icon: 'admin' },
];

/** Entrées sidebar « Mon espace ». */
export const MON_ESPACE_MENU_PERMISSION_IDS = [
  'menu.my_appointments',
  'menu.my_room_reservations',
] as const;

/** Sous-menus Administration (sidebar). */
export const ADMIN_MENU_PERMISSION_IDS = [
  'menu.admin.users',
  'menu.admin.roles',
  'menu.admin.referentials',
  'menu.admin.settings',
  'menu.admin.audit',
] as const;

/** Boutons d’action de la liste des rendez-vous. */
export const APPOINTMENT_ACTION_PERMISSION_IDS = [
  'action.appointments.approve',
  'action.appointments.reschedule',
  'action.appointments.reject',
  'action.appointments.edit',
  'action.appointments.detail',
  'action.appointments.archive',
  'action.appointments.restore',
  'action.appointments.delete',
] as const;

/** Boutons d’action des contacts stratégiques. */
export const CONTACT_ACTION_PERMISSION_IDS = [
  'action.contacts.history',
  'action.contacts.plan',
  'action.contacts.create',
  'action.contacts.edit',
  'action.contacts.archive',
  'action.contacts.restore',
  'action.contacts.delete',
] as const;

/** Boutons d’action des missions. */
export const MISSION_ACTION_PERMISSION_IDS = [
  'action.missions.create',
  'action.missions.edit',
  'action.missions.archive',
  'action.missions.restore',
  'action.missions.delete',
  'action.missions.import',
  'action.missions.hotel',
] as const;

/** Boutons d’action des comptes rendus. */
export const DOCUMENT_ACTION_PERMISSION_IDS = [
  'action.documents.view',
  'action.documents.create',
  'action.documents.edit',
  'action.documents.archive',
  'action.documents.restore',
  'action.documents.delete',
  'action.documents.export',
] as const;

/** Boutons d’action de la liste des réservations salles. */
export const ROOM_RESERVATION_ACTION_PERMISSION_IDS = [
  'action.room_reservations.approve',
  'action.room_reservations.reject',
  'action.room_reservations.propose',
  'action.room_reservations.cancel',
  'action.room_reservations.agenda',
  'action.room_reservations.edit',
  'action.room_reservations.detail',
  'action.room_reservations.archive',
  'action.room_reservations.restore',
  'action.room_reservations.delete',
] as const;

const ROOM_RESERVATION_REVIEW_ACTION_IDS = [
  'action.room_reservations.approve',
  'action.room_reservations.reject',
  'action.room_reservations.propose',
  'action.room_reservations.archive',
  'action.room_reservations.restore',
  'action.room_reservations.delete',
] as const;

/** Boutons d’action de la gestion des utilisateurs. */
export const USER_ACTION_PERMISSION_IDS = [
  'action.users.view',
  'action.users.create',
  'action.users.edit',
  'action.users.toggle_active',
  'action.users.archive',
  'action.users.restore',
  'action.users.delete',
  'action.users.import',
] as const;

/** Onglets / sections de la gestion des référentiels. */
export const REFERENTIAL_ACTION_PERMISSION_IDS = [
  'action.referentials.schedule',
  'action.referentials.holidays',
  'action.referentials.unavailabilities',
  'action.referentials.appointment_types',
  'action.referentials.locations',
  'action.referentials.motifs',
  'action.referentials.departments',
  'action.referentials.trash',
] as const;

/** Onglets des paramètres système. */
export const SETTINGS_ACTION_PERMISSION_IDS = [
  'action.settings.general',
  'action.settings.notifications',
  'action.settings.security',
  'action.settings.integrations',
] as const;

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { id: 'menu.dashboard', label: 'Dashboard', categoryId: 'pilotage' },
  { id: 'menu.calendar', label: 'Agenda', categoryId: 'pilotage' },
  { id: 'menu.assistant', label: 'Espace assistante', categoryId: 'pilotage' },
  { id: 'menu.my_appointments', label: 'Mes demandes RDV', categoryId: 'mon_espace' },
  { id: 'menu.my_room_reservations', label: 'Mes réservations', categoryId: 'mon_espace' },
  { id: 'menu.appointments_list', label: 'Liste des rendez-vous', categoryId: 'menu' },
  { id: 'menu.plan', label: 'Planifier un RDV', categoryId: 'menu' },
  { id: 'menu.history', label: 'Historique RDV', categoryId: 'menu' },
  { id: 'menu.notifications', label: 'Notifications', categoryId: 'menu' },
  { id: 'menu.contacts', label: 'Contacts stratégiques', categoryId: 'menu' },
  { id: 'menu.documents', label: 'Compte rendu', categoryId: 'menu' },
  { id: 'menu.room_slots', label: 'Créneaux salles', categoryId: 'menu' },
  { id: 'menu.mail', label: 'Courriers', categoryId: 'menu' },
  { id: 'menu.room_reservations', label: 'Liste des réservations salles', categoryId: 'menu' },
  { id: 'menu.analytics', label: 'Analyse comparative', categoryId: 'menu' },
  { id: 'action.appointments.approve', label: 'Approuver', categoryId: 'actions' },
  { id: 'action.appointments.reschedule', label: 'Reporter', categoryId: 'actions' },
  { id: 'action.appointments.reject', label: 'Refuser', categoryId: 'actions' },
  { id: 'action.appointments.edit', label: 'Modifier', categoryId: 'actions' },
  { id: 'action.appointments.detail', label: 'Demandeur / Détail', categoryId: 'actions' },
  { id: 'action.appointments.archive', label: 'Corbeille', categoryId: 'actions' },
  { id: 'action.appointments.restore', label: 'Restaurer', categoryId: 'actions' },
  { id: 'action.appointments.delete', label: 'Supprimer définitivement', categoryId: 'actions' },
  { id: 'action.contacts.history', label: 'Historique des rendez-vous', categoryId: 'actions_contacts' },
  { id: 'action.contacts.plan', label: 'Planifier un rendez-vous', categoryId: 'actions_contacts' },
  { id: 'action.contacts.create', label: 'Nouveau contact', categoryId: 'actions_contacts' },
  { id: 'action.contacts.edit', label: 'Modifier', categoryId: 'actions_contacts' },
  { id: 'action.contacts.archive', label: 'Corbeille', categoryId: 'actions_contacts' },
  { id: 'action.contacts.restore', label: 'Restaurer', categoryId: 'actions_contacts' },
  { id: 'action.contacts.delete', label: 'Supprimer définitivement', categoryId: 'actions_contacts' },
  { id: 'action.documents.view', label: 'Visualiser', categoryId: 'actions_documents' },
  { id: 'action.documents.create', label: 'Nouveau compte rendu', categoryId: 'actions_documents' },
  { id: 'action.documents.edit', label: 'Modifier', categoryId: 'actions_documents' },
  { id: 'action.documents.archive', label: 'Corbeille', categoryId: 'actions_documents' },
  { id: 'action.documents.restore', label: 'Restaurer', categoryId: 'actions_documents' },
  { id: 'action.documents.delete', label: 'Supprimer définitivement', categoryId: 'actions_documents' },
  { id: 'action.documents.export', label: 'Exporter', categoryId: 'actions_documents' },
  { id: 'action.room_reservations.approve', label: 'Valider', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.reject', label: 'Refuser', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.propose', label: 'Proposer un créneau', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.cancel', label: 'Annuler', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.agenda', label: 'Agenda', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.edit', label: 'Modifier', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.detail', label: 'Détail', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.archive', label: 'Corbeille', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.restore', label: 'Restaurer', categoryId: 'actions_rooms' },
  { id: 'action.room_reservations.delete', label: 'Supprimer définitivement', categoryId: 'actions_rooms' },
  { id: 'action.users.view', label: 'Voir le détail', categoryId: 'actions_users' },
  { id: 'action.users.create', label: 'Nouvel utilisateur', categoryId: 'actions_users' },
  { id: 'action.users.edit', label: 'Modifier', categoryId: 'actions_users' },
  { id: 'action.users.toggle_active', label: 'Activer / Désactiver', categoryId: 'actions_users' },
  { id: 'action.users.archive', label: 'Corbeille', categoryId: 'actions_users' },
  { id: 'action.users.restore', label: 'Restaurer', categoryId: 'actions_users' },
  { id: 'action.users.delete', label: 'Supprimer définitivement', categoryId: 'actions_users' },
  { id: 'action.users.import', label: 'Importer AD / LDAP', categoryId: 'actions_users' },
  { id: 'action.referentials.schedule', label: 'Horaires & créneaux', categoryId: 'actions_referentials' },
  { id: 'action.referentials.holidays', label: 'Jours fériés', categoryId: 'actions_referentials' },
  { id: 'action.referentials.unavailabilities', label: 'Indisponibilités', categoryId: 'actions_referentials' },
  { id: 'action.referentials.appointment_types', label: 'Types de rendez-vous', categoryId: 'actions_referentials' },
  { id: 'action.referentials.locations', label: 'Lieux', categoryId: 'actions_referentials' },
  { id: 'action.referentials.motifs', label: 'Motifs', categoryId: 'actions_referentials' },
  { id: 'action.referentials.departments', label: 'Départements', categoryId: 'actions_referentials' },
  { id: 'action.referentials.trash', label: 'Corbeille', categoryId: 'actions_referentials' },
  { id: 'action.settings.general', label: 'Général', categoryId: 'actions_settings' },
  { id: 'action.settings.notifications', label: 'Notifications', categoryId: 'actions_settings' },
  { id: 'action.settings.security', label: 'Sécurité', categoryId: 'actions_settings' },
  { id: 'action.settings.integrations', label: 'Intégrations', categoryId: 'actions_settings' },
  { id: 'menu.admin.users', label: 'Utilisateurs', categoryId: 'administration' },
  { id: 'menu.admin.roles', label: 'Rôles & Permissions', categoryId: 'administration' },
  { id: 'menu.admin.referentials', label: 'Référentiels', categoryId: 'administration' },
  { id: 'menu.admin.settings', label: 'Paramètres', categoryId: 'administration' },
  { id: 'menu.admin.audit', label: "Journal d'audit", categoryId: 'administration' },
];

const CATALOG_IDS = PERMISSION_CATALOG.map((p) => p.id);

function catalogFlags(enabled: string[]): Record<string, boolean> {
  return Object.fromEntries(CATALOG_IDS.map((id) => [id, enabled.includes(id)]));
}

const DG_EXCLUDED_DOCUMENT_ACTIONS = new Set([
  'action.documents.create',
  'action.documents.edit',
  'action.documents.archive',
  'action.documents.restore',
  'action.documents.delete',
]);

/** Matrice par défaut (menus + actions). */
export const DEFAULT_ROLE_PERMISSIONS: Record<DgRole, Record<string, boolean>> = {
  ASSISTANT: catalogFlags(CATALOG_IDS),
  DG: catalogFlags(
    CATALOG_IDS.filter(
      (id) =>
        !id.startsWith('menu.admin.') &&
        !id.startsWith('action.users.') &&
        !id.startsWith('action.referentials.') &&
        !id.startsWith('action.settings.') &&
        !id.startsWith('action.contacts.') &&
        !id.startsWith('action.missions.') &&
        !DG_EXCLUDED_DOCUMENT_ACTIONS.has(id)
    )
  ),
  MANAGER: catalogFlags(['menu.my_appointments']),
  EXTERNAL: catalogFlags(['menu.my_appointments']),
};

export { ROOM_RESERVATION_REVIEW_ACTION_IDS };

export function catalogByCategory() {
  return PERMISSION_CATEGORIES.map((cat) => ({
    ...cat,
    permissions: PERMISSION_CATALOG.filter((p) => p.categoryId === cat.id),
  }));
}

export function isMenuPermissionId(id: string): boolean {
  return id.startsWith('menu.');
}

export function isActionPermissionId(id: string): boolean {
  return id.startsWith('action.');
}

export function hasAnyAdminMenuPermission(map: Record<string, boolean>): boolean {
  return ADMIN_MENU_PERMISSION_IDS.some((id) => Boolean(map[id]));
}
