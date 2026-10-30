import {
  DEFAULT_PLATFORM_CONFIG,
  parsePlatformConfig,
  serializePlatformConfig,
  type PlatformConfig,
} from '@/lib/dg/platform-config';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetPlatformSettings, mockUpdatePlatformSettings } from '@/lib/mock/settings';
import {
  listPlatformSettingsRows,
  upsertPlatformSettingValue,
} from '@/lib/services/platform-settings-store';

export async function getPlatformSettings(): Promise<PlatformConfig> {
  if (isMockDataEnabled()) return mockGetPlatformSettings();

  const rows = await listPlatformSettingsRows();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  if (Object.keys(map).length === 0) return DEFAULT_PLATFORM_CONFIG;
  return parsePlatformConfig(map);
}

export async function updatePlatformSettings(
  patch: Partial<PlatformConfig>,
  updatedById?: string
): Promise<PlatformConfig> {
  if (isMockDataEnabled()) return mockUpdatePlatformSettings(patch);

  const current = await getPlatformSettings();
  const next = { ...current, ...patch };
  const serialized = serializePlatformConfig(next);

  for (const [key, value] of Object.entries(serialized)) {
    await upsertPlatformSettingValue(key, value, updatedById);
  }

  return next;
}

export async function getBufferMinutes(): Promise<number> {
  const s = await getPlatformSettings();
  return Number.isFinite(s.bufferMinutes) && s.bufferMinutes >= 0 ? s.bufferMinutes : 15;
}
