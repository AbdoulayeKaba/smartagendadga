import type { DgRole } from '@/lib/dg/rbac';
import { canAdminPlatform } from '@/lib/dg/rbac';
import type { DgMission, MissionStatus } from '@/lib/workspace/types';

export const MISSION_ALLOWED_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  PLANNED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['PLANNED', 'ONGOING'],
};

export const MISSION_CANCEL_REASONS = [
  'REPORT_EVENT',
  'ORGANIZER_CANCEL',
  'BUDGET',
  'DG_UNAVAILABLE',
  'OTHER',
] as const;

export type MissionCancelReason = (typeof MISSION_CANCEL_REASONS)[number];

export const MISSION_CANCEL_REASON_LABELS: Record<MissionCancelReason, string> = {
  REPORT_EVENT: "Report de l'événement",
  ORGANIZER_CANCEL: "Annulation par l'organisateur",
  BUDGET: 'Contraintes budgétaires',
  DG_UNAVAILABLE: 'Indisponibilité du DGA',
  OTHER: 'Autre',
};

export type MissionClosureInput = {
  closureReport?: string | null;
  closureResults?: string | null;
  closureRecommendations?: string | null;
  closureComments?: string | null;
};

export type MissionStatusAction = 'start' | 'close' | 'cancel' | 'reopen';

export function startOfDay(value: Date | string): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isMissionDepartingToday(departAt: string | Date, now = new Date()): boolean {
  return startOfDay(departAt).getTime() === startOfDay(now).getTime();
}

/** Début de la fenêtre « Départ aujourd'hui » le jour J (07h00, heure locale). */
export const MISSION_DEPART_TODAY_START_HOUR = 7;
export const MISSION_DEPART_TODAY_START_MINUTE = 0;

/** Fin de journée ouvrée de référence (18h30) — la mission reste « Départ aujourd'hui » jusqu'au démarrage auto. */
export const MISSION_DEPART_TODAY_BUSINESS_END_HOUR = 18;
export const MISSION_DEPART_TODAY_BUSINESS_END_MINUTE = 30;

/** Heure de démarrage automatique le jour du départ (22h59, heure locale). */
export const MISSION_AUTO_START_HOUR = 22;
export const MISSION_AUTO_START_MINUTE = 59;

export function missionDepartTodayWindowStart(departAt: string | Date): Date {
  const d = startOfDay(departAt);
  d.setHours(MISSION_DEPART_TODAY_START_HOUR, MISSION_DEPART_TODAY_START_MINUTE, 0, 0);
  return d;
}

/** Instant de démarrage automatique : 22h59 le jour du départ (heure locale). */
export function missionAutoStartAt(departAt: string | Date): Date {
  const d = startOfDay(departAt);
  d.setHours(MISSION_AUTO_START_HOUR, MISSION_AUTO_START_MINUTE, 0, 0);
  return d;
}

/**
 * Mission planifiée en « Départ aujourd'hui » : jour J, entre 07h00 et le démarrage auto à 22h59.
 */
export function isMissionDepartTodayVisualState(
  departAt: string | Date,
  now = new Date()
): boolean {
  if (!isMissionDepartingToday(departAt, now)) return false;
  return (
    now.getTime() >= missionDepartTodayWindowStart(departAt).getTime() &&
    now.getTime() < missionAutoStartAt(departAt).getTime()
  );
}

/** Démarrage automatique dû (22h59 le jour du départ, ou rattrapage si jour ultérieur dans la période). */
export function isMissionAutoStartDue(
  now: Date,
  departAt: string | Date,
  returnAt: string | Date
): boolean {
  if (!isMissionInProgressPeriod(now, departAt, returnAt)) return false;
  const departDay = startOfDay(departAt).getTime();
  const today = startOfDay(now).getTime();
  if (today > departDay) return true;
  if (today < departDay) return false;
  return now.getTime() >= missionAutoStartAt(departAt).getTime();
}

