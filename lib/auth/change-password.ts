import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { validatePasswordForPlatform } from '@/lib/services/password-validation';
import { bumpUserSessionVersion } from '@/lib/auth/user-session-version';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockFindUserById, mockUpdateUser } from '@/lib/mock/users-store';
import { prisma } from '@/lib/prisma';

export async function completeUserPasswordChange(input: {
  userId: string;
  newPassword: string;
  currentPassword?: string;
  requireCurrentPassword?: boolean;
}): Promise<
  | { ok: true; sessionRevoked: boolean }
  | { ok: false; error: 'NOT_FOUND' | 'INVALID_CURRENT_PASSWORD' | string }
> {
  const policyCheck = await validatePasswordForPlatform(input.newPassword);
  if (!policyCheck.ok) {
    return { ok: false, error: policyCheck.error };
  }

  if (isMockDataEnabled()) {
    const user = mockFindUserById(input.userId);
    if (!user) return { ok: false, error: 'NOT_FOUND' };

    if (input.requireCurrentPassword) {
      const current = input.currentPassword?.trim() ?? '';
      if (!current || user.password !== current) {
        return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
      }
    }

    const result = mockUpdateUser(input.userId, {
      password: input.newPassword,
      mustChangePassword: false,
    });
    if (!result.ok) return { ok: false, error: 'NOT_FOUND' };
    await bumpUserSessionVersion(input.userId);
    return { ok: true, sessionRevoked: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true, mustChangePassword: true, archived: true, active: true },
  });
  if (!user || user.archived || !user.active) {
    return { ok: false, error: 'NOT_FOUND' };
  }

  if (input.requireCurrentPassword) {
    if (!user.passwordHash || !input.currentPassword?.trim()) {
      return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
    }
    const valid = await verifyPassword(input.currentPassword.trim(), user.passwordHash);
    if (!valid) return { ok: false, error: 'INVALID_CURRENT_PASSWORD' };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });

  return { ok: true, sessionRevoked: true };
}
