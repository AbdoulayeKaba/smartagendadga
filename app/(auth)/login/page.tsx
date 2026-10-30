import { LoginForm } from '@/components/auth/login-form';
import { passwordPolicyFromPlatform } from '@/lib/auth/password-policy';
import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { getPlatformSettings } from '@/lib/services/platform-settings';

export default async function LoginPage() {
  const settings = await getPlatformSettings();
  const branding = pickPlatformBranding(settings);
  const passwordPolicy = passwordPolicyFromPlatform(settings);
  return <LoginForm branding={branding} passwordPolicy={passwordPolicy} />;
}
