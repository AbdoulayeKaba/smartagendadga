import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { readWorkspaceFile } from '@/lib/storage/workspace-uploads';
import { getWorkspaceDocument } from '@/lib/services/workspace-service';
import { isInlineReportStorageKey } from '@/lib/workspace/report-content';
import { reportMimeTypeFromFileName } from '@/lib/workspace/report-file';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const { id } = await ctx.params;
  const document = await getWorkspaceDocument(id);
  if (!document) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const url = new URL(req.url);
  const download = url.searchParams.get('download') === '1';
  const disposition = download ? 'attachment' : 'inline';

  if (isInlineReportStorageKey(document.storageKey)) {
    if (!document.bodyHtml?.trim()) {
      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }
    return new NextResponse(document.bodyHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(document.fileName)}"`,
      },
    });
  }

  try {
    const data = await readWorkspaceFile(document.storageKey);
    const mimeType = reportMimeTypeFromFileName(document.fileName);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(document.fileName)}"`,
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    const { ensureDemoReportPdfIfMissing } = await import('@/lib/seed/ensure-demo-report-files');
    const healed = await ensureDemoReportPdfIfMissing(document.storageKey, document.title);
    if (healed) {
      const mimeType = reportMimeTypeFromFileName(document.fileName);
      return new NextResponse(new Uint8Array(healed), {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `${disposition}; filename="${encodeURIComponent(document.fileName)}"`,
          'Content-Length': String(healed.byteLength),
          'Cache-Control': 'private, max-age=60',
        },
      });
    }
    return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
  }
}
