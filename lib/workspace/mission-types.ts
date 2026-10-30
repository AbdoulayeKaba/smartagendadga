/** Types de mission prédéfinis + saisie libre (« Autre »). */

export const MISSION_TYPE_OPTIONS = [
  'Réunion institutionnelle',
  'Conférence',
  'Séminaire',
  'Atelier',
  'Formation',
  'Mission officielle',
  'Mission internationale',
  'Mission de contrôle',
  'Représentation officielle',
] as const;

export type MissionTypeOption = (typeof MISSION_TYPE_OPTIONS)[number];

export const MISSION_TYPE_OTHER_VALUE = '__OTHER__';

const PREDEFINED = new Set<string>(MISSION_TYPE_OPTIONS);

export function isPredefinedMissionType(value: string): value is MissionTypeOption {
  return PREDEFINED.has(value);
}

export function resolveMissionType(
  selectValue: string | null | undefined,
  otherText: string | null | undefined
): string {
  const select = selectValue?.trim() ?? '';
  const other = otherText?.trim() ?? '';
  if (!select) return '';
  if (select === MISSION_TYPE_OTHER_VALUE) return other;
  return select;
}

export function splitMissionType(stored: string | null | undefined): {
  select: string;
  other: string;
} {
  const value = stored?.trim() ?? '';
  if (value && isPredefinedMissionType(value)) {
    return { select: value, other: '' };
  }
  if (value) {
    return { select: MISSION_TYPE_OTHER_VALUE, other: value };
  }
  return { select: '', other: '' };
}

export function normalizeMissionTypeLabel(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < 2) {
    throw new Error('MISSION_TYPE_REQUIRED');
  }
  if (trimmed.length > 120) {
    throw new Error('MISSION_TYPE_TOO_LONG');
  }
  return trimmed;
}

export const DEFAULT_MISSION_TYPE: MissionTypeOption = 'Mission officielle';
