import 'server-only';

import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { readInstitutionLogo } from '@/lib/storage/platform-branding';

export const EMAIL_INSTITUTION_LOGO_CID = 'institution-logo@agenda-dga';

export type EmailInlineLogo = {
  cid: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

function parseDataUrlLogo(dataUrl: string): EmailInlineLogo | null {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (!match) return null;

  const mimeType = match[1]?.trim() || 'image/png';
  const buffer = Buffer.from(match[2] ?? '', 'base64');
  if (buffer.length === 0) return null;

  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
      ? 'webp'
      : mimeType.includes('gif')
        ? 'gif'
        : mimeType.includes('svg')
          ? 'svg'
          : 'jpg';

  return {
    cid: EMAIL_INSTITUTION_LOGO_CID,
    buffer,
    mimeType,
    filename: `logo.${ext}`,
  };
}

/** Logo embarqué pour e-mails (évite les URLs localhost inaccessibles depuis Gmail, etc.). */
export async function resolveEmailInlineLogo(): Promise<EmailInlineLogo | null> {
  const file = await readInstitutionLogo();
  if (file) {
    const ext = file.mimeType.includes('png')
      ? 'png'
      : file.mimeType.includes('webp')
        ? 'webp'
        : file.mimeType.includes('gif')
          ? 'gif'
          : file.mimeType.includes('svg')
            ? 'svg'
            : 'jpg';
    return {
      cid: EMAIL_INSTITUTION_LOGO_CID,
      buffer: file.buffer,
      mimeType: file.mimeType,
      filename: `logo.${ext}`,
    };
  }

  const settings = await getPlatformSettings();
  const branding = pickPlatformBranding(settings);
  const logoUrl = branding.institutionLogoUrl?.trim() ?? '';
  if (logoUrl.startsWith('data:')) {
    return parseDataUrlLogo(logoUrl);
  }

  return null;
}

export function emailLogoCidSrc(cid: string): string {
  return `cid:${cid}`;
}
