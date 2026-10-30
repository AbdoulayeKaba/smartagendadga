import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { listWorkspaceMissionDocuments } from '@/lib/services/workspace-service';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const { id } = await ctx.params;
  const items = await listWorkspaceMissionDocuments(id);
  return NextResponse.json({ items });
}
