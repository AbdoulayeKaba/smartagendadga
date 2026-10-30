import { hashPassword } from '@/lib/auth/password';
import { bumpUserSessionVersion } from '@/lib/auth/user-session-version';
import { validatePasswordForPlatform } from '@/lib/services/password-validation';
import type { DgRole } from '@/lib/dg/rbac';
import type { RoleId } from '@/lib/dg/role-ids';
import { parseRoleId } from '@/lib/dg/role-ids';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  buildRoleLabelMap,
  roleDisplayLabel,
  resolveRoleForUserUpdate,
  validateAssignableRoleId,
} from '@/lib/services/assignable-roles';
import {
  mockCreateUser,
  mockDeleteUser,
  mockEmptyUsersTrash,
  mockImportUsers,
  mockListUsers,
  mockUpdateUser,
  type ImportRow,
} from '@/lib/mock/users-store';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { prisma } from '@/lib/prisma';
import { mockWriteAudit } from '@/lib/mock/audit';
import { writeAudit } from '@/lib/services/appointments';
import type { WelcomeEmailDelivery } from '@/lib/welcome-email-delivery';
import { dgRoleLabel } from '@/lib/dg/role-labels';

const ROLES: DgRole[] = ['DG', 'ASSISTANT', 'MANAGER', 'EXTERNAL'];

export function parseDgRoleInput(raw: string): DgRole | null {
  const u = raw.trim().toUpperCase();
  return ROLES.includes(u as DgRole) ? (u as DgRole) : null;
}

async function countActiveAssistants(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: 'ASSISTANT',
      active: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function listUsers() {
  if (isMockDataEnabled()) return mockListUsers();

  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      archived: true,
      archivedAt: true,
      department: true,
      phone: true,
      createdAt: true,
      lastLoginAt: true,
      microsoftId: true,
    },
  }).then((rows) =>
    rows.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      archivedAt: u.archivedAt ? u.archivedAt.toISOString() : null,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      department: u.department ?? '',
      phone: u.phone ?? '',
    }))
  );
}

export async function createUser(
  input: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    department?: string;
    phone?: string;
    password?: string;
    sendWelcomeEmail?: boolean;
  },
  actorId: string
) {
  const roleId = await validateAssignableRoleId(input.role);
  if (!roleId) return { ok: false as const, error: 'INVALID_ROLE' as const };

  const roleLabels = await buildRoleLabelMap();

  if (isMockDataEnabled()) {
    const settings = await getPlatformSettings();
    const pwd = input.password ?? settings.defaultImportPassword;
    const policyCheck = await validatePasswordForPlatform(pwd);
    if (!policyCheck.ok) {
      return { ok: false as const, error: policyCheck.error };
    }
    const result = mockCreateUser({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: roleId,
      department: input.department,
      phone: input.phone,
      password: pwd,
    });
    if (result.ok) {
      mockWriteAudit(actorId, 'admin.user.create', undefined);
      let welcomeEmail: WelcomeEmailDelivery | undefined;
      if (input.sendWelcomeEmail) {
        const { sendUserWelcomeEmail } = await import('@/lib/services/user-welcome-email');
        welcomeEmail = await sendUserWelcomeEmail({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          roleLabel: roleDisplayLabel(roleId, roleLabels),
          initialPassword: pwd,
        }).catch(() => 'failed' as const);
      }
      return { ok: true as const, user: result.user, welcomeEmail };
    }
    return result;
  }

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  const settings = await getPlatformSettings();
  const pwd = input.password ?? settings.defaultImportPassword;
  const policyCheck = await validatePasswordForPlatform(pwd);
  if (!policyCheck.ok) {
    return { ok: false as const, error: policyCheck.error };
  }
  const passwordHash = await hashPassword(pwd);

  if (existing && !existing.archived) {
    return { ok: false as const, error: 'EMAIL_EXISTS' as const };
  }

  try {
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            role: roleId,
            department: input.department?.trim() ?? null,
            phone: input.phone?.trim() || null,
            passwordHash,
            mustChangePassword: true,
            passwordChangedAt: null,
            active: true,
            archived: false,
            archivedAt: null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
            phone: true,
            createdAt: true,
          },
        })
      : await prisma.user.create({
          data: {
            email,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            role: roleId,
            department: input.department?.trim() ?? null,
            phone: input.phone?.trim() || null,
            passwordHash,
            mustChangePassword: true,
            passwordChangedAt: null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
            phone: true,
            createdAt: true,
          },
        });

    await writeAudit(
      actorId,
      existing ? 'admin.user.restore' : 'admin.user.create',
      undefined,
      { email, restoredFromTrash: Boolean(existing) }
    ).catch((err) => {
      console.error('[createUser] audit log skipped:', err);
    });

    let welcomeEmail: WelcomeEmailDelivery | undefined;
    if (input.sendWelcomeEmail) {
      const { sendUserWelcomeEmail } = await import('@/lib/services/user-welcome-email');
      welcomeEmail = await sendUserWelcomeEmail({
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleLabel: roleDisplayLabel(roleId, roleLabels),
        initialPassword: pwd,
      }).catch(() => 'failed' as const);
    }

    return {
      ok: true as const,
      user: {
        ...user,
        active: true,
        archived: false,
        department: user.department ?? '',
        phone: user.phone ?? '',
        createdAt: user.createdAt.toISOString(),
      },
      welcomeEmail,
      restoredFromTrash: Boolean(existing),
    };
  } catch (e) {
    console.error('[createUser]', e);
    return { ok: false as const, error: 'CREATE_FAILED' as const };
  }
}

