import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AgendaWeekPressure } from '@/lib/ai/types';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { listAppointments } from '@/lib/services/appointments';
import { listRoomReservations } from '@/lib/services/room-reservations';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { effectiveUrgencyLevel } from '@/lib/dg/urgent-slot-priority';
import { APPOINTMENT_URGENCY_LABELS } from '@/lib/dg/appointments-review';
import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';

export type AssistantAiContext = {
  now: Date;
  todayLabel: string;
  approvedToday: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    priority: string;
    requester: string;
    urgencyLabel: string;
    urgentOverride: boolean;
  }[];
  pending: {
    id: string;
    title: string;
    startAt: Date;
    priority: string;
    requester: string;
    urgencyLabel: string;
    urgentOverride: boolean;
  }[];
  tomorrowUrgent: {
    id: string;
    title: string;
    startAt: Date;
    requester: string;
  }[];
  stats: {
    pendingCount: number;
    approvedTodayCount: number;
    approvedWeekCount: number;
    roomReservationsToday: number;
    highPriorityPending: number;
    urgentPending: number;
  };
  pressure: AgendaWeekPressure;
};

function priorityWeight(p: string) {
  if (p === 'HIGH') return 3;
  if (p === 'MEDIUM') return 2;
  return 1;
}

function personName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export async function buildAssistantAiContext(referenceDate?: Date): Promise<AssistantAiContext> {
  const now = new Date();
  const target = referenceDate ?? now;
  const todayStart = startOfDay(target);
  const todayEnd = endOfDay(target);
  const weekStart = startOfWeek(target, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(target, { weekStartsOn: 1 });
  const tomorrowStart = startOfDay(addDays(todayStart, 1));
  const tomorrowEnd = endOfDay(addDays(todayStart, 1));

  await autoRejectExpiredPendingAppointments({ now });

  const [pendingRaw, approvedTodayRaw, approvedWeek, roomToday, roomWeek] = await Promise.all([
    listAppointments({ status: 'PENDING' }),
    listAppointments({ status: 'APPROVED', from: todayStart, to: todayEnd }),
    listAppointments({ status: 'APPROVED', from: weekStart, to: weekEnd }),
    listRoomReservations({ from: todayStart, to: todayEnd }),
    listRoomReservations({
      from: weekStart,
      to: weekEnd,
      status: ['CONFIRMED', 'PENDING'],
    }),
  ]);

  const pending = [...pendingRaw]
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
    .map((a) => {
      const { meta } = parseAppointmentMeta(a.description);
      return {
        id: a.id,
        title: a.title,
        startAt: a.startAt,
        priority: a.priority,
        requester: personName(a.requestedBy),
        urgencyLabel: APPOINTMENT_URGENCY_LABELS[
          effectiveUrgencyLevel(meta.urgencyLevel ?? 'NORMAL', a.urgentOverride)
        ],
        urgentOverride: a.urgentOverride,
      };
    });

  const approvedToday = [...approvedTodayRaw]
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((a) => {
      const { meta } = parseAppointmentMeta(a.description);
      return {
        id: a.id,
        title: a.title,
        startAt: a.startAt,
        endAt: a.endAt,
        priority: a.priority,
        requester: personName(a.requestedBy),
        urgencyLabel: APPOINTMENT_URGENCY_LABELS[
          effectiveUrgencyLevel(meta.urgencyLevel ?? 'NORMAL', a.urgentOverride)
        ],
        urgentOverride: a.urgentOverride,
      };
    });

  const tomorrowUrgent = approvedWeek
    .filter((a) => a.urgentOverride && a.startAt >= tomorrowStart && a.startAt <= tomorrowEnd)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt,
      requester: personName(a.requestedBy),
    }));

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayKey = formatIsoDateInAppTz(now);
  const weekKeys = new Set(weekDays.map((day) => formatIsoDateInAppTz(day)));
  const confirmedByDay = new Map<string, number>();
  const pendingByDay = new Map<string, number>();
  for (const row of approvedWeek) {
    const key = formatIsoDateInAppTz(row.startAt);
    confirmedByDay.set(key, (confirmedByDay.get(key) ?? 0) + 1);
  }
  let pendingOnWeek = 0;
  let pendingOutsideWeek = 0;
  for (const row of pending) {
    const key = formatIsoDateInAppTz(row.startAt);
    if (!weekKeys.has(key)) {
      pendingOutsideWeek += 1;
      continue;
    }
    pendingOnWeek += 1;
    pendingByDay.set(key, (pendingByDay.get(key) ?? 0) + 1);
  }
  const days = weekDays.map((day) => {
    const key = formatIsoDateInAppTz(day);
    return {
      key,
      label: format(day, 'EEE d', { locale: fr }),
      confirmed: confirmedByDay.get(key) ?? 0,
      pending: pendingByDay.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
  const onsiteWeek = approvedWeek.filter((row) => !row.isOnlineMeeting).length;
  const onlineWeek = approvedWeek.filter((row) => row.isOnlineMeeting).length;
  const highPriorityPending = pending.filter((row) => row.priority === 'HIGH').length;
  const urgentPending = pending.filter((row) => row.urgentOverride).length;
  const peak = days.reduce((best, day) => (day.confirmed > best.confirmed ? day : best), days[0]);
  const reading: string[] = [];
  if (!peak || peak.confirmed === 0) {
    reading.push('Aucun rendez-vous confirmé sur cette semaine.');
  } else {
    reading.push(
      `Le jour le plus chargé en rendez-vous confirmés est le ${peak.label} (${peak.confirmed}).`
    );
  }
  if (pendingOnWeek > 0) {
    reading.push(
      pendingOnWeek > 1
        ? `${pendingOnWeek} demandes visent un créneau de cette semaine.`
        : '1 demande vise un créneau de cette semaine.'
    );
  }
  if (pendingOutsideWeek > 0) {
    reading.push(
      pendingOutsideWeek > 1
        ? `${pendingOutsideWeek} demandes portent sur une date hors de cette semaine.`
        : '1 demande porte sur une date hors de cette semaine.'
    );
  }
  if (highPriorityPending > 0) {
    reading.push(
      highPriorityPending > 1
        ? `${highPriorityPending} demandes en haute priorité restent à arbitrer.`
        : '1 demande en haute priorité reste à arbitrer.'
    );
  }
  if (urgentPending > 0) {
    reading.push(
      urgentPending > 1
        ? `${urgentPending} demandes sont marquées ultra urgentes.`
        : '1 demande est marquée ultra urgente.'
    );
  }

  return {
    now,
    todayLabel: format(target, 'EEEE d MMMM yyyy', { locale: fr }),
    approvedToday,
    pending,
    tomorrowUrgent,
    stats: {
      pendingCount: pending.length,
      approvedTodayCount: approvedToday.length,
      approvedWeekCount: approvedWeek.length,
      roomReservationsToday: roomToday.length,
      highPriorityPending,
      urgentPending,
    },
    pressure: {
      weekLabel: `Semaine du ${format(weekDays[0], 'd MMM', { locale: fr })} au ${format(weekDays[6], 'd MMM yyyy', { locale: fr })}`,
      days,
      confirmedWeek: approvedWeek.length,
      pendingOnWeek,
      pendingOutsideWeek,
      highPriorityPending,
      urgentPending,
      onsiteWeek,
      onlineWeek,
      roomsWeek: roomWeek.length,
      reading,
    },
  };
}

export function formatAgendaTimeRange(start: Date, end: Date) {
  return `${formatTimeInAppTz(start)} – ${formatTimeInAppTz(end)}`;
}

export function contextToPromptPayload(ctx: AssistantAiContext) {
  return {
    date: ctx.todayLabel,
    agenda: ctx.approvedToday.map((a) => ({
      time: formatAgendaTimeRange(a.startAt, a.endAt),
      title: a.title,
      requester: a.requester,
      priority: a.priority,
      urgency: a.urgencyLabel,
      ultraUrgent: a.urgentOverride,
    })),
    pending: ctx.pending.map((p) => ({
      title: p.title,
      slot: format(p.startAt, 'EEE d MMM HH:mm', { locale: fr }),
      requester: p.requester,
      priority: p.priority,
      urgency: p.urgencyLabel,
      ultraUrgent: p.urgentOverride,
    })),
    tomorrowUrgent: ctx.tomorrowUrgent.map((a) => ({
      time: format(a.startAt, 'EEE d MMM HH:mm', { locale: fr }),
      title: a.title,
      requester: a.requester,
    })),
    stats: ctx.stats,
  };
}
