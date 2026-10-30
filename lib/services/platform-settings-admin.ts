import type { PlatformConfig } from '@/lib/dg/platform-config';
import { normalizeInstitutionLogoUrl } from '@/lib/dg/platform-branding';
import { normalizeOptionalUrl } from '@/lib/dg/settings-validation';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/services/platform-settings';

export const SMTP_PASSWORD_MASK = '********';

export function sanitizeSettingsForClient(config: PlatformConfig): PlatformConfig {
  return {
    ...config,
    institutionLogoUrl: normalizeInstitutionLogoUrl(config.institutionLogoUrl),
    institutionWebsite: normalizeOptionalUrl(config.institutionWebsite),
    smtpPassword: config.smtpPassword ? SMTP_PASSWORD_MASK : '',
  };
}

export async function getPlatformSettingsForAdmin(): Promise<PlatformConfig> {
  const settings = await getPlatformSettings();
  return sanitizeSettingsForClient(settings);
}

export async function updatePlatformSettingsForAdmin(
  patch: Partial<PlatformConfig>,
  userId: string
): Promise<PlatformConfig> {
  const current = await getPlatformSettings();
  const next: Partial<PlatformConfig> = { ...patch };

  if (
    patch.smtpPassword === undefined ||
    patch.smtpPassword === '' ||
    patch.smtpPassword === SMTP_PASSWORD_MASK
  ) {
    next.smtpPassword = current.smtpPassword;
  }

  if (patch.notifyAppointmentReminders !== undefined) {
    next.reminderEmailEnabled = patch.notifyAppointmentReminders;
  }
  if (patch.reminderEmailEnabled !== undefined && patch.notifyAppointmentReminders === undefined) {
    next.notifyAppointmentReminders = patch.reminderEmailEnabled;
  }

  const settings = await updatePlatformSettings(next, userId);
  return sanitizeSettingsForClient(settings);
}
