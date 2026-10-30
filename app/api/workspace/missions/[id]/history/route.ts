import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { listMissionHistory } from '@/lib/services/mission-workflow';
import type { Ctx } from '@/lib/api/workspace-id-route';

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const { id } = await ctx.params;
  const items = await listMissionHistory(id);
  return NextResponse.json({ items });
}
