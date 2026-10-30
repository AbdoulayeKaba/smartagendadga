import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { listWorkspaceMailStatusTrace } from '@/lib/services/workspace-service';
import type { Ctx } from '@/lib/api/workspace-id-route';

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const { id } = await ctx.params;
  const items = await listWorkspaceMailStatusTrace(id);
  if (!items) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ items });
}
