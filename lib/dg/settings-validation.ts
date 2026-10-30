/** Valeurs partielles de champ URL/email à traiter comme vide. */
const PARTIAL_URL_PREFIXES = new Set(['http://', 'https://', 'http:', 'https:']);

export function normalizeOptionalUrl(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || PARTIAL_URL_PREFIXES.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

export function normalizeOptionalEmail(value: string | undefined | null): string {
  return value?.trim() ?? '';
}

export function sanitizeSettingsPatch<T extends Record<string, unknown>>(patch: T): T {
  const next = { ...patch };
  if ('institutionWebsite' in next && typeof next.institutionWebsite === 'string') {
    next.institutionWebsite = normalizeOptionalUrl(next.institutionWebsite) as T[keyof T];
  }
  if ('institutionOfficialEmail' in next && typeof next.institutionOfficialEmail === 'string') {
    next.institutionOfficialEmail = normalizeOptionalEmail(next.institutionOfficialEmail) as T[keyof T];
  }
  if ('smtpFromEmail' in next && typeof next.smtpFromEmail === 'string') {
    next.smtpFromEmail = normalizeOptionalEmail(next.smtpFromEmail) as T[keyof T];
  }
  if ('dgOutlookEmail' in next && typeof next.dgOutlookEmail === 'string') {
    next.dgOutlookEmail = normalizeOptionalEmail(next.dgOutlookEmail) as T[keyof T];
  }
  return next;
}
