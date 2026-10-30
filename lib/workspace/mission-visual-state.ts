import type { DgMission } from '@/lib/workspace/types';
import {
  isBeforeMissionStart,
  isMissionAutoStartDue,
  isMissionDepartingToday,
  isMissionDepartTodayVisualState,
  isMissionInProgressPeriod,
  isReturnDatePassed,
  startOfDay,
} from '@/lib/workspace/mission-status-workflow';

/** Réexport pour les modules UI (défini dans mission-status-workflow). */
export {
  isMissionDepartingToday,
  isMissionDepartTodayVisualState,
} from '@/lib/workspace/mission-status-workflow';

/** État visuel affiché (badges, lignes, calendrier) — combine statut et dates. */
export type MissionVisualState =
  | 'PLANNED'
  | 'DEPART_TODAY'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export type MissionAttentionTier =
  | 'depart_today'
  | 'ongoing'
  | 'depart_tomorrow'
  | 'planned'
  | 'completed';

export const MISSION_VISUAL_LABELS: Record<MissionVisualState, string> = {
  PLANNED: 'PLANIFIÉ',
  DEPART_TODAY: "DÉPART AUJOURD'HUI",
  ONGOING: 'EN COURS',
  COMPLETED: 'TERMINÉ',
  CANCELLED: 'ANNULÉ',
};

const ATTENTION_TIER_ORDER: Record<MissionAttentionTier, number> = {
  depart_today: 0,
  ongoing: 1,
  depart_tomorrow: 2,
  planned: 3,
  completed: 4,
};

export function isMissionDepartingTomorrow(departAt: string | Date, now = new Date()): boolean {
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return startOfDay(departAt).getTime() === tomorrow.getTime();
}

export function isMissionReturningToday(returnAt: string | Date, now = new Date()): boolean {
  return startOfDay(returnAt).getTime() === startOfDay(now).getTime();
}

/**
 * Une mission ne bloque la validation d’un rendez-vous que lorsqu’elle est réellement en cours
 * (démarrage manuel, ou démarrage auto à 22h59). Planifiée ou « départ aujourd’hui », le créneau reste validable.
 */
export function isMissionBlockingApproval(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'> & { archived?: boolean },
  now = new Date()
): boolean {
  if (mission.archived) return false;
  return resolveMissionVisualState(mission, now) === 'ONGOING';
}

/**
 * État visuel aligné sur le statut métier + dates.
 * « DÉPART AUJOURD'HUI » si encore planifiée le jour J (avant démarrage manuel ou auto 22h59).
 * « EN COURS » dès démarrage manuel, ou dès 22h59 (démarrage auto dû / déjà appliqué).
 */
export function resolveMissionVisualState(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): MissionVisualState {
  if (mission.status === 'CANCELLED') return 'CANCELLED';
  if (mission.status === 'COMPLETED' || isReturnDatePassed(now, mission.returnAt)) {
    return 'COMPLETED';
  }
  if (mission.status === 'ONGOING') return 'ONGOING';
  if (
    mission.status === 'PLANNED' &&
    isMissionAutoStartDue(now, mission.departAt, mission.returnAt)
  ) {
    return 'ONGOING';
  }
  if (isMissionDepartTodayVisualState(mission.departAt, now)) return 'DEPART_TODAY';
  if (mission.status === 'PLANNED') return 'PLANNED';
  return 'PLANNED';
}

/** Coloration calendrier : période départ–retour (indépendamment du statut DB). */
export function resolveMissionCalendarVisualState(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  day: Date
): MissionVisualState {
  if (mission.status === 'CANCELLED') return 'CANCELLED';
  if (mission.status === 'COMPLETED' || isReturnDatePassed(day, mission.returnAt)) {
    return 'COMPLETED';
  }
  if (isMissionDepartingToday(mission.departAt, day)) return 'DEPART_TODAY';
  if (isMissionInProgressPeriod(day, mission.departAt, mission.returnAt)) {
    return mission.status === 'ONGOING' ? 'ONGOING' : 'PLANNED';
  }
  if (isBeforeMissionStart(day, mission.departAt)) return 'PLANNED';
  return 'PLANNED';
}

export function getMissionAttentionTier(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt' | 'archived'>,
  now = new Date()
): MissionAttentionTier | null {
  if (mission.archived) return null;
  const visual = resolveMissionVisualState(mission, now);
  if (visual === 'DEPART_TODAY') return 'depart_today';
  if (visual === 'ONGOING') return 'ongoing';
  if (visual === 'PLANNED' && isMissionDepartingTomorrow(mission.departAt, now)) return 'depart_tomorrow';
  if (visual === 'PLANNED') return 'planned';
  if (visual === 'COMPLETED') return 'completed';
  return null;
}

export function compareMissionAttention(
  a: Pick<DgMission, 'status' | 'departAt' | 'returnAt' | 'archived'>,
  b: Pick<DgMission, 'status' | 'departAt' | 'returnAt' | 'archived'>,
  now = new Date()
): number {
  const tierA = getMissionAttentionTier(a, now);
  const tierB = getMissionAttentionTier(b, now);
  const orderA = tierA ? ATTENTION_TIER_ORDER[tierA] : 99;
  const orderB = tierB ? ATTENTION_TIER_ORDER[tierB] : 99;
  if (orderA !== orderB) return orderA - orderB;
  return new Date(a.departAt).getTime() - new Date(b.departAt).getTime();
}

export function missionVisualRowClassName(state: MissionVisualState): string {
  const map: Record<MissionVisualState, string> = {
    PLANNED: 'workspace-module-row--mission-planned',
    DEPART_TODAY: 'workspace-module-row--mission-depart-today',
    ONGOING: 'workspace-module-row--mission-ongoing',
    COMPLETED: 'workspace-module-row--mission-completed',
    CANCELLED: 'workspace-module-row--mission-cancelled',
  };
  return map[state];
}

export function missionNeedsStartPrompt(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): boolean {
  return mission.status === 'PLANNED' && isMissionDepartTodayVisualState(mission.departAt, now);
}

export function missionNeedsClosePrompt(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): boolean {
  return mission.status === 'ONGOING' && isReturnDatePassed(now, mission.returnAt);
}

export function sortMissionsByAttention<T extends Pick<DgMission, 'status' | 'departAt' | 'returnAt' | 'archived'>>(
  missions: T[],
  now = new Date()
): T[] {
  return [...missions].sort((a, b) => compareMissionAttention(a, b, now));
}
