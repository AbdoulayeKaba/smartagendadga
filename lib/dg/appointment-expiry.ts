import { normalizeMinSubmissionLeadRule, type MinSubmissionLeadRule } from '@/lib/dg/min-submission-lead';

export const DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES = 120;

export const AUTO_REJECT_BEFORE_START_PRESETS = [
  { label: '1 h', minutes: 60 },
  { label: '2 h', minutes: 120 },
  { label: '3 h', minutes: 180 },
  { label: '4 h', minutes: 240 },
] as const;

function toTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

export const AUTO_REJECT_START_PASSED_REASON =
  'Rejet automatique : non validé avant le début du créneau.';

export function formatAutoRejectExpiredReason(beforeStartMinutes: number): string {
  if (beforeStartMinutes <= 0) {
    return AUTO_REJECT_START_PASSED_REASON;
  }
  if (beforeStartMinutes % 60 === 0) {
    const hours = beforeStartMinutes / 60;
    return `Rejet automatique : non validé par l’assistante ${hours} h avant le début du créneau.`;
  }
  return `Rejet automatique : non validé par l’assistante ${beforeStartMinutes} min avant le début du créneau.`;
}

/** Message par défaut (2 h avant le début). */
export const AUTO_REJECT_EXPIRED_REASON = formatAutoRejectExpiredReason(
  DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES
);

export function isAutoRejectExpiredReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return reason.startsWith('Rejet automatique :');
}

/**
 * Si le référentiel n’impose aucun délai de soumission (règle coupée, ou 0 h et 0 jour),
 * on ne rejette plus « N h avant le début » : la demande reste en attente jusqu’au créneau.
 */
export function effectiveAutoRejectBeforeStartMinutes(
  configuredMinutes: number,
  lead: MinSubmissionLeadRule
): number {
  const normalized = normalizeMinSubmissionLeadRule(lead);
  if (!normalized.enabled || (normalized.minHours <= 0 && normalized.minDays <= 0)) {
    return 0;
  }
  return Math.max(0, configuredMinutes | 0);
}

/** Dernière limite pour valider : début du créneau moins le délai configuré. */
export function getAutoRejectDeadline(
  startAt: Date | string,
  beforeStartMinutes: number = DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES
): Date {
  const startMs = toTimestamp(startAt);
  return new Date(startMs - beforeStartMinutes * 60_000);
}

/** Une demande PENDING doit être auto-rejetée si l'heure limite de validation est atteinte. */
export function isPendingAppointmentExpired(
  status: string,
  startAt: Date | string,
  now: Date = new Date(),
  beforeStartMinutes: number = DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES
) {
  if (status !== 'PENDING') return false;
  const startMs = toTimestamp(startAt);
  if (Number.isNaN(startMs)) return false;
  const nowMs = now.getTime();
  if (nowMs >= startMs) return true;
  if (beforeStartMinutes <= 0) return false;
  const deadlineMs = getAutoRejectDeadline(startAt, beforeStartMinutes).getTime();
  return nowMs >= deadlineMs;
}

/** Motif de rejet selon le moment (avant ou après le début du créneau). */
export function resolveAutoRejectReason(
  startAt: Date | string,
  now: Date,
  beforeStartMinutes: number = DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES
): string {
  const startMs = toTimestamp(startAt);
  if (!Number.isNaN(startMs) && now.getTime() >= startMs) {
    return AUTO_REJECT_START_PASSED_REASON;
  }
  return formatAutoRejectExpiredReason(beforeStartMinutes);
}

/** @deprecated Utiliser isPendingAppointmentExpired avec startAt. */
export function isAppointmentSlotEnded(endAt: Date | string, now: Date = new Date()) {
  const endMs = toTimestamp(endAt);
  if (Number.isNaN(endMs)) return false;
  return endMs <= now.getTime();
}
