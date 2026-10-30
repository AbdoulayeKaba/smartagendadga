import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockFindUserById, mockUpdateUser } from '@/lib/mock/users-store';
import { hashPassword } from '@/lib/auth/password';
import { validatePasswordForPlatform } from '@/lib/services/password-validation';
import {
  deleteUserAvatar,
  publicAvatarUrl,
  saveUserAvatar,
} from '@/lib/storage/user-avatars';

export type AccountProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  if (isMockDataEnabled()) {
    const mock = mockFindUserById(userId);
    if (!mock) return null;
    return {
      id: mock.id,
      email: mock.email,
      firstName: mock.firstName,
      lastName: mock.lastName,
      phone: mock.phone ?? '',
      department: mock.department ?? '',
      avatarUrl: mock.avatarUrl ?? null,
      lastLoginAt: mock.lastLoginAt ?? null,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.archived) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    department: user.department ?? '',
    avatarUrl: user.avatarUrl ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export async function updateAccountProfile(
  userId: string,
  patch: {
    firstName: string;
    lastName: string;
    phone: string;
    department: string;
    password?: string;
  }
) {
  if (patch.password) {
    const policyCheck = await validatePasswordForPlatform(patch.password);
    if (!policyCheck.ok) return { ok: false as const, error: policyCheck.error };
  }

  if (isMockDataEnabled()) {
    const result = mockUpdateUser(userId, {
      firstName: patch.firstName,
      lastName: patch.lastName,
      phone: patch.phone,
      department: patch.department,
      ...(patch.password ? { password: patch.password } : {}),
    });
    if (!result.ok) return { ok: false as const, error: 'NOT_FOUND' as const };
    return {
      ok: true as const,
      sessionRevoked: Boolean(patch.password),
      profile: await getAccountProfile(userId),
    };
  }

  const data: {
    firstName: string;
    lastName: string;
    phone: string | null;
    department: string | null;
    passwordHash?: string;
    passwordChangedAt?: Date;
    sessionVersion?: { increment: number };
  } = {
    firstName: patch.firstName,
    lastName: patch.lastName,
    phone: patch.phone.trim() || null,
    department: patch.department.trim() || null,
  };

  if (patch.password) {
    data.passwordHash = await hashPassword(patch.password);
    data.passwordChangedAt = new Date();
    data.sessionVersion = { increment: 1 };
  }

  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }

  return {
    ok: true as const,
    sessionRevoked: Boolean(patch.password),
    profile: await getAccountProfile(userId),
  };
}

export async function uploadAccountAvatar(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
) {
  await saveUserAvatar(userId, buffer, mimeType, fileName);
  const avatarUrl = publicAvatarUrl(userId, Date.now());

  if (isMockDataEnabled()) {
    mockUpdateUser(userId, { avatarUrl });
    return { ok: true as const, avatarUrl };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
  return { ok: true as const, avatarUrl };
}

export async function removeAccountAvatar(userId: string) {
  await deleteUserAvatar(userId);

  if (isMockDataEnabled()) {
    mockUpdateUser(userId, { avatarUrl: null });
    return { ok: true as const };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  return { ok: true as const };
}
