import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import type { AuditActionCategory } from '@/lib/dg/audit-journal';
import { listAuditJournal } from '@/lib/services/audit-journal-admin';

const querySchema = z.object({
  q: z.string().max(200).optional(),
  category: z
    .enum(['ALL', 'LOGIN', 'UPDATE', 'DELETE', 'EXPORT', 'BUSINESS', 'OTHER'])
    .optional(),
  userId: z.string().max(64).optional(),
  from: z.string().max(32).optional(),
  to: z.string().max(32).optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') || undefined,
    category: url.searchParams.get('category') || undefined,
    userId: url.searchParams.get('userId') || undefined,
    from: url.searchParams.get('from') || undefined,
    to: url.searchParams.get('to') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const category = parsed.data.category as AuditActionCategory | 'ALL' | undefined;

  const data = await listAuditJournal({
    q: parsed.data.q,
    category: category ?? 'ALL',
    userId: parsed.data.userId,
    from: parsed.data.from,
    to: parsed.data.to,
  });

  return NextResponse.json(data);
}
