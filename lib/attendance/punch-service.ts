import type { Attendance, Schedule, LeaveType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  attendanceTimezone,
  calendarDateInTz,
  clockHmInTz,
  isoWeekdayFromCalendarYmd,
  parseHm,
} from './timezone';

export type PunchAction = 'check_in' | 'check_out';

export type EmployeeDayContext = 'workday' | 'weekend' | 'public_holiday' | 'on_leave';

const DEFAULT_START = '08:30';
const DEFAULT_END = '17:30';
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

function scheduleForEmployee(schedule: Schedule | null): {
  startTime: string;
  endTime: string;
  workDays: number[];
} {
  if (!schedule) {
    return { startTime: DEFAULT_START, endTime: DEFAULT_END, workDays: DEFAULT_WORK_DAYS };
  }
  const wd = schedule.workDays as unknown;
  const workDays = Array.isArray(wd) ? (wd as number[]).map(Number) : DEFAULT_WORK_DAYS;
  return {
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    workDays,
  };
}

function isScheduledWorkDayYmd(dateYmd: string, workDays: number[]): boolean {
  const isoD = isoWeekdayFromCalendarYmd(dateYmd);
  return workDays.includes(isoD);
}

/** Entrée : présent si à l’heure, sinon retard. */
export function entryStatus(
  now: Date,
  startTime: string,
  tz: string
): 'present' | 'retard' {
  const hm = clockHmInTz(now, tz);
  return parseHm(hm, startTime) > 0 ? 'retard' : 'present';
}

const attendanceLocationInclude = {
  checkInLocation: { select: { id: true, name: true } },
  checkOutLocation: { select: { id: true, name: true } },
} as const;

export async function getTodayContext(employeeId: string, now: Date = new Date()) {
  const tz = attendanceTimezone();
  const date = calendarDateInTz(now, tz);
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { schedule: true },
  });
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  const { startTime, endTime, workDays } = scheduleForEmployee(employee.schedule);

  const scheduledWeekday = isScheduledWorkDayYmd(date, workDays);
  let dayContext: EmployeeDayContext = 'weekend';
  let publicHolidayName: string | null = null;
  let leaveType: LeaveType | null = null;

  if (scheduledWeekday) {
    const [hol, leave] = await Promise.all([
      prisma.publicHoliday.findUnique({ where: { date } }),
      prisma.employeeLeave.findFirst({
        where: { employeeId, startDate: { lte: date }, endDate: { gte: date } },
      }),
    ]);
    if (hol) {
      dayContext = 'public_holiday';
      publicHolidayName = hol.name;
    } else if (leave) {
      dayContext = 'on_leave';
      leaveType = leave.type;
    } else {
      dayContext = 'workday';
    }
  }

  const workDay = dayContext === 'workday';

  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    include: attendanceLocationInclude,
  });
  return {
    employee,
    attendance,
    date,
    tz,
    startTime,
    endTime,
    workDays,
    workDay,
    dayContext,
    publicHolidayName,
    leaveType,
  };
}

export type AttendanceWithLocations = Attendance & {
  checkInLocation?: { id: string; name: string } | null;
  checkOutLocation?: { id: string; name: string } | null;
};

export interface PunchResult {
  attendance: AttendanceWithLocations;
  message: string;
}

export type PunchOptions = {
  /** Référence `locations.id` — enregistrée sur l’entrée ou la sortie selon l’action. */
  locationId?: string | null;
};

async function assertLocationExists(locationId: string | null | undefined): Promise<void> {
  const id = locationId?.trim();
  if (!id) return;
  const loc = await prisma.location.findUnique({ where: { id } });
  if (!loc) throw new Error('INVALID_LOCATION');
}

function punchDayHint(dayContext: EmployeeDayContext): string {
  if (dayContext === 'workday') return '';
  if (dayContext === 'public_holiday') return ' (jour férié)';
  if (dayContext === 'on_leave') return ' (jour de congé)';
  return ' (jour non planifié au planning)';
}

