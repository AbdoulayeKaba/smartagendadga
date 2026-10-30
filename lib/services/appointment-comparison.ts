import { isMockDataEnabled } from '@/lib/mock/config';
import {
  buildAppointmentPeriodComparison,
  buildDemoAppointmentComparison,
  periodBoundsForComparison,
  type AppointmentYearComparison,
  type AppointmentYearRaw,
  type AuditRescheduleRaw,
} from '@/lib/dg/appointment-year-comparison';
import {
  buildPeriodRange,
  type ComparePeriodRange,
  yearToPeriodRange,
} from '@/lib/temporal/compare-period';
import { parseYearParam, clampYear, currentYear } from '@/lib/temporal/year-range';
import { prisma } from '@/lib/prisma';
import { listAppointments } from '@/lib/services/appointments';

function mapAppointment(row: {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  reviewedAt: Date | null;
  startAt: Date;
  rejectionReason: string | null;
  requestedBy: { department: string | null };
}): AppointmentYearRaw {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    startAt: row.startAt,
    rejectionReason: row.rejectionReason,
    department: row.requestedBy.department,
  };
}

async function fetchReschedules(from: Date, to: Date): Promise<AuditRescheduleRaw[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: 'appointment.reschedule',
      createdAt: { gte: from, lte: to },
    },
    select: { appointmentId: true, createdAt: true },
  });
  return rows.map((r) => ({ appointmentId: r.appointmentId, createdAt: r.createdAt }));
}

function resolveComparisonRanges(input: {
  from1?: string;
  to1?: string;
  from2?: string;
  to2?: string;
  year1?: number;
  year2?: number;
}): { range1: ComparePeriodRange; range2: ComparePeriodRange } | null {
  const y2 = input.year2 ?? currentYear();
  const y1 = input.year1 ?? y2 - 1;

  const range1 =
    input.from1 && input.to1
      ? buildPeriodRange(input.from1, input.to1)
      : yearToPeriodRange(clampYear(y1));
  const range2 =
    input.from2 && input.to2
      ? buildPeriodRange(input.from2, input.to2)
      : yearToPeriodRange(clampYear(y2));

  if (!range1 || !range2) return null;
  if (range1.fromDate === range2.fromDate && range1.toDate === range2.toDate) return null;
  return { range1, range2 };
}

async function fetchFromDb(
  range1: ComparePeriodRange,
  range2: ComparePeriodRange
): Promise<AppointmentYearComparison> {
  const { from, to } = periodBoundsForComparison(range1, range2);
  const [appointmentRows, rescheduleRows] = await Promise.all([
    listAppointments({ from, to }),
    fetchReschedules(from, to),
  ]);

  const appointments = appointmentRows.map((r) =>
    mapAppointment({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      startAt: r.startAt,
      rejectionReason: r.rejectionReason,
      requestedBy: { department: r.requestedBy.department ?? null },
    })
  );

  return buildAppointmentPeriodComparison(range1, range2, appointments, rescheduleRows);
}

async function fetchFromMock(
  range1: ComparePeriodRange,
  range2: ComparePeriodRange
): Promise<AppointmentYearComparison> {
  const { from, to } = periodBoundsForComparison(range1, range2);
  const appointmentRows = await listAppointments({ from, to });
  const appointments = appointmentRows.map((r) =>
    mapAppointment({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      startAt: r.startAt,
      rejectionReason: r.rejectionReason,
      requestedBy: { department: r.requestedBy.department ?? null },
    })
  );

  if (appointments.length < 5) {
    return buildDemoAppointmentComparison(range1, range2);
  }

  return buildAppointmentPeriodComparison(range1, range2, appointments, []);
}

export async function getAppointmentYearComparison(input: {
  from1?: string;
  to1?: string;
  from2?: string;
  to2?: string;
  year1?: number;
  year2?: number;
}): Promise<AppointmentYearComparison | null> {
  const ranges = resolveComparisonRanges(input);
  if (!ranges) return null;

  if (isMockDataEnabled()) {
    return fetchFromMock(ranges.range1, ranges.range2);
  }
  return fetchFromDb(ranges.range1, ranges.range2);
}

export function parseComparisonQuery(searchParams: URLSearchParams): {
  from1?: string;
  to1?: string;
  from2?: string;
  to2?: string;
  year1?: number;
  year2?: number;
} {
  const y2 = parseYearParam(searchParams.get('year2'));
  const y1 = parseYearParam(searchParams.get('year1'));
  return {
    from1: searchParams.get('from1') ?? undefined,
    to1: searchParams.get('to1') ?? undefined,
    from2: searchParams.get('from2') ?? undefined,
    to2: searchParams.get('to2') ?? undefined,
    year1: y1,
    year2: y2,
  };
}
