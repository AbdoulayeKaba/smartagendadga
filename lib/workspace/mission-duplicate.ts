import type { DgMission } from '@/lib/workspace/types';

export const MISSION_DUPLICATE_ERROR = 'MISSION_DUPLICATE';

export type MissionDuplicateCandidate = {
  subject: string;
};

export type MissionDuplicateCheckRow = MissionDuplicateCandidate & {
  id: string;
  archived?: boolean;
  status?: string;
};

export function normalizeMissionSubject(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Missions prises en compte pour le doublon : actives non archivées (planifiée / en cours). */
export function isMissionSubjectConflict(existing: MissionDuplicateCheckRow): boolean {
  if (existing.archived) return false;
  if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') return false;
  return true;
}

export function isMissionDuplicateOf(
  candidate: MissionDuplicateCandidate,
  existing: MissionDuplicateCheckRow,
  options?: { excludeId?: string }
): boolean {
  if (options?.excludeId && existing.id === options.excludeId) return false;
  if (!isMissionSubjectConflict(existing)) return false;
  return normalizeMissionSubject(candidate.subject) === normalizeMissionSubject(existing.subject);
}

export function findMissionDuplicate(
  candidate: MissionDuplicateCandidate,
  existing: MissionDuplicateCheckRow[],
  options?: { excludeId?: string }
): MissionDuplicateCheckRow | undefined {
  return existing.find((row) => isMissionDuplicateOf(candidate, row, options));
}

/** Fusionne l'objet courant et la modification (contrôle anti-doublon). */
export function buildMissionDuplicateCandidate(
  base: MissionDuplicateCandidate,
  patch: Partial<MissionDuplicateCandidate>
): MissionDuplicateCandidate {
  return {
    subject: patch.subject !== undefined ? patch.subject.trim() : base.subject,
  };
}

export function missionDuplicateMessage(existing?: Pick<DgMission, 'subject'>): string {
  if (!existing) {
    return 'Une mission avec le même objet existe déjà.';
  }
  return `L'objet « ${existing.subject} » est déjà utilisé par une autre mission.`;
}