export async function updateUser(
  id: string,
  patch: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    department: string;
    phone: string;
    password: string;
    active: boolean;
    archived: boolean;
  }>,
  actorId: string
) {
  let resolvedRole: RoleId | undefined;
  if (patch.role !== undefined) {
    const currentRole =
      isMockDataEnabled()
        ? parseRoleId(mockListUsers().find((u) => u.id === id)?.role ?? '') ?? null
        : parseRoleId(
            (
              await prisma.user.findUnique({
                where: { id },
                select: { role: true },
              })
            )?.role ?? ''
          ) ?? null;
    const validated = await resolveRoleForUserUpdate(patch.role, currentRole);
    if (!validated) return { ok: false as const, error: 'INVALID_ROLE' as const };
    resolvedRole = validated;
  }

  if (isMockDataEnabled()) {
    if (patch.password) {
      const policyCheck = await validatePasswordForPlatform(patch.password);
      if (!policyCheck.ok) return { ok: false as const, error: policyCheck.error };
    }
    const result = mockUpdateUser(id, {
      ...patch,
      ...(resolvedRole !== undefined ? { role: resolvedRole } : {}),
    });
    const mockCurrent = mockListUsers().find((u) => u.id === id);
    const mockRoleChanged = Boolean(
      resolvedRole && mockCurrent && resolvedRole !== mockCurrent.role
    );
    const mockSessionInvalidated = Boolean(
      patch.password ||
        mockRoleChanged ||
        (patch.active === false && mockCurrent?.active) ||
        patch.archived === true
    );
    if (result.ok && mockSessionInvalidated) {
      await bumpUserSessionVersion(id);
    }
    if (result.ok) mockWriteAudit(actorId, 'admin.user.update', undefined);
    return {
      ...result,
      sessionRevoked: result.ok && id === actorId && mockSessionInvalidated,
    };
  }

  const data: Record<string, unknown> = {};
  if (patch.email) data.email = patch.email.trim().toLowerCase();
  if (patch.firstName) data.firstName = patch.firstName.trim();
  if (patch.lastName) data.lastName = patch.lastName.trim();
  if (patch.department !== undefined) data.department = patch.department.trim() || null;
  if (patch.phone !== undefined) data.phone = patch.phone.trim() || null;
  if (patch.password) {
    const policyCheck = await validatePasswordForPlatform(patch.password);
    if (!policyCheck.ok) return { ok: false as const, error: policyCheck.error };
    data.passwordHash = await hashPassword(patch.password);
    data.passwordChangedAt = new Date();
  }

  const current = await prisma.user.findUnique({
    where: { id },
    select: { role: true, active: true, archived: true },
  });
  if (!current) return { ok: false as const, error: 'NOT_FOUND' as const };

  const currentRoleId = parseRoleId(current.role);
  const roleChanged = Boolean(
    resolvedRole && currentRoleId && resolvedRole !== currentRoleId
  );
  if (roleChanged && resolvedRole) {
    data.role = resolvedRole;
  }

  const nextArchived = patch.archived !== undefined ? patch.archived : current.archived;

  if (patch.archived !== undefined) {
    data.archived = patch.archived;
    if (patch.archived) {
      data.active = false;
      data.archivedAt = new Date();
    } else {
      data.archivedAt = null;
      if (patch.active === undefined) {
        data.active = true;
      }
    }
  }

  if (patch.active !== undefined) {
    if (nextArchived && patch.active) {
      return { ok: false as const, error: 'USER_ARCHIVED' as const };
    }
    if (current.role === 'ASSISTANT' && current.active && patch.active === false) {
      const others = await countActiveAssistants(id);
      if (others === 0) return { ok: false as const, error: 'LAST_ADMIN' as const };
    }
    data.active = patch.active;
  }

  if (resolvedRole && current.role === 'ASSISTANT' && current.active && resolvedRole !== 'ASSISTANT') {
    const others = await countActiveAssistants(id);
    if (others === 0) return { ok: false as const, error: 'LAST_ADMIN' as const };
  }

  const shouldInvalidateSession = Boolean(
    patch.password ||
      roleChanged ||
      (patch.active === false && current.active) ||
      patch.archived === true
  );

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        active: true,
        archived: true,
        archivedAt: true,
        department: true,
        phone: true,
        createdAt: true,
      },
    });
    if (shouldInvalidateSession) {
      await bumpUserSessionVersion(id);
    }
    await writeAudit(actorId, 'admin.user.update', undefined, { userId: id }).catch((err) => {
      console.error('[updateUser] audit log skipped:', err);
    });
    return {
      ok: true as const,
      sessionRevoked: shouldInvalidateSession && id === actorId,
      user: {
        ...user,
        department: user.department ?? '',
        phone: user.phone ?? '',
        createdAt: user.createdAt.toISOString(),
        archivedAt: user.archivedAt ? user.archivedAt.toISOString() : null,
      },
    };
  } catch (e) {
    console.error('[updateUser]', e);
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2025') return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: false as const, error: 'UPDATE_FAILED' as const };
  }
}

