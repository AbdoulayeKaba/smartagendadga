import type { DgRole } from '@/lib/dg/rbac';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/dg/permission-catalog';
import type { CustomRoleRecord } from '@/lib/services/role-permissions-admin';
import { isCustomRoleId, type RoleId } from '@/lib/dg/role-ids';
import { DG_ROLE_META, SYSTEM_ROLES } from '@/lib/dg/role-meta';
import { purgeTrashedRole } from '@/lib/dg/role-trash';

type Store = {
  permissions: Record<string, Record<string, boolean>>;
  archived: string[];
  purged: DgRole[];
  descriptions: Partial<Record<DgRole, string>>;
  labels: Partial<Record<DgRole, string>>;
  customRoles: CustomRoleRecord[];
};

function listAllRoleLabels(store: Store): { id: RoleId; label: string }[] {
  const items: { id: RoleId; label: string }[] = SYSTEM_ROLES.filter(
    (id) => !store.purged.includes(id)
  ).map((id) => ({
    id,
    label: store.labels[id] ?? DG_ROLE_META[id].label,
  }));
  for (const custom of store.customRoles) {
    items.push({ id: custom.id, label: custom.label });
  }
  return items;
}

const STORE_KEY = '__dg_role_permissions_store__';

function cloneDefaults(): Store {
  return {
    permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)) as Record<
      string,
      Record<string, boolean>
    >,
    archived: [],
    purged: [],
    descriptions: {},
    labels: {},
    customRoles: [],
  };
}

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = cloneDefaults();
  }
  const store = g[STORE_KEY];
  if (!store.customRoles) store.customRoles = [];
  if (!store.labels) store.labels = {};
  if (!store.purged) store.purged = [];
  return store;
}

export function mockGetRolePermissionsStore(): Store {
  return JSON.parse(JSON.stringify(getStore())) as Store;
}

export function mockCreateCustomRole(input: {
  id: `custom_${string}`;
  label: string;
  description: string;
  permissions: Record<string, boolean>;
}): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const label = input.label.trim();
  if (label.length < 2) return { ok: false, error: 'ROLE_LABEL_REQUIRED' };
  if (listAllRoleLabels(store).some((r) => r.label.toLowerCase() === label.toLowerCase())) {
    return { ok: false, error: 'ROLE_LABEL_EXISTS' };
  }
  store.customRoles.push({
    id: input.id,
    label,
    description: input.description.trim(),
  });
  store.permissions[input.id] = { ...input.permissions };
  return { ok: true };
}

export function mockUpdateRolePermissions(
  roleId: RoleId,
  patch: {
    permissions?: Record<string, boolean>;
    archived?: boolean;
    description?: string;
    label?: string;
  }
): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  if (roleId === 'ASSISTANT' && patch.archived === true) {
    return { ok: false, error: 'CANNOT_ARCHIVE_ASSISTANT' };
  }

  const isArchived = store.archived.includes(roleId);
  const isRestore = patch.archived === false;
  if (
    isArchived &&
    !isRestore &&
    (patch.permissions !== undefined ||
      patch.description !== undefined ||
      patch.label !== undefined)
  ) {
    return { ok: false, error: 'ROLE_ARCHIVED_READONLY' };
  }

  if (patch.permissions) {
    store.permissions[roleId] = { ...store.permissions[roleId], ...patch.permissions };
  }
  if (patch.description !== undefined) {
    if (isCustomRoleId(roleId)) {
      const custom = store.customRoles.find((c) => c.id === roleId);
      if (custom) custom.description = patch.description;
    } else {
      store.descriptions[roleId] = patch.description;
    }
  }
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (label.length < 2) return { ok: false, error: 'ROLE_LABEL_REQUIRED' };
    if (label.length > 80) return { ok: false, error: 'VALIDATION_ERROR' };
    if (
      listAllRoleLabels(store).some(
        (r) => r.id !== roleId && r.label.toLowerCase() === label.toLowerCase()
      )
    ) {
      return { ok: false, error: 'ROLE_LABEL_EXISTS' };
    }
    if (isCustomRoleId(roleId)) {
      const custom = store.customRoles.find((c) => c.id === roleId);
      if (custom) custom.label = label;
    } else {
      store.labels[roleId] = label;
    }
  }
  if (patch.archived !== undefined) {
    if (patch.archived) {
      if (!store.archived.includes(roleId)) store.archived.push(roleId);
    } else {
      store.archived = store.archived.filter((r) => r !== roleId);
    }
  }

  return { ok: true };
}

export function mockGetRoleDescription(roleId: DgRole): string {
  const store = getStore();
  return store.descriptions[roleId] ?? DG_ROLE_META[roleId].description;
}

/** Suppression définitive depuis la corbeille : le rôle ne revient pas dans la liste active. */
export function mockPurgeRoleFromTrash(roleId: RoleId): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const outcome = purgeTrashedRole(store, roleId);
  if (outcome === 'protected') return { ok: false, error: 'CANNOT_PURGE_ASSISTANT' };
  if (outcome === 'unknown') return { ok: false, error: 'VALIDATION_ERROR' };
  return { ok: true };
}

export function mockEmptyRolesTrash(): { purged: number; skipped: number } {
  const store = getStore();
  const toPurge = [...store.archived].filter((r) => r !== 'ASSISTANT');
  for (const roleId of toPurge) {
    mockPurgeRoleFromTrash(roleId as RoleId);
  }
  return { purged: toPurge.length, skipped: store.archived.includes('ASSISTANT') ? 1 : 0 };
}
