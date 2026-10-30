import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { passwordPolicyFromPlatform } from '@/lib/auth/password-policy';
import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { getPlatformSettings } from '@/lib/services/platform-settings';

export default async function ResetPasswordPage() {
  const settings = await getPlatformSettings();
  const branding = pickPlatformBranding(settings);
  const passwordPolicy = passwordPolicyFromPlatform(settings);
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm branding={branding} passwordPolicy={passwordPolicy} />
    </Suspense>
  );
}
