import type { DgRole } from '@/lib/dg/rbac';
import {
  catalogByCategory,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
} from '@/lib/dg/permission-catalog';
import {
  normalizeToMenuPermissions,
  resolveEffectivePermissionMap,
} from '@/lib/dg/expand-menu-permissions';
import { enforceMenuActionDependencies } from '@/lib/dg/permission-menu-deps';
import {
  isCustomRoleId,
  isDgRole,
  newCustomRoleId,
  type RoleId,
} from '@/lib/dg/role-ids';
import { DG_ROLE_META, SYSTEM_ROLES } from '@/lib/dg/role-meta';
import { purgeTrashedRole, sanitizePurgedRoleIds } from '@/lib/dg/role-trash';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockCreateCustomRole,
  mockEmptyRolesTrash,
  mockGetRolePermissionsStore,
  mockPurgeRoleFromTrash,
  mockUpdateRolePermissions,
} from '@/lib/mock/role-permissions-store';
import { mockListUsers } from '@/lib/mock/users-store';
import {
  getPlatformSettingValue,
  upsertPlatformSettingValue,
} from '@/lib/services/platform-settings-store';
import { listUsers } from '@/lib/services/users-admin';

const SETTINGS_KEY = 'dg_role_permissions';

export type CustomRoleRecord = {
  id: `custom_${string}`;
  label: string;
  description: string;
};

type Persisted = {
  permissions: Record<string, Record<string, boolean>>;
  archived: string[];
  /** Rôles système retirés définitivement de la corbeille : absents des listes active et corbeille. */
  purged: DgRole[];
  descriptions: Partial<Record<DgRole, string>>;
  labels: Partial<Record<DgRole, string>>;
  customRoles: CustomRoleRecord[];
};

function listAllRoleLabels(persisted: Persisted): { id: RoleId; label: string }[] {
  const items: { id: RoleId; label: string }[] = SYSTEM_ROLES.filter(
    (id) => !persisted.purged.includes(id)
  ).map((id) => ({
    id,
    label: persisted.labels[id] ?? DG_ROLE_META[id].label,
  }));
  for (const custom of persisted.customRoles) {
    items.push({ id: custom.id, label: custom.label });
  }
  return items;
}

function persistRoleLabel(
  persisted: Persisted,
  roleId: RoleId,
  label: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = label.trim();
  if (trimmed.length < 2) return { ok: false, error: 'ROLE_LABEL_REQUIRED' };
  if (trimmed.length > 80) return { ok: false, error: 'VALIDATION_ERROR' };
  const duplicate = listAllRoleLabels(persisted).some(
    (r) => r.id !== roleId && r.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return { ok: false, error: 'ROLE_LABEL_EXISTS' };

  if (isCustomRoleId(roleId)) {
    const custom = persisted.customRoles.find((c) => c.id === roleId);
    if (custom) custom.label = trimmed;
  } else {
    persisted.labels[roleId] = trimmed;
  }
  return { ok: true };
}

function normalizePersisted(raw: Partial<Persisted> | null | undefined): Persisted {
  const permissions: Record<string, Record<string, boolean>> = JSON.parse(
    JSON.stringify(DEFAULT_ROLE_PERMISSIONS)
  ) as Record<string, Record<string, boolean>>;

  for (const [roleId, map] of Object.entries(raw?.permissions ?? {})) {
    // Ne pas merger avec les defaults avant migration : sinon les clés menu.*
    // des defaults masquent la rétro-compat des anciennes permissions techniques.
    permissions[roleId] = enforceMenuActionDependencies(normalizeToMenuPermissions(map));
  }

  return {
    permissions,
    archived: raw?.archived ?? [],
    purged: sanitizePurgedRoleIds(raw?.purged),
    descriptions: raw?.descriptions ?? {},
    labels: raw?.labels ?? {},
    customRoles: raw?.customRoles ?? [],
  };
}

async function loadPersisted(): Promise<Persisted> {
  if (isMockDataEnabled()) {
    const s = mockGetRolePermissionsStore();
    return normalizePersisted({
      permissions: s.permissions,
      archived: s.archived,
      purged: s.purged,
      descriptions: s.descriptions,
      labels: s.labels,
      customRoles: s.customRoles,
    });
  }

  const value = await getPlatformSettingValue(SETTINGS_KEY);
  if (!value) {
    return normalizePersisted(null);
  }
  try {
    return normalizePersisted(JSON.parse(value) as Partial<Persisted>);
  } catch {
    return normalizePersisted(null);
  }
}

async function savePersisted(
  data: Persisted,
  updatedById?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) return { ok: true };

  try {
    await upsertPlatformSettingValue(SETTINGS_KEY, JSON.stringify(data), updatedById);
    return { ok: true };
  } catch {
    return { ok: false, error: 'SAVE_FAILED' };
  }
}

