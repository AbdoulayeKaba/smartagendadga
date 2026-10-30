import type { RoleId } from '@/lib/dg/role-ids';

export type MockUserRecord = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: RoleId;
  department: string;
  phone: string;
  active: boolean;
  archived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  avatarUrl?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  mustChangePassword?: boolean;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: string | null;
};

const SEED: MockUserRecord[] = [
  {
    id: 'mock-dg',
    email: 'dg@organisation.local',
    password: 'password123',
    firstName: 'Mamadou',
    lastName: 'Falilou',
    role: 'DG',
    department: 'DDCN',
    phone: '',
    active: true,
    archived: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'mock-assistant',
    email: 'assistante@organisation.local',
    password: 'password123',
    firstName: 'Marie',
    lastName: 'Diallo',
    role: 'ASSISTANT',
    department: 'Cabinet DGA',
    phone: '+221 77 123 45 67',
    active: true,
    archived: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock-manager',
    email: 'manager@organisation.local',
    password: 'password123',
    firstName: 'Ibrahim',
    lastName: 'Camara',
    role: 'MANAGER',
    department: 'Affaires reglementaires',
    phone: '',
    active: true,
    archived: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  },
  {
    id: 'mock-disabled',
    email: 'desactive@organisation.local',
    password: 'password123',
    firstName: 'Fatou',
    lastName: 'Sow',
    role: 'MANAGER',
    department: 'Communication',
    phone: '',
    active: false,
    archived: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  },
  {
    id: 'mock-external',
    email: 'externe@partenaire.local',
    password: 'password123',
    firstName: 'Sophie',
    lastName: 'Martin',
    role: 'EXTERNAL',
    department: 'Partenaire',
    phone: '',
    active: false,
    archived: true,
    archivedAt: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'mock-inactive',
    email: 'inactif@organisation.local',
    password: 'password123',
    firstName: 'Amadou',
    lastName: 'Bah',
    role: 'MANAGER',
    department: 'Juridique',
    phone: '',
    active: false,
    archived: true,
    archivedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  },
];

let users: MockUserRecord[] = SEED.map((u) => ({ ...u }));
let userSeq = 100;

export type PublicUser = Omit<MockUserRecord, 'password'>;

function toPublic(u: MockUserRecord): PublicUser {
  const { password: _p, ...rest } = u;
  return rest;
}

export function mockListUsers(): PublicUser[] {
  return users
    .map(toPublic)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function mockFindUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email === normalized && u.active && !u.archived) ?? null;
}

export function mockFindUserById(id: string) {
  return users.find((u) => u.id === id) ?? null;
}

export function mockAuthenticate(email: string, password: string) {
  const user = mockFindUserByEmail(email);
  if (!user || user.password !== password.trim()) return null;
  mockRecordLastLogin(user.id);
  return user;
}

export function mockRecordLastLogin(userId: string) {
  const user = users.find((u) => u.id === userId);
  if (user) user.lastLoginAt = new Date().toISOString();
}

/** Réinitialise les comptes mock (utile après archivage en démo). */
export function mockResetUsers() {
  users = SEED.map((u) => ({ ...u }));
  userSeq = 100;
}

export function getDefaultGuestUser() {
  return users.find((u) => u.role === 'ASSISTANT' && u.active && !u.archived) ?? users[0];
}

export function mockCreateUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleId;
  department?: string;
  phone?: string;
  password?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (users.some((u) => u.email === email)) {
    return { ok: false as const, error: 'EMAIL_EXISTS' as const };
  }
  const row: MockUserRecord = {
    id: `mock-user-${userSeq++}`,
    email,
    password: input.password ?? 'Password1234@',
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    department: input.department?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    active: true,
    archived: false,
    createdAt: new Date().toISOString(),
    mustChangePassword: true,
  };
  users.push(row);
  return { ok: true as const, user: toPublic(row) };
}

