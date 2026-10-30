/**
 * Détermine les rappels à planifier selon reminderMinutesBefore :
 * - undefined / null → standards (24 h + 1 h)
 * - 0 → aucun
 * - > 0 → un seul rappel à l’échéance choisie
 */
export function resolveReminderOffsets(reminderMinutesBefore: number | null | undefined): number[] {
  if (reminderMinutesBefore === 0) return [];
  if (reminderMinutesBefore != null && reminderMinutesBefore > 0) {
    return [reminderMinutesBefore];
  }
  return [24 * 60, 60];
}

export function reminderKindForOffset(minutesBefore: number): 'REMINDER_24H' | 'REMINDER_1H' {
  return minutesBefore >= 24 * 60 ? 'REMINDER_24H' : 'REMINDER_1H';
}

export function reminderLabelFr(minutesBefore: number): string {
  if (minutesBefore >= 24 * 60) {
    const days = Math.round(minutesBefore / (24 * 60));
    return days === 1 ? '24 heures' : `${days} jours`;
  }
  if (minutesBefore >= 60) {
    const hours = Math.round(minutesBefore / 60);
    return hours === 1 ? '1 heure' : `${hours} heures`;
  }
  return `${minutesBefore} minutes`;
}

/** Affiché sur la fiche dès que le début du créneau est passé : plus aucun rappel ne part. */
export const SLOT_ELAPSED_REMINDERS_LABEL = 'Créneau écoulé — rappels désactivés';

export function isAppointmentSlotElapsed(startAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= startAt.getTime();
}

const TWO_MIN_MS = 2 * 60_000;
/** Au-delà, un e-mail « réunion terminée » n’a plus de sens opérationnel. */
export const MEETING_ENDED_CATCHUP_MS = 6 * 60 * 60_000;

/**
 * Un rappel / cycle de vie ne doit partir que s’il est encore pertinent
 * au moment de l’envoi (jamais pour un RDV déjà passé).
 */
export function shouldDispatchScheduledAppointmentMail(input: {
  kind: string;
  now: Date;
  startAt: Date;
  endAt: Date;
}): boolean {
  const now = input.now.getTime();
  const start = input.startAt.getTime();
  const end = input.endAt.getTime();

  if (input.kind === 'REMINDER_24H' || input.kind === 'REMINDER_1H') {
    return now < start;
  }

  if (input.kind === 'MEETING_STARTED') {
    return now >= start - TWO_MIN_MS && now <= end;
  }

  if (input.kind === 'MEETING_ENDED') {
    return now >= end && now - end <= MEETING_ENDED_CATCHUP_MS;
  }

  return false;
}
