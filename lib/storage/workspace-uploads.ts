import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { WORKSPACE_UPLOAD_MAX_BYTES } from '@/lib/storage/workspace-file-utils';

export { WORKSPACE_UPLOAD_MAX_BYTES };

const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'workspace-uploads');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

export function sanitizeWorkspaceFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()éèêëàâùûôîïçÉÈÊËÀÂÙÛÔÎÏÇ]/gi, '_');
  return base.slice(0, 200) || 'fichier';
}

export function isAllowedWorkspaceMimeType(mimeType: string) {
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  return mimeType.startsWith('image/');
}

export function resolveWorkspaceStoragePath(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) throw new Error('INVALID_STORAGE_KEY');
  const full = path.resolve(UPLOAD_ROOT, normalized);
  if (!full.startsWith(path.resolve(UPLOAD_ROOT))) throw new Error('INVALID_STORAGE_KEY');
  return full;
}

export function buildPendingHotelAttachmentKey(missionId: string, fileName: string) {
  return `missions/${missionId}/pending/${randomUUID()}-${sanitizeWorkspaceFileName(fileName)}`;
}

export function buildPendingMissionDocumentKey(ownerId: string, fileName: string) {
  return `missions/${ownerId}/pending/${randomUUID()}-${sanitizeWorkspaceFileName(fileName)}`;
}

export function buildPendingReportKey(fileName: string) {
  return `reports/pending/${randomUUID()}-${sanitizeWorkspaceFileName(fileName)}`;
}

export function buildPendingMailAttachmentKey(mailOwnerId: string, fileName: string) {
  return `mail/${mailOwnerId}/pending/${randomUUID()}-${sanitizeWorkspaceFileName(fileName)}`;
}

export function isMailAttachmentDraftOwner(mailOwnerId: string) {
  return mailOwnerId.startsWith('draft-mail-');
}

export async function finalizeMailAttachmentKey(mailId: string, storageKey: string): Promise<string> {
  if (!storageKey.includes('/pending/')) return storageKey;
  const fileName = storageKey.split('/').pop()!;
  const newKey = `mail/${mailId}/files/${fileName}`;
  if (storageKey === newKey) return newKey;
  const data = await readWorkspaceFile(storageKey);
  await saveWorkspaceFile(newKey, data);
  await deleteWorkspaceFile(storageKey);
  return newKey;
}

export async function finalizeReportDocumentKey(
  documentId: string,
  storageKey: string
): Promise<string> {
  if (!storageKey.includes('/pending/')) return storageKey;
  const fileName = storageKey.split('/').pop()!;
  const newKey = `reports/${documentId}/${fileName}`;
  if (storageKey === newKey) return newKey;
  const data = await readWorkspaceFile(storageKey);
  await saveWorkspaceFile(newKey, data);
  await deleteWorkspaceFile(storageKey);
  return newKey;
}

export function isMissionDocumentDraftOwner(ownerId: string) {
  return ownerId.startsWith('draft-');
}

export async function finalizeMissionDocumentKey(missionId: string, storageKey: string): Promise<string> {
  if (!storageKey.includes('/pending/')) return storageKey;
  const fileName = storageKey.split('/').pop()!;
  const newKey = `missions/${missionId}/docs/${fileName}`;
  if (storageKey === newKey) return newKey;
  const data = await readWorkspaceFile(storageKey);
  await saveWorkspaceFile(newKey, data);
  await deleteWorkspaceFile(storageKey);
  return newKey;
}

export async function saveWorkspaceFile(storageKey: string, data: Buffer): Promise<void> {
  const filePath = resolveWorkspaceStoragePath(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

export async function readWorkspaceFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveWorkspaceStoragePath(storageKey));
}

export async function deleteWorkspaceFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(resolveWorkspaceStoragePath(storageKey));
  } catch {
    /* fichier déjà absent */
  }
}
