import { differenceInCalendarDays } from 'date-fns';
import { startOfDay } from '@/lib/workspace/mission-status-workflow';
import type { DgMission, MissionOperationalState } from '@/lib/workspace/types';

export const MISSION_OPERATIONAL_STATE_LABELS: Record<MissionOperationalState, string> = {
  NORMAL: 'Normal',
  PROLONGED: 'Prolongée',
  SHORTENED: 'Écourtée',
  CLOSED: 'Clôturée',
};

/** Motifs prédéfinis — prolongation. */
export const MISSION_EXTEND_REASONS = [
  'EXTRA_MEETING',
  'PROGRAM_EXTENDED',
  'TRAVEL_DELAY',
  'DG_REQUEST',
  'OTHER',
] as const;

export type MissionExtendReason = (typeof MISSION_EXTEND_REASONS)[number];

export const MISSION_EXTEND_REASON_LABELS: Record<MissionExtendReason, string> = {
  EXTRA_MEETING: 'Réunion / rendez-vous supplémentaire',
  PROGRAM_EXTENDED: 'Programme prolongé par l’organisateur',
  TRAVEL_DELAY: 'Retard de transport / logistique',
  DG_REQUEST: 'Demande du DGA',
  OTHER: 'Autre',
};

/** Motifs prédéfinis — écourcissement. */
export const MISSION_SHORTEN_REASONS = [
  'PROGRAM_ENDED_EARLY',
  'AGENDA_CHANGE',
  'DG_REQUEST',
  'BUDGET',
  'OTHER',
] as const;

export type MissionShortenReason = (typeof MISSION_SHORTEN_REASONS)[number];

export const MISSION_SHORTEN_REASON_LABELS: Record<MissionShortenReason, string> = {
  PROGRAM_ENDED_EARLY: 'Programme terminé plus tôt que prévu',
  AGENDA_CHANGE: 'Changement d’agenda',
  DG_REQUEST: 'Demande du DGA',
  BUDGET: 'Contraintes budgétaires',
  OTHER: 'Autre',
};

export type MissionAdjustReturnMode = 'extend' | 'shorten';

/** Motifs prédéfinis — réouverture (mission annulée). */
export const MISSION_REOPEN_REASONS = [
  'EVENT_RESCHEDULED',
  'CANCELLED_BY_MISTAKE',
  'NEW_INSTRUCTIONS',
  'DG_REQUEST',
  'OTHER',
] as const;

export type MissionReopenReason = (typeof MISSION_REOPEN_REASONS)[number];

export const MISSION_REOPEN_REASON_LABELS: Record<MissionReopenReason, string> = {
  EVENT_RESCHEDULED: 'Événement / programme reporté',
  CANCELLED_BY_MISTAKE: 'Annulation par erreur',
  NEW_INSTRUCTIONS: 'Nouvelles instructions',
  DG_REQUEST: 'Demande du DGA',
  OTHER: 'Autre',
};

export function missionAdjustReasons(mode: MissionAdjustReturnMode) {
  if (mode === 'shorten') {
    return {
      ids: MISSION_SHORTEN_REASONS,
      labels: MISSION_SHORTEN_REASON_LABELS as Record<string, string>,
    };
  }
  return {
    ids: MISSION_EXTEND_REASONS,
    labels: MISSION_EXTEND_REASON_LABELS as Record<string, string>,
  };
}

export function resolveMissionAdjustReasonLabel(
  mode: MissionAdjustReturnMode,
  reasonId: string,
  detail?: string | null
): string {
  const { labels } = missionAdjustReasons(mode);
  const label = labels[reasonId] ?? reasonId;
  if (reasonId === 'OTHER') {
    const d = detail?.trim() ?? '';
    return d.length >= 3 ? d : label;
  }
  return label;
}

export function resolveMissionReopenReasonLabel(
  reasonId: string,
  detail?: string | null
): string {
  const label = MISSION_REOPEN_REASON_LABELS[reasonId as MissionReopenReason] ?? reasonId;
  if (reasonId === 'OTHER') {
    const d = detail?.trim() ?? '';
    return d.length >= 3 ? d : label;
  }
  return label;
}

export type MissionExtendInput = {
  returnAt: string;
  reason: string;
  comment?: string | null;
};

export type MissionReopenInput = {
  reason?: string | null;
  returnAt?: string | null;
};

export function prolongationExtraDays(
  mission: Pick<DgMission, 'initialReturnAt' | 'returnAt'>
): number {
  const initial = new Date(mission.initialReturnAt);
  const current = new Date(mission.returnAt);
  if (Number.isNaN(initial.getTime()) || Number.isNaN(current.getTime())) return 0;
  return Math.max(0, differenceInCalendarDays(current, initial));
}

export function prolongationLabel(
  mission: Pick<DgMission, 'initialReturnAt' | 'returnAt' | 'operationalState' | 'prolongationCount'>
): string | null {
  if (mission.operationalState !== 'PROLONGED' && mission.prolongationCount <= 0) return null;
  const extra = prolongationExtraDays(mission);
  if (extra > 0) return `Prolongation (+${extra} jour${extra > 1 ? 's' : ''})`;
  return 'Prolongée';
}

export function resolveOperationalStateAfterReturnChange(
  initialReturnAt: string | Date,
  newReturnAt: string | Date,
  previousReturnAt: string | Date
): MissionOperationalState {
  const initial = startOfDay(initialReturnAt).getTime();
  const next = startOfDay(newReturnAt).getTime();
  const prev = startOfDay(previousReturnAt).getTime();
  if (next > prev || next > initial) return 'PROLONGED';
  if (next < prev || next < initial) return 'SHORTENED';
  return 'NORMAL';
}

export function validateMissionExtend(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  input: MissionExtendInput
): string | null {
  if (mission.status !== 'ONGOING') return 'MISSION_NOT_ONGOING';
  const reason = input.reason?.trim() ?? '';
  if (reason.length < 3) return 'EXTEND_REASON_REQUIRED';
  const newReturn = new Date(input.returnAt);
  const oldReturn = new Date(mission.returnAt);
  const depart = startOfDay(mission.departAt);
  if (Number.isNaN(newReturn.getTime())) return 'VALIDATION_ERROR';
  if (startOfDay(newReturn).getTime() < depart.getTime()) return 'INVALID_RETURN_BEFORE_DEPART';
  if (startOfDay(newReturn).getTime() === startOfDay(oldReturn).getTime()) return 'SAME_RETURN_DATE';
  return null;
}

export function validateMissionReopen(
  mission: Pick<DgMission, 'status' | 'archived' | 'returnAt'>,
  input: MissionReopenInput,
  now = new Date()
): string | null {
  if (mission.archived) return 'MISSION_LOCKED';
  if (mission.status === 'COMPLETED') return 'MISSION_COMPLETED_FINAL';
  if (mission.status !== 'CANCELLED') {
    return 'INVALID_TRANSITION';
  }
  const returnReached = startOfDay(now).getTime() >= startOfDay(mission.returnAt).getTime();
  if (returnReached) {
    if (!input.returnAt?.trim()) return 'REOPEN_RETURN_REQUIRED';
    const newReturn = new Date(input.returnAt);
    if (Number.isNaN(newReturn.getTime())) return 'VALIDATION_ERROR';
    if (startOfDay(newReturn).getTime() < startOfDay(now).getTime()) {
      return 'INVALID_RETURN_DATE';
    }
  }
  return null;
}

export function formatMissionHistoryDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
