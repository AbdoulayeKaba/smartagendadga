import { formatIsoDateInAppTz } from '@/lib/datetime/format';
import { buildDgDaySheetRows, type DgDaySheetRow } from '@/lib/dg/day-sheet';
import { parseDateTime } from '@/lib/dg/scheduling';
import { listAppointments } from '@/lib/services/appointments';
import { listReferentialItems } from '@/lib/services/referentials-admin';

export type DgDaySheet = {
  dateLabel: string;
  rows: DgDaySheetRow[];
};

export async function getDgDaySheet(now = new Date()): Promise<DgDaySheet> {
  const todayKey = formatIsoDateInAppTz(now);
  const dayStart = parseDateTime(todayKey, '00:00');
  const dayEnd = parseDateTime(todayKey, '23:59');
  const [items, lieux] = await Promise.all([
    listAppointments({
      status: 'APPROVED',
      from: dayStart,
      to: dayEnd,
    }).catch(() => []),
    listReferentialItems('lieux', { archived: false }).catch(() => []),
  ]);
  const locationNames = new Map(lieux.map((item) => [item.id, item.name]));

  const today = items.filter(
    (item) => formatIsoDateInAppTz(item.startAt) === todayKey
  );

  return {
    dateLabel: new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now),
    rows: buildDgDaySheetRows(today, locationNames),
  };
}
