import {
  DEFAULT_PLATFORM_CONFIG,
  parsePlatformConfig,
  serializePlatformConfig,
  type PlatformConfig,
} from '@/lib/dg/platform-config';

let settings: Record<string, string> = serializePlatformConfig(DEFAULT_PLATFORM_CONFIG);

export function mockGetPlatformSettings(): PlatformConfig {
  return parsePlatformConfig(settings);
}

export function mockUpdatePlatformSettings(patch: Partial<PlatformConfig>): PlatformConfig {
  const current = mockGetPlatformSettings();
  const next = { ...current, ...patch };
  settings = serializePlatformConfig(next);
  return next;
}
