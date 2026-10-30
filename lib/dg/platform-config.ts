import { DEFAULT_LDAP_USER_FILTER, type AdImportSource } from '@/lib/dg/ldap-config';
import type { DateTimeFormat, SystemLanguage } from '@/lib/dg/institutional-options';
import { ALLOWED_APPOINTMENT_DURATIONS } from '@/lib/dg/referential-types';
import type { DgRole } from '@/lib/dg/rbac';

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAY_OPTIONS: { key: WeekdayKey; label: string }[] = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' },
  { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' },
  { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
];

export type PlatformConfig = {
  organizationName: string;
  institutionAcronym: string;
  institutionLogoUrl: string;
  institutionAddress: string;
  institutionPhone: string;
  institutionOfficialEmail: string;
  institutionWebsite: string;
  systemLanguage: SystemLanguage;
  dateTimeFormat: DateTimeFormat;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  notifyNewDocuments: boolean;
  notifyNewAppointments: boolean;
  notifyAppointmentReminders: boolean;
  bufferMinutes: number;
  workDayStart: string;
  workDayEnd: string;
  slotDurationMinutes: number;
  defaultAppointmentDurationMinutes: number;
  allowedDurationMinutes: number[];
  maxAppointmentsPerDay: number;
  maxAppointmentsPerWeek: number;
  allowOutsideHours: boolean;
  allowWeekendAppointments: boolean;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  workingDays: WeekdayKey[];
  timezone: string;
  autoRejectBeforeStartMinutes: number;
  dgOutlookEmail: string;
  defaultImportPassword: string;
  reminderEmailEnabled: boolean;
  adImportSource: AdImportSource;
  ldapUrl: string;
  ldapBindDn: string;
  ldapBaseDn: string;
  ldapUserFilter: string;
  ldapDefaultRole: DgRole;
  ldapTlsRejectUnauthorized: boolean;
  passwordMinLength: number;
  passwordExpirationDays: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionExpirationMinutes: number;
  sessionSinglePerUser: boolean;
  twoFactorRequired: boolean;
};

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  organizationName: 'Direction Générale Adjointe',
  institutionAcronym: 'DGA',
  institutionLogoUrl: '',
  institutionAddress: '',
  institutionPhone: '',
  institutionOfficialEmail: '',
  institutionWebsite: '',
  systemLanguage: 'fr',
  dateTimeFormat: 'DD/MM/YYYY HH:mm',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  notifyNewDocuments: true,
  notifyNewAppointments: true,
  notifyAppointmentReminders: true,
  bufferMinutes: 15,
  workDayStart: '08:00',
  workDayEnd: '18:00',
  slotDurationMinutes: 30,
  defaultAppointmentDurationMinutes: 30,
  allowedDurationMinutes: [...ALLOWED_APPOINTMENT_DURATIONS],
  maxAppointmentsPerDay: 8,
  maxAppointmentsPerWeek: 35,
  allowOutsideHours: false,
  allowWeekendAppointments: false,
  lunchBreakStart: '12:30',
  lunchBreakEnd: '14:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  timezone: 'Africa/Conakry',
  autoRejectBeforeStartMinutes: 120,
  dgOutlookEmail: '',
  defaultImportPassword: 'Password1234@',
  reminderEmailEnabled: true,
  adImportSource: 'graph',
  ldapUrl: 'ldaps://dc.organisation.local:636',
  ldapBindDn: 'CN=svc-ldap,OU=Service Accounts,DC=organisation,DC=local',
  ldapBaseDn: 'OU=Utilisateurs,DC=organisation,DC=local',
  ldapUserFilter: DEFAULT_LDAP_USER_FILTER,
  ldapDefaultRole: 'MANAGER',
  ldapTlsRejectUnauthorized: true,
  passwordMinLength: 10,
  passwordExpirationDays: 90,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true,
  sessionExpirationMinutes: 15,
  sessionSinglePerUser: true,
  twoFactorRequired: false,
};

function parseAllowedDurations(raw: string | undefined): number[] {
  if (!raw?.trim()) return [...DEFAULT_PLATFORM_CONFIG.allowedDurationMinutes];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_PLATFORM_CONFIG.allowedDurationMinutes];
    const allowed = new Set(ALLOWED_APPOINTMENT_DURATIONS);
    const nums = parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && allowed.has(n as (typeof ALLOWED_APPOINTMENT_DURATIONS)[number]));
    return nums.length > 0 ? nums : [...DEFAULT_PLATFORM_CONFIG.allowedDurationMinutes];
  } catch {
    return [...DEFAULT_PLATFORM_CONFIG.allowedDurationMinutes];
  }
}

