import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { listDgCalendarOverlays } from '@/lib/services/dg-calendar-overlays';

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
  }

  const items = await listDgCalendarOverlays(from, to);
  return NextResponse.json({ items });
}
