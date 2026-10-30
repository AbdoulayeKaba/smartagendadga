import { addDays } from 'date-fns';
import { formatIsoDateInAppTz, formatTimeInAppTz, getWallClockPartsInAppTz } from '@/lib/datetime';
import { parseDateTime } from '@/lib/dg/scheduling';
import type { RoomUsageType } from '@/lib/dg/room-reservation-form';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
} from '@/lib/dg/meeting-room-config';
import { resolveMissionVisualState } from '@/lib/workspace/mission-visual-state';
import type { MissionStatus } from '@/lib/workspace/types';

export type CockpitAgendaKind = 'rdv' | 'reunion' | 'mission' | 'free';

export type CockpitAgendaItem = {
  id: string;
  kind: CockpitAgendaKind;
  /** Agenda du DGA, ou réservation de salle affichée à part. */
  lane: 'agenda' | 'salle';
  timeLabel: string;
  title: string;
  meta: string;
  place: string;
  href: string;
  ongoing: boolean;
};

export type CockpitAttentionItem = {
  id: string;
  tone: 'mail' | 'check' | 'reunion' | 'mission';
  title: string;
  detail: string;
  href: string;
};

export type CockpitUpcomingItem = {
  id: string;
  day: string;
  month: string;
  title: string;
  detail: string;
  href: string;
};

export type CockpitHourBar = {
  hour: number;
  label: string;
  rdv: number;
  reunion: number;
  mission: number;
  free: number;
};

export type CockpitRoomSlice = {
  key: 'busy' | 'free' | 'blocked';
  label: string;
  count: number;
  color: string;
};

export type CockpitContact = {
  id: string;
  initials: string;
  name: string;
  detail: string;
  href: string;
};

export type DgCockpitFocus = {
  state: 'ongoing' | 'next' | 'clear';
  title: string;
  timeLabel: string;
  place: string;
  href: string;
};

export type DgCockpitData = {
  greeting: string;
  subtitle: string;
  dateLabel: string;
  ficheHref: string;
  planHref: string;
  focus: DgCockpitFocus;
  kpis: {
    appointments: { count: number; hint: string; spark: number[] };
    meetings: { count: number; hint: string };
    missions: { count: number; hint: string };
    inbox: { count: number; hint: string };
    free: { label: string; hint: string; minutes: number };
  };
  agenda: CockpitAgendaItem[];
  agendaHref: string;
  attention: CockpitAttentionItem[];
  attentionHref: string;
  hours: CockpitHourBar[];
  upcoming: CockpitUpcomingItem[];
  upcomingHref: string;
  room: {
    name: string;
    total: number;
    slices: CockpitRoomSlice[];
    href: string;
  };
  contacts: CockpitContact[];
  contactsHref: string;
};

export type CockpitAppointment = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
  isOnlineMeeting: boolean;
  location: string | null;
  requestedByName: string;
  requestedByService: string;
};

export type CockpitReservation = {
  id: string;
  title: string;
  usageType: RoomUsageType;
  roomName: string;
  organizerService: string;
  startAt: Date;
  endAt: Date;
  status: string;
  appointmentId: string | null;
};

export type CockpitMission = {
  id: string;
  subject: string;
  destination: string;
  departAt: string;
  returnAt: string;
  status: string;
  participants: string;
};

export type CockpitMail = {
  priority: 'URGENT' | 'NORMAL';
  workflowStatus: string;
  direction: string;
  archived: boolean;
};

export type CockpitContactSource = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  organization: string;
  appointmentCount: number;
};

export type CockpitSlot = {
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BUSY' | 'BUFFER' | 'BLOCKED';
};

export type CockpitSource = {
  viewer: { firstName: string; lastName: string; role: string };
  now: Date;
  appointments: CockpitAppointment[];
  reservations: CockpitReservation[];
  pendingAppointments: number;
  pendingReservations: CockpitReservation[];
  missions: CockpitMission[];
  mail: CockpitMail[];
  contacts: CockpitContactSource[];
  slots: CockpitSlot[];
  roomName: string;
};

const DAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
const ROOM_COLORS = {
  busy: '#d4534a',
  free: '#1f9d55',
  blocked: '#e0a23a',
} as const;

const MEETING_USAGES = new Set<RoomUsageType>(['REUNION', 'COMITE']);

export function formatFreeDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe <= 0) return '0 min';
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, '0')}`;
}

export function contactInitials(fullName: string): string {
  const parts = fullName
    .replace(/\./g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 || /[A-Za-zÀ-ÿ]/.test(part));
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || 'CT';
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function frenchCount(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function sameDay(value: Date, dayKey: string) {
  return formatIsoDateInAppTz(value) === dayKey;
}

function dayKeyOf(value: string) {
  return formatIsoDateInAppTz(value);
}

function isOngoing(start: Date, end: Date, now: Date) {
  return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
}

function coversHour(start: Date, end: Date, hour: number) {
  const startHour = getWallClockPartsInAppTz(start).hour;
  const endParts = getWallClockPartsInAppTz(end);
  const endExclusive =
    endParts.minute === 0 && endParts.hour > startHour ? endParts.hour : endParts.hour + 1;
  return hour >= startHour && hour < Math.max(endExclusive, startHour + 1);
}

function upcomingStamp(value: Date) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Africa/Conakry',
  }).formatToParts(value);
  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: (parts.find((part) => part.type === 'month')?.value ?? '').replace('.', '').toUpperCase(),
  };
}

function slotMinutes(slot: CockpitSlot) {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const [eh, em] = slot.endTime.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function missionStatus(status: string): MissionStatus {
  if (status === 'ONGOING' || status === 'COMPLETED' || status === 'CANCELLED') return status;
  return 'PLANNED';
}

/** Même lecture que la liste Missions : une date de retour passée compte comme terminée. */
function missionVisual(mission: CockpitMission, now: Date) {
  return resolveMissionVisualState(
    {
      status: missionStatus(mission.status),
      departAt: mission.departAt,
      returnAt: mission.returnAt,
    },
    now
  );
}

function missionOnDay(mission: CockpitMission, dayKey: string, now: Date) {
  const visual = missionVisual(mission, now);
  if (visual === 'CANCELLED' || visual === 'COMPLETED') return false;
  const start = dayKeyOf(mission.departAt);
  const end = dayKeyOf(mission.returnAt);
  return dayKey >= start && dayKey <= end;
}

export function buildDgCockpit(source: CockpitSource): DgCockpitData {
  const todayKey = formatIsoDateInAppTz(source.now);
  const tomorrow = addDays(parseDateTime(todayKey, '12:00'), 1);
  const horizon = addDays(tomorrow, 14);
  const horizonKey = formatIsoDateInAppTz(horizon);

  const appointmentsToday = source.appointments.filter(
    (item) => item.status === 'APPROVED' && sameDay(item.startAt, todayKey)
  );
  const reservationsToday = source.reservations.filter(
    (item) => item.status === 'CONFIRMED' && sameDay(item.startAt, todayKey)
  );
  const reservationByAppointment = new Map(
    reservationsToday
      .filter((item) => item.appointmentId)
      .map((item) => [item.appointmentId as string, item])
  );

  const agenda: CockpitAgendaItem[] = [];

  for (const appointment of appointmentsToday) {
    const room = reservationByAppointment.get(appointment.id);
    const meeting =
      appointment.isOnlineMeeting || (room ? MEETING_USAGES.has(room.usageType) : false);
    agenda.push({
      id: `appt-${appointment.id}`,
      kind: meeting ? 'reunion' : 'rdv',
      lane: 'agenda',
      timeLabel: `${formatTimeInAppTz(appointment.startAt)} – ${formatTimeInAppTz(appointment.endAt)}`,
      title: appointment.title,
      meta: appointment.requestedByService || appointment.requestedByName,
      place: room?.roomName || (appointment.isOnlineMeeting ? 'Visioconférence' : appointment.location || 'Lieu à confirmer'),
      href: meeting ? DG_ROOM_RESERVATIONS_HREF : '/appointments/calendar',
      ongoing: isOngoing(appointment.startAt, appointment.endAt, source.now),
    });
  }

  for (const reservation of reservationsToday) {
    agenda.push({
      id: `room-${reservation.id}`,
      kind: 'reunion',
      lane: 'salle',
      timeLabel: `${formatTimeInAppTz(reservation.startAt)} – ${formatTimeInAppTz(reservation.endAt)}`,
      title: reservation.roomName,
      meta: reservation.title,
      place: reservation.roomName,
      href: DG_ROOM_RESERVATIONS_HREF,
      ongoing: isOngoing(reservation.startAt, reservation.endAt, source.now),
    });
  }

  const freeSlots = source.slots.filter((slot) => slot.status === 'AVAILABLE');
  const nextFree = freeSlots[0];
  if (nextFree) {
    agenda.push({
      id: `free-${nextFree.startTime}`,
      kind: 'free',
      lane: 'agenda',
      timeLabel: `${nextFree.startTime} – ${nextFree.endTime}`,
      title: 'Créneau disponible',
      meta: freeSlots.length > 1 ? `${freeSlots.length} créneaux libres` : 'Salle libre',
      place: 'Planifier',
      href: `/dg/plan?date=${todayKey}&startTime=${nextFree.startTime}&endTime=${nextFree.endTime}`,
      ongoing: false,
    });
  }

  agenda.sort((a, b) => {
    const key = (item: CockpitAgendaItem) => (item.timeLabel === 'Journée' ? '12:00' : item.timeLabel);
    return key(a).localeCompare(key(b), 'fr');
  });

  const rdvItems = agenda.filter((item) => item.kind === 'rdv');
  const meetingItems = agenda.filter((item) => item.kind === 'reunion' && item.lane === 'agenda');
  const rdvOngoing = rdvItems.filter((item) => item.ongoing).length;
  const meetingOngoing = meetingItems.filter((item) => item.ongoing).length;

  const mailQueue = source.mail.filter(
    (item) =>
      !item.archived &&
      item.direction === 'INCOMING' &&
      item.workflowStatus !== 'PROCESSED' &&
      item.workflowStatus !== 'ARCHIVED'
  );
  const urgentMail = mailQueue.filter((item) => item.priority === 'URGENT').length;
  const normalMail = mailQueue.length - urgentMail;

  const plannedMissions = source.missions.filter((item) => {
    const visual = missionVisual(item, source.now);
    return visual === 'PLANNED' || visual === 'DEPART_TODAY';
  });
  const ongoingMissions = source.missions.filter(
    (item) => missionVisual(item, source.now) === 'ONGOING'
  );
  const leadMission = ongoingMissions[0] ?? plannedMissions[0];
  const missionHint = leadMission?.destination
    ? leadMission.destination
    : ongoingMissions.length > 0
      ? 'En cours'
      : plannedMissions.length > 0
        ? 'En préparation'
        : 'Aucune en cours';
  const attention: CockpitAttentionItem[] = [];
  if (mailQueue.length > 0) {
    const detail = [
      urgentMail > 0 ? frenchCount(urgentMail, 'urgent', 'urgents') : '',
      normalMail > 0 ? frenchCount(normalMail, 'normal', 'normaux') : '',
    ]
      .filter(Boolean)
      .join(' • ');
    attention.push({
      id: 'mail',
      tone: 'mail',
      title: frenchCount(mailQueue.length, 'courrier à traiter', 'courriers à traiter'),
      detail: detail || 'À traiter',
      href: '/dg/workspace/mail',
    });
  }
  if (source.pendingAppointments > 0) {
    attention.push({
      id: 'appt',
      tone: 'check',
      title: frenchCount(
        source.pendingAppointments,
        'validation en attente',
        'validations en attente'
      ),
      detail: 'Demandes de rendez-vous',
      href: '/dg/appointments',
    });
  }
  if (source.pendingReservations.length > 0) {
    const next = [...source.pendingReservations].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime()
    )[0];
    attention.push({
      id: 'room-pending',
      tone: 'reunion',
      title: frenchCount(
        source.pendingReservations.length,
        'salle à confirmer',
        'salles à confirmer'
      ),
      detail: next
        ? `${next.title} · ${new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric',
            month: 'short',
            timeZone: 'Africa/Conakry',
          }).format(next.startAt)}`
        : 'Demande de salle',
      href: DG_ROOM_RESERVATIONS_HREF,
    });
  }
  const inboxParts = [
    mailQueue.length > 0 ? frenchCount(mailQueue.length, 'courrier', 'courriers') : '',
    source.pendingAppointments > 0
      ? frenchCount(source.pendingAppointments, 'validation', 'validations')
      : '',
    source.pendingReservations.length > 0
      ? frenchCount(source.pendingReservations.length, 'salle', 'salles')
      : '',
  ]
    .filter(Boolean)
    .slice(0, 2);

  const hours: CockpitHourBar[] = DAY_HOURS.map((hour) => ({
    hour,
    label: `${hour}h`,
    rdv: appointmentsToday.filter(
      (item) =>
        !item.isOnlineMeeting &&
        !MEETING_USAGES.has(reservationByAppointment.get(item.id)?.usageType ?? 'AUTRE') &&
        coversHour(item.startAt, item.endAt, hour)
    ).length,
    reunion:
      appointmentsToday.filter((item) => {
        const room = reservationByAppointment.get(item.id);
        const meeting = item.isOnlineMeeting || (room ? MEETING_USAGES.has(room.usageType) : false);
        return meeting && coversHour(item.startAt, item.endAt, hour);
      }).length +
      reservationsToday.filter((item) => {
        if (item.appointmentId && appointmentsToday.some((appt) => appt.id === item.appointmentId)) {
          return false;
        }
        return coversHour(item.startAt, item.endAt, hour);
      }).length,
    mission: 0,
    free: freeSlots.filter((slot) => Number(slot.startTime.slice(0, 2)) === hour).length,
  }));

  const laterAppointments = source.appointments
    .filter((item) => item.status === 'APPROVED')
    .filter((item) => {
      const key = formatIsoDateInAppTz(item.startAt);
      return key > todayKey && key <= horizonKey;
    });

  const upcomingDrafts: Array<CockpitUpcomingItem & { sort: number }> = [];
  for (const item of laterAppointments) {
    const stamp = upcomingStamp(item.startAt);
    upcomingDrafts.push({
      sort: item.startAt.getTime(),
      id: `up-appt-${item.id}`,
      ...stamp,
      title: item.title,
      detail: `${formatTimeInAppTz(item.startAt)} – ${formatTimeInAppTz(item.endAt)} · ${item.location || item.requestedByName}`,
      href: '/appointments/calendar',
    });
  }
  for (const item of source.reservations) {
    if (item.status !== 'CONFIRMED') continue;
    const key = formatIsoDateInAppTz(item.startAt);
    if (key <= todayKey || key > horizonKey) continue;
    if (item.appointmentId && laterAppointments.some((appt) => appt.id === item.appointmentId)) continue;
    const stamp = upcomingStamp(item.startAt);
    upcomingDrafts.push({
      sort: item.startAt.getTime(),
      id: `up-room-${item.id}`,
      ...stamp,
      title: item.title,
      detail: `${formatTimeInAppTz(item.startAt)} – ${formatTimeInAppTz(item.endAt)} · ${item.roomName}`,
      href: DG_ROOM_RESERVATIONS_HREF,
    });
  }
  const upcoming = upcomingDrafts
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 3)
    .map(({ sort: _sort, ...item }) => item);

  const roomSlices: CockpitRoomSlice[] = [
    {
      key: 'busy',
      label: 'Occupés',
      count: source.slots.filter((slot) => slot.status === 'BUSY').length,
      color: ROOM_COLORS.busy,
    },
    {
      key: 'free',
      label: 'Disponibles',
      count: freeSlots.length,
      color: ROOM_COLORS.free,
    },
    {
      key: 'blocked',
      label: 'Indisponibles',
      count: source.slots.filter((slot) => slot.status === 'BLOCKED' || slot.status === 'BUFFER').length,
      color: ROOM_COLORS.blocked,
    },
  ];

  const contacts = [...source.contacts]
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .slice(0, 4)
    .map((contact) => ({
      id: contact.id,
      initials: contactInitials(contact.fullName),
      name: contact.fullName,
      detail: contact.jobTitle || contact.organization,
      href: '/dg/workspace/contacts',
    }));

  const spark = hours.map((bar) => bar.rdv);
  const freeMinutes = freeSlots.reduce((total, slot) => total + slotMinutes(slot), 0);
  const nowMs = source.now.getTime();
  const orderedToday = [...appointmentsToday].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  );
  const currentAppointment = orderedToday.find(
    (item) => nowMs >= item.startAt.getTime() && nowMs < item.endAt.getTime()
  );
  const nextAppointment = orderedToday.find((item) => item.startAt.getTime() > nowMs);
  const focusSource = currentAppointment ?? nextAppointment ?? null;
  const focusRow = focusSource
    ? agenda.find((item) => item.id === `appt-${focusSource.id}`)
    : undefined;
  const focus: DgCockpitFocus = focusSource
    ? {
        state: currentAppointment ? 'ongoing' : 'next',
        title: focusSource.title,
        timeLabel: focusRow?.timeLabel ?? '',
        place: focusRow?.place ?? '',
        href: focusRow?.href ?? '/appointments/calendar',
      }
    : {
        state: 'clear',
        title: orderedToday.length > 0 ? 'Journée terminée' : 'Aucun rendez-vous',
        timeLabel: '',
        place: '',
        href: '/appointments/calendar',
      };

  const isDg = source.viewer.role === 'DG';
  const person = [source.viewer.firstName, source.viewer.lastName].filter(Boolean).join(' ');

  return {
    greeting: isDg ? 'Bonjour Monsieur le DGA' : person ? `Bonjour ${person}` : 'Bonjour',
    subtitle: 'Agenda du Directeur général adjoint',
    dateLabel: capitalize(
      new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Conakry',
      }).format(source.now)
    ),
    ficheHref: '/dg/fiche-jour',
    planHref: '/dg/plan',
    focus,
    kpis: {
      appointments: {
        count: rdvItems.length,
        hint: rdvOngoing > 0 ? `dont ${frenchCount(rdvOngoing, 'en cours', 'en cours')}` : "Aujourd'hui",
        spark,
      },
      meetings: {
        count: meetingItems.length,
        hint:
          meetingOngoing > 0
            ? `dont ${frenchCount(meetingOngoing, 'en cours', 'en cours')}`
            : "Aujourd'hui",
      },
      missions: {
        count: ongoingMissions.length + plannedMissions.length,
        hint: missionHint,
      },
      inbox: {
        count:
          mailQueue.length +
          source.pendingAppointments +
          source.pendingReservations.length,
        hint: inboxParts.length > 0 ? inboxParts.join(' • ') : 'Rien en attente',
      },
      free: {
        label: formatFreeDuration(freeMinutes),
        hint: "Aujourd'hui",
        minutes: freeMinutes,
      },
    },
    agenda,
    agendaHref: '/appointments/calendar',
    attention,
    attentionHref: attention[0]?.href ?? '/dg/appointments',
    hours,
    upcoming,
    upcomingHref: '/appointments/calendar',
    room: {
      name: source.roomName || 'Salle de réunion',
      total: source.slots.length,
      slices: roomSlices,
      href: DG_ROOM_AVAILABILITY_HREF,
    },
    contacts,
    contactsHref: '/dg/workspace/contacts',
  };
}
