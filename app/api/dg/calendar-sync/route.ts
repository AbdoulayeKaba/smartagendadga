import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { syncDgCalendarOverlays } from '@/lib/services/dg-calendar-sync';

const bodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function POST(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
  }

  const result = await syncDgCalendarOverlays(from, to);
  return NextResponse.json({ ok: true, ...result });
}
