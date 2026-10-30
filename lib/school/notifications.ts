import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type NotificationPayload = {
  title: string;
  message: string;
  channel?: 'email' | 'sms' | 'in_app';
  recipientEmail?: string | null;
  studentId?: string | null;
  parentId?: string | null;
  teacherId?: string | null;
  academicYearId?: string | null;
  meta?: unknown;
};

export async function createSchoolNotification(payload: NotificationPayload) {
  const id = crypto.randomUUID().replace(/-/g, '');
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO notifications (
      id, title, message, channel, status, recipient_email, student_id, parent_id, teacher_id, academic_year_id, meta, created_at
    ) VALUES (
      ${id},
      ${payload.title},
      ${payload.message},
      ${payload.channel ?? 'in_app'},
      ${'pending'},
      ${payload.recipientEmail ?? null},
      ${payload.studentId ?? null},
      ${payload.parentId ?? null},
      ${payload.teacherId ?? null},
      ${payload.academicYearId ?? null},
      ${payload.meta === undefined ? null : JSON.stringify(payload.meta)},
      NOW(3)
    )`
  );
  return id;
}

export async function notifyStudentAndParents(params: {
  studentId: string;
  academicYearId: string;
  title: string;
  message: string;
  meta?: unknown;
}) {
  const students = await prisma.$queryRaw<Array<{ id: string; email: string | null }>>(
    Prisma.sql`SELECT id, email FROM students WHERE id = ${params.studentId} LIMIT 1`
  );
  const student = students[0];
  if (!student) return;

  if (student.email) {
    await createSchoolNotification({
      title: params.title,
      message: params.message,
      channel: 'email',
      recipientEmail: student.email,
      studentId: student.id,
      academicYearId: params.academicYearId,
      meta: params.meta,
    });
  }

  const parents = await prisma.$queryRaw<Array<{ parent_id: string; parent_email: string | null }>>(
    Prisma.sql`SELECT sp.parent_id, p.email AS parent_email
               FROM student_parents sp
               INNER JOIN parents p ON p.id = sp.parent_id
               WHERE sp.student_id = ${student.id}`
  );

  for (const link of parents) {
    if (!link.parent_email) continue;
    await createSchoolNotification({
      title: params.title,
      message: params.message,
      channel: 'email',
      recipientEmail: link.parent_email,
      studentId: student.id,
      parentId: link.parent_id,
      academicYearId: params.academicYearId,
      meta: params.meta,
    });
  }
}

