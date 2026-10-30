import { getISODay } from 'date-fns';

const DEFAULT_TZ = process.env.ATTENDANCE_TIMEZONE ?? 'Africa/Conakry';

export function attendanceTimezone(): string {
  return DEFAULT_TZ;
}

/** Date locale YYYY-MM-DD dans le fuseau configuré. */
export function calendarDateInTz(date: Date, timeZone: string = attendanceTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Heure courante HH:mm (24h) dans le fuseau configuré. */
export function clockHmInTz(date: Date, timeZone: string = attendanceTimezone()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** 1 = lundi … 7 = dimanche (identique à date-fns getISODay). */
export function isoWeekdayInTz(date: Date, timeZone: string = attendanceTimezone()): number {
  const ymd = calendarDateInTz(date, timeZone);
  return isoWeekdayFromCalendarYmd(ymd);
}

/** Jour ISO (1–7) pour une date calendaire `YYYY-MM-DD` (UTC minuit, sans ambiguïté DST pour les fuseaux sans DST). */
export function isoWeekdayFromCalendarYmd(dateYmd: string): number {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return 0;
  return getISODay(new Date(Date.UTC(y, mo - 1, d)));
}

export function parseHm(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}