export async function deleteUser(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const result = mockDeleteUser(id);
    if (result.ok) mockWriteAudit(actorId, 'admin.user.delete', undefined);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, archived: true },
  });
  if (!target) return { ok: false, error: 'NOT_FOUND' };
  if (!target.archived) return { ok: false, error: 'USER_NOT_ARCHIVED' };
  if (target.role === 'ASSISTANT') return { ok: false, error: 'CANNOT_DELETE_ASSISTANT' };

  try {
    await prisma.user.delete({ where: { id } });
    await writeAudit(actorId, 'admin.user.delete', undefined, { userId: id }).catch((err) => {
      console.error('[deleteUser] audit log skipped:', err);
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'DELETE_FAILED' };
  }
}

export async function emptyUsersTrash(actorId: string): Promise<{ purged: number; skipped: number }> {
  if (isMockDataEnabled()) {
    const result = mockEmptyUsersTrash();
    if (result.purged > 0) mockWriteAudit(actorId, 'admin.users.trash.empty', undefined);
    return result;
  }

  const trash = await prisma.user.findMany({
    where: { archived: true },
    select: { id: true, role: true },
  });

  let purged = 0;
  let skipped = 0;
  for (const u of trash) {
    if (u.role === 'ASSISTANT') {
      skipped++;
      continue;
    }
    const result = await deleteUser(u.id, actorId);
    if (result.ok) purged++;
    else skipped++;
  }

  if (purged > 0) {
    await writeAudit(actorId, 'admin.users.trash.empty', undefined, { purged, skipped }).catch((err) => {
      console.error('[emptyUsersTrash] audit log skipped:', err);
    });
  }

  return { purged, skipped };
}

export function parseCsvUsers(csv: string): ImportRow[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
  const start = header.includes('email') ? 1 : 0;

  const rows: ImportRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map((c) => c.trim());
    if (cols.length < 4) continue;

    let email: string;
    let firstName: string;
    let lastName: string;
    let roleRaw: string;
    let department: string | undefined;
    let password: string | undefined;

    if (start === 1) {
      const map: Record<string, string> = {};
      header.forEach((h, idx) => {
        map[h] = cols[idx] ?? '';
      });
      email = map.email ?? '';
      firstName = map.firstname ?? map['prénom'] ?? map.prenom ?? '';
      lastName = map.lastname ?? map.nom ?? '';
      roleRaw = map.role ?? 'MANAGER';
      department = map.department ?? map.département ?? map.departement;
      password = map.password ?? map.motdepasse;
    } else {
      [email, firstName, lastName, roleRaw, department, password] = cols as [
        string,
        string,
        string,
        string,
        string?,
        string?,
      ];
    }

    const role = parseDgRoleInput(roleRaw);
    if (!email || !firstName || !lastName || !role) continue;

    rows.push({
      email: email.toLowerCase(),
      firstName,
      lastName,
      role,
      department,
      password,
    });
  }

  return rows;
}

export async function importUsers(csv: string, actorId: string) {
  const rows = parseCsvUsers(csv);
  if (rows.length === 0) return { ok: false as const, error: 'EMPTY_CSV' as const };

  if (isMockDataEnabled()) {
    const settings = await getPlatformSettings();
    const withDefaults = rows.map((r) => ({
      ...r,
      password: r.password ?? settings.defaultImportPassword,
    }));
    const result = mockImportUsers(withDefaults);
    mockWriteAudit(actorId, 'admin.users.import', undefined);
    return { ok: true as const, ...result, total: rows.length };
  }

  const settings = await getPlatformSettings();
  const created: string[] = [];
  const errors: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const res = await createUser(
      { ...row, password: row.password ?? settings.defaultImportPassword },
      actorId
    );
    if (res.ok) created.push(res.user.email);
    else errors.push({ row: i + 1, email: row.email, error: res.error });
  }

  await writeAudit(actorId, 'admin.users.import', undefined, { created: created.length, errors: errors.length });
  return { ok: true as const, created: created.length, errors, total: rows.length };
}