export function mockUpdateUser(
  id: string,
  patch: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    role: RoleId;
    department: string;
    phone: string;
    password: string;
    active: boolean;
    archived: boolean;
    avatarUrl: string | null;
    mustChangePassword: boolean;
  }>
) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };

  if (patch.email) {
    const email = patch.email.trim().toLowerCase();
    if (users.some((u) => u.email === email && u.id !== id)) {
      return { ok: false as const, error: 'EMAIL_EXISTS' as const };
    }
    users[idx].email = email;
  }
  if (patch.firstName !== undefined) users[idx].firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) users[idx].lastName = patch.lastName.trim();
  if (patch.role !== undefined) {
    if (users[idx].role === 'ASSISTANT' && patch.role !== 'ASSISTANT') {
      const assistants = users.filter((u) => u.role === 'ASSISTANT' && u.active && !u.archived);
      if (assistants.length <= 1) return { ok: false as const, error: 'LAST_ADMIN' as const };
    }
    users[idx].role = patch.role;
  }
  if (patch.department !== undefined) users[idx].department = patch.department.trim();
  if (patch.phone !== undefined) users[idx].phone = patch.phone.trim();
  if (patch.password) users[idx].password = patch.password;
  if (patch.mustChangePassword !== undefined) {
    users[idx].mustChangePassword = patch.mustChangePassword;
  }
  if (patch.avatarUrl !== undefined) users[idx].avatarUrl = patch.avatarUrl;
  const nextArchived = patch.archived !== undefined ? patch.archived : users[idx].archived;

  if (patch.archived !== undefined) {
    users[idx].archived = patch.archived;
    if (patch.archived) {
      users[idx].active = false;
      users[idx].archivedAt = new Date().toISOString();
    } else {
      users[idx].archivedAt = null;
      if (patch.active === undefined) {
        users[idx].active = true;
      }
    }
  }
  if (patch.active !== undefined) {
    if (nextArchived && patch.active) {
      return { ok: false as const, error: 'USER_ARCHIVED' as const };
    }
    if (users[idx].role === 'ASSISTANT' && !patch.active) {
      const assistants = users.filter((u) => u.role === 'ASSISTANT' && u.active && !u.archived);
      if (assistants.length <= 1) return { ok: false as const, error: 'LAST_ADMIN' as const };
    }
    users[idx].active = patch.active;
  }

  return { ok: true as const, user: toPublic(users[idx]) };
}

export function mockDeleteUser(id: string) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };
  if (!users[idx].archived) return { ok: false as const, error: 'USER_NOT_ARCHIVED' as const };
  if (users[idx].role === 'ASSISTANT') return { ok: false as const, error: 'CANNOT_DELETE_ASSISTANT' as const };
  users.splice(idx, 1);
  return { ok: true as const };
}

export function mockEmptyUsersTrash() {
  const archived = users.filter((u) => u.archived);
  let purged = 0;
  let skipped = 0;
  for (const u of archived) {
    if (u.role === 'ASSISTANT') {
      skipped++;
      continue;
    }
    const idx = users.findIndex((x) => x.id === u.id);
    if (idx >= 0) {
      users.splice(idx, 1);
      purged++;
    }
  }
  return { purged, skipped };
}

export type ImportRow = {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleId;
  department?: string;
  password?: string;
};

export function mockImportUsers(rows: ImportRow[]) {
  const created: PublicUser[] = [];
  const errors: { row: number; email: string; error: string }[] = [];

  rows.forEach((row, i) => {
    const result = mockCreateUser(row);
    if (result.ok) created.push(result.user);
    else errors.push({ row: i + 1, email: row.email, error: result.error });
  });

  return { created: created.length, errors };
}

export function mockGetTwoFactor(userId: string) {
  const user = users.find((u) => u.id === userId);
  return {
    enabled: Boolean(user?.twoFactorEnabled),
    secret: user?.twoFactorSecret ?? null,
  };
}

export function mockSetTwoFactor(
  userId: string,
  value: { enabled: boolean; secret: string | null }
) {
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return false;
  users[idx].twoFactorEnabled = value.enabled;
  users[idx].twoFactorSecret = value.secret;
  return true;
}

export function mockSetPasswordReset(userId: string, tokenHash: string, expiresAt: string) {
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.passwordResetToken = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
}

export function mockValidatePasswordResetToken(tokenHash: string) {
  const now = Date.now();
  return (
    users.find(
      (u) =>
        u.active &&
        !u.archived &&
        u.passwordResetToken === tokenHash &&
        u.passwordResetExpiresAt &&
        new Date(u.passwordResetExpiresAt).getTime() > now
    ) ?? null
  );
}

export function mockClearPasswordReset(userId: string) {
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
}
