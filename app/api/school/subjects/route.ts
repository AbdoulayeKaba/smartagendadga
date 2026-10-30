import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

const postSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(191),
  coefficient: z.number().positive().max(10).optional(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const items = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
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

  try {
    const created = await prisma.subject.create({ data: { ...parsed.data, coefficient: parsed.data.coefficient ?? 1 } });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'DUPLICATE_SUBJECT' }, { status: 409 });
  }
}
