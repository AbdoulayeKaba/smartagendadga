import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/prisma';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import {
  buildPendingMissionDocumentKey,
  deleteWorkspaceFile,
  isAllowedWorkspaceMimeType,
  isMissionDocumentDraftOwner,
  saveWorkspaceFile,
  WORKSPACE_UPLOAD_MAX_BYTES,
} from '@/lib/storage/workspace-uploads';

async function assertOwnerId(ownerId: string) {
  if (isMissionDocumentDraftOwner(ownerId)) return true;
  const mission = await prisma.dgMission.findUnique({
    where: { id: ownerId },
    select: { id: true, archived: true },
  });
  return Boolean(mission && !mission.archived);
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = formData.get('file');
  const ownerId = String(formData.get('ownerId') ?? '').trim();

  if (!(file instanceof File) || !ownerId) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (!(await assertOwnerId(ownerId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > WORKSPACE_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 422 });
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isAllowedWorkspaceMimeType(mimeType)) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 422 });
  }

  const storageKey = buildPendingMissionDocumentKey(ownerId, file.name);
  await saveWorkspaceFile(storageKey, buffer);

  return NextResponse.json({
    document: {
      fileName: file.name,
      fileSize: buffer.length,
      mimeType,
      storageKey,
    },
  });
}

export async function DELETE(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const storageKey = new URL(req.url).searchParams.get('storageKey')?.trim();
  if (!storageKey || !storageKey.includes('/pending/')) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  await deleteWorkspaceFile(storageKey);
  return NextResponse.json({ ok: true });
}
