import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { readWorkspaceFile } from '@/lib/storage/workspace-uploads';
import { getWorkspaceMissionDocument } from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const { id } = await ctx.params;
  const document = await getWorkspaceMissionDocument(id);
  if (!document) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const data = await readWorkspaceFile(document.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        'Content-Length': String(document.fileSize),
      },
    });
  } catch {
    return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
  }
}