export async function getRolesPermissionsAdmin() {
  const persisted = await loadPersisted();
  const users = isMockDataEnabled() ? mockListUsers() : await listUsers();

  const userCountByRole = SYSTEM_ROLES.reduce(
    (acc, role) => {
      acc[role] = users.filter((u) => u.role === role && u.active).length;
      return acc;
    },
    {} as Record<DgRole, number>
  );

  const systemRoles = SYSTEM_ROLES.filter((id) => !persisted.purged.includes(id)).map((id) => ({
    id,
    label: persisted.labels[id] ?? DG_ROLE_META[id].label,
    description: persisted.descriptions[id] ?? DG_ROLE_META[id].description,
    userCount: userCountByRole[id],
    archived: persisted.archived.includes(id),
    isCustom: false as const,
  }));

  const customRoles = (persisted.customRoles ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description,
    userCount: users.filter((u) => u.role === c.id && u.active).length,
    archived: persisted.archived.includes(c.id),
    isCustom: true as const,
  }));

  return {
    roles: [...systemRoles, ...customRoles],
    permissions: persisted.permissions,
    catalog: catalogByCategory(),
    totalPermissions: PERMISSION_CATALOG.length,
  };
}

export async function createRolePermissionsAdmin(
  input: { label: string; description: string; copyFrom?: RoleId },
  actorId: string
): Promise<{ ok: true; roleId: RoleId } | { ok: false; error: string }> {
  const label = input.label.trim();
  const description = input.description.trim();
  if (label.length < 2) return { ok: false, error: 'ROLE_LABEL_REQUIRED' };
  if (label.length > 80) return { ok: false, error: 'VALIDATION_ERROR' };
  if (description.length > 500) return { ok: false, error: 'VALIDATION_ERROR' };

  const copyFrom: RoleId = input.copyFrom ?? 'MANAGER';
  const roleId = newCustomRoleId();

  if (isMockDataEnabled()) {
    const s = mockGetRolePermissionsStore();
    const source =
      s.permissions[copyFrom] ??
      (isDgRole(copyFrom)
        ? DEFAULT_ROLE_PERMISSIONS[copyFrom]
        : DEFAULT_ROLE_PERMISSIONS.MANAGER);
    const r = mockCreateCustomRole({
      id: roleId,
      label,
      description,
      permissions: { ...source },
    });
    return r.ok ? { ok: true, roleId } : { ok: false, error: r.error };
  }

  const persisted = await loadPersisted();
  const sourcePerms = JSON.parse(
    JSON.stringify(ensureRolePermissionMap(persisted, copyFrom))
  ) as Record<string, boolean>;
  const labelExists = listAllRoleLabels(persisted).some(
    (r) => r.label.toLowerCase() === label.toLowerCase()
  );
  if (labelExists) return { ok: false, error: 'ROLE_LABEL_EXISTS' };

  persisted.customRoles.push({ id: roleId, label, description });
  persisted.permissions[roleId] = sourcePerms;
  const saved = await savePersisted(persisted, actorId);
  return saved.ok ? { ok: true, roleId } : { ok: false, error: saved.error };
}

export async function purgeRoleFromTrashAdmin(
  roleId: RoleId,
  userCount: number,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (roleId === 'ASSISTANT') return { ok: false, error: 'CANNOT_PURGE_ASSISTANT' };
  if (userCount > 0) return { ok: false, error: 'ROLE_HAS_USERS' };

  if (isMockDataEnabled()) {
    return mockPurgeRoleFromTrash(roleId);
  }

  const persisted = await loadPersisted();
  const outcome = purgeTrashedRole(persisted, roleId);
  if (outcome === 'unknown') return { ok: false, error: 'VALIDATION_ERROR' };
  const saved = await savePersisted(persisted, actorId);
  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}

