import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { attendanceTimezone, calendarDateInTz } from '@/lib/attendance/timezone';

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scope: z.enum(['self', 'all']).optional().default('self'),
});

export async function GET(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    date: url.searchParams.get('date') ?? undefined,
    scope: url.searchParams.get('scope') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const { date: dateParam, scope } = parsed.data;
  const date = dateParam ?? calendarDateInTz(new Date(), attendanceTimezone());

  if (scope === 'all' && !isHrFamily(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await prisma.attendance.findMany({
    where: {
      date,
      ...(scope === 'self' ? { employeeId: ctx.employeeId } : {}),
    },
    orderBy: [{ employee: { nom: 'asc' } }, { checkIn: 'asc' }],
    include: {
      employee: {
        select: { id: true, nom: true, prenom: true, email: true, matricule: true, service: true },
      },
      checkInLocation: { select: { id: true, name: true } },
      checkOutLocation: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    date,
    items: rows.map((r) => ({
      id: r.id,
      employee: r.employee,
      checkIn: r.checkIn?.toISOString() ?? null,
      checkOut: r.checkOut?.toISOString() ?? null,
      status: r.status,
      workedMinutes: r.workedMinutes,
      checkInLocation: r.checkInLocation ?? null,
      checkOutLocation: r.checkOutLocation ?? null,
    })),
  });
}
