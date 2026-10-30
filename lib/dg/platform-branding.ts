import type { PlatformConfig } from '@/lib/dg/platform-config';

export const PLATFORM_BRANDING_LOGO_PATH = '/api/platform/branding/logo';

export function platformBrandingLogoUrl(version?: string | number) {
  if (version === undefined || version === '') return PLATFORM_BRANDING_LOGO_PATH;
  return `${PLATFORM_BRANDING_LOGO_PATH}?v=${encodeURIComponent(String(version))}`;
}

export type PlatformBranding = {
  organizationName: string;
  institutionAcronym: string;
  institutionLogoUrl: string;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: 'Direction Générale Adjointe',
  institutionAcronym: 'DGA',
  institutionLogoUrl: '',
};

/** Ancien stockage base64 tronqué par la limite MySQL TEXT (65 535 octets). */
const MYSQL_TEXT_MAX_BYTES = 65_535;

export function normalizeInstitutionLogoUrl(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed.startsWith(PLATFORM_BRANDING_LOGO_PATH)) return trimmed;
  if (trimmed.startsWith('data:') && trimmed.length >= MYSQL_TEXT_MAX_BYTES) return '';
  return trimmed;
}

export function pickPlatformBranding(config: PlatformConfig): PlatformBranding {
  return {
    organizationName: config.organizationName?.trim() || DEFAULT_PLATFORM_BRANDING.organizationName,
    institutionAcronym: config.institutionAcronym?.trim() || DEFAULT_PLATFORM_BRANDING.institutionAcronym,
    institutionLogoUrl: normalizeInstitutionLogoUrl(config.institutionLogoUrl),
  };
}
