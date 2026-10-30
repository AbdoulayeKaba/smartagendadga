import { parseYearParam, yearRange, type YearRange } from '@/lib/temporal/year-range';

export function parseYearFromRequest(url: URL): number | undefined {
  return parseYearParam(url.searchParams.get('year'));
}

export function resolveTemporalBounds(url: URL): YearRange | null {
  const year = parseYearFromRequest(url);
  return year ? yearRange(year) : null;
}

export function resolveFromToWithYear(url: URL): { from?: Date; to?: Date } {
  const explicitFrom = url.searchParams.get('from');
  const explicitTo = url.searchParams.get('to');
  if (explicitFrom || explicitTo) {
    return {
      ...(explicitFrom ? { from: new Date(explicitFrom) } : {}),
      ...(explicitTo ? { to: new Date(explicitTo) } : {}),
    };
  }
  const bounds = resolveTemporalBounds(url);
  if (!bounds) return {};
  return { from: bounds.from, to: bounds.to };
}