function parseWorkingDays(raw: string | undefined): WeekdayKey[] {
  if (!raw?.trim()) return DEFAULT_PLATFORM_CONFIG.workingDays;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_PLATFORM_CONFIG.workingDays;
    const valid = new Set<WeekdayKey>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    return parsed.filter((d): d is WeekdayKey => typeof d === 'string' && valid.has(d as WeekdayKey));
  } catch {
    return DEFAULT_PLATFORM_CONFIG.workingDays;
  }
}

export const PLATFORM_SETTING_KEYS: (keyof PlatformConfig)[] = [
  'organizationName',
  'institutionAcronym',
  'institutionLogoUrl',
  'institutionAddress',
  'institutionPhone',
  'institutionOfficialEmail',
  'institutionWebsite',
  'systemLanguage',
  'dateTimeFormat',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpPassword',
  'smtpFromEmail',
  'notifyNewDocuments',
  'notifyNewAppointments',
  'notifyAppointmentReminders',
  'bufferMinutes',
  'workDayStart',
  'workDayEnd',
  'slotDurationMinutes',
  'defaultAppointmentDurationMinutes',
  'allowedDurationMinutes',
  'maxAppointmentsPerDay',
  'maxAppointmentsPerWeek',
  'allowOutsideHours',
  'allowWeekendAppointments',
  'lunchBreakStart',
  'lunchBreakEnd',
  'workingDays',
  'timezone',
  'autoRejectBeforeStartMinutes',
  'dgOutlookEmail',
  'defaultImportPassword',
  'reminderEmailEnabled',
  'passwordMinLength',
  'passwordExpirationDays',
  'passwordRequireUppercase',
  'passwordRequireLowercase',
  'passwordRequireNumbers',
  'passwordRequireSpecialChars',
  'sessionExpirationMinutes',
  'sessionSinglePerUser',
  'twoFactorRequired',
  'adImportSource',
  'ldapUrl',
  'ldapBindDn',
  'ldapBaseDn',
  'ldapUserFilter',
  'ldapDefaultRole',
  'ldapTlsRejectUnauthorized',
];

