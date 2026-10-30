import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireArptAuth } from '@/lib/auth/arpt-auth';

export async function GET(req: Request) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const end = `${month}-31`;

  const leaves = await prisma.$queryRaw<
    Array<{
      id: string;
      employeeName: string;
      startDate: string;
      endDate: string;
      status: string;
    }>
  >`
    SELECT l.id, CONCAT(e.prenom, ' ', e.nom) AS employeeName, l.start_date AS startDate, l.end_date AS endDate, l.status
    FROM employee_leaves l
    INNER JOIN employees e ON e.id = l.employee_id
    WHERE l.start_date <= ${end} AND l.end_date >= ${start}
    ORDER BY l.start_date ASC
  `;

  const holidays = await prisma.$queryRaw<Array<{ id: string; date: string; name: string }>>`
    SELECT id, date, name FROM public_holidays WHERE date BETWEEN ${start} AND ${end} ORDER BY date ASC
  `;

  return NextResponse.json({ leaves, holidays });
}
