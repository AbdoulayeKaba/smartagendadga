import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { emptyWorkspaceMailTrash } from '@/lib/services/workspace-service';

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const result = await emptyWorkspaceMailTrash(session.userId, {
    direction: url.searchParams.get('direction') ?? 'OUTGOING',
    mailKind: url.searchParams.get('mailKind') ?? 'DEPARTURE',
    year: parseYearFromRequest(url),
  });
  return NextResponse.json(result);
}
