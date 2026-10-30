import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { readWorkspaceFile } from '@/lib/storage/workspace-uploads';
import { getWorkspaceMailAttachment } from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const { id } = await ctx.params;
  const attachment = await getWorkspaceMailAttachment(id);
  if (!attachment) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const data = await readWorkspaceFile(attachment.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        'Content-Length': String(attachment.fileSize),
      },
    });
  } catch {
    return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
  }
}
