import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const AVATAR_ROOT = path.join(process.cwd(), 'data', 'user-avatars');

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXT));

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function extFromMime(mimeType: string, fileName: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName && MIME_BY_EXT[fromName]) return fromName === '.jpeg' ? '.jpg' : fromName;
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.jpg';
  }
}

function avatarPath(userId: string, ext: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(AVATAR_ROOT, `${safeId}${ext}`);
}

async function ensureDir() {
  await mkdir(AVATAR_ROOT, { recursive: true });
}

export function isAllowedAvatarMime(mimeType: string) {
  return ALLOWED_MIME.has(mimeType);
}

export async function saveUserAvatar(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
) {
  await ensureDir();
  const ext = extFromMime(mimeType, fileName);
  const target = avatarPath(userId, ext);

  for (const candidate of Object.keys(MIME_BY_EXT)) {
    const other = avatarPath(userId, candidate);
    if (other !== target) {
      await unlink(other).catch(() => undefined);
    }
  }

  await writeFile(target, buffer);
  return { ext, mimeType: MIME_BY_EXT[ext] ?? mimeType };
}

export async function readUserAvatar(
  userId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  for (const ext of Object.keys(MIME_BY_EXT)) {
    const full = avatarPath(userId, ext);
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

export async function deleteUserAvatar(userId: string) {
  await ensureDir();
  for (const ext of Object.keys(MIME_BY_EXT)) {
    await unlink(avatarPath(userId, ext)).catch(() => undefined);
  }
}

export function publicAvatarUrl(userId: string, version?: number | string) {
  const v = version ?? Date.now();
  return `/api/users/${userId}/avatar?v=${v}`;
}
