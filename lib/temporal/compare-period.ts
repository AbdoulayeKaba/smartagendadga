import { clampYear, currentYear, yearRange } from '@/lib/temporal/year-range';

export const COMPARE_PERIOD_STORAGE_KEY = 'dg-compare-periods';

export type ComparePeriodRange = {
  from: Date;
  to: Date;
  fromDate: string;
  toDate: string;
  label: string;
  shortLabel: string;
  year: number;
};

const MONTH_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateParam(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== mo - 1 ||
    d.getDate() !== day
  ) {
    return undefined;
  }
  return value.trim();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function formatPeriodShortLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromPart = `${from.getDate()} ${MONTH_SHORT[from.getMonth()]}`;
  const toPart = `${to.getDate()} ${MONTH_SHORT[to.getMonth()]}`;
  if (sameYear) return `${fromPart} – ${toPart} ${from.getFullYear()}`;
  return `${fromPart} ${from.getFullYear()} – ${toPart} ${to.getFullYear()}`;
}

export function formatPeriodLabel(from: Date, to: Date): string {
  return formatPeriodShortLabel(from, to);
}

export function yearToPeriodRange(year: number): ComparePeriodRange {
  const range = yearRange(year);
  return {
    from: range.from,
    to: range.to,
    fromDate: toDateInputValue(range.from),
    toDate: toDateInputValue(range.to),
    label: formatPeriodLabel(range.from, range.to),
    shortLabel: String(year),
    year: range.year,
  };
}

export function isFullCalendarYearRange(
  fromDate: string,
  toDate: string,
  year = new Date(fromDate).getFullYear()
): boolean {
  return fromDate === `${year}-01-01` && toDate === `${year}-12-31`;
}

export function formatDateFr(isoDate: string): string {
  const parsed = parseDateParam(isoDate);
  if (!parsed) return isoDate;
  const [y, m, d] = parsed.split('-');
  return `${d}/${m}/${y}`;
}

/** Format court pour les champs compacts (ex. 01/01/25). */
export function formatDateFrShort(isoDate: string): string {
  const parsed = parseDateParam(isoDate);
  if (!parsed) return isoDate;
  const [y, m, d] = parsed.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

export function buildPeriodRange(fromDate: string, toDate: string): ComparePeriodRange | null {
  const fromParsed = parseDateParam(fromDate);
  const toParsed = parseDateParam(toDate);
  if (!fromParsed || !toParsed) return null;

  const from = startOfDay(new Date(fromParsed));
  const to = endOfDay(new Date(toParsed));
  if (from.getTime() > to.getTime()) return null;

  const year = from.getFullYear();
  const fullYear = isFullCalendarYearRange(fromParsed, toParsed, year);

  return {
    from,
    to,
    fromDate: fromParsed,
    toDate: toParsed,
    label: formatPeriodLabel(from, to),
    shortLabel: fullYear ? String(year) : formatPeriodShortLabel(from, to),
    year,
  };
}

export function periodDayCount(range: ComparePeriodRange): number {
  const ms = range.to.getTime() - range.from.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

export function inPeriod(d: Date, from: Date, to: Date): boolean {
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function periodsAreIdentical(a: ComparePeriodRange, b: ComparePeriodRange): boolean {
  return a.fromDate === b.fromDate && a.toDate === b.toDate;
}

export function combinedPeriodBounds(
  a: ComparePeriodRange,
  b: ComparePeriodRange
): { from: Date; to: Date } {
  const from = a.from < b.from ? a.from : b.from;
  const to = a.to > b.to ? a.to : b.to;
  return { from, to };
}

export function defaultComparisonPeriods(referenceYear = currentYear()): {
  period1: ComparePeriodRange;
  period2: ComparePeriodRange;
} {
  return {
    period1: yearToPeriodRange(clampYear(referenceYear - 1)),
    period2: yearToPeriodRange(clampYear(referenceYear)),
  };
}

export type StoredComparePeriods = {
  period1From: string;
  period1To: string;
  period2From: string;
  period2To: string;
};

export function readStoredComparePeriods(referenceYear = currentYear()): StoredComparePeriods {
  const defaults = defaultComparisonPeriods(referenceYear);
  if (typeof window === 'undefined') {
    return {
      period1From: defaults.period1.fromDate,
      period1To: defaults.period1.toDate,
      period2From: defaults.period2.fromDate,
      period2To: defaults.period2.toDate,
    };
  }
  try {
    const raw = localStorage.getItem(COMPARE_PERIOD_STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<StoredComparePeriods>;
    const p1 = buildPeriodRange(
      parsed.period1From ?? defaults.period1.fromDate,
      parsed.period1To ?? defaults.period1.toDate
    );
    const p2 = buildPeriodRange(
      parsed.period2From ?? defaults.period2.fromDate,
      parsed.period2To ?? defaults.period2.toDate
    );
    if (!p1 || !p2 || periodsAreIdentical(p1, p2)) throw new Error('invalid');
    return {
      period1From: p1.fromDate,
      period1To: p1.toDate,
      period2From: p2.fromDate,
      period2To: p2.toDate,
    };
  } catch {
    return {
      period1From: defaults.period1.fromDate,
      period1To: defaults.period1.toDate,
      period2From: defaults.period2.fromDate,
      period2To: defaults.period2.toDate,
    };
  }
}

export function writeStoredComparePeriods(periods: StoredComparePeriods): void {
  try {
    localStorage.setItem(COMPARE_PERIOD_STORAGE_KEY, JSON.stringify(periods));
  } catch {
    /* ignore */
  }
}
