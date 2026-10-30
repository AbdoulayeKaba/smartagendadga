import { NextResponse } from 'next/server';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { LOGO_MAX_BYTES } from '@/lib/dg/institutional-options';
import { platformBrandingLogoUrl } from '@/lib/dg/platform-branding';
import {
  deleteInstitutionLogo,
  saveInstitutionLogo,
} from '@/lib/storage/platform-branding';
import { revalidatePlatformBrandingCache } from '@/lib/services/platform-settings-cache';
import { updatePlatformSettings } from '@/lib/services/platform-settings';

const LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session.role, 'action.settings.general'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > LOGO_MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 422 });
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!LOGO_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 422 });
  }

  await saveInstitutionLogo(buffer, mimeType, file.name);
  const logoUrl = platformBrandingLogoUrl(Date.now());
  await updatePlatformSettings({ institutionLogoUrl: logoUrl }, auth.session.userId);
  revalidatePlatformBrandingCache();

  return NextResponse.json({ logoUrl });
}

export async function DELETE() {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session.role, 'action.settings.general'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await deleteInstitutionLogo();
  await updatePlatformSettings({ institutionLogoUrl: '' }, auth.session.userId);
  revalidatePlatformBrandingCache();

  return NextResponse.json({ ok: true });
}
