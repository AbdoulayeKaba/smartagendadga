import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyPortalToken } from '@/lib/portal/token';
import { getStudentBulletin } from '@/lib/school/services/bulletins';

function readBearer(req: Request): string | null {
  const raw = req.headers.get('authorization');
  if (!raw) return null;
  const [type, token] = raw.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function GET(req: Request) {
  const token = readBearer(req);
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload || payload.role !== 'parent' || !payload.parentId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const link = await prisma.$queryRaw<Array<{ parent_id: string }>>(
    Prisma.sql`SELECT parent_id FROM student_parents WHERE student_id = ${payload.studentId} AND parent_id = ${payload.parentId} LIMIT 1`
  );
  if (!link[0]) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const parentRows = await prisma.$queryRaw<Array<{ id: string; first_name: string; last_name: string; email: string | null }>>(
    Prisma.sql`SELECT id, first_name, last_name, email FROM parents WHERE id = ${payload.parentId} LIMIT 1`
  );
  const parent = parentRows[0] ?? null;
  const bulletin = await getStudentBulletin(payload.studentId);
  if (!bulletin) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ parent, student: bulletin.student, enrollment: bulletin.enrollment, metrics: bulletin.metrics, subjectAverages: bulletin.subjectAverages, absences: bulletin.absences });
}
