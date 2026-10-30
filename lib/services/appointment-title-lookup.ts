import {
  classifyAppointmentTitleMatches,
  findBlockingAppointmentTitleMatch,
  findExactAppointmentTitleMatch,
  normalizeAppointmentTitle,
  titlesMatchExactly,
  type AppointmentTitleMatch,
} from '@/lib/dg/appointment-title-match';
import { listAppointments } from '@/lib/services/appointments';

export type AppointmentTitleLookupResult = {
  matches: AppointmentTitleMatch[];
  exact: AppointmentTitleMatch | null;
  blocking: AppointmentTitleMatch | null;
};

export async function lookupAppointmentTitleCandidates(options: {
  query: string;
  requestedById: string;
  formDate?: string;
  excludeId?: string;
  reviewAll?: boolean;
  limit?: number;
}): Promise<AppointmentTitleLookupResult> {
  const needle = options.query.trim();
  if (needle.length < 2) {
    return { matches: [], exact: null, blocking: null };
  }

  const rows = options.reviewAll
    ? await listAppointments({ archived: false })
    : await listAppointments({ requestedById: options.requestedById, archived: false });

  const normalizedNeedle = normalizeAppointmentTitle(needle);
  const candidates = rows
    .filter((row) => {
      if (row.id === options.excludeId) return false;
      const normalizedTitle = normalizeAppointmentTitle(row.title);
      return (
        normalizedTitle.includes(normalizedNeedle) ||
        normalizedNeedle.includes(normalizedTitle) ||
        titlesMatchExactly(row.title, needle)
      );
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      startAt: row.startAt instanceof Date ? row.startAt.toISOString() : String(row.startAt),
      status: row.status,
    }));

  const matches = classifyAppointmentTitleMatches(needle, candidates, {
    excludeId: options.excludeId,
    limit: options.limit ?? 8,
    formDate: options.formDate,
  });

  return {
    matches,
    exact: findExactAppointmentTitleMatch(matches) ?? null,
    blocking: findBlockingAppointmentTitleMatch(matches) ?? null,
  };
}
