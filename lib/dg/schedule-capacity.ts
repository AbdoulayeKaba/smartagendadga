import type { ScheduleSettings } from '@/lib/services/referentials-admin';

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function estimateScheduleCapacity(schedule: ScheduleSettings): {
  daily: number;
  weekly: number;
} {
  const start = timeToMinutes(schedule.workDayStart);
  const end = timeToMinutes(schedule.workDayEnd);
  const duration =
    schedule.defaultAppointmentDurationMinutes ?? schedule.slotDurationMinutes ?? 30;
  const slot = duration + schedule.bufferMinutes;
  if (slot <= 0 || end <= start) return { daily: 0, weekly: 0 };
  const workMinutes = Math.max(0, end - start);
  const daily = Math.floor(workMinutes / slot);
  let weekly = daily * (schedule.workingDays?.length ?? 0);
  if (schedule.maxAppointmentsPerWeek > 0) {
    weekly = Math.min(weekly, schedule.maxAppointmentsPerWeek);
  }
  return { daily, weekly };
}
