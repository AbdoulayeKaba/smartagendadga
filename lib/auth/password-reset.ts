import { createHash, randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { resolveAppBaseUrl } from '@/lib/auth/app-base-url';
import { validatePasswordForPlatform } from '@/lib/services/password-validation';
import { bumpUserSessionVersion } from '@/lib/auth/user-session-version';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockClearPasswordReset,
  mockFindUserByEmail,
  mockSetPasswordReset,
  mockValidatePasswordResetToken,
} from '@/lib/mock/users-store';
import { sendPasswordResetEmail } from '@/lib/services/password-reset-email';
import { prisma } from '@/lib/prisma';

export const PASSWORD_RESET_EXPIRES_MINUTES = 60;

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(token: string): string {
  const base = resolveAppBaseUrl();
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: true };

  if (isMockDataEnabled()) {
    const user = mockFindUserByEmail(normalized);
    if (!user) {
      // eslint-disable-next-line no-console
      console.info('[password-reset:skipped]', normalized, 'user_not_found');
      return { ok: true };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60_000);
    mockSetPasswordReset(user.id, hashResetToken(token), expiresAt.toISOString());

    const resetUrl = buildResetUrl(token);
    const delivery = await sendPasswordResetEmail({
      email: user.email,
      recipientName: `${user.firstName} ${user.lastName}`.trim(),
      resetUrl,
      expiresMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
    });
    // eslint-disable-next-line no-console
    console.info('[password-reset]', normalized, delivery, delivery === 'simulated' ? resetUrl : '');
    return { ok: true };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      active: true,
      archived: true,
      passwordHash: true,
    },
  });

  if (!user || user.archived || !user.active || !user.passwordHash) {
    // eslint-disable-next-line no-console
    console.info('[password-reset:skipped]', normalized, 'user_not_eligible');
    return { ok: true };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60_000);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashResetToken(token),
        passwordResetExpiresAt: expiresAt,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[password-reset:db-error]', normalized, err);
    throw err;
  }

  const resetUrl = buildResetUrl(token);
  const delivery = await sendPasswordResetEmail({
    email: user.email,
    recipientName: `${user.firstName} ${user.lastName}`.trim(),
    resetUrl,
    expiresMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
  });
  // eslint-disable-next-line no-console
  console.info('[password-reset]', normalized, delivery, delivery === 'simulated' ? resetUrl : '');

  return { ok: true };
}

export async function validatePasswordResetToken(
  token: string
): Promise<{ ok: true; email: string } | { ok: false }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false };

  if (isMockDataEnabled()) {
    const user = mockValidatePasswordResetToken(hashResetToken(trimmed));
    if (!user) return { ok: false };
    return { ok: true, email: user.email };
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashResetToken(trimmed),
      passwordResetExpiresAt: { gt: new Date() },
      active: true,
      archived: false,
    },
    select: { email: true },
  });

  if (!user) return { ok: false };
  return { ok: true, email: user.email };
}

export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const policyCheck = await validatePasswordForPlatform(input.newPassword);
  if (!policyCheck.ok) {
    return { ok: false, error: policyCheck.error };
  }

  const trimmed = input.token.trim();
  if (!trimmed) return { ok: false, error: 'INVALID_TOKEN' };

  if (isMockDataEnabled()) {
    const user = mockValidatePasswordResetToken(hashResetToken(trimmed));
    if (!user) return { ok: false, error: 'INVALID_TOKEN' };

    const { mockUpdateUser } = await import('@/lib/mock/users-store');
    const result = mockUpdateUser(user.id, {
      password: input.newPassword,
      mustChangePassword: false,
    });
    if (!result.ok) return { ok: false, error: 'INVALID_TOKEN' };

    mockClearPasswordReset(user.id);
    await bumpUserSessionVersion(user.id);
    return { ok: true };
  }

  const tokenHash = hashResetToken(trimmed);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
      active: true,
      archived: false,
    },
    select: { id: true },
  });

  if (!user) return { ok: false, error: 'INVALID_TOKEN' };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  });

  return { ok: true };
}
