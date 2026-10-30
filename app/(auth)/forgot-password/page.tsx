import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { getPlatformSettings } from '@/lib/services/platform-settings';

export default async function ForgotPasswordPage() {
  const branding = pickPlatformBranding(await getPlatformSettings());
  return <ForgotPasswordForm branding={branding} />;
}
