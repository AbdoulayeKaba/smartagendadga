export const SYSTEM_LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
] as const;

export type SystemLanguage = (typeof SYSTEM_LANGUAGE_OPTIONS)[number]['value'];

export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Conakry', label: 'Africa/Conakry (GMT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan' },
  { value: 'Africa/Dakar', label: 'Africa/Dakar' },
] as const;

export const DATE_TIME_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY HH:mm', label: 'DD/MM/YYYY HH:mm' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD HH:mm', label: 'YYYY-MM-DD HH:mm' },
  { value: 'MM/DD/YYYY h:mm a', label: 'MM/DD/YYYY h:mm a' },
] as const;

export type DateTimeFormat = (typeof DATE_TIME_FORMAT_OPTIONS)[number]['value'];

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
