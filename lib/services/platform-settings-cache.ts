import { revalidateTag, unstable_cache } from 'next/cache';
import {
  DEFAULT_PLATFORM_BRANDING,
  pickPlatformBranding,
  platformBrandingLogoUrl,
} from '@/lib/dg/platform-branding';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { readInstitutionLogo } from '@/lib/storage/platform-branding';

export const PLATFORM_BRANDING_CACHE_TAG = 'dg-platform-branding';

async function resolvePlatformBranding() {
  try {
    const settings = await getPlatformSettings();
    const branding = pickPlatformBranding(settings);
    if (!branding.institutionLogoUrl) {
      const file = await readInstitutionLogo();
      if (file) {
        branding.institutionLogoUrl = platformBrandingLogoUrl();
      }
    }
    return branding;
  } catch {
    return pickPlatformBranding(DEFAULT_PLATFORM_CONFIG);
  }
}

/** Branding institutionnel — cache court pour accélérer le layout à chaque navigation. */
export const getCachedPlatformBranding = unstable_cache(
  async () => resolvePlatformBranding(),
  ['dg-platform-branding'],
  { revalidate: 120, tags: [PLATFORM_BRANDING_CACHE_TAG] }
);

export async function revalidatePlatformBrandingCache() {
  revalidateTag(PLATFORM_BRANDING_CACHE_TAG, 'max');
}

export async function getLayoutPlatformBranding() {
  try {
    return await getCachedPlatformBranding();
  } catch {
    return DEFAULT_PLATFORM_BRANDING;
  }
}
