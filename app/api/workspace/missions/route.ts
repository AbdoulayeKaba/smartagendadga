import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createMissionSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import {
  countWorkspaceMissions,
  createWorkspaceMission,
  listWorkspaceMissions,
} from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const archivedParam = url.searchParams.get('archived');
  const archived = archivedParam === 'true';
  const year = parseYearFromRequest(url);
  const [items, counts] = await Promise.all([
    listWorkspaceMissions({ archived, year }),
    countWorkspaceMissions(),
  ]);
  return NextResponse.json({ items, counts });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.missions.create'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createMissionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  try {
    const result = await createWorkspaceMission(
      {
        subject: parsed.data.subject,
        missionType: parsed.data.missionType,
        destinations: parsed.data.destinations.map((c) => c.toUpperCase()),
        details: parsed.data.details ?? null,
        departAt: parsed.data.departAt,
        returnAt: parsed.data.returnAt,
        participants: parsed.data.participants,
      },
      session.userId,
      `${session.firstName} ${session.lastName}`.trim(),
      parsed.data.documents
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ mission: result.mission }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/workspace/missions]', e);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
