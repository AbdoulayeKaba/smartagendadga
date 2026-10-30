import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime/format';
import { parseDateTime } from '@/lib/dg/scheduling';

export type MinSubmissionLeadRule = {
  enabled: boolean;
  minHours: number;
  minDays: number;
};

function hhMmToMinutes(value: string): number {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHhMm(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 45));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function laterHhMm(a: string, b: string): string {
  return a >= b ? a : b;
}

function nextSlotAfterNow(nowHhMm: string, stepMinutes = 15): string {
  return minutesToHhMm(Math.ceil((hhMmToMinutes(nowHhMm) + 1) / stepMinutes) * stepMinutes);
}

/**
 * Convertit les délais « 24 h / 48 h glissantes » en jours calendaires pour le calendrier :
 * demain dès l’ouverture du cabinet, plutôt qu’à la même heure le lendemain.
 */
export function normalizeMinSubmissionLeadRule(rule: MinSubmissionLeadRule): MinSubmissionLeadRule {
  if (!rule.enabled || rule.minDays > 0) return rule;
  const hours = Math.max(0, rule.minHours | 0);
  if (hours < 24) return rule;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return {
    enabled: true,
    minDays: Math.max(1, days),
    minHours: remainder,
  };
}

/** Ajoute N jours calendaires à une date ISO (yyyy-MM-dd), en UTC date-only. */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = Date.UTC(y, (m ?? 1) - 1, d ?? 1) + days * 86_400_000;
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function minSubmissionLeadDelayLabel(rule: MinSubmissionLeadRule): string | null {
  const hours = Math.max(0, rule.minHours | 0);
  const days = Math.max(0, rule.minDays | 0);
  if (hours > 0 && days > 0) {
    return `${days} jour${days > 1 ? 's' : ''} et ${hours} heure${hours > 1 ? 's' : ''}`;
  }
  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} heure${hours > 1 ? 's' : ''}`;
  return null;
}

/** Phrase affichée dans le formulaire tant que la règle est active. */
export function minSubmissionLeadNotice(rule: MinSubmissionLeadRule): string | null {
  const normalized = normalizeMinSubmissionLeadRule(rule);
  if (!normalized.enabled) return null;
  const delay = minSubmissionLeadDelayLabel(normalized);
  if (!delay) return 'Un créneau trop proche est refusé, sauf urgence justifiée.';
  return `La demande doit arriver au moins ${delay} avant le créneau. Un créneau trop proche est refusé, sauf urgence justifiée.`;
}

export const MIN_SUBMISSION_LEAD_WAIVED_NOTICE =
  'Urgence justifiée : ce délai ne s’applique plus à ce créneau.';

export function minSubmissionLeadMessage(rule: MinSubmissionLeadRule): string {
  const hours = Math.max(0, rule.minHours | 0);
  const days = Math.max(0, rule.minDays | 0);
  if (hours > 0 && days > 0) {
    return `Le délai minimum de soumission est de ${hours} heure${hours > 1 ? 's' : ''} et ${days} jour${days > 1 ? 's' : ''}.`;
  }
  if (days > 0) {
    return `Le délai minimum de soumission est de ${days} jour${days > 1 ? 's' : ''}.`;
  }
  if (hours > 0) {
    return `Le délai minimum de soumission est de ${hours} heure${hours > 1 ? 's' : ''}.`;
  }
  return 'Le délai minimum de soumission n’est pas respecté.';
}

/** Instant le plus tôt autorisé pour le début du créneau (now + minHours). */
export function earliestInstantByHours(now: Date, rule: MinSubmissionLeadRule): Date {
  const hours = Math.max(0, rule.minHours | 0);
  return new Date(now.getTime() + hours * 3_600_000);
}

/** Première date ISO autorisée (aujourd’hui + minDays). */
export function earliestAllowedIsoDate(now: Date, rule: MinSubmissionLeadRule): string {
  const today = formatIsoDateInAppTz(now);
  const days = Math.max(0, rule.minDays | 0);
  return addDaysToIsoDate(today, days);
}

export function isDateBlockedByMinSubmissionLead(
  isoDate: string,
  now: Date,
  rule: MinSubmissionLeadRule
): boolean {
  const normalized = normalizeMinSubmissionLeadRule(rule);
  if (!normalized.enabled || !isoDate) return false;
  if (isoDate < earliestAllowedIsoDate(now, normalized)) return true;
  // Une date avant le jour de (now + minHours) n’a aucun créneau valide.
  const byHoursDate = formatIsoDateInAppTz(earliestInstantByHours(now, normalized));
  return isoDate < byHoursDate;
}

/**
 * Borne basse HH:mm pour le début sur `isoDate` (arrondie au pas).
 * `undefined` = pas de borne supplémentaire ce jour-là (la plage cabinet s’applique).
 */
export function earliestSelectableStartTimeOnDate(
  isoDate: string,
  now: Date,
  rule: MinSubmissionLeadRule,
  stepMinutes = 15
): string | undefined {
  const normalized = normalizeMinSubmissionLeadRule(rule);
  if (!normalized.enabled || !isoDate) return undefined;
  if (isDateBlockedByMinSubmissionLead(isoDate, now, normalized)) return undefined;

  const earliest = earliestInstantByHours(now, normalized);
  const earliestDate = formatIsoDateInAppTz(earliest);
  if (isoDate < earliestDate || isoDate > earliestDate) return undefined;

  const hhMm = formatTimeInAppTz(earliest);
  const [h = 0, m = 0] = hhMm.split(':').map(Number);
  const ceiled = Math.ceil((h * 60 + m) / stepMinutes) * stepMinutes;
  if (ceiled > 23 * 60 + 45) return undefined;
  const eh = Math.floor(ceiled / 60);
  const em = ceiled % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

export function validateSlotAgainstMinSubmissionLead(input: {
  date: string;
  startTime: string;
  now?: Date;
  rule: MinSubmissionLeadRule;
}): string | null {
  const { date, startTime, rule } = input;
  const normalized = normalizeMinSubmissionLeadRule(rule);
  if (!normalized.enabled) return null;
  if (!date || !startTime) return null;

  const now = input.now ?? new Date();
  if (isDateBlockedByMinSubmissionLead(date, now, normalized)) {
    return minSubmissionLeadMessage(normalized);
  }

  const slotStart = parseDateTime(date, startTime);
  const earliest = earliestInstantByHours(now, normalized);
  if (slotStart.getTime() < earliest.getTime()) {
    return minSubmissionLeadMessage(normalized);
  }
  return null;
}

/** Heures par défaut cohérentes lors du choix d’une date dans le calendrier. */
export function resolvePlanningSlotDefaultsForDate(input: {
  date: string;
  now: Date;
  rule: MinSubmissionLeadRule;
  workDayStart?: string;
  workDayEnd?: string;
  officeHoursRestricted?: boolean;
  durationMinutes?: number;
  stepMinutes?: number;
}): { startTime: string; endTime: string } {
  const rule = normalizeMinSubmissionLeadRule(input.rule);
  const workDayStart = input.workDayStart ?? '09:00';
  const workDayEnd = input.workDayEnd ?? '18:00';
  const officeRestricted = input.officeHoursRestricted ?? true;
  const duration = input.durationMinutes ?? 60;
  const step = input.stepMinutes ?? 15;

  const officeMin = officeRestricted ? workDayStart : '00:00';
  const officeMax = officeRestricted ? workDayEnd : '23:45';

  const leadMin = earliestSelectableStartTimeOnDate(input.date, input.now, rule, step);
  const isToday = input.date === formatIsoDateInAppTz(input.now);
  const systemMin =
    !rule.enabled && isToday ? nextSlotAfterNow(formatTimeInAppTz(input.now), step) : undefined;

  let startTime = [officeMin, leadMin, systemMin]
    .filter((v): v is string => Boolean(v))
    .reduce((acc, v) => laterHhMm(acc, v));

  if (startTime > officeMax) startTime = officeMax;

  let endMinutes = Math.min(hhMmToMinutes(startTime) + duration, hhMmToMinutes(officeMax));
  if (endMinutes <= hhMmToMinutes(startTime)) {
    endMinutes = Math.min(hhMmToMinutes(startTime) + 15, hhMmToMinutes(officeMax));
  }

  return { startTime, endTime: minutesToHhMm(endMinutes) };
}
