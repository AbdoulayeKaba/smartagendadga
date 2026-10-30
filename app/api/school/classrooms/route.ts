import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockClassrooms } from '@/lib/mock-data';

const postSchema = z.object({
  name: z.string().trim().min(1).max(191),
  level: z.string().trim().min(1).max(64),
  section: z.string().trim().max(64).optional().nullable(),
  capacity: z.number().int().min(1).max(200).optional(),
  building: z.string().trim().max(120).optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockClassrooms });
  const items = await prisma.classroom.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  try {
    const created = await prisma.classroom.create({
      data: {
        name: parsed.data.name,
        level: parsed.data.level,
        section: parsed.data.section || null,
        capacity: parsed.data.capacity ?? 30,
        building: parsed.data.building || null,
      },
    });
    try { await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, { action: 'school.classroom.create', entity: 'classroom', entityId: created.id }); } catch {}
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') return NextResponse.json({ error: 'DUPLICATE_CLASSROOM' }, { status: 409 });
    throw e;
  }
}
