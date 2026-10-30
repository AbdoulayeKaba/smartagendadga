import {
  ADMIN_MENU_PERMISSION_IDS,
  APPOINTMENT_ACTION_PERMISSION_IDS,
  CONTACT_ACTION_PERMISSION_IDS,
  DOCUMENT_ACTION_PERMISSION_IDS,
  MISSION_ACTION_PERMISSION_IDS,
  MON_ESPACE_MENU_PERMISSION_IDS,
  PERMISSION_CATALOG,
  REFERENTIAL_ACTION_PERMISSION_IDS,
  ROOM_RESERVATION_ACTION_PERMISSION_IDS,
  ROOM_RESERVATION_REVIEW_ACTION_IDS,
  SETTINGS_ACTION_PERMISSION_IDS,
  USER_ACTION_PERMISSION_IDS,
} from '@/lib/dg/permission-catalog';

const CATALOG_IDS = PERMISSION_CATALOG.map((p) => p.id);

/** Capacités techniques toujours reconnues par les guards API (non affichées en UI). */
export const TECHNICAL_PERMISSION_IDS = [
  'admin.platform',
  'admin.users.read',
  'admin.users.create',
  'admin.users.update',
  'admin.users.import',
  'admin.roles.manage',
  'admin.roles.permissions',
  'admin.settings',
  'admin.referentials',
  'appointments.request',
  'appointments.view_own',
  'appointments.own.detail',
  'appointments.own.edit',
  'appointments.own.delete',
  'appointments.review',
  'appointments.reschedule',
  'calendar.view',
  'calendar.drag',
  'calendar.urgent',
  'dashboard.dg',
  'audit.read',
  'export.pdf',
  'workspace.read',
  'workspace.manage',
  'workspace.documents',
] as const;

function hasFlag(map: Record<string, boolean>, id: string): boolean {
  return Boolean(map[id]);
}

function setMany(target: Record<string, boolean>, ids: string[], value = true) {
  for (const id of ids) target[id] = value;
}

function migrateMonolithicAdmin(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasGranularAdmin = ADMIN_MENU_PERMISSION_IDS.some((id) => id in source);
  if (hasGranularAdmin) return;
  if (source['menu.admin']) {
    for (const id of ADMIN_MENU_PERMISSION_IDS) {
      target[id] = true;
    }
  }
}

function migrateAppointmentActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = APPOINTMENT_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const reviewAccess =
    Boolean(source['menu.appointments_list']) || Boolean(source['appointments.review']);
  for (const id of APPOINTMENT_ACTION_PERMISSION_IDS) {
    target[id] = reviewAccess;
  }
}

function migrateContactActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = CONTACT_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const contactAccess =
    Boolean(source['menu.contacts']) ||
    Boolean(source['workspace.manage']) ||
    Boolean(source['workspace.read']);
  for (const id of CONTACT_ACTION_PERMISSION_IDS) {
    if (id === 'action.contacts.history' && contactAccess) {
      target[id] = true;
      continue;
    }
    target[id] = Boolean(source['workspace.manage']) || Boolean(source['menu.contacts']);
  }
}

function migrateCalendarMenu(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  if ('menu.calendar' in source) return;
  target['menu.calendar'] = Boolean(
    source['menu.dashboard'] ||
      source['menu.appointments_list'] ||
      source['dashboard.dg'] ||
      source['calendar.view'] ||
      source['appointments.review']
  );
}

function migrateMissionActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = MISSION_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const missionAccess =
    Boolean(source['menu.missions']) || Boolean(source['workspace.manage']);
  for (const id of MISSION_ACTION_PERMISSION_IDS) {
    target[id] = missionAccess;
  }
}

function migrateDocumentActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = DOCUMENT_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const docsAccess =
    Boolean(source['menu.documents']) ||
    Boolean(source['workspace.documents']) ||
    Boolean(source['workspace.manage']);
  for (const id of DOCUMENT_ACTION_PERMISSION_IDS) {
    if (id === 'action.documents.view' || id === 'action.documents.export') {
      target[id] = docsAccess;
      continue;
    }
    target[id] = Boolean(source['workspace.manage']) || Boolean(source['menu.documents']);
  }
}

function migrateRoomReservationActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = ROOM_RESERVATION_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const roomAccess =
    Boolean(source['menu.room_reservations']) || Boolean(source['calendar.view']);
  const reviewAccess =
    Boolean(source['appointments.review']) || Boolean(source['menu.appointments_list']);
  for (const id of ROOM_RESERVATION_ACTION_PERMISSION_IDS) {
    if ((ROOM_RESERVATION_REVIEW_ACTION_IDS as readonly string[]).includes(id)) {
      target[id] = roomAccess && reviewAccess;
      continue;
    }
    target[id] = roomAccess || reviewAccess;
  }
}

function migrateUserActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = USER_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const usersAccess =
    Boolean(source['menu.admin.users']) ||
    Boolean(source['admin.users.read']) ||
    Boolean(source['admin.users.create']) ||
    Boolean(source['admin.users.update']) ||
    Boolean(source['admin.users.import']) ||
    Boolean(source['admin.platform']);
  for (const id of USER_ACTION_PERMISSION_IDS) {
    target[id] = usersAccess;
  }
}

function migrateReferentialActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = REFERENTIAL_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const refsAccess =
    Boolean(source['menu.admin.referentials']) ||
    Boolean(source['admin.referentials']) ||
    Boolean(source['admin.platform']);
  for (const id of REFERENTIAL_ACTION_PERMISSION_IDS) {
    target[id] = refsAccess;
  }
}

function migrateSettingsActions(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  const hasAnyAction = SETTINGS_ACTION_PERMISSION_IDS.some((id) => id in source);
  if (hasAnyAction) return;
  const settingsAccess =
    Boolean(source['menu.admin.settings']) ||
    Boolean(source['admin.settings']) ||
    Boolean(source['admin.platform']);
  for (const id of SETTINGS_ACTION_PERMISSION_IDS) {
    target[id] = settingsAccess;
  }
}

function migrateMonEspaceMenus(
  source: Record<string, boolean>,
  target: Record<string, boolean>
) {
  if (!('menu.my_appointments' in source)) {
    target['menu.my_appointments'] = Boolean(
      source['menu.plan'] ||
        source['appointments.view_own'] ||
        source['appointments.request'] ||
        source['calendar.drag']
    );
  }
  if (!('menu.my_room_reservations' in source)) {
    target['menu.my_room_reservations'] = Boolean(
      source['menu.room_slots'] ||
        source['menu.room_reservations'] ||
        source['appointments.request'] ||
        source['calendar.view']
    );
  }
}

/**
 * Convertit une matrice legacy en permissions catalogue (menu.* + action.*).
 */
