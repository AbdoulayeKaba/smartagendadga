import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import type { AppointmentRequestMeta } from '@/lib/dg/appointment-request-meta';

export const PLANNING_URGENT_LABEL = 'Ultra urgent';

export const PLANNING_URGENT_TOGGLE_TITLE = 'Priorité ultra urgente';

export const PLANNING_URGENT_TOGGLE_DESC =
  'Cette demande sera signalée comme ultra urgente et passera en premier plan dans la file de validation.';

export const PLANNING_URGENT_ALERT =
  'Cette demande sera signalée comme ultra urgente et passera en premier plan dans la file de validation.';

export function isPlanningUrgentSlot(item: { urgentOverride?: boolean }) {
  return Boolean(item.urgentOverride);
}

export function effectiveUrgencyLevel(
  level: UrgencyLevel,
  urgentOverride: boolean
): UrgencyLevel {
  if (!urgentOverride) return level;
  if (level === 'CRITIQUE') return 'CRITIQUE';
  return 'TRES_URGENT';
}

export function applyPlanningUrgentMeta(meta: AppointmentRequestMeta): AppointmentRequestMeta {
  return {
    ...meta,
    urgencyLevel: meta.urgencyLevel === 'CRITIQUE' ? 'CRITIQUE' : 'TRES_URGENT',
    planningPriority: true,
  };
}

export function clearPlanningUrgentMeta(meta: AppointmentRequestMeta): AppointmentRequestMeta {
  return {
    ...meta,
    planningPriority: false,
  };
}

export function planningUrgentSortScore(item: {
  status: string;
  urgentOverride: boolean;
  urgencyLevel: UrgencyLevel;
  businessScore: number;
}) {
  if (item.status !== 'PENDING') return 0;
  let score = item.businessScore;
  if (item.urgentOverride) score += 10_000;
  if (item.urgencyLevel === 'CRITIQUE') score += 5_000;
  else if (item.urgencyLevel === 'TRES_URGENT') score += 4_000;
  else if (item.urgencyLevel === 'URGENT') score += 3_000;
  return score;
}
