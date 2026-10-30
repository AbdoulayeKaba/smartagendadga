import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canAccessAssistantWorkspace } from '@/lib/workspace/rbac';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { getWorkspaceDashboard } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canAccessAssistantWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  try {
    const year = parseYearFromRequest(new URL(req.url));
    const data = await getWorkspaceDashboard(year);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[workspace/dashboard]', err);
    return NextResponse.json({ error: 'DASHBOARD_LOAD_FAILED' }, { status: 500 });
  }
}
