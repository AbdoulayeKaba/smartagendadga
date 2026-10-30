import { addDays, startOfWeek } from 'date-fns';
import { formatIsoDateInAppTz, getWallClockPartsInAppTz } from '@/lib/datetime';
import { parseDateTime } from '@/lib/dg/scheduling';
import type { DgDayBriefingData } from '@/lib/dg/day-briefing-types';
import { listAppointments } from '@/lib/services/appointments';
import { listRoomReservations } from '@/lib/services/room-reservations';
import { listWorkspaceMail, listWorkspaceMissions } from '@/lib/services/workspace-service';

export type { DgDayBriefingData } from '@/lib/dg/day-briefing-types';

const DAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const MAIL_SLICE_ORDER = [
  { key: 'RECEIVED', label: 'Reçu' },
  { key: 'ASSIGNED', label: 'Affecté' },
  { key: 'IN_PROGRESS', label: 'Traitement' },
  { key: 'SENT', label: 'Envoyé' },
] as const;

export async function getDgDayBriefing(now = new Date()): Promise<DgDayBriefingData> {
  const todayKey = formatIsoDateInAppTz(now);
  const dayStart = parseDateTime(todayKey, '00:00');
  const dayEnd = parseDateTime(todayKey, '23:59');
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const nowHour = getWallClockPartsInAppTz(now).hour;

  const [today, week, pending, missions, mail, rooms] = await Promise.all([
    listAppointments({ status: 'APPROVED', from: dayStart, to: dayEnd }),
    listAppointments({ status: 'APPROVED', from: weekStart, to: weekEnd }),
    listAppointments({ status: 'PENDING' }).catch(() => []),
    listWorkspaceMissions({ archived: false }).catch(() => []),
    listWorkspaceMail({ archived: false }).catch(() => []),
    listRoomReservations({
      from: dayStart,
      to: dayEnd,
      status: 'CONFIRMED',
      archived: false,
    }).catch(() => []),
  ]);

  const sortedToday = [...today].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const nextAppointment =
    sortedToday.find((a) => a.endAt.getTime() >= now.getTime()) ?? sortedToday[0];
  const ongoingMissions = missions.filter((m) => m.status === 'ONGOING');
  const mailToProcess = mail.filter(
    (m) => !m.archived && m.workflowStatus !== 'PROCESSED' && m.workflowStatus !== 'ARCHIVED'
  );
  const occupiedRooms = rooms.filter((r) => r.endAt >= dayStart && r.startAt <= dayEnd);

  const hours = DAY_HOURS.map((hour) => {
    const appointments = sortedToday.filter((item) => {
      const startH = getWallClockPartsInAppTz(item.startAt).hour;
      const endH = getWallClockPartsInAppTz(item.endAt).hour;
      return hour >= startH && hour < Math.max(endH, startH + 1);
    }).length;
    const roomHits = occupiedRooms.filter((item) => {
      const startH = getWallClockPartsInAppTz(item.startAt).hour;
      const endH = getWallClockPartsInAppTz(item.endAt).hour;
      return hour >= startH && hour < Math.max(endH, startH + 1);
    }).length;
    return {
      hour,
      label: `${hour}h`,
      appointments,
      rooms: roomHits,
      now: hour === nowHour,
    };
  });

  const weekdays = WEEKDAY_LABELS.map((label, index) => {
    const day = addDays(weekStart, index);
    const key = formatIsoDateInAppTz(day);
    return {
      key,
      label,
      today: key === todayKey,
      count: week.filter((item) => formatIsoDateInAppTz(item.startAt) === key).length,
    };
  });

  const mailByStatus = new Map<string, number>();
  for (const item of mailToProcess) {
    mailByStatus.set(item.workflowStatus, (mailByStatus.get(item.workflowStatus) ?? 0) + 1);
  }
  const mailSlices = MAIL_SLICE_ORDER.map((slice) => ({
    ...slice,
    count: mailByStatus.get(slice.key) ?? 0,
  })).filter((slice) => slice.count > 0);

  const weekMinutes = week.reduce(
    (acc, item) => acc + (item.endAt.getTime() - item.startAt.getTime()) / 60000,
    0
  );
  const loadPercent = Math.min(100, Math.round((weekMinutes / (5 * 8 * 60)) * 100));

  return {
    dateLabel: new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now),
    nowHour,
    appointmentsToday: {
      count: sortedToday.length,
      nextTitle: nextAppointment?.title ?? null,
    },
    missionsOngoing: {
      count: ongoingMissions.length,
      nextTitle: ongoingMissions[0]?.subject ?? null,
    },
    mailToProcess: { count: mailToProcess.length },
    roomsOccupied: {
      count: occupiedRooms.length,
      nextTitle: occupiedRooms[0]?.title ?? occupiedRooms[0]?.roomName ?? null,
    },
    hours,
    weekdays,
    mailSlices,
    pendingCount: pending.length,
    loadPercent,
  };
}
