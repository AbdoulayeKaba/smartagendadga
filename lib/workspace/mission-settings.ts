import { isMockDataEnabled } from '@/lib/mock/config';
import { getPlatformSettingValue } from '@/lib/services/platform-settings-store';

const CLOSURE_REPORT_KEY = 'mission.closure_report_required';
const AUTO_COMPLETE_KEY = 'mission.auto_complete_on_return';

export async function isMissionClosureReportRequired(): Promise<boolean> {
  if (isMockDataEnabled()) return false;
  const value = await getPlatformSettingValue(CLOSURE_REPORT_KEY);
  return value === 'true';
}

/** Missions « En cours » → « Terminée » dès la date de retour atteinte (désactivable via réglage). */
export async function isMissionAutoCompleteOnReturn(): Promise<boolean> {
  if (isMockDataEnabled()) return true;
  const value = await getPlatformSettingValue(AUTO_COMPLETE_KEY);
  if (value == null) return true;
  return value !== 'false';
}
