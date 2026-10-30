import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { missionStatusActionSchema } from '@/lib/workspace/schemas';
import { applyMissionStatusTransition } from '@/lib/services/mission-workflow';

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = missionStatusActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const session = auth.session!;
  const actor = {
    userId: session.userId,
    userName: `${session.firstName} ${session.lastName}`.trim(),
  };

  const payload =
    parsed.data.action === 'cancel'
      ? {
          cancelReason: parsed.data.cancelReason,
          cancelReasonDetail: parsed.data.cancelReasonDetail,
        }
      : parsed.data.action === 'close'
        ? {
            closure: {
              closureReport: parsed.data.closureReport,
              closureResults: parsed.data.closureResults,
              closureRecommendations: parsed.data.closureRecommendations,
              closureComments: parsed.data.closureComments,
            },
          }
        : parsed.data.action === 'reopen'
          ? {
              returnAt: parsed.data.returnAt ?? undefined,
              reopenReason: parsed.data.reopenReason,
            }
          : undefined;

  try {
    const result = await applyMissionStatusTransition(id, parsed.data.action, actor, payload);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ mission: result.mission });
  } catch (err) {
    console.error('[mission-status]', err);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
