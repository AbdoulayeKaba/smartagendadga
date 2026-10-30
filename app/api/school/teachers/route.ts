import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockTeachers } from '@/lib/mock-data';

const postSchema = z.object({
  matricule: z.string().trim().min(2).max(64),
  firstName: z.string().trim().min(1).max(191),
  lastName: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  specialty: z.string().trim().max(191).optional().nullable(),
  status: z.string().trim().max(32).optional(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockTeachers });

  const items = await prisma.teacher.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
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
    const created = await prisma.teacher.create({
      data: {
        ...parsed.data,
        email: parsed.data.email?.toLowerCase() || null,
        specialty: parsed.data.specialty || null,
        status: parsed.data.status || 'active',
        reviewedById: ctx.employeeId,
      },
    });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'school.teacher.create', entity: 'teacher', entityId: created.id,
      });
    } catch {}
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') return NextResponse.json({ error: 'DUPLICATE_KEY' }, { status: 409 });
    throw e;
  }
}
