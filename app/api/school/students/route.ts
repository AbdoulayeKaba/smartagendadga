import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockStudents } from '@/lib/mock-data';

const postSchema = z.object({
  matricule: z.string().trim().min(2).max(64),
  firstName: z.string().trim().min(1).max(191),
  lastName: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  classroomId: z.string().trim().optional().nullable(),
  status: z.string().trim().max(32).optional(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockStudents });

  const items = await prisma.student.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    include: {
      classroom: { select: { id: true, name: true, level: true, section: true } },
      parents: { include: { parent: true } },
    },
  });

  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      matricule: s.matricule,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone,
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      status: s.status,
      classroom: s.classroom,
      parents: s.parents.map((p) => ({
        id: p.parent.id,
        firstName: p.parent.firstName,
        lastName: p.parent.lastName,
        email: p.parent.email,
        phone: p.parent.phone,
        relation: p.relation,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const created = await prisma.student.create({
      data: {
        matricule: parsed.data.matricule,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email?.toLowerCase() || null,
        phone: parsed.data.phone || null,
        dateOfBirth: parsed.data.dateOfBirth || null,
        gender: parsed.data.gender || null,
        classroomId: parsed.data.classroomId || null,
        status: parsed.data.status || 'active',
        reviewedById: ctx.employeeId,
      },
    });

    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'school.student.create',
        entity: 'student',
        entityId: created.id,
        meta: { matricule: created.matricule },
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') return NextResponse.json({ error: 'DUPLICATE_KEY' }, { status: 409 });
    throw e;
  }
}
