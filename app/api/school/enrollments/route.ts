import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

const postSchema = z.object({
  studentId: z.string().min(1),
  classroomId: z.string().min(1),
  academicYearId: z.string().min(1),
  status: z.enum(['active', 'suspended', 'completed', 'dropped']).optional(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const items = await prisma.studentEnrollment.findMany({
    orderBy: { enrolledAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      classroom: { select: { id: true, name: true, level: true, section: true } },
      academicYear: { select: { id: true, label: true } },
    },
  });
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
    const created = await prisma.studentEnrollment.create({
      data: {
        studentId: parsed.data.studentId,
        classroomId: parsed.data.classroomId,
        academicYearId: parsed.data.academicYearId,
        status: parsed.data.status ?? 'active',
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'DUPLICATE_ENROLLMENT' }, { status: 409 });
  }
}
