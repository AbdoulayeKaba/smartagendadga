import { verifyPassword } from '@/lib/auth/password';
import { isPasswordExpired } from '@/lib/auth/password-policy';
import { sessionExpiresAt } from '@/lib/auth/session-policy';
import { bumpUserSessionVersion } from '@/lib/auth/user-session-version';
import { recordUserLastLogin } from '@/lib/auth/record-user-last-login';
import type { RoleId } from '@/lib/dg/role-ids';
import { parseRoleId } from '@/lib/dg/role-ids';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockAuthenticate } from '@/lib/mock/users-store';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { prisma } from '@/lib/prisma';

export type CredentialsLoginError =
  | 'INVALID_CREDENTIALS'
  | 'PASSWORD_EXPIRED'
  | 'TWO_FACTOR_REQUIRED'
  | 'TWO_FACTOR_PENDING'
  | 'INVALID_TWO_FACTOR'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_ARCHIVED';

export type CredentialsLoginSuccess = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleId;
  department: string;
  sessionVersion?: number;
  sessionExp: number;
  mustChangePassword?: boolean;
};

export async function verifyCredentialsLogin(
  email: string,
  password: string,
  totpCode?: string
): Promise<
  { ok: true; user: CredentialsLoginSuccess } | { ok: false; error: CredentialsLoginError }
> {
  const normalized = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  if (!normalized || !normalizedPassword) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const settings = await getPlatformSettings();

  if (settings.twoFactorRequired) {
    return { ok: false, error: 'TWO_FACTOR_REQUIRED' };
  }

  if (isMockDataEnabled()) {
    const mock = mockAuthenticate(normalized, normalizedPassword);
    if (!mock) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const { mockGetTwoFactor } = await import('@/lib/mock/users-store');
    const { verifyTotpCode } = await import('@/lib/auth/totp');
    const tf = mockGetTwoFactor(mock.id);
    if (tf.enabled) {
      if (!totpCode?.trim()) return { ok: false, error: 'TWO_FACTOR_PENDING' };
      if (!tf.secret || !verifyTotpCode(tf.secret, totpCode)) {
        return { ok: false, error: 'INVALID_TWO_FACTOR' };
      }
    }

    let sessionVersion: number | undefined;
    if (settings.sessionSinglePerUser) {
      sessionVersion = await bumpUserSessionVersion(mock.id);
    }

    return {
      ok: true,
      user: {
        id: mock.id,
        email: mock.email,
        firstName: mock.firstName,
        lastName: mock.lastName,
        role: mock.role,
        department: mock.department,
        sessionVersion,
        sessionExp: sessionExpiresAt(settings),
        mustChangePassword: Boolean(mock.mustChangePassword),
      },
    };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) return { ok: false, error: 'INVALID_CREDENTIALS' };
  if (user.archived) return { ok: false, error: 'ACCOUNT_ARCHIVED' };
  if (!user.active) return { ok: false, error: 'ACCOUNT_INACTIVE' };

  const valid = await verifyPassword(normalizedPassword, user.passwordHash);
  if (!valid) return { ok: false, error: 'INVALID_CREDENTIALS' };

  if (!user.mustChangePassword && isPasswordExpired(user.passwordChangedAt, settings.passwordExpirationDays)) {
    return { ok: false, error: 'PASSWORD_EXPIRED' };
  }

  const { userRequiresTwoFactor, verifyUserTotp } = await import(
    '@/lib/services/account-two-factor'
  );
  if (await userRequiresTwoFactor(normalized)) {
    if (!totpCode?.trim()) return { ok: false, error: 'TWO_FACTOR_PENDING' };
    if (!(await verifyUserTotp(normalized, totpCode))) {
      return { ok: false, error: 'INVALID_TWO_FACTOR' };
    }
  }

  let sessionVersion: number | undefined;
  if (settings.sessionSinglePerUser) {
    sessionVersion = await bumpUserSessionVersion(user.id);
  }

  await recordUserLastLogin(user.id);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: parseRoleId(user.role) ?? 'MANAGER',
      department: user.department ?? '',
      sessionVersion,
      sessionExp: sessionExpiresAt(settings),
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export const CREDENTIALS_LOGIN_ERROR_LABELS: Record<CredentialsLoginError, string> = {
  INVALID_CREDENTIALS: 'Identifiants incorrects.',
  PASSWORD_EXPIRED:
    'Mot de passe expiré. Contactez l’administratrice pour définir un nouveau mot de passe.',
  TWO_FACTOR_REQUIRED:
    'L’authentification à deux facteurs est obligatoire. Utilisez la connexion Microsoft.',
  TWO_FACTOR_PENDING: 'Saisissez le code de vérification de votre application d’authentification.',
  INVALID_TWO_FACTOR: 'Code de vérification incorrect ou expiré.',
  ACCOUNT_INACTIVE:
    'Ce compte est désactivé. Contactez l’administratrice pour le réactiver.',
  ACCOUNT_ARCHIVED:
    'Ce compte est archivé. Contactez l’administratrice pour le restaurer.',
};
