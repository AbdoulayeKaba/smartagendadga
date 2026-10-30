import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';
import { countBusinessDays } from '@/lib/arpt/workdays';
import { createArptNotification } from '@/lib/arpt/notifications';

const createSchema = z.object({
  leaveTypeId: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const url = new URL(req.url);
  const mine = url.searchParams.get('mine') === '1';

  const rows = mine
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          employeeId: string;
          employeeName: string;
          leaveType: string | null;
          startDate: string;
          endDate: string;
          workingDays: number;
          status: string;
          note: string | null;
          submittedAt: Date | null;
          approvedAt: Date | null;
          rejectionReason: string | null;
        }>
      >`
      SELECT l.id,
             l.employee_id AS employeeId,
             CONCAT(e.prenom, ' ', e.nom) AS employeeName,
             t.label AS leaveType,
             l.start_date AS startDate,
             l.end_date AS endDate,
             l.working_days AS workingDays,
             l.status,
             l.note,
             l.submitted_at AS submittedAt,
             l.approved_at AS approvedAt,
             l.rejection_reason AS rejectionReason
      FROM employee_leaves l
      INNER JOIN employees e ON e.id = l.employee_id
      LEFT JOIN leave_type_configs t ON t.id = l.leave_type_id
      WHERE l.employee_id = ${session.user.id}
      ORDER BY l.created_at DESC
      LIMIT 200
    `
    : await prisma.$queryRaw<
        Array<{
          id: string;
          employeeId: string;
          employeeName: string;
          leaveType: string | null;
          startDate: string;
          endDate: string;
          workingDays: number;
          status: string;
          note: string | null;
          submittedAt: Date | null;
          approvedAt: Date | null;
          rejectionReason: string | null;
        }>
      >`
      SELECT l.id,
             l.employee_id AS employeeId,
             CONCAT(e.prenom, ' ', e.nom) AS employeeName,
             t.label AS leaveType,
             l.start_date AS startDate,
             l.end_date AS endDate,
             l.working_days AS workingDays,
             l.status,
             l.note,
             l.submitted_at AS submittedAt,
             l.approved_at AS approvedAt,
             l.rejection_reason AS rejectionReason
      FROM employee_leaves l
      INNER JOIN employees e ON e.id = l.employee_id
      LEFT JOIN leave_type_configs t ON t.id = l.leave_type_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `;

  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  if (parsed.data.startDate > parsed.data.endDate) {
    return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 422 });
  }

  const holidays = await prisma.$queryRaw<Array<{ date: string }>>`SELECT date FROM public_holidays`;
  const holidaySet = new Set(holidays.map((h) => h.date));
  const workingDays = countBusinessDays(parsed.data.startDate, parsed.data.endDate, holidaySet);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO employee_leaves (
        id, employee_id, leave_type_id, start_date, end_date, type, status, note, working_days, submitted_at, created_at
      ) VALUES (
        UUID(),
        ${session.user.id},
        ${parsed.data.leaveTypeId},
        ${parsed.data.startDate},
        ${parsed.data.endDate},
        'autre',
        'submitted',
        ${parsed.data.note ?? null},
        ${workingDays},
        NOW(),
        NOW()
      )
    `;

    const managers = await tx.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT manager_id AS managerId FROM employees WHERE id = ${session.user.id} LIMIT 1
    `;
    const managerId = managers[0]?.managerId;
    if (managerId) {
      await createArptNotification({
        employeeId: managerId,
        type: 'leave_submitted',
        title: 'Nouvelle demande de conge',
        message: `${session.user.firstName} ${session.user.lastName} a soumis une demande.`,
      });
    }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
