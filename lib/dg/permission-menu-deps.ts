import {
  APPOINTMENT_ACTION_PERMISSION_IDS,
  CONTACT_ACTION_PERMISSION_IDS,
  DOCUMENT_ACTION_PERMISSION_IDS,
  MISSION_ACTION_PERMISSION_IDS,
  PERMISSION_CATALOG,
  REFERENTIAL_ACTION_PERMISSION_IDS,
  ROOM_RESERVATION_ACTION_PERMISSION_IDS,
  ROOM_RESERVATION_REVIEW_ACTION_IDS,
  SETTINGS_ACTION_PERMISSION_IDS,
  USER_ACTION_PERMISSION_IDS,
} from '@/lib/dg/permission-catalog';

/** Menus → actions associées (désactivées en cascade si le menu est coupé). */
export const MENU_DEPENDENT_ACTIONS: Record<string, readonly string[]> = {
  'menu.appointments_list': APPOINTMENT_ACTION_PERMISSION_IDS,
  'menu.contacts': CONTACT_ACTION_PERMISSION_IDS,
  'menu.missions': MISSION_ACTION_PERMISSION_IDS,
  'menu.documents': DOCUMENT_ACTION_PERMISSION_IDS,
  'menu.room_reservations': ROOM_RESERVATION_ACTION_PERMISSION_IDS,
  'menu.room_slots': ['action.room_reservations.agenda'],
  'menu.my_room_reservations': [
    'action.room_reservations.agenda',
    'action.room_reservations.edit',
    'action.room_reservations.detail',
  ],
  'menu.admin.users': USER_ACTION_PERMISSION_IDS,
  'menu.admin.referentials': REFERENTIAL_ACTION_PERMISSION_IDS,
  'menu.admin.settings': SETTINGS_ACTION_PERMISSION_IDS,
};

const ACTION_PARENT_MENUS = new Map<string, string[]>();

for (const [menuId, actionIds] of Object.entries(MENU_DEPENDENT_ACTIONS)) {
  for (const actionId of actionIds) {
    const parents = ACTION_PARENT_MENUS.get(actionId) ?? [];
    if (!parents.includes(menuId)) parents.push(menuId);
    ACTION_PARENT_MENUS.set(actionId, parents);
  }
}

export function parentMenusForAction(actionId: string): string[] {
  return ACTION_PARENT_MENUS.get(actionId) ?? [];
}

export function isActionGatedByMenu(actionId: string, permMap: Record<string, boolean>): boolean {
  const parents = parentMenusForAction(actionId);
  if (parents.length === 0) return false;
  return parents.some((menuId) => permMap[menuId] === true);
}

/** Force les actions à false si aucun menu parent n’est actif. */
export function enforceMenuActionDependencies(
  permMap: Record<string, boolean>
): Record<string, boolean> {
  const next = { ...permMap };
  for (const perm of PERMISSION_CATALOG) {
    if (!perm.id.startsWith('action.')) continue;
    const parents = parentMenusForAction(perm.id);
    if (parents.length === 0) continue;
    if (!parents.some((menuId) => next[menuId] === true)) {
      next[perm.id] = false;
    }
  }
  return next;
}

/** Mises à jour lors du basculement d’un menu (désactivation en cascade). */
export function buildMenuPermissionUpdates(
  permMap: Record<string, boolean>,
  menuId: string,
  enabled: boolean
): Record<string, boolean> {
  const updates: Record<string, boolean> = { [menuId]: enabled };
  if (enabled || !MENU_DEPENDENT_ACTIONS[menuId]) return updates;

  for (const actionId of MENU_DEPENDENT_ACTIONS[menuId]) {
    const parents = parentMenusForAction(actionId);
    const anotherParentStillOn = parents.some(
      (parentId) => parentId !== menuId && permMap[parentId] === true
    );
    if (!anotherParentStillOn) {
      updates[actionId] = false;
    }
  }
  return updates;
}

export function mergePermissionUpdates(
  permMap: Record<string, boolean>,
  updates: Record<string, boolean>
): Record<string, boolean> {
  return enforceMenuActionDependencies({ ...permMap, ...updates });
}
