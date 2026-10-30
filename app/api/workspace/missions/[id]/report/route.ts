import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import {
  attachWorkspaceMissionReportFile,
  deleteWorkspaceMissionReportFile,
} from '@/lib/services/workspace-service';
import {
  isAllowedWorkspaceMimeType,
  WORKSPACE_UPLOAD_MAX_BYTES,
} from '@/lib/storage/workspace-uploads';

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

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

  const session = auth.session!;
  const result = await attachWorkspaceMissionReportFile(
    id,
    {
      fileName: file.name,
      fileSize: buffer.length,
      mimeType,
      buffer,
    },
    session.userId,
    `${session.firstName} ${session.lastName}`.trim()
  );

  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ document: result.document, mission: result.mission });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  const session = auth.session!;
  const result = await deleteWorkspaceMissionReportFile(
    id,
    session.userId,
    `${session.firstName} ${session.lastName}`.trim()
  );

  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ mission: result.mission });
}