export async function punchForEmployee(
  employeeId: string,
  action: PunchAction,
  now: Date = new Date(),
  options?: PunchOptions
): Promise<PunchResult> {
  const { employee, attendance, date, tz, startTime, workDay, dayContext } = await getTodayContext(
    employeeId,
    now
  );

  if (employee.statut !== 'actif') {
    throw new Error('EMPLOYEE_INACTIVE');
  }

  await assertLocationExists(options?.locationId ?? undefined);

  if (action === 'check_in') {
    if (attendance?.checkIn) {
      throw new Error('ALREADY_CHECKED_IN');
    }
    const status = entryStatus(now, startTime, tz);
    const locId = options?.locationId?.trim() || null;
    const created = await prisma.attendance.create({
      data: {
        employeeId,
        date,
        checkIn: now,
        status,
        checkInLocationId: locId,
      },
      include: attendanceLocationInclude,
    });
    const dayHint = !workDay ? punchDayHint(dayContext) : '';
    return {
      attendance: created,
      message:
        (status === 'retard' ? 'Entrée enregistrée (retard).' : 'Entrée enregistrée.') + dayHint,
    };
  }

  // check_out
  if (!attendance?.checkIn) {
    throw new Error('NO_CHECK_IN');
  }
  if (attendance.checkOut) {
    throw new Error('ALREADY_CHECKED_OUT');
  }

  const workedMinutes = Math.max(
    0,
    Math.round((now.getTime() - attendance.checkIn.getTime()) / 60000)
  );

  const locOut = options?.locationId?.trim() || null;

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      workedMinutes,
      checkOutLocationId: locOut,
    },
    include: attendanceLocationInclude,
  });

  return { attendance: updated, message: 'Sortie enregistrée.' };
}

export function absentGraceMinutes(): number {
  const n = Number(process.env.ATTENDANCE_ABSENT_GRACE_MINUTES ?? 45);
  return Number.isFinite(n) && n > 0 ? n : 45;
}

/** Minutes depuis minuit pour comparer au début de journée + grace. */
function minutesSinceMidnight(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export type DashboardAttendanceStats = {
  date: string;
  timezone: string;
  /** Employés actifs attendus aujourd’hui (jour ouvré). */
  expectedToday: number;
  /** Au moins une entrée aujourd’hui. */
  checkedIn: number;
  /** Entrée avec statut retard. */
  late: number;
  /** À l’heure à l’entrée. */
  onTime: number;
  /** Pas de pointage après délai de grâce. */
  absent: number;
  /** Somme des minutes travaillées (journées clôturées aujourd’hui). */
  workedMinutesTotal: number;
};

export async function computeAttendanceDashboard(now: Date = new Date()): Promise<DashboardAttendanceStats> {
  const tz = attendanceTimezone();
  const date = calendarDateInTz(now, tz);
  const hm = clockHmInTz(now, tz);
  const grace = absentGraceMinutes();

  const employees = await prisma.employee.findMany({
    where: { statut: 'actif' },
    include: { schedule: true, attendances: { where: { date } } },
  });

  const holiday = await prisma.publicHoliday.findUnique({ where: { date } });
  const leaveRows = holiday
    ? []
    : await prisma.employeeLeave.findMany({
        where: { startDate: { lte: date }, endDate: { gte: date } },
        select: { employeeId: true },
      });
  const leaveSet = new Set(leaveRows.map((r) => r.employeeId));

  let expectedToday = 0;
  let checkedIn = 0;
  let late = 0;
  let onTime = 0;
  let absent = 0;
  let workedMinutesTotal = 0;

  for (const e of employees) {
    const { startTime, workDays } = scheduleForEmployee(e.schedule);
    if (!isScheduledWorkDayYmd(date, workDays)) continue;
    if (holiday) continue;
    if (leaveSet.has(e.id)) continue;
    expectedToday += 1;

    const att = e.attendances[0];
    if (att?.checkIn) {
      checkedIn += 1;
      if (att.status === 'retard') late += 1;
      if (att.status === 'present') onTime += 1;
      if (att.workedMinutes != null) workedMinutesTotal += att.workedMinutes;
    } else {
      const startM = minutesSinceMidnight(startTime);
      const nowM = minutesSinceMidnight(hm);
      if (nowM > startM + grace) absent += 1;
    }
  }

  return {
    date,
    timezone: tz,
    expectedToday,
    checkedIn,
    late,
    onTime,
    absent,
    workedMinutesTotal,
  };
}