/**
 * Démarrage manuel autorisé dès le jour du départ jusqu’au jour du retour.
 * Le démarrage automatique à 22h59 reste un filet de sécurité si personne n’a démarré manuellement.
 */
export function canManuallyStartMission(
  now: Date,
  departAt: string | Date,
  returnAt: string | Date
): boolean {
  return isMissionInProgressPeriod(now, departAt, returnAt);
}

/**
 * Annulation manuelle : avant le jour du départ, ou le jour J tant que le démarrage auto (22h59) n’a pas eu lieu.
 * Couvre l’état visuel « Départ aujourd’hui » (07h–22h).
 */
export function canManuallyCancelMission(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): boolean {
  if (mission.status !== 'PLANNED') return false;
  if (isBeforeMissionStart(now, mission.departAt)) return true;
  if (
    isMissionDepartingToday(mission.departAt, now) &&
    !isMissionAutoStartDue(now, mission.departAt, mission.returnAt)
  ) {
    return true;
  }
  return false;
}

export function isMissionInProgressPeriod(
  now: Date,
  departAt: string | Date,
  returnAt: string | Date
): boolean {
  const today = startOfDay(now).getTime();
  const depart = startOfDay(departAt).getTime();
  const ret = startOfDay(returnAt).getTime();
  return today >= depart && today <= ret;
}

/** Instant de clôture automatique : 23h59 le jour du retour (heure locale). */
export function missionAutoCloseAt(returnAt: string | Date): Date {
  const d = startOfDay(returnAt);
  d.setHours(23, 59, 0, 0);
  return d;
}

/** Après 23h59 le jour du retour, ou un jour ultérieur. */
export function isReturnDatePassed(now: Date, returnAt: string | Date): boolean {
  return now.getTime() >= missionAutoCloseAt(returnAt).getTime();
}

/** Heure de clôture automatique atteinte (23h59 le jour du retour, inclus). */
export function isReturnDateReached(now: Date, returnAt: string | Date): boolean {
  return isReturnDatePassed(now, returnAt);
}

export function isBeforeMissionStart(now: Date, departAt: string | Date): boolean {
  return startOfDay(now).getTime() < startOfDay(departAt).getTime();
}

export function canTransitionStatus(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MissionStatus, to: MissionStatus): string | null {
  if (from === to) return 'SAME_STATUS';
  if (!canTransitionStatus(from, to)) return 'INVALID_TRANSITION';
  return null;
}

export function computeAutoStatus(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): MissionStatus | null {
  // Un démarrage manuel anticipé (avant 22h59) doit rester ONGOING — on ne revient pas en PLANNED.
  if (
    mission.status === 'PLANNED' &&
    isMissionAutoStartDue(now, mission.departAt, mission.returnAt)
  ) {
    return 'ONGOING';
  }
  if (mission.status === 'ONGOING' && isReturnDateReached(now, mission.returnAt)) {
    return 'COMPLETED';
  }
  return null;
}

/** Après modification des dates : transitions automatiques (planifiée → en cours, en cours → terminée). */
export function computeAutoStatusAfterDatePatch(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  patch: { departAt?: string | Date; returnAt?: string | Date },
  now = new Date()
): MissionStatus | null {
  if (mission.status !== 'PLANNED' && mission.status !== 'ONGOING') return null;
  if (patch.departAt === undefined && patch.returnAt === undefined) return null;

  const departAt = patch.departAt ?? mission.departAt;
  const returnAt = patch.returnAt ?? mission.returnAt;

  return computeAutoStatus(
    {
      status: mission.status,
      departAt: typeof departAt === 'string' ? departAt : departAt.toISOString(),
      returnAt: typeof returnAt === 'string' ? returnAt : returnAt.toISOString(),
    },
    now
  );
}

