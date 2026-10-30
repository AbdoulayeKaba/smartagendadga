import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { getTodayContext } from '@/lib/attendance/punch-service';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { attendance, date, tz, startTime, endTime, workDay, dayContext, publicHolidayName, leaveType } =
    await getTodayContext(ctx.employeeId);

  return NextResponse.json({
    date,
    timezone: tz,
    schedule: {
      startTime,
      endTime,
      workDay,
      dayContext,
      publicHolidayName,
      leaveType: leaveType ?? null,
    },
    attendance: attendance
      ? {
          id: attendance.id,
          checkIn: attendance.checkIn?.toISOString() ?? null,
          checkOut: attendance.checkOut?.toISOString() ?? null,
          status: attendance.status,
          workedMinutes: attendance.workedMinutes,
          checkInLocation: attendance.checkInLocation ?? null,
          checkOutLocation: attendance.checkOutLocation ?? null,
        }
      : null,
  });
}
