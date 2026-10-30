import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { detectDailyAgendaConflicts } from '@/lib/ai/agenda-conflicts';
import { parseDateTime } from '@/lib/dg/scheduling';
import { APP_TIMEZONE, formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';
import { listAppointments } from '@/lib/services/appointments';

export type DgaDecisionCard = {
  id: string;
  title: string;
  timeLabel: string;
  dayLabel: "Aujourd'hui" | 'Demain';
  mode: 'Présentiel' | 'En ligne';
  place: string;
};

export type DgaTomorrowSlot = {
  id: string;
  title: string;
  timeLabel: string;
  mode: 'Présentiel' | 'En ligne';
  place: string;
  teamsUrl: string | null;
};

export type DgaTomorrowBrief = {
  dateLabel: string;
  first: DgaTomorrowSlot | null;
  conflicts: { id: string; message: string }[];
  decisions: DgaDecisionCard[];
  confirmedCount: number;
};

export type DgaFocus = {
  decisions: DgaDecisionCard[];
  tomorrow: DgaTomorrowBrief;
};

type FocusRow = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  isOnlineMeeting: boolean;
  location: string | null;
  teamsMeetingUrl: string | null;
  requestedBy: { firstName: string; lastName: string };
};

export function shiftIsoDate(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function civilLabel(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateTime(iso, '12:00'));
}

function presentation(row: FocusRow): Pick<DgaDecisionCard, 'mode' | 'place'> {
  const { meta } = parseAppointmentMeta(row.description);
  const room = meta.roomName?.trim() || '';
  if (row.isOnlineMeeting && room) {
    return { mode: 'Présentiel', place: `${room} · En ligne` };
  }
  if (row.isOnlineMeeting) {
    return { mode: 'En ligne', place: 'En ligne' };
  }
  if (room) return { mode: 'Présentiel', place: room };
  if (row.location?.trim()) return { mode: 'Présentiel', place: row.location.trim() };
  return { mode: 'Présentiel', place: 'Présentiel' };
}

function toCard(row: FocusRow, today: string, tomorrow: string): DgaDecisionCard | null {
  const day = formatIsoDateInAppTz(row.startAt);
  if (day !== today && day !== tomorrow) return null;
  const shown = presentation(row);
  return {
    id: row.id,
    title: row.title,
    timeLabel: `${formatTimeInAppTz(row.startAt)} – ${formatTimeInAppTz(row.endAt)}`,
    dayLabel: day === today ? "Aujourd'hui" : 'Demain',
    mode: shown.mode,
    place: shown.place,
  };
}

export function buildDgaFocus(rows: FocusRow[], now = new Date()): DgaFocus {
  const today = formatIsoDateInAppTz(now);
  const tomorrow = shiftIsoDate(today, 1);
  const pending = rows
    .filter((row) => row.status === 'PENDING')
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const decisions = pending
    .map((row) => toCard(row, today, tomorrow))
    .filter((card): card is DgaDecisionCard => card !== null);

  const approvedTomorrow = rows
    .filter((row) => row.status === 'APPROVED' && formatIsoDateInAppTz(row.startAt) === tomorrow)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const firstRow = approvedTomorrow[0] ?? null;
  const firstShown = firstRow ? presentation(firstRow) : null;
  const conflicts = detectDailyAgendaConflicts(
    approvedTomorrow.map((row) => ({
      id: row.id,
      title: row.title,
      startAt: row.startAt,
      endAt: row.endAt,
      requester: `${row.requestedBy.firstName} ${row.requestedBy.lastName}`.trim(),
    }))
  ).map((conflict) => ({ id: conflict.id, message: conflict.message }));

  return {
    decisions,
    tomorrow: {
      dateLabel: civilLabel(tomorrow),
      first: firstRow && firstShown
        ? {
            id: firstRow.id,
            title: firstRow.title,
            timeLabel: `${formatTimeInAppTz(firstRow.startAt)} – ${formatTimeInAppTz(firstRow.endAt)}`,
            mode: firstShown.mode,
            place: firstShown.place,
            teamsUrl: firstRow.teamsMeetingUrl,
          }
        : null,
      conflicts,
      decisions: decisions.filter((card) => card.dayLabel === 'Demain'),
      confirmedCount: approvedTomorrow.length,
    },
  };
}

export async function loadDgaFocus(now = new Date()): Promise<DgaFocus> {
  const today = formatIsoDateInAppTz(now);
  const tomorrow = shiftIsoDate(today, 1);
  const from = parseDateTime(today, '00:00');
  const to = parseDateTime(tomorrow, '23:59');
  to.setSeconds(59, 999);
  const [pending, approved] = await Promise.all([
    listAppointments({ status: 'PENDING', archived: false }),
    listAppointments({ status: 'APPROVED', from, to, archived: false }),
  ]);
  return buildDgaFocus(
    [...pending, ...approved].map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      isOnlineMeeting: row.isOnlineMeeting,
      location: row.location,
      teamsMeetingUrl: row.teamsMeetingUrl,
      requestedBy: row.requestedBy,
    })),
    now
  );
}