export function getManualStatusActions(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt' | 'archived'>,
  now = new Date()
): MissionStatusAction[] {
  if (mission.archived) return [];
  if (mission.status === 'PLANNED') {
    const actions: MissionStatusAction[] = [];
    if (canManuallyStartMission(now, mission.departAt, mission.returnAt)) {
      actions.push('start');
    }
    if (canManuallyCancelMission(mission, now)) {
      actions.push('cancel');
    }
    return actions;
  }
  if (mission.status === 'CANCELLED') {
    return ['reopen'];
  }
  return [];
}

/** Statut cible après réouverture d’une mission annulée. */
export function resolveReopenTargetStatus(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date(),
  newReturnAt?: string | Date | null
): MissionStatus {
  if (mission.status !== 'CANCELLED') return mission.status;
  if (isBeforeMissionStart(now, mission.departAt)) return 'PLANNED';
  if (newReturnAt) return 'ONGOING';
  if (isMissionInProgressPeriod(now, mission.departAt, mission.returnAt)) return 'ONGOING';
  return 'PLANNED';
}

export function canExtendMission(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  return canAdjustMissionReturn(mission, role);
}

export function canShortenMission(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  return canAdjustMissionReturn(mission, role);
}

export function canAdjustMissionReturn(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  if (!canAdminPlatform(role)) return false;
  if (mission.archived) return false;
  return mission.status === 'ONGOING';
}

export function canReopenMission(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  if (!canAdminPlatform(role)) return false;
  if (mission.archived) return false;
  // Terminée = définitive ; seule une annulation peut être corrigée par réouverture.
  return mission.status === 'CANCELLED';
}

export function canEditMissionFields(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  if (!canAdminPlatform(role)) return false;
  if (mission.archived) return false;
  if (mission.status === 'PLANNED') return true;
  return false;
}

export function canEditMissionObservations(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  if (!canAdminPlatform(role)) return false;
  if (mission.archived) return false;
  return mission.status === 'ONGOING';
}

export function canEditMissionReport(
  mission: Pick<DgMission, 'status' | 'archived'>,
  role: DgRole
): boolean {
  if (!canAdminPlatform(role)) return false;
  if (mission.archived) return false;
  return mission.status === 'ONGOING' || mission.status === 'COMPLETED';
}

export function isMissionReadOnly(mission: Pick<DgMission, 'status'>): boolean {
  return mission.status === 'COMPLETED' || mission.status === 'CANCELLED';
}

/** Une mission en cours ne peut pas être archivée (corbeille) ni supprimée. */
export function canArchiveMission(mission: Pick<DgMission, 'status'>): boolean {
  return mission.status !== 'ONGOING';
}

export function validateStartTransition(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): string | null {
  const err = assertTransition(mission.status, 'ONGOING');
  if (err) return err;
  if (!canManuallyStartMission(now, mission.departAt, mission.returnAt)) {
    return 'OUTSIDE_MISSION_PERIOD';
  }
  return null;
}

export function validateCancelTransition(
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>,
  now = new Date()
): string | null {
  const err = assertTransition(mission.status, 'CANCELLED');
  if (err) return err;
  if (!canManuallyCancelMission(mission, now)) {
    return 'MISSION_ALREADY_STARTED';
  }
  return null;
}

export function validateCloseTransition(mission: Pick<DgMission, 'status'>): string | null {
  return assertTransition(mission.status, 'COMPLETED');
}

export function validateReopenTransition(
  mission: Pick<DgMission, 'status' | 'archived' | 'departAt' | 'returnAt'>,
  now = new Date(),
  newReturnAt?: string | Date | null
): string | null {
  if (mission.archived) return 'MISSION_LOCKED';
  if (mission.status === 'COMPLETED') return 'MISSION_COMPLETED_FINAL';
  if (mission.status !== 'CANCELLED') {
    return 'INVALID_TRANSITION';
  }
  const target = resolveReopenTargetStatus(mission, now, newReturnAt);
  const err = assertTransition(mission.status, target);
  if (err) return err;
  return null;
}

