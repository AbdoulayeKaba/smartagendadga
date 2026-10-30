import { APP_TIMEZONE } from '@/lib/datetime/locale';

/** Tampon obligatoire entre deux créneaux DG (minutes). */
export const DG_BUFFER_MINUTES = 15;

export const DG_BUFFER_MS = DG_BUFFER_MINUTES * 60 * 1000;

export type TimeRange = { startAt: Date; endAt: Date; id?: string };

/**
 * Vérifie le chevauchement avec buffer après chaque RDV approuvé.
 * Plage effective du RDV existant : [start, end + buffer]
 */
export function rangesConflict(
  candidate: TimeRange,
  existing: TimeRange,
  bufferMs: number = DG_BUFFER_MS
): boolean {
  const cStart = candidate.startAt.getTime();
  const cEnd = candidate.endAt.getTime();
  const eStart = existing.startAt.getTime();
  const eEnd = existing.endAt.getTime() + bufferMs;

  return cStart < eEnd && eStart < cEnd;
}

export function findConflicts(
  candidate: TimeRange,
  approved: TimeRange[],
  excludeId?: string,
  bufferMs: number = DG_BUFFER_MS
) {
  return approved.filter((a) => {
    if (excludeId && a.id === excludeId) return false;
    return rangesConflict(candidate, a, bufferMs);
  });
}

/** Convertit une date/heure murale (fuseau institutionnel) en instant UTC. */
export function parseDateTime(date: string, time: string, timeZone: string = APP_TIMEZONE): Date {
  const hm = time.trim().slice(0, 5);
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) {
    return new Date(`${date}T${hm}:00`);
  }

  let utc = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utc));
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const diff =
      Date.UTC(y, mo - 1, d, h, mi, 0) -
      Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'));
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

export const PAST_SLOT_MESSAGE = 'Ce créneau est déjà passé.';

/** Vrai dès que l’heure de début du créneau est atteinte ou dépassée. */
export function isSlotStartInThePast(date: string, startTime: string, now = new Date()): boolean {
  if (!date || !startTime) return false;
  return parseDateTime(date, startTime).getTime() <= now.getTime();
}

export function validateRange(
  startAt: Date,
  endAt: Date,
  options?: { allowStartInPast?: boolean }
): string | null {
  if (endAt <= startAt) return 'INVALID_TIME_RANGE';
  if (!options?.allowStartInPast && startAt.getTime() < Date.now() - 60_000) {
    return 'START_IN_PAST';
  }
  return null;
}