export function normalizeToMenuPermissions(
  raw: Record<string, boolean> | null | undefined
): Record<string, boolean> {
  const source = raw ?? {};
  const hasCatalogKeys =
    CATALOG_IDS.some((id) => id in source) ||
    'menu.admin' in source ||
    APPOINTMENT_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    CONTACT_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    MISSION_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    DOCUMENT_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    ROOM_RESERVATION_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    USER_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    REFERENTIAL_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    SETTINGS_ACTION_PERMISSION_IDS.some((id) => id in source) ||
    MON_ESPACE_MENU_PERMISSION_IDS.some((id) => id in source);

  if (hasCatalogKeys) {
    const result = Object.fromEntries(CATALOG_IDS.map((id) => [id, Boolean(source[id])]));
    migrateMonolithicAdmin(source, result);
    migrateMonEspaceMenus(source, result);
    migrateCalendarMenu(source, result);
    migrateAppointmentActions(source, result);
    migrateContactActions(source, result);
    migrateMissionActions(source, result);
    migrateDocumentActions(source, result);
    migrateRoomReservationActions(source, result);
    migrateUserActions(source, result);
    migrateReferentialActions(source, result);
    migrateSettingsActions(source, result);
    return result;
  }

  const derived: Record<string, boolean> = Object.fromEntries(
    CATALOG_IDS.map((id) => [id, false])
  );

  derived['menu.dashboard'] = Boolean(source['dashboard.dg']);
  derived['menu.calendar'] = Boolean(
    source['dashboard.dg'] || source['calendar.view'] || source['appointments.review']
  );
  derived['menu.assistant'] = Boolean(
    source['workspace.read'] || source['workspace.manage'] || source['appointments.review']
  );
  derived['menu.my_appointments'] = Boolean(
    source['appointments.request'] ||
      source['appointments.view_own'] ||
      source['calendar.drag']
  );
  derived['menu.my_room_reservations'] = Boolean(
    source['calendar.view'] || source['appointments.request']
  );
  derived['menu.appointments_list'] = Boolean(source['appointments.review']);
  derived['menu.plan'] = Boolean(source['appointments.request'] || source['calendar.drag']);
  derived['menu.history'] = Boolean(source['appointments.review']);
  derived['menu.notifications'] = Boolean(
    source['appointments.review'] || source['workspace.read'] || source['appointments.view_own']
  );
  derived['menu.mail'] = Boolean(source['workspace.read'] || source['workspace.manage']);
  derived['menu.contacts'] = Boolean(source['workspace.read'] || source['workspace.manage']);
  derived['menu.missions'] = Boolean(source['workspace.read'] || source['workspace.manage']);
  derived['menu.documents'] = Boolean(source['workspace.documents']);
  derived['menu.room_slots'] = Boolean(source['calendar.view']);
  derived['menu.room_reservations'] = Boolean(source['calendar.view']);
  derived['menu.analytics'] = Boolean(source['appointments.review']);

  derived['menu.admin.users'] = Boolean(
    source['admin.users.read'] ||
      source['admin.users.create'] ||
      source['admin.users.update'] ||
      source['admin.users.import'] ||
      source['admin.platform']
  );
  derived['menu.admin.roles'] = Boolean(
    source['admin.roles.manage'] || source['admin.roles.permissions'] || source['admin.platform']
  );
  derived['menu.admin.referentials'] = Boolean(
    source['admin.referentials'] || source['admin.platform']
  );
  derived['menu.admin.settings'] = Boolean(source['admin.settings'] || source['admin.platform']);
  derived['menu.admin.audit'] = Boolean(source['audit.read'] || source['admin.platform']);

  const reviewAccess = Boolean(source['appointments.review']);
  for (const id of APPOINTMENT_ACTION_PERMISSION_IDS) {
    derived[id] = reviewAccess;
  }

  const contactManage = Boolean(source['workspace.manage']);
  const contactRead =
    contactManage || Boolean(source['workspace.read']) || Boolean(source['appointments.review']);
  for (const id of CONTACT_ACTION_PERMISSION_IDS) {
    derived[id] =
      id === 'action.contacts.history' ? contactRead : contactManage;
  }

  const missionManage = Boolean(source['workspace.manage']);
  for (const id of MISSION_ACTION_PERMISSION_IDS) {
    derived[id] = missionManage;
  }

  const documentManage = Boolean(source['workspace.manage']);
  const documentRead =
    documentManage || Boolean(source['workspace.documents']) || Boolean(source['workspace.read']);
  for (const id of DOCUMENT_ACTION_PERMISSION_IDS) {
    derived[id] =
      id === 'action.documents.view' || id === 'action.documents.export'
        ? documentRead
        : documentManage;
  }

  const roomAccess = Boolean(source['calendar.view']);
  for (const id of ROOM_RESERVATION_ACTION_PERMISSION_IDS) {
    if ((ROOM_RESERVATION_REVIEW_ACTION_IDS as readonly string[]).includes(id)) {
      derived[id] = roomAccess && reviewAccess;
      continue;
    }
    derived[id] = roomAccess || reviewAccess;
  }

  const usersAccess = Boolean(
    source['admin.users.read'] ||
      source['admin.users.create'] ||
      source['admin.users.update'] ||
      source['admin.users.import'] ||
      source['admin.platform']
  );
  for (const id of USER_ACTION_PERMISSION_IDS) {
    derived[id] = usersAccess;
  }

  const refsAccess = Boolean(source['admin.referentials'] || source['admin.platform']);
  for (const id of REFERENTIAL_ACTION_PERMISSION_IDS) {
    derived[id] = refsAccess;
  }

  const settingsAccess = Boolean(source['admin.settings'] || source['admin.platform']);
  for (const id of SETTINGS_ACTION_PERMISSION_IDS) {
    derived[id] = settingsAccess;
  }

  return derived;
}

