/** Jours fériés — type institutionnel */
export type HolidayType = 'national' | 'religious' | 'institutional';

export const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'religious', label: 'Religieux' },
  { value: 'institutional', label: 'Institutionnel' },
];

export type HolidayMeta = {
  kind: 'holiday';
  date: string;
  type: HolidayType;
  annualRepeat: boolean;
  active: boolean;
};

/** Indisponibilités DG */
export type UnavailabilityType =
  | 'conge'
  | 'deplacement'
  | 'formation'
  | 'reunion_interne'
  | 'conseil_admin'
  | 'exceptionnelle'
  | 'autres'
  | 'mission';

export const UNAVAILABILITY_TYPE_OPTIONS: { value: UnavailabilityType; label: string }[] = [
  { value: 'conge', label: 'Congé' },
  { value: 'deplacement', label: 'Déplacement' },
  { value: 'formation', label: 'Formation' },
  { value: 'reunion_interne', label: 'Réunion interne' },
  { value: 'conseil_admin', label: "Conseil d'administration" },
  { value: 'exceptionnelle', label: 'Indisponibilité exceptionnelle' },
  { value: 'autres', label: 'Autres' },
];

/** Valeurs historiques encore acceptées en lecture (ex. mission). */
export const LEGACY_UNAVAILABILITY_TYPES = ['mission'] as const;

export type ConfidentialityLevel = 'standard' | 'restreint' | 'confidentiel';

export const CONFIDENTIALITY_OPTIONS: { value: ConfidentialityLevel; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'restreint', label: 'Restreint' },
  { value: 'confidentiel', label: 'Confidentiel' },
];

export type UnavailabilityMeta = {
  kind: 'unavailability';
  type: UnavailabilityType;
  /** Précision obligatoire lorsque type = « autres ». */
  typeOther?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  motif: string;
  confidentialityLevel: ConfidentialityLevel;
  active: boolean;
};

export type ReferentialItemMeta = HolidayMeta | UnavailabilityMeta;

export const ALLOWED_APPOINTMENT_DURATIONS = [15, 30, 45, 60] as const;

export type AllowedAppointmentDuration = (typeof ALLOWED_APPOINTMENT_DURATIONS)[number];

export function isHolidayMeta(meta: unknown): meta is HolidayMeta {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as HolidayMeta).kind === 'holiday' &&
    typeof (meta as HolidayMeta).date === 'string'
  );
}

export function isUnavailabilityMeta(meta: unknown): meta is UnavailabilityMeta {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as UnavailabilityMeta).kind === 'unavailability' &&
    typeof (meta as UnavailabilityMeta).startDate === 'string'
  );
}

export function getHolidayMeta(item: {
  value?: string;
  meta?: ReferentialItemMeta;
}): HolidayMeta {
  if (isHolidayMeta(item.meta)) return item.meta;
  return {
    kind: 'holiday',
    date: item.value ?? '',
    type: 'national',
    annualRepeat: false,
    active: true,
  };
}

export function getUnavailabilityMeta(item: {
  meta?: ReferentialItemMeta;
}): UnavailabilityMeta | null {
  if (isUnavailabilityMeta(item.meta)) return item.meta;
  return null;
}

export function holidayTypeLabel(type: HolidayType): string {
  return HOLIDAY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function unavailabilityTypeLabel(
  type: UnavailabilityType,
  typeOther?: string
): string {
  if (type === 'autres') {
    const detail = typeOther?.trim();
    return detail ? `Autres — ${detail}` : 'Autres';
  }
  if (type === 'mission') return 'Mission';
  return UNAVAILABILITY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/** Normalise les anciennes entrées « mission » pour l’édition (type = autres + précision). */
export function normalizeUnavailabilityFormType(meta: UnavailabilityMeta): {
  type: UnavailabilityType;
  typeOther: string;
} {
  if (meta.type === 'mission') {
    return { type: 'autres', typeOther: meta.typeOther?.trim() || 'Mission' };
  }
  return {
    type: meta.type,
    typeOther: meta.typeOther?.trim() ?? '',
  };
}

export function confidentialityLabel(level: ConfidentialityLevel): string {
  return CONFIDENTIALITY_OPTIONS.find((o) => o.value === level)?.label ?? level;
}

/** Nombre de jours calendaires inclusifs entre deux dates `yyyy-MM-dd`. */
export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  const from = new Date(`${startDate}T12:00:00`);
  const to = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function formatInclusiveDayCount(startDate: string, endDate: string): string {
  const n = inclusiveCalendarDays(startDate, endDate);
  if (n <= 0) return '—';
  return n === 1 ? '1 jour' : `${n} jours`;
}