export async function emptyRolesTrashAdmin(actorId: string) {
  const persisted = await loadPersisted();
  const users = isMockDataEnabled() ? mockListUsers() : await listUsers();

  let purged = 0;
  let skipped = 0;

  for (const roleId of [...persisted.archived]) {
    if (roleId === 'ASSISTANT') {
      skipped++;
      continue;
    }
    const count = users.filter((u) => u.role === roleId && u.active).length;
    if (count > 0) {
      skipped++;
      continue;
    }
    if (isMockDataEnabled()) {
      mockPurgeRoleFromTrash(roleId);
    } else {
      const outcome = purgeTrashedRole(persisted, roleId);
      if (outcome !== 'purged') {
        skipped++;
        continue;
      }
    }
    purged++;
  }

  if (!isMockDataEnabled()) {
    await savePersisted(persisted, actorId);
  }

  return { purged, skipped };
}

function ensureRolePermissionMap(
  persisted: Persisted,
  roleId: RoleId
): Record<string, boolean> {
  if (!persisted.permissions[roleId]) {
    const fallback = isDgRole(roleId)
      ? DEFAULT_ROLE_PERMISSIONS[roleId]
      : DEFAULT_ROLE_PERMISSIONS.MANAGER;
    persisted.permissions[roleId] = normalizeToMenuPermissions(
      JSON.parse(JSON.stringify(fallback)) as Record<string, boolean>
    );
  } else {
    persisted.permissions[roleId] = normalizeToMenuPermissions(persisted.permissions[roleId]);
  }
  return persisted.permissions[roleId];
}

function isArchivedPermissionEditBlocked(
  archived: string[],
  roleId: RoleId,
  patch: {
    permissions?: Record<string, boolean>;
    archived?: boolean;
    description?: string;
    setAll?: boolean;
    copyFrom?: RoleId;
  }
): boolean {
  if (!archived.includes(roleId)) return false;
  if (patch.archived === false) return false;
  return (
    patch.permissions !== undefined ||
    patch.setAll !== undefined ||
    patch.copyFrom !== undefined ||
    patch.description !== undefined
  );
}

