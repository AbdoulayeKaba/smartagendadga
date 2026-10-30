import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { extendMissionSchema } from '@/lib/workspace/schemas';
import { extendWorkspaceMission } from '@/lib/services/workspace-service';

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = extendMissionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }
  const result = await extendWorkspaceMission(
    id,
    parsed.data,
    auth.session!.userId,
    `${auth.session!.firstName} ${auth.session!.lastName}`.trim()
  );
  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ mission: result.mission });
}
