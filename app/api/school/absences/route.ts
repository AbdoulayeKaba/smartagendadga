import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { notifyStudentAndParents } from '@/lib/school/notifications';

const postSchema = z.object({
  studentId: z.string().min(1),
  assignmentId: z.string().optional().nullable(),
  academicYearId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  status: z.enum(['pending', 'justified', 'unjustified']).optional(),
  reason: z.string().trim().max(500).optional().nullable(),
  markedByTeacherId: z.string().optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const items = await prisma.studentAbsence.findMany({
    orderBy: { date: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      assignment: { include: { subject: { select: { name: true } } } },
      academicYear: { select: { id: true, label: true } },
      markedByTeacher: { select: { id: true, firstName: true, lastName: true } },
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

  const created = await prisma.studentAbsence.create({
    data: {
      studentId: parsed.data.studentId,
      assignmentId: parsed.data.assignmentId || null,
      academicYearId: parsed.data.academicYearId,
      date: parsed.data.date,
      startTime: parsed.data.startTime || null,
      endTime: parsed.data.endTime || null,
      status: parsed.data.status ?? 'pending',
      reason: parsed.data.reason || null,
      markedByTeacherId: parsed.data.markedByTeacherId || null,
    },
  });

  await notifyStudentAndParents({
    studentId: parsed.data.studentId,
    academicYearId: parsed.data.academicYearId,
    title: 'Absence enregistree',
    message: `Une absence a ete enregistree le ${parsed.data.date} (${parsed.data.startTime ?? '--:--'} - ${parsed.data.endTime ?? '--:--'}).`,
    meta: {
      absenceId: created.id,
      status: created.status,
      reason: created.reason,
      assignmentId: created.assignmentId,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
