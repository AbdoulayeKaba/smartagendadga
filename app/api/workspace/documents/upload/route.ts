import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import type { RoleId } from '@/lib/dg/role-ids';
import type { DgRole } from '@/lib/dg/rbac';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import {
  buildPendingReportKey,
  deleteWorkspaceFile,
  isAllowedWorkspaceMimeType,
  saveWorkspaceFile,
  WORKSPACE_UPLOAD_MAX_BYTES,
} from '@/lib/storage/workspace-uploads';

async function canUploadDocuments(role: RoleId | DgRole): Promise<boolean> {
  return (
    (await userHasPermission(role, 'action.documents.create')) ||
    (await userHasPermission(role, 'action.documents.edit'))
  );
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await canUploadDocuments(session.role))) {
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
  if (buffer.length === 0 || buffer.length > WORKSPACE_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 422 });
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isAllowedWorkspaceMimeType(mimeType)) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 422 });
  }

  const storageKey = buildPendingReportKey(file.name);
  await saveWorkspaceFile(storageKey, buffer);

  return NextResponse.json({
    file: {
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
  if (!(await canUploadDocuments(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const storageKey = new URL(req.url).searchParams.get('storageKey')?.trim();
  if (!storageKey || !storageKey.includes('/pending/')) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  await deleteWorkspaceFile(storageKey);
  return NextResponse.json({ ok: true });
}
