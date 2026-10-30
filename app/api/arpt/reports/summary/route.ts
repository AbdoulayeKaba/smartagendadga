import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';

export async function GET() {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin', 'rh'])) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<
    Array<{
      employee: string;
      leaveType: string | null;
      startDate: string;
      endDate: string;
      workingDays: number;
      status: string;
      submittedAt: Date | null;
    }>
  >`
    SELECT CONCAT(e.prenom, ' ', e.nom) AS employee,
           t.label AS leaveType,
           l.start_date AS startDate,
           l.end_date AS endDate,
           l.working_days AS workingDays,
           l.status,
           l.submitted_at AS submittedAt
    FROM employee_leaves l
    INNER JOIN employees e ON e.id = l.employee_id
    LEFT JOIN leave_type_configs t ON t.id = l.leave_type_id
    ORDER BY l.created_at DESC
  `;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Demandes Conges');
  sheet.columns = [
    { header: 'Employe', key: 'employee', width: 28 },
    { header: 'Type', key: 'leaveType', width: 20 },
    { header: 'Debut', key: 'startDate', width: 14 },
    { header: 'Fin', key: 'endDate', width: 14 },
    { header: 'Jours Ouvrables', key: 'workingDays', width: 18 },
    { header: 'Statut', key: 'status', width: 14 },
    { header: 'Soumise Le', key: 'submittedAt', width: 20 },
  ];

  rows.forEach((r) => {
    sheet.addRow({
      ...r,
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
    });
  });

  const fileBuffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="arpt-conges.xlsx"',
    },
  });
}
