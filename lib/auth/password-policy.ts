import type { PlatformConfig } from '@/lib/dg/platform-config';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';

export type PasswordPolicyConfig = Pick<
  PlatformConfig,
  | 'passwordMinLength'
  | 'passwordExpirationDays'
  | 'passwordRequireUppercase'
  | 'passwordRequireLowercase'
  | 'passwordRequireNumbers'
  | 'passwordRequireSpecialChars'
>;

export const PASSWORD_POLICY_ERROR_LABELS: Record<string, string> = {
  PASSWORD_TOO_SHORT: 'Mot de passe trop court',
  PASSWORD_NEEDS_UPPERCASE: 'Une majuscule est requise',
  PASSWORD_NEEDS_LOWERCASE: 'Une minuscule est requise',
  PASSWORD_NEEDS_DIGIT: 'Un chiffre est requis',
  PASSWORD_NEEDS_SPECIAL: 'Un caractère spécial est requis',
};

export function passwordPolicyErrorMessage(code: string): string {
  return PASSWORD_POLICY_ERROR_LABELS[code] ?? 'Mot de passe non conforme à la politique.';
}

export function passwordPolicyFromPlatform(
  config: Pick<PlatformConfig, keyof PasswordPolicyConfig>
): PasswordPolicyConfig {
  return {
    passwordMinLength: config.passwordMinLength,
    passwordExpirationDays: config.passwordExpirationDays,
    passwordRequireUppercase: config.passwordRequireUppercase,
    passwordRequireLowercase: config.passwordRequireLowercase,
    passwordRequireNumbers: config.passwordRequireNumbers,
    passwordRequireSpecialChars: config.passwordRequireSpecialChars,
  };
}

export function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicyConfig = passwordPolicyFromPlatform(DEFAULT_PLATFORM_CONFIG)
): string | null {
  if (password.length < policy.passwordMinLength) return 'PASSWORD_TOO_SHORT';
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) return 'PASSWORD_NEEDS_UPPERCASE';
  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) return 'PASSWORD_NEEDS_LOWERCASE';
  if (policy.passwordRequireNumbers && !/[0-9]/.test(password)) return 'PASSWORD_NEEDS_DIGIT';
  if (policy.passwordRequireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    return 'PASSWORD_NEEDS_SPECIAL';
  }
  return null;
}

export function isPasswordExpired(
  passwordChangedAt: Date | string | null | undefined,
  expirationDays: number
): boolean {
  if (!expirationDays || expirationDays <= 0) return false;
  if (!passwordChangedAt) return false;
  const changed = typeof passwordChangedAt === 'string' ? new Date(passwordChangedAt) : passwordChangedAt;
  if (Number.isNaN(changed.getTime())) return false;
  const expiresAt = changed.getTime() + expirationDays * 24 * 60 * 60 * 1000;
  return Date.now() > expiresAt;
}
