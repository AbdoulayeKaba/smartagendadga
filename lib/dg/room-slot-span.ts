import { timeToMinutes } from '@/lib/dg/schedule-capacity';

/** Une réservation de salle peut couvrir plusieurs créneaux, jusqu’à 4 heures. */
export const ROOM_SPAN_MAX_MINUTES = 240;

export const ROOM_SPAN_HOUR_CHOICES = [60, 120, 180, 240] as const;

export type RoomGridSlot = {
  startTime: string;
  endTime: string;
  status: string;
  label?: string;
  reason?: string;
};

export type RoomSpanOption = {
  minutes: number;
  startTime: string;
  endTime: string;
  slots: RoomGridSlot[];
  available: boolean;
  blockedReason: string | null;
};

function byStart(slots: RoomGridSlot[]): RoomGridSlot[] {
  return [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function slotUnavailableReason(slot: RoomGridSlot): string {
  const detail = slot.label?.trim() || slot.reason?.trim();
  const range = `${slot.startTime}–${slot.endTime}`;
  return detail
    ? `${range} n’est pas libre (${detail}).`
    : `${range} n’est pas libre.`;
}

/** Créneaux qui se suivent sans trou à partir de l’heure de début. */
export function contiguousRoomSlots(slots: RoomGridSlot[], startTime: string): RoomGridSlot[] {
  const ordered = byStart(slots);
  const startIndex = ordered.findIndex((slot) => slot.startTime === startTime);
  if (startIndex < 0) return [];
  const chain = [ordered[startIndex]];
  for (let index = startIndex + 1; index < ordered.length; index += 1) {
    const previous = chain[chain.length - 1];
    const next = ordered[index];
    if (next.startTime !== previous.endTime) break;
    chain.push(next);
  }
  return chain;
}

/** Journée entière : du premier au dernier créneau, sans limite de 4 h. */
export function roomFullDaySpan(slots: RoomGridSlot[]): RoomSpanOption | null {
  const ordered = byStart(slots);
  if (!ordered.length) return null;

  const startTime = ordered[0].startTime;
  const endTime = ordered[ordered.length - 1].endTime;
  let gap = false;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startTime !== ordered[index - 1].endTime) {
      gap = true;
      break;
    }
  }
  const blocked = ordered.find((slot) => slot.status !== 'AVAILABLE');
  return {
    minutes: timeToMinutes(endTime) - timeToMinutes(startTime),
    startTime,
    endTime,
    slots: ordered,
    available: !gap && !blocked,
    blockedReason: gap
      ? 'La journée n’est pas continue : un trou empêche de tout réserver.'
      : blocked
        ? slotUnavailableReason(blocked)
        : null,
  };
}

/** Toutes les fins possibles en avançant créneau par créneau, dans la limite de 4 h. */
export function roomSpanOptions(slots: RoomGridSlot[], startTime: string): RoomSpanOption[] {
  const chain = contiguousRoomSlots(slots, startTime);
  if (!chain.length) return [];

  const options: RoomSpanOption[] = [];
  const covered: RoomGridSlot[] = [];
  for (const slot of chain) {
    covered.push(slot);
    const minutes = timeToMinutes(slot.endTime) - timeToMinutes(startTime);
    if (minutes <= 0) continue;
    if (minutes > ROOM_SPAN_MAX_MINUTES) break;
    const blocked = covered.find((item) => item.status !== 'AVAILABLE');
    options.push({
      minutes,
      startTime,
      endTime: slot.endTime,
      slots: [...covered],
      available: !blocked,
      blockedReason: blocked ? slotUnavailableReason(blocked) : null,
    });
  }
  return options;
}

export function explainRoomSpan(
  slots: RoomGridSlot[],
  startTime: string,
  endTime: string
): { ok: true; option: RoomSpanOption } | { ok: false; message: string } {
  if (!startTime || !endTime || timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { ok: false, message: 'L’heure de fin doit être après le début.' };
  }
  const fullDay = roomFullDaySpan(slots);
  if (fullDay && startTime === fullDay.startTime && endTime === fullDay.endTime) {
    if (!fullDay.available) {
      return {
        ok: false,
        message: fullDay.blockedReason
          ? `Impossible de réserver la journée : ${fullDay.blockedReason}`
          : 'Impossible de réserver la journée entière.',
      };
    }
    return { ok: true, option: fullDay };
  }

  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (minutes > ROOM_SPAN_MAX_MINUTES) {
    return { ok: false, message: 'La durée maximale d’une réservation de salle est de 4 heures.' };
  }
  const match = roomSpanOptions(slots, startTime).find((option) => option.endTime === endTime);
  if (!match) {
    return {
      ok: false,
      message: 'Le créneau doit couvrir des horaires consécutifs de la salle, sans interruption.',
    };
  }
  if (!match.available) {
    return {
      ok: false,
      message: match.blockedReason
        ? `Impossible d’étendre le créneau : ${match.blockedReason}`
        : 'Impossible d’étendre le créneau : un horaire inclus n’est pas libre.',
    };
  }
  return { ok: true, option: match };
}

/** Conserve la durée si les créneaux du nouveau début le permettent, sinon le premier créneau libre. */
export function moveRoomSpanStart(
  slots: RoomGridSlot[],
  nextStart: string,
  previousStart: string,
  previousEnd: string
): { startTime: string; endTime: string } | null {
  const duration = timeToMinutes(previousEnd) - timeToMinutes(previousStart);
  const options = roomSpanOptions(slots, nextStart).filter((option) => option.available);
  const sameDuration = options.find((option) => option.minutes === duration);
  const next = sameDuration ?? options[0];
  if (!next) return null;
  return { startTime: next.startTime, endTime: next.endTime };
}
