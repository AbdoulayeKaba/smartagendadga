import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { attendanceTimezone, calendarDateInTz } from '@/lib/attendance/timezone';
import {
  buildAttendanceExportBuffer,
  exportTimezoneLabel,
  type ExportAttendanceRow,
} from '@/lib/attendance/export-excel';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const MAX_RANGE_DAYS = 93;

function parseYmd(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export async function GET(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!isHrFamily(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const today = calendarDateInTz(new Date(), attendanceTimezone());
  const parsed = querySchema.safeParse({
    from: url.searchParams.get('from') ?? today,
    to: url.searchParams.get('to') ?? today,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const { from, to } = parsed.data;
  if (parseYmd(from) > parseYmd(to)) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
  }
  const spanDays = (parseYmd(to) - parseYmd(from)) / (86400000) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: 'RANGE_TOO_LARGE', maxDays: MAX_RANGE_DAYS }, { status: 422 });
  }

  const rows = await prisma.attendance.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: 'desc' }, { employee: { nom: 'asc' } }],
    include: {
      employee: { select: { nom: true, prenom: true, matricule: true, service: true } },
      checkInLocation: { select: { name: true } },
      checkOutLocation: { select: { name: true } },
    },
  });

  const exportRows: ExportAttendanceRow[] = rows.map((r) => ({
    date: r.date,
    matricule: r.employee.matricule,
    nom: r.employee.nom,
    prenom: r.employee.prenom,
    service: r.employee.service,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    status: r.status,
    workedMinutes: r.workedMinutes,
    checkInLocationName: r.checkInLocation?.name ?? null,
    checkOutLocationName: r.checkOutLocation?.name ?? null,
  }));

  const tz = exportTimezoneLabel();
  const periodLabel = from === to ? `Journée du ${from}` : `Du ${from} au ${to}`;
  const buffer = await buildAttendanceExportBuffer(exportRows, {
    title: 'Export présences — ARPT',
    timezone: tz,
    periodLabel,
  });

  const filename = `presences_${from}_${to}.xlsx`;
  const bytes = Buffer.from(buffer);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  try {
    await logAuditFromRequest(
      req,
      { employeeId: ctx.employeeId, user: ctx.user },
      { action: 'attendance.export', entity: 'attendance', meta: { from, to, rows: exportRows.length } }
    );
  } catch {
    /* audit non bloquant */
  }

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