export async function updateRolePermissionsAdmin(
  roleId: RoleId,
  patch: {
    permissions?: Record<string, boolean>;
    archived?: boolean;
    description?: string;
    label?: string;
    setAll?: boolean;
    sectionId?: string;
    purge?: boolean;
    copyFrom?: RoleId;
  },
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (patch.purge) {
    const users = isMockDataEnabled() ? mockListUsers() : await listUsers();
    const count = users.filter((u) => u.role === roleId && u.active).length;
    return purgeRoleFromTrashAdmin(roleId, count, actorId);
  }

  if (patch.copyFrom) {
    if (isMockDataEnabled()) {
      const s = mockGetRolePermissionsStore();
      if (isArchivedPermissionEditBlocked(s.archived, roleId, patch)) {
        return { ok: false, error: 'ROLE_ARCHIVED_READONLY' };
      }
      const source = s.permissions[patch.copyFrom] ?? DEFAULT_ROLE_PERMISSIONS[patch.copyFrom];
      const r = mockUpdateRolePermissions(roleId, {
        permissions: { ...source },
        description: patch.description,
        label: patch.label,
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const persisted = await loadPersisted();
    if (isArchivedPermissionEditBlocked(persisted.archived, roleId, patch)) {
      return { ok: false, error: 'ROLE_ARCHIVED_READONLY' };
    }
    const source = ensureRolePermissionMap(persisted, patch.copyFrom);
    persisted.permissions[roleId] = { ...source };
    if (patch.description !== undefined) {
      if (isCustomRoleId(roleId)) {
        const custom = persisted.customRoles.find((c) => c.id === roleId);
        if (custom) custom.description = patch.description;
      } else {
        persisted.descriptions[roleId] = patch.description;
      }
    }
    if (patch.label !== undefined) {
      const labelResult = persistRoleLabel(persisted, roleId, patch.label);
      if (!labelResult.ok) return labelResult;
    }
    const saved = await savePersisted(persisted, actorId);
    return saved.ok ? { ok: true } : { ok: false, error: saved.error };
  }

  if (isMockDataEnabled()) {
    const s = mockGetRolePermissionsStore();
    if (isArchivedPermissionEditBlocked(s.archived, roleId, patch)) {
      return { ok: false, error: 'ROLE_ARCHIVED_READONLY' };
    }
    if (patch.setAll !== undefined && patch.sectionId) {
      const section = catalogByCategory().find((c) => c.id === patch.sectionId);
      if (section) {
        const merged = enforceMenuActionDependencies({
          ...(s.permissions[roleId] ?? {}),
          ...Object.fromEntries(section.permissions.map((p) => [p.id, patch.setAll!])),
        });
        const r = mockUpdateRolePermissions(roleId, { permissions: merged });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      }
    }
    if (patch.setAll !== undefined && !patch.sectionId) {
      const merged = enforceMenuActionDependencies(
        Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.id, patch.setAll!]))
      );
      const r = mockUpdateRolePermissions(roleId, { permissions: merged });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const mergedPermissions = patch.permissions
      ? enforceMenuActionDependencies({
          ...(s.permissions[roleId] ?? {}),
          ...patch.permissions,
        })
      : undefined;
    const r = mockUpdateRolePermissions(roleId, {
      permissions: mergedPermissions,
      archived: patch.archived,
      description: patch.description,
      label: patch.label,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  const persisted = await loadPersisted();
  ensureRolePermissionMap(persisted, roleId);

  if (roleId === 'ASSISTANT' && patch.archived === true) {
    return { ok: false, error: 'CANNOT_ARCHIVE_ASSISTANT' };
  }

  if (isArchivedPermissionEditBlocked(persisted.archived, roleId, patch)) {
    return { ok: false, error: 'ROLE_ARCHIVED_READONLY' };
  }

  if (patch.setAll !== undefined) {
    const ids = patch.sectionId
      ? PERMISSION_CATALOG.filter((p) => p.categoryId === patch.sectionId).map((p) => p.id)
      : PERMISSION_CATALOG.map((p) => p.id);
    const map = persisted.permissions[roleId];
    for (const id of ids) {
      map[id] = patch.setAll;
    }
    persisted.permissions[roleId] = enforceMenuActionDependencies(map);
  }

  if (patch.permissions) {
    persisted.permissions[roleId] = enforceMenuActionDependencies(
      normalizeToMenuPermissions({
        ...persisted.permissions[roleId],
        ...patch.permissions,
      })
    );
  }
  if (patch.description !== undefined) {
    if (isCustomRoleId(roleId)) {
      const custom = persisted.customRoles.find((c) => c.id === roleId);
      if (custom) custom.description = patch.description;
    } else {
      persisted.descriptions[roleId] = patch.description;
    }
  }
  if (patch.label !== undefined) {
    const labelResult = persistRoleLabel(persisted, roleId, patch.label);
    if (!labelResult.ok) return labelResult;
  }
  if (patch.archived !== undefined) {
    if (patch.archived) {
      if (!persisted.archived.includes(roleId)) persisted.archived.push(roleId);
    } else {
      persisted.archived = persisted.archived.filter((r) => r !== roleId);
    }
  }

  const saved = await savePersisted(persisted, actorId);
  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}

/** Vérifie une permission fine (avec repli sur défauts si clé absente). */
export async function roleHasPermission(role: RoleId, permissionId: string): Promise<boolean> {
  const map = await getRolePermissionMap(role);
  if (permissionId in map) return Boolean(map[permissionId]);
  return false;
}

/** Map élargi menu.* + capacités techniques (session, guards API). */
export async function getRolePermissionMap(role: RoleId): Promise<Record<string, boolean>> {
  const persisted = await loadPersisted();
  const map = persisted.permissions[role];
  if (map) return resolveEffectivePermissionMap(map);
  if (isDgRole(role)) return resolveEffectivePermissionMap(DEFAULT_ROLE_PERMISSIONS[role]);
  return resolveEffectivePermissionMap(DEFAULT_ROLE_PERMISSIONS.MANAGER);
}

export async function getRoleLabel(roleId: RoleId): Promise<string> {
  const persisted = await loadPersisted();
  if (isCustomRoleId(roleId)) {
    const custom = persisted.customRoles.find((c) => c.id === roleId);
    if (custom) return custom.label;
  }
  if (isDgRole(roleId)) {
    return persisted.labels[roleId] ?? DG_ROLE_META[roleId].label;
  }
  return roleId;
}

/** Libellés des permissions actives pour un rôle (UI création utilisateur, fiche rôle). */
export async function getRolePermissionLabels(role: RoleId): Promise<string[]> {
  const persisted = await loadPersisted();
  const map = normalizeToMenuPermissions(
    persisted.permissions[role] ??
      (isDgRole(role) ? DEFAULT_ROLE_PERMISSIONS[role] : DEFAULT_ROLE_PERMISSIONS.MANAGER)
  );
  return PERMISSION_CATALOG.filter((p) => map[p.id]).map((p) => p.label);
}
