import {
  passwordPolicyFromPlatform,
  validatePasswordPolicy,
  type PasswordPolicyConfig,
} from '@/lib/auth/password-policy';
import { getPlatformSettings } from '@/lib/services/platform-settings';

export async function validatePasswordForPlatform(
  password: string,
  policyOverride?: PasswordPolicyConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getPlatformSettings();
  const policy = policyOverride ?? passwordPolicyFromPlatform(settings);
  const code = validatePasswordPolicy(password, policy);
  if (code) return { ok: false, error: code };
  return { ok: true };
}