export function parsePlatformConfig(raw: Record<string, string>): PlatformConfig {
  const slotDurationMinutes = Number(raw.slotDurationMinutes ?? DEFAULT_PLATFORM_CONFIG.slotDurationMinutes);
  const defaultAppointmentDurationMinutes = Number(
    raw.defaultAppointmentDurationMinutes ??
      raw.slotDurationMinutes ??
      DEFAULT_PLATFORM_CONFIG.defaultAppointmentDurationMinutes
  );
  const allowedDurationMinutes = parseAllowedDurations(raw.allowedDurationMinutes);
  const resolvedDefault = Number.isFinite(defaultAppointmentDurationMinutes)
    ? defaultAppointmentDurationMinutes
    : DEFAULT_PLATFORM_CONFIG.defaultAppointmentDurationMinutes;
  const maxAppointmentsPerDay = Number(
    raw.maxAppointmentsPerDay ?? DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerDay
  );
  const maxAppointmentsPerWeek = Number(
    raw.maxAppointmentsPerWeek ?? DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerWeek
  );
  const systemLanguage =
    raw.systemLanguage === 'en' ? 'en' : DEFAULT_PLATFORM_CONFIG.systemLanguage;
  const dateTimeFormat =
    raw.dateTimeFormat === 'DD/MM/YYYY' ||
    raw.dateTimeFormat === 'YYYY-MM-DD HH:mm' ||
    raw.dateTimeFormat === 'MM/DD/YYYY h:mm a'
      ? raw.dateTimeFormat
      : DEFAULT_PLATFORM_CONFIG.dateTimeFormat;

  return {
    organizationName: raw.organizationName ?? DEFAULT_PLATFORM_CONFIG.organizationName,
    institutionAcronym: raw.institutionAcronym ?? DEFAULT_PLATFORM_CONFIG.institutionAcronym,
    institutionLogoUrl: raw.institutionLogoUrl ?? DEFAULT_PLATFORM_CONFIG.institutionLogoUrl,
    institutionAddress: raw.institutionAddress ?? DEFAULT_PLATFORM_CONFIG.institutionAddress,
    institutionPhone: raw.institutionPhone ?? DEFAULT_PLATFORM_CONFIG.institutionPhone,
    institutionOfficialEmail:
      raw.institutionOfficialEmail ?? DEFAULT_PLATFORM_CONFIG.institutionOfficialEmail,
    institutionWebsite: raw.institutionWebsite ?? DEFAULT_PLATFORM_CONFIG.institutionWebsite,
    systemLanguage,
    dateTimeFormat,
    smtpHost: raw.smtpHost ?? DEFAULT_PLATFORM_CONFIG.smtpHost,
    smtpPort: Number.isFinite(Number(raw.smtpPort))
      ? Math.max(1, Math.min(65535, Number(raw.smtpPort)))
      : DEFAULT_PLATFORM_CONFIG.smtpPort,
    smtpSecure: raw.smtpSecure === 'true',
    smtpUser: raw.smtpUser ?? DEFAULT_PLATFORM_CONFIG.smtpUser,
    smtpPassword: raw.smtpPassword ?? DEFAULT_PLATFORM_CONFIG.smtpPassword,
    smtpFromEmail: raw.smtpFromEmail ?? DEFAULT_PLATFORM_CONFIG.smtpFromEmail,
    notifyNewDocuments: raw.notifyNewDocuments !== 'false',
    notifyNewAppointments: raw.notifyNewAppointments !== 'false',
    notifyAppointmentReminders:
      raw.notifyAppointmentReminders !== 'false' && raw.reminderEmailEnabled !== 'false',
    bufferMinutes: Number(raw.bufferMinutes ?? DEFAULT_PLATFORM_CONFIG.bufferMinutes),
    workDayStart: raw.workDayStart ?? DEFAULT_PLATFORM_CONFIG.workDayStart,
    workDayEnd: raw.workDayEnd ?? DEFAULT_PLATFORM_CONFIG.workDayEnd,
    slotDurationMinutes: Number.isFinite(slotDurationMinutes)
      ? slotDurationMinutes
      : DEFAULT_PLATFORM_CONFIG.slotDurationMinutes,
    defaultAppointmentDurationMinutes: allowedDurationMinutes.includes(resolvedDefault)
      ? resolvedDefault
      : allowedDurationMinutes[0] ?? DEFAULT_PLATFORM_CONFIG.defaultAppointmentDurationMinutes,
    allowedDurationMinutes,
    maxAppointmentsPerDay: Number.isFinite(maxAppointmentsPerDay)
      ? Math.max(0, maxAppointmentsPerDay)
      : DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerDay,
    maxAppointmentsPerWeek: Number.isFinite(maxAppointmentsPerWeek)
      ? Math.max(0, maxAppointmentsPerWeek)
      : DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerWeek,
    allowOutsideHours: raw.allowOutsideHours === 'true',
    allowWeekendAppointments: raw.allowWeekendAppointments === 'true',
    lunchBreakStart: raw.lunchBreakStart ?? DEFAULT_PLATFORM_CONFIG.lunchBreakStart,
    lunchBreakEnd: raw.lunchBreakEnd ?? DEFAULT_PLATFORM_CONFIG.lunchBreakEnd,
    workingDays: parseWorkingDays(raw.workingDays),
    timezone: raw.timezone ?? DEFAULT_PLATFORM_CONFIG.timezone,
    autoRejectBeforeStartMinutes: clampInt(
      raw.autoRejectBeforeStartMinutes,
      DEFAULT_PLATFORM_CONFIG.autoRejectBeforeStartMinutes,
      0,
      1440
    ),
    dgOutlookEmail: raw.dgOutlookEmail ?? DEFAULT_PLATFORM_CONFIG.dgOutlookEmail,
    defaultImportPassword: raw.defaultImportPassword ?? DEFAULT_PLATFORM_CONFIG.defaultImportPassword,
    reminderEmailEnabled:
      raw.reminderEmailEnabled !== 'false' && raw.notifyAppointmentReminders !== 'false',
    adImportSource: raw.adImportSource === 'ldap' ? 'ldap' : 'graph',
    ldapUrl: raw.ldapUrl ?? DEFAULT_PLATFORM_CONFIG.ldapUrl,
    ldapBindDn: raw.ldapBindDn ?? DEFAULT_PLATFORM_CONFIG.ldapBindDn,
    ldapBaseDn: raw.ldapBaseDn ?? DEFAULT_PLATFORM_CONFIG.ldapBaseDn,
    ldapUserFilter: raw.ldapUserFilter ?? DEFAULT_PLATFORM_CONFIG.ldapUserFilter,
    ldapDefaultRole:
      raw.ldapDefaultRole === 'DG' ||
      raw.ldapDefaultRole === 'ASSISTANT' ||
      raw.ldapDefaultRole === 'MANAGER' ||
      raw.ldapDefaultRole === 'EXTERNAL'
        ? raw.ldapDefaultRole
        : DEFAULT_PLATFORM_CONFIG.ldapDefaultRole,
    ldapTlsRejectUnauthorized: raw.ldapTlsRejectUnauthorized !== 'false',
    passwordMinLength: clampInt(
      raw.passwordMinLength,
      DEFAULT_PLATFORM_CONFIG.passwordMinLength,
      6,
      128
    ),
    passwordExpirationDays: clampInt(
      raw.passwordExpirationDays,
      DEFAULT_PLATFORM_CONFIG.passwordExpirationDays,
      0,
      3650
    ),
    passwordRequireUppercase: raw.passwordRequireUppercase !== 'false',
    passwordRequireLowercase: raw.passwordRequireLowercase !== 'false',
    passwordRequireNumbers: raw.passwordRequireNumbers !== 'false',
    passwordRequireSpecialChars: raw.passwordRequireSpecialChars !== 'false',
    sessionExpirationMinutes: clampInt(
      raw.sessionExpirationMinutes,
      DEFAULT_PLATFORM_CONFIG.sessionExpirationMinutes,
      5,
      1440
    ),
    sessionSinglePerUser: raw.sessionSinglePerUser !== 'false',
    twoFactorRequired: raw.twoFactorRequired === 'true',
  };
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function serializePlatformConfig(config: PlatformConfig): Record<string, string> {
  return {
    organizationName: config.organizationName,
    institutionAcronym: config.institutionAcronym,
    institutionLogoUrl: config.institutionLogoUrl,
    institutionAddress: config.institutionAddress,
    institutionPhone: config.institutionPhone,
    institutionOfficialEmail: config.institutionOfficialEmail,
    institutionWebsite: config.institutionWebsite,
    systemLanguage: config.systemLanguage,
    dateTimeFormat: config.dateTimeFormat,
    smtpHost: config.smtpHost,
    smtpPort: String(config.smtpPort),
    smtpSecure: config.smtpSecure ? 'true' : 'false',
    smtpUser: config.smtpUser,
    smtpPassword: config.smtpPassword,
    smtpFromEmail: config.smtpFromEmail,
    notifyNewDocuments: config.notifyNewDocuments ? 'true' : 'false',
    notifyNewAppointments: config.notifyNewAppointments ? 'true' : 'false',
    notifyAppointmentReminders: config.notifyAppointmentReminders ? 'true' : 'false',
    bufferMinutes: String(config.bufferMinutes),
    workDayStart: config.workDayStart,
    workDayEnd: config.workDayEnd,
    slotDurationMinutes: String(config.defaultAppointmentDurationMinutes),
    defaultAppointmentDurationMinutes: String(config.defaultAppointmentDurationMinutes),
    allowedDurationMinutes: JSON.stringify(config.allowedDurationMinutes),
    maxAppointmentsPerDay: String(config.maxAppointmentsPerDay),
    maxAppointmentsPerWeek: String(config.maxAppointmentsPerWeek),
    allowOutsideHours: config.allowOutsideHours ? 'true' : 'false',
    allowWeekendAppointments: config.allowWeekendAppointments ? 'true' : 'false',
    lunchBreakStart: config.lunchBreakStart,
    lunchBreakEnd: config.lunchBreakEnd,
    workingDays: JSON.stringify(config.workingDays),
    timezone: config.timezone,
    autoRejectBeforeStartMinutes: String(config.autoRejectBeforeStartMinutes),
    dgOutlookEmail: config.dgOutlookEmail,
    defaultImportPassword: config.defaultImportPassword,
    reminderEmailEnabled: config.notifyAppointmentReminders ? 'true' : 'false',
    adImportSource: config.adImportSource,
    ldapUrl: config.ldapUrl,
    ldapBindDn: config.ldapBindDn,
    ldapBaseDn: config.ldapBaseDn,
    ldapUserFilter: config.ldapUserFilter,
    ldapDefaultRole: config.ldapDefaultRole,
    ldapTlsRejectUnauthorized: config.ldapTlsRejectUnauthorized ? 'true' : 'false',
    passwordMinLength: String(config.passwordMinLength),
    passwordExpirationDays: String(config.passwordExpirationDays),
    passwordRequireUppercase: config.passwordRequireUppercase ? 'true' : 'false',
    passwordRequireLowercase: config.passwordRequireLowercase ? 'true' : 'false',
    passwordRequireNumbers: config.passwordRequireNumbers ? 'true' : 'false',
    passwordRequireSpecialChars: config.passwordRequireSpecialChars ? 'true' : 'false',
    sessionExpirationMinutes: String(config.sessionExpirationMinutes),
    sessionSinglePerUser: config.sessionSinglePerUser ? 'true' : 'false',
    twoFactorRequired: config.twoFactorRequired ? 'true' : 'false',
  };
}
