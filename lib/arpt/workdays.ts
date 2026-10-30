import { isWeekend, parseISO } from 'date-fns';

export function getInclusiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function countBusinessDays(
  startDate: string,
  endDate: string,
  holidays: Set<string>
) {
  const dates = getInclusiveDates(startDate, endDate);
  return dates.filter((d) => !isWeekend(parseISO(d)) && !holidays.has(d)).length;
}