/**
 * Étend les permissions catalogue en capacités techniques pour les guards API.
 */
export function expandMenuPermissions(
  menuMap: Record<string, boolean>
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...menuMap };

  for (const id of TECHNICAL_PERMISSION_IDS) {
    out[id] = false;
  }

  if (hasFlag(menuMap, 'menu.dashboard')) {
    out['dashboard.dg'] = true;
  }

  if (hasFlag(menuMap, 'menu.calendar')) {
    out['calendar.view'] = true;
  }

  if (hasFlag(menuMap, 'menu.assistant')) {
    setMany(out, ['workspace.read', 'workspace.manage', 'appointments.review']);
  }

  if (hasFlag(menuMap, 'menu.appointments_list')) {
    setMany(out, ['appointments.review', 'export.pdf']);
  }

  if (hasFlag(menuMap, 'menu.history')) {
    out['appointments.review'] = true;
  }

  if (hasFlag(menuMap, 'menu.analytics')) {
    out['appointments.review'] = true;
  }

  if (hasFlag(menuMap, 'menu.plan')) {
    out['appointments.request'] = true;
    if (
      hasFlag(menuMap, 'menu.appointments_list') ||
      hasFlag(menuMap, 'menu.assistant')
    ) {
      out['calendar.drag'] = true;
      out['calendar.urgent'] = true;
    }
  }

  if (hasFlag(menuMap, 'menu.notifications')) {
    if (!hasFlag(menuMap, 'menu.appointments_list') && !hasFlag(menuMap, 'menu.assistant')) {
      out['appointments.view_own'] = true;
    } else {
      out['workspace.read'] = true;
    }
  }

  if (
    hasFlag(menuMap, 'menu.mail') ||
    hasFlag(menuMap, 'menu.contacts') ||
    hasFlag(menuMap, 'menu.missions')
  ) {
    out['workspace.read'] = true;
  }

  if (hasFlag(menuMap, 'menu.documents')) {
    out['workspace.documents'] = true;
  }
  if (
    hasFlag(menuMap, 'action.documents.view') ||
    hasFlag(menuMap, 'action.documents.export') ||
    hasFlag(menuMap, 'action.documents.create') ||
    hasFlag(menuMap, 'action.documents.edit') ||
    hasFlag(menuMap, 'action.documents.archive') ||
    hasFlag(menuMap, 'action.documents.restore') ||
    hasFlag(menuMap, 'action.documents.delete')
  ) {
    out['workspace.documents'] = true;
  }

  if (hasFlag(menuMap, 'menu.room_slots') || hasFlag(menuMap, 'menu.room_reservations')) {
    out['calendar.view'] = true;
  }
  if (ROOM_RESERVATION_ACTION_PERMISSION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['calendar.view'] = true;
  }
  if (ROOM_RESERVATION_REVIEW_ACTION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['appointments.review'] = true;
  }

  if (hasFlag(menuMap, 'menu.admin.users') || hasFlag(menuMap, 'action.users.view')) {
    out['admin.users.read'] = true;
  }
  if (hasFlag(menuMap, 'action.users.create')) {
    out['admin.users.create'] = true;
    out['admin.users.read'] = true;
  }
  if (
    hasFlag(menuMap, 'action.users.edit') ||
    hasFlag(menuMap, 'action.users.toggle_active') ||
    hasFlag(menuMap, 'action.users.archive') ||
    hasFlag(menuMap, 'action.users.restore') ||
    hasFlag(menuMap, 'action.users.delete')
  ) {
    out['admin.users.update'] = true;
    out['admin.users.read'] = true;
  }
  if (hasFlag(menuMap, 'action.users.import')) {
    out['admin.users.import'] = true;
    out['admin.users.read'] = true;
  }

  if (hasFlag(menuMap, 'menu.admin.roles')) {
    setMany(out, ['admin.roles.manage', 'admin.roles.permissions']);
  }

  if (hasFlag(menuMap, 'menu.admin.referentials')) {
    out['admin.referentials'] = true;
  }
  if (REFERENTIAL_ACTION_PERMISSION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['admin.referentials'] = true;
  }

  if (hasFlag(menuMap, 'menu.admin.settings')) {
    out['admin.settings'] = true;
  }
  if (SETTINGS_ACTION_PERMISSION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['admin.settings'] = true;
  }

  if (hasFlag(menuMap, 'menu.admin.audit')) {
    out['audit.read'] = true;
  }

  if (ADMIN_MENU_PERMISSION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['admin.platform'] = true;
  }

  // Actions → capacités API associées
  if (hasFlag(menuMap, 'action.appointments.approve') || hasFlag(menuMap, 'action.appointments.reject')) {
    out['appointments.review'] = true;
  }
  if (hasFlag(menuMap, 'action.appointments.reschedule')) {
    out['appointments.reschedule'] = true;
    out['appointments.review'] = true;
  }
  if (
    hasFlag(menuMap, 'action.appointments.edit') ||
    hasFlag(menuMap, 'action.appointments.detail') ||
    hasFlag(menuMap, 'action.appointments.archive') ||
    hasFlag(menuMap, 'action.appointments.restore') ||
    hasFlag(menuMap, 'action.appointments.delete')
  ) {
    out['appointments.review'] = true;
  }

  // Contacts stratégiques → capacités workspace
  if (hasFlag(menuMap, 'action.contacts.history') || hasFlag(menuMap, 'menu.contacts')) {
    out['workspace.read'] = true;
  }
  if (
    hasFlag(menuMap, 'action.contacts.create') ||
    hasFlag(menuMap, 'action.contacts.edit') ||
    hasFlag(menuMap, 'action.contacts.archive') ||
    hasFlag(menuMap, 'action.contacts.restore') ||
    hasFlag(menuMap, 'action.contacts.delete') ||
    hasFlag(menuMap, 'action.contacts.plan')
  ) {
    out['workspace.manage'] = true;
    out['workspace.read'] = true;
  }

  if (hasFlag(menuMap, 'menu.missions')) {
    out['workspace.read'] = true;
  }
  if (MISSION_ACTION_PERMISSION_IDS.some((id) => hasFlag(menuMap, id))) {
    out['workspace.manage'] = true;
    out['workspace.read'] = true;
  }

  // Tout rôle qui peut planifier voit et gère aussi ses propres demandes
  // (y compris assistante / DGA — distinct de la file « Liste des RDV »).
  if (hasFlag(menuMap, 'menu.plan') || hasFlag(menuMap, 'menu.my_appointments')) {
    setMany(out, [
      'appointments.view_own',
      'appointments.own.detail',
      'appointments.own.edit',
    ]);
    out['menu.notifications'] = true;
    out['menu.history'] = true;
  }

  if (hasFlag(menuMap, 'menu.my_room_reservations')) {
    out['calendar.view'] = true;
  }

  return out;
}

export function resolveEffectivePermissionMap(
  raw: Record<string, boolean> | null | undefined
): Record<string, boolean> {
  return expandMenuPermissions(normalizeToMenuPermissions(raw));
}
