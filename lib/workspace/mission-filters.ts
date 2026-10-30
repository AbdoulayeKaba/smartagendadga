import { startOfDay } from '@/lib/workspace/mission-status-workflow';
import {
  type MissionVisualState,
  resolveMissionVisualState,
} from '@/lib/workspace/mission-visual-state';
import { parseLegacyDestination } from '@/lib/workspace/mission-countries';
import type { DgMission } from '@/lib/workspace/types';

export type MissionStatusFilter = 'ALL' | MissionVisualState;

export type MissionListFilters = {
  status: MissionStatusFilter;
  missionType: string;
  destination: string;
  departFrom: string;
  departTo: string;
};

export const EMPTY_MISSION_FILTERS: MissionListFilters = {
  status: 'ALL',
  missionType: 'ALL',
  destination: 'ALL',
  departFrom: '',
  departTo: '',
};

export function missionDestinationCodes(mission: DgMission): string[] {
  if (Array.isArray(mission.destinations) && mission.destinations.length > 0) {
    return mission.destinations;
  }
  return parseLegacyDestination(mission.destination);
}

export function matchesMissionSearch(mission: DgMission, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    mission.subject,
    mission.missionType,
    mission.destination,
    mission.participants,
    mission.details,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function matchesMissionFilters(
  mission: DgMission,
  filters: MissionListFilters,
  now = new Date()
): boolean {
  if (filters.status !== 'ALL') {
    const visual = resolveMissionVisualState(mission, now);
    if (visual !== filters.status) return false;
  }

  if (filters.missionType !== 'ALL') {
    const type = (mission.missionType ?? '').trim();
    if (type.localeCompare(filters.missionType, 'fr', { sensitivity: 'accent' }) !== 0) {
      return false;
    }
  }

  if (filters.destination !== 'ALL') {
    const codes = missionDestinationCodes(mission);
    if (!codes.includes(filters.destination)) return false;
  }

  if (filters.departFrom) {
    const from = startOfDay(filters.departFrom).getTime();
    if (startOfDay(mission.departAt).getTime() < from) return false;
  }

  if (filters.departTo) {
    const to = startOfDay(filters.departTo).getTime();
    if (startOfDay(mission.departAt).getTime() > to) return false;
  }

  return true;
}

export function filterMissions(
  missions: DgMission[],
  filters: MissionListFilters,
  query = '',
  now = new Date()
): DgMission[] {
  return missions.filter((mission) => {
    if (!matchesMissionSearch(mission, query)) return false;
    return matchesMissionFilters(mission, filters, now);
  });
}

export function collectMissionFilterOptions(missions: DgMission[]): {
  types: string[];
  destinations: string[];
} {
  const typeSet = new Set<string>();
  const destSet = new Set<string>();
  for (const mission of missions) {
    const type = mission.missionType?.trim();
    if (type) typeSet.add(type);
    for (const code of missionDestinationCodes(mission)) {
      destSet.add(code);
    }
  }
  return {
    types: [...typeSet].sort((a, b) => a.localeCompare(b, 'fr')),
    destinations: [...destSet].sort(),
  };
}

export function hasActiveMissionFilters(filters: MissionListFilters): boolean {
  return (
    filters.status !== 'ALL' ||
    filters.missionType !== 'ALL' ||
    filters.destination !== 'ALL' ||
    filters.departFrom.length > 0 ||
    filters.departTo.length > 0
  );
}
