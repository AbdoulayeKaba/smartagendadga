export const TEMPORAL_YEAR_MIN = 2000;
export const TEMPORAL_YEAR_MAX = 2100;
export const TEMPORAL_STORAGE_KEY = 'dg-temporal-year';

export type YearRange = {
  year: number;
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
};

export function clampYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.min(TEMPORAL_YEAR_MAX, Math.max(TEMPORAL_YEAR_MIN, Math.round(year)));
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function yearRange(year: number): YearRange {
  const y = clampYear(year);
  const from = new Date(y, 0, 1, 0, 0, 0, 0);
  const to = new Date(y, 11, 31, 23, 59, 59, 999);
  return {
    year: y,
    from,
    to,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export function parseYearParam(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const y = Number(value);
  if (!Number.isFinite(y)) return undefined;
  if (y < TEMPORAL_YEAR_MIN || y > TEMPORAL_YEAR_MAX) return undefined;
  return Math.round(y);
}

export function dateInYear(iso: string | null | undefined, year: number): boolean {
  if (!iso) return false;
  const y = clampYear(year);
  const datePrefix = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePrefix)) {
    return Number(datePrefix.slice(0, 4)) === y;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === y;
}

export function rangeOverlapsYear(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  year: number
): boolean {
  if (!startIso) return false;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const { from, to } = yearRange(year);
  return start <= to && end >= from;
}

export function anyDateInYear(dates: (string | null | undefined)[], year: number): boolean {
  return dates.some((d) => dateInYear(d, year));
}
