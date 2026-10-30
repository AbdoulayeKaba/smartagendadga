import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { isMockDataEnabled, mockSchoolKpis } from '@/lib/mock-data';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json(mockSchoolKpis);

  const [studentsTotalRes, teachersTotalRes, parentsTotalRes, classroomsTotalRes, activeEnrollmentsRes, gradesCountRes, absencesCountRes, justifiedAbsencesRes] =
    await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM students`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM teachers`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM parents`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM classrooms`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM student_enrollments WHERE status = 'active'`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM grade_records`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM student_absences`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM student_absences WHERE status = 'justified'`),
    ]);

  const zero = BigInt(0);
  const studentsTotal = Number(studentsTotalRes[0]?.total ?? zero);
  const teachersTotal = Number(teachersTotalRes[0]?.total ?? zero);
  const parentsTotal = Number(parentsTotalRes[0]?.total ?? zero);
  const classroomsTotal = Number(classroomsTotalRes[0]?.total ?? zero);
  const activeEnrollments = Number(activeEnrollmentsRes[0]?.total ?? zero);
  const gradesCount = Number(gradesCountRes[0]?.total ?? zero);
  const absencesCount = Number(absencesCountRes[0]?.total ?? zero);
  const justifiedAbsences = Number(justifiedAbsencesRes[0]?.total ?? zero);

  const justificationRate = absencesCount > 0 ? Number(((justifiedAbsences / absencesCount) * 100).toFixed(2)) : 0;

  return NextResponse.json({
    studentsTotal,
    teachersTotal,
    parentsTotal,
    classroomsTotal,
    activeEnrollments,
    gradesCount,
    absencesCount,
    justifiedAbsences,
    absenceJustificationRate: justificationRate,
  });
}
