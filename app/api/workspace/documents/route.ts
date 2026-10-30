import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createReportSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceDocument, countWorkspaceDocuments, listWorkspaceDocuments } from '@/lib/services/workspace-service';
import { ReportDuplicateError } from '@/lib/workspace/report-errors';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const archived = url.searchParams.get('archived') === 'true';
  try {
    const [items, counts] = await Promise.all([
      listWorkspaceDocuments({
        category: url.searchParams.get('category') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
        year: parseYearFromRequest(url),
        archived,
      }),
      countWorkspaceDocuments(),
    ]);
    return NextResponse.json({ items, counts });
  } catch (err) {
    console.error('[GET /api/workspace/documents]', err);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.documents.create'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  try {
    const document = await createWorkspaceDocument(
      {
        title: parsed.data.title,
        reportDate: parsed.data.reportDate,
        bodyHtml: parsed.data.bodyHtml ?? null,
        fileName: parsed.data.fileName ?? '',
        fileSize: parsed.data.fileSize ?? 0,
        storageKey: parsed.data.storageKey ?? '',
        uploadedById: session.userId,
      },
      session.userId
    );
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof ReportDuplicateError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }
    console.error('[POST /api/workspace/documents]', err);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
