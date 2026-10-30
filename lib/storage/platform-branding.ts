import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const BRANDING_ROOT = path.join(process.cwd(), 'data', 'platform-branding');
const LOGO_BASENAME = 'institution-logo';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

function extFromMime(mimeType: string, fileName: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName && MIME_BY_EXT[fromName]) return fromName;
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '.jpg';
  }
}

function logoPathForExt(ext: string) {
  return path.join(BRANDING_ROOT, `${LOGO_BASENAME}${ext}`);
}

async function ensureDir() {
  await mkdir(BRANDING_ROOT, { recursive: true });
}

export async function saveInstitutionLogo(buffer: Buffer, mimeType: string, fileName: string) {
  await ensureDir();
  const ext = extFromMime(mimeType, fileName);
  const target = logoPathForExt(ext);

  for (const candidate of Object.keys(MIME_BY_EXT)) {
    const other = logoPathForExt(candidate);
    if (other !== target) {
      await unlink(other).catch(() => undefined);
    }
  }

  await writeFile(target, buffer);
  return { ext, mimeType: MIME_BY_EXT[ext] ?? mimeType };
}

export async function readInstitutionLogo(): Promise<
  { buffer: Buffer; mimeType: string } | null
> {
  for (const ext of Object.keys(MIME_BY_EXT)) {
    const full = logoPathForExt(ext);
    try {
      const buffer = await readFile(full);
      if (buffer.length === 0) continue;
      return { buffer, mimeType: MIME_BY_EXT[ext]! };
    } catch {
      continue;
    }
  }
  return null;
}

export async function deleteInstitutionLogo() {
  await ensureDir();
  for (const ext of Object.keys(MIME_BY_EXT)) {
    await unlink(logoPathForExt(ext)).catch(() => undefined);
  }
}
