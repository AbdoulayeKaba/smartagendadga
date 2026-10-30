import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

const postSchema = z.object({
  label: z.string().trim().min(4).max(32),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isCurrent: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const items = await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });

  const created = await prisma.$transaction(async (tx) => {
    if (parsed.data.isCurrent) {
      await tx.academicYear.updateMany({ data: { isCurrent: false } });
    }
    return tx.academicYear.create({ data: parsed.data });
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
