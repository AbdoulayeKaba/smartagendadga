import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { notifyStudentAndParents } from '@/lib/school/notifications';

const postSchema = z.object({
  studentId: z.string().min(1),
  assignmentId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  academicYearId: z.string().min(1),
  assessmentType: z.enum(['homework', 'quiz', 'exam', 'project', 'oral']),
  score: z.number().nonnegative(),
  maxScore: z.number().positive().optional(),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const items = await prisma.gradeRecord.findMany({
    orderBy: { assessmentDate: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
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

  const created = await prisma.gradeRecord.create({
    data: {
      ...parsed.data,
      maxScore: parsed.data.maxScore ?? 20,
      comment: parsed.data.comment || null,
    },
  });

  await notifyStudentAndParents({
    studentId: parsed.data.studentId,
    academicYearId: parsed.data.academicYearId,
    title: 'Nouvelle note publiee',
    message: `Une note (${parsed.data.assessmentType}) a ete enregistree: ${parsed.data.score}/${parsed.data.maxScore ?? 20}.`,
    meta: {
      gradeRecordId: created.id,
      subjectId: parsed.data.subjectId,
      teacherId: parsed.data.teacherId,
      assessmentDate: parsed.data.assessmentDate,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
