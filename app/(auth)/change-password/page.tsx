import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { passwordPolicyFromPlatform } from '@/lib/auth/password-policy';
import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { getPlatformSettings } from '@/lib/services/platform-settings';

export default async function ChangePasswordPage() {
  const settings = await getPlatformSettings();
  const branding = pickPlatformBranding(settings);
  const passwordPolicy = passwordPolicyFromPlatform(settings);
  return <ChangePasswordForm branding={branding} passwordPolicy={passwordPolicy} />;
}
