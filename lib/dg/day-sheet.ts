import { formatTimeInAppTz } from '@/lib/datetime/format';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';

export type DgDaySheetSource = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  isOnlineMeeting: boolean;
  description: string | null;
  requestedBy: { firstName: string; lastName: string };
};

export type DgDaySheetRow = {
  id: string;
  time: string;
  start: string;
  end: string;
  title: string;
  requester: string;
  initials: string;
  modality: 'En ligne' | 'Présentiel';
  place: string;
  room: string;
};

function initialsOf(firstName: string, lastName: string) {
  const letters = `${firstName} ${lastName}`
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || 'RD';
}

export function buildDgDaySheetRows(
  items: DgDaySheetSource[],
  locationNames?: Map<string, string>
): DgDaySheetRow[] {
  return [...items]
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((item) => {
      const meta = parseAppointmentMeta(item.description).meta;
      const online =
        item.isOnlineMeeting ||
        (item.location ?? '').toLowerCase().includes('teams') ||
        (item.location ?? '').toLowerCase().includes('en ligne');
      const room = meta.roomName?.trim() || '';
      const namedPlace = meta.locationRef ? locationNames?.get(meta.locationRef)?.trim() : '';
      const location = namedPlace || item.location?.trim() || '';
      const start = formatTimeInAppTz(item.startAt);
      const end = formatTimeInAppTz(item.endAt);
      const requester = `${item.requestedBy.firstName} ${item.requestedBy.lastName}`.trim();
      return {
        id: item.id,
        time: `${start} – ${end}`,
        start,
        end,
        title: item.title.trim() || 'Sans objet',
        requester,
        initials: initialsOf(item.requestedBy.firstName, item.requestedBy.lastName),
        modality: online ? 'En ligne' : 'Présentiel',
        place: online ? 'Microsoft Teams' : location || 'Lieu à confirmer',
        room: room || 'Non réservée',
      };
    });
}
