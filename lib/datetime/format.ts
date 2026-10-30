import { format as dateFnsFormat, formatDistanceStrict, type Locale } from 'date-fns';
import { APP_LOCALE, APP_TIMEZONE, DATE_FNS_LOCALE, initFrenchDateLocale } from '@/lib/datetime/locale';

initFrenchDateLocale();

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Format date-fns avec locale française par défaut. */
export function formatDate(
  value: DateInput,
  pattern: string,
  options?: { locale?: Locale }
): string {
  return dateFnsFormat(toDate(value), pattern, {
    locale: options?.locale ?? DATE_FNS_LOCALE,
  });
}

/** Date courte : 16/06/2026 */
export function formatDateShort(value: DateInput): string {
  return formatDate(value, 'dd/MM/yyyy');
}

/** Date lisible : mardi 16 juin 2026 */
export function formatDateLong(value: DateInput): string {
  return formatDate(value, 'EEEE d MMMM yyyy');
}

/** Date compacte : 16 juin 2026 */
export function formatDateMedium(value: DateInput): string {
  return formatDate(value, 'd MMMM yyyy');
}

/** Heure 24h : 09:00 */
export function formatTime(value: DateInput): string {
  return formatDate(value, 'HH:mm');
}

/** Heure avec secondes : 09:00:00 */
export function formatTimeWithSeconds(value: DateInput): string {
  return formatDate(value, 'HH:mm:ss');
}

/** Date + heure : 16/06/2026 09:00 */
export function formatDateTime(value: DateInput): string {
  return formatDate(value, 'dd/MM/yyyy HH:mm');
}

/** Date + heure détaillée : 16 juin 2026 à 09:00 */
export function formatDateTimeLong(value: DateInput): string {
  return formatDate(value, "d MMMM yyyy 'à' HH:mm");
}

/** Créneau sur une journée : 09:00 – 10:30 */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Stockage / API : yyyy-MM-dd */
export function formatIsoDate(value: DateInput): string {
  return formatDate(value, 'yyyy-MM-dd');
}

/** Date calendaire yyyy-MM-dd dans le fuseau institutionnel. */
export function formatIsoDateInAppTz(value: DateInput): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value));
}

/** Heure HH:mm (24h) dans le fuseau institutionnel — alignée sur la grille de planification. */
export function formatTimeInAppTz(value: DateInput): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(toDate(value));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** Heures / minutes murales (fuseau institutionnel) pour positionner un événement sur la grille agenda. */
export function getWallClockPartsInAppTz(value: DateInput): { hour: number; minute: number } {
  const hm = formatTimeInAppTz(value);
  const [h, m] = hm.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
}

/** Format Intl navigateur (fr-FR). */
export function formatWithIntl(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  locale: string = APP_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIMEZONE,
    ...options,
  }).format(toDate(value));
}

/** Date + heure complètes via Intl. */
export function formatDateTimeIntl(value: DateInput): string {
  return formatWithIntl(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Instant affiché : l’heure prévue si la notification était planifiée, sinon sa création. */
export function notificationInstant(input: {
  createdAt: string;
  scheduledFor?: string | null;
}): Date {
  const raw = input.scheduledFor || input.createdAt;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date(input.createdAt);
  return date;
}

/** Heure institutionnelle + délai exact, sans arrondi « environ ». */
export function formatNotificationWhen(
  value: DateInput,
  now = new Date()
): { clock: string; relative: string } {
  const date = toDate(value);
  const sameDay = formatIsoDateInAppTz(date) === formatIsoDateInAppTz(now);
  const clock = sameDay
    ? formatTimeInAppTz(date)
    : `${formatDate(date, 'd MMM')} ${formatTimeInAppTz(date)}`;
  const relative = formatDistanceStrict(date, now, {
    addSuffix: true,
    locale: DATE_FNS_LOCALE,
    roundingMethod: 'floor',
  });
  return { clock, relative };
}
