import {
  DEFAULT_APPOINTMENT_BUSINESS_RULES,
  normalizeBusinessRules,
  type AppointmentBusinessRules,
} from '@/lib/dg/appointment-business-rules';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockGetAppointmentBusinessRules,
  mockUpdateAppointmentBusinessRules,
} from '@/lib/mock/appointment-business-rules-store';
import {
  getPlatformSettingValue,
  upsertPlatformSettingValue,
} from '@/lib/services/platform-settings-store';

export const APPOINTMENT_BUSINESS_RULES_KEY = 'dg_appointment_business_rules';

export async function getAppointmentBusinessRules(): Promise<AppointmentBusinessRules> {
  if (isMockDataEnabled()) return mockGetAppointmentBusinessRules();

  const value = await getPlatformSettingValue(APPOINTMENT_BUSINESS_RULES_KEY);
  if (!value) return { ...DEFAULT_APPOINTMENT_BUSINESS_RULES };
  try {
    return normalizeBusinessRules(JSON.parse(value) as Partial<AppointmentBusinessRules>);
  } catch {
    return { ...DEFAULT_APPOINTMENT_BUSINESS_RULES };
  }
}

export async function updateAppointmentBusinessRules(
  patch: Partial<AppointmentBusinessRules>,
  updatedById?: string
): Promise<AppointmentBusinessRules> {
  if (isMockDataEnabled()) return mockUpdateAppointmentBusinessRules(patch);

  const current = await getAppointmentBusinessRules();
  const next = normalizeBusinessRules({ ...current, ...patch });
  await upsertPlatformSettingValue(APPOINTMENT_BUSINESS_RULES_KEY, JSON.stringify(next), updatedById);
  return next;
}
