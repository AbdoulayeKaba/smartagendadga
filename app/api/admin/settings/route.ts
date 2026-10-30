import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { filterSettingsPatchByPermissions } from '@/lib/dg/settings-tab-permissions';
import {
  normalizeOptionalEmail,
  normalizeOptionalUrl,
  sanitizeSettingsPatch,
} from '@/lib/dg/settings-validation';
import {
  getPlatformSettingsForAdmin,
  updatePlatformSettingsForAdmin,
} from '@/lib/services/platform-settings-admin';
import { getRolePermissionMap } from '@/lib/services/role-permissions-admin';
import { mockWriteAudit } from '@/lib/mock/audit';
import { writeAudit } from '@/lib/services/appointments';
import { isMockDataEnabled } from '@/lib/mock/config';
import { revalidatePlatformBrandingCache } from '@/lib/services/platform-settings-cache';

const patchSchema = z.object({
  organizationName: z.string().min(2).max(191).optional(),
  institutionAcronym: z.string().max(32).optional(),
  institutionLogoUrl: z.string().max(600_000).optional(),
  institutionAddress: z.string().max(500).optional(),
  institutionPhone: z.string().max(64).optional(),
  institutionOfficialEmail: z.preprocess(
    (v) => normalizeOptionalEmail(typeof v === 'string' ? v : ''),
    z.string().email().optional().or(z.literal(''))
  ),
  institutionWebsite: z.preprocess(
    (v) => normalizeOptionalUrl(typeof v === 'string' ? v : ''),
    z.string().url().optional().or(z.literal(''))
  ),
  systemLanguage: z.enum(['fr', 'en']).optional(),
  dateTimeFormat: z
    .enum(['DD/MM/YYYY HH:mm', 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm', 'MM/DD/YYYY h:mm a'])
    .optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPassword: z.string().max(256).optional(),
  smtpFromEmail: z.string().email().optional().or(z.literal('')),
  notifyNewDocuments: z.boolean().optional(),
  notifyNewAppointments: z.boolean().optional(),
  notifyAppointmentReminders: z.boolean().optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  defaultAppointmentDurationMinutes: z.number().int().min(5).max(240).optional(),
  allowedDurationMinutes: z.array(z.number().int()).optional(),
  maxAppointmentsPerDay: z.number().int().min(0).max(99).optional(),
  maxAppointmentsPerWeek: z.number().int().min(0).max(500).optional(),
  allowOutsideHours: z.boolean().optional(),
  allowWeekendAppointments: z.boolean().optional(),
  workDayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.number().int().min(5).max(240).optional(),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingDays: z
    .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .min(1)
    .optional(),
  timezone: z.string().min(2).max(64).optional(),
  dgOutlookEmail: z.string().email().optional().or(z.literal('')),
  defaultImportPassword: z.string().min(6).max(128).optional(),
  reminderEmailEnabled: z.boolean().optional(),
  adImportSource: z.enum(['graph', 'ldap']).optional(),
  ldapUrl: z.string().max(255).optional(),
  ldapBindDn: z.string().max(255).optional(),
  ldapBaseDn: z.string().max(255).optional(),
  ldapUserFilter: z.string().max(500).optional(),
  ldapDefaultRole: z.enum(['DG', 'ASSISTANT', 'MANAGER', 'EXTERNAL']).optional(),
  ldapTlsRejectUnauthorized: z.boolean().optional(),
  passwordMinLength: z.number().int().min(6).max(128).optional(),
  passwordExpirationDays: z.number().int().min(0).max(3650).optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireLowercase: z.boolean().optional(),
  passwordRequireNumbers: z.boolean().optional(),
  passwordRequireSpecialChars: z.boolean().optional(),
  sessionExpirationMinutes: z.number().int().min(5).max(1440).optional(),
  sessionSinglePerUser: z.boolean().optional(),
  twoFactorRequired: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;

  const settings = await getPlatformSettingsForAdmin();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(sanitizeSettingsPatch((json ?? {}) as Record<string, unknown>));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const permMap = await getRolePermissionMap(session.role);
  const filtered = filterSettingsPatchByPermissions(
    parsed.data as Record<string, unknown>,
    permMap
  );
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const settings = await updatePlatformSettingsForAdmin(
    filtered as Parameters<typeof updatePlatformSettingsForAdmin>[0],
    session.userId
  );
  if (
    'organizationName' in filtered ||
    'institutionAcronym' in filtered ||
    'institutionLogoUrl' in filtered
  ) {
    revalidatePlatformBrandingCache();
  }
  if (isMockDataEnabled()) {
    mockWriteAudit(session.userId, 'admin.settings.update');
  } else {
    await writeAudit(session.userId, 'admin.settings.update');
  }

  return NextResponse.json({ settings });
}