export function validateClosureReport(
  input: MissionClosureInput,
  required: boolean
): string | null {
  if (!required) return null;
  const hasContent = [input.closureReport, input.closureResults, input.closureRecommendations]
    .some((v) => (v ?? '').trim().length >= 3);
  return hasContent ? null : 'CLOSURE_REPORT_REQUIRED';
}

export function validateCancelReason(
  reason: string | null | undefined,
  detail: string | null | undefined
): string | null {
  const r = reason?.trim() ?? '';
  if (!r || !MISSION_CANCEL_REASONS.includes(r as MissionCancelReason)) {
    return 'CANCEL_REASON_REQUIRED';
  }
  if (r === 'OTHER' && (detail?.trim().length ?? 0) < 3) {
    return 'CANCEL_REASON_DETAIL_REQUIRED';
  }
  return null;
}

export const MISSION_STATUS_ERROR_LABELS: Record<string, string> = {
  INVALID_TRANSITION: 'Transition de statut non autorisée.',
  SAME_STATUS: 'Le statut est déjà à jour.',
  OUTSIDE_MISSION_PERIOD:
    'La mission ne peut démarrer qu’à partir du jour de départ (jusqu’au jour de retour).',
  MISSION_ALREADY_STARTED: 'Une mission déjà démarrée ne peut plus être annulée.',
  CANCEL_REASON_REQUIRED: 'Le motif d’annulation est obligatoire.',
  CANCEL_REASON_DETAIL_REQUIRED: 'Précisez le motif d’annulation.',
  CLOSURE_REPORT_REQUIRED: 'Le rapport de clôture est obligatoire.',
  MISSION_LOCKED: 'Cette mission n’est plus modifiable.',
  MISSION_COMPLETED_FINAL:
    'Une mission terminée ne peut pas être rouverte. Créez une nouvelle mission si besoin.',
  MISSION_DUPLICATE: 'Une mission avec le même objet existe déjà.',
  MANUAL_CLOSE_FORBIDDEN:
    'La clôture est automatique à 23h59 le jour du retour. Aucune action manuelle n’est requise.',
  STATUS_CHANGE_FORBIDDEN: 'Utilisez les actions de workflow pour changer le statut.',
  MISSION_ONGOING_ARCHIVE_FORBIDDEN:
    'Cette mission est en cours et ne peut pas être déplacée dans la corbeille.',
  MISSION_NOT_ONGOING: 'Seules les missions en cours peuvent être prolongées ou écourtées.',
  EXTEND_REASON_REQUIRED: 'Le motif est obligatoire (prolongation ou écourcissement).',
  SAME_RETURN_DATE: 'La nouvelle date de retour doit être différente de la date actuelle.',
  INVALID_RETURN_BEFORE_DEPART: 'La date de retour ne peut pas être antérieure au départ.',
  USE_EXTEND_WORKFLOW: 'Utilisez « Prolonger la mission » pour modifier la date de retour.',
  DEPART_DATE_LOCKED: 'La date de départ ne peut plus être modifiée (départ déjà passé).',
  REOPEN_RETURN_REQUIRED:
    'La date de retour est dépassée : indiquez une nouvelle date de retour pour rouvrir la mission.',
  INVALID_RETURN_DATE: 'La nouvelle date de retour doit être aujourd’hui ou ultérieure.',
  MISSION_HOTEL_LOCKED:
    'Mission terminée ou annulée — les réservations hôtel ne sont plus modifiables.',
  UPDATE_FAILED: 'La mise à jour de la mission a échoué. Vérifiez les champs puis réessayez.',
  VALIDATION_ERROR: 'Données invalides. Vérifiez le formulaire.',
  MISSION_TYPE_REQUIRED: 'Le type de mission est obligatoire.',
  MISSION_TYPE_TOO_LONG: 'Le type de mission est trop long.',
};
