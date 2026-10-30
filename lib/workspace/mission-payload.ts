import {
  formatMissionDestinations,
  normalizeDestinationCodes,
  parseLegacyDestination,
} from '@/lib/workspace/mission-countries';
import { normalizeMissionTypeLabel } from '@/lib/workspace/mission-types';

export function missionDestinationLabel(codes: string[]): string {
  const normalized = normalizeDestinationCodes(codes);
  return formatMissionDestinations(normalized);
}

export function parseDestinationsField(raw: unknown, legacyDestination?: string): string[] {
  if (Array.isArray(raw)) {
    return normalizeDestinationCodes(raw.filter((x): x is string => typeof x === 'string'));
  }
  if (typeof legacyDestination === 'string' && legacyDestination.trim()) {
    const parsed = parseLegacyDestination(legacyDestination);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

export type MissionWriteInput = {
  subject: string;
  missionType: string;
  destinations: string[];
  details?: string | null;
  departAt: string;
  returnAt: string;
  participants: string;
  status?: import('@/lib/workspace/types').MissionStatus;
};

export function normalizeMissionWrite(input: MissionWriteInput) {
  const destinations = normalizeDestinationCodes(input.destinations);
  return {
    subject: input.subject.trim(),
    missionType: normalizeMissionTypeLabel(input.missionType),
    destinations,
    destination: missionDestinationLabel(destinations),
    details: input.details?.trim() ? input.details.trim() : null,
    departAt: input.departAt,
    returnAt: input.returnAt,
    participants: (input.participants ?? '').trim(),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
}
