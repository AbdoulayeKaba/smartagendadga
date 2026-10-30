import {
  passwordPolicyFromPlatform,
  type PasswordPolicyConfig,
} from '@/lib/auth/password-policy';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';

export type PasswordStrengthCheck = {
  id: string;
  label: string;
  met: boolean;
};

export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export type PasswordStrengthResult = {
  score: number;
  level: PasswordStrengthLevel;
  levelLabel: string;
  checks: PasswordStrengthCheck[];
  isCompliant: boolean;
};

const LEVEL_LABELS: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: 'Faible',
  medium: 'Moyenne',
  strong: 'Conforme à la politique',
};

export function buildPasswordPolicyChecks(
  password: string,
  policy: PasswordPolicyConfig = passwordPolicyFromPlatform(DEFAULT_PLATFORM_CONFIG)
): PasswordStrengthCheck[] {
  const checks: PasswordStrengthCheck[] = [
    {
      id: 'length',
      label: `Au moins ${policy.passwordMinLength} caractères`,
      met: password.length >= policy.passwordMinLength,
    },
  ];

  if (policy.passwordRequireUppercase) {
    checks.push({
      id: 'upper',
      label: 'Une majuscule (A-Z)',
      met: /[A-Z]/.test(password),
    });
  }

  if (policy.passwordRequireLowercase) {
    checks.push({
      id: 'lower',
      label: 'Une minuscule (a-z)',
      met: /[a-z]/.test(password),
    });
  }

  if (policy.passwordRequireNumbers) {
    checks.push({
      id: 'digit',
      label: 'Un chiffre (0-9)',
      met: /[0-9]/.test(password),
    });
  }

  if (policy.passwordRequireSpecialChars) {
    checks.push({
      id: 'special',
      label: 'Un caractère spécial',
      met: /[^A-Za-z0-9]/.test(password),
    });
  }

  return checks;
}

export function evaluatePasswordStrength(
  password: string,
  policy: PasswordPolicyConfig = passwordPolicyFromPlatform(DEFAULT_PLATFORM_CONFIG)
): PasswordStrengthResult {
  const checks = buildPasswordPolicyChecks(password, policy);

  if (!password) {
    return {
      score: 0,
      level: 'empty',
      levelLabel: '',
      checks,
      isCompliant: false,
    };
  }

  const metCount = checks.filter((c) => c.met).length;
  const score = Math.round((metCount / checks.length) * 100);
  const isCompliant = metCount === checks.length;

  let level: PasswordStrengthLevel = 'weak';
  if (isCompliant) {
    level = 'strong';
  } else if (score >= 50) {
    level = 'medium';
  }

  return {
    score,
    level,
    levelLabel: LEVEL_LABELS[level],
    checks,
    isCompliant,
  };
}
