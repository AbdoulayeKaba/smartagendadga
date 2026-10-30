import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import type { PlatformConfig } from '@/lib/dg/platform-config';
import { SMTP_PASSWORD_MASK } from '@/lib/services/platform-settings-admin';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { testSmtpConnection } from '@/lib/services/smtp-mailer';

const bodySchema = z.object({
  to: z.string().email(),
  smtp: z
    .object({
      smtpHost: z.string().max(255).optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
      smtpSecure: z.boolean().optional(),
      smtpUser: z.string().max(255).optional(),
      smtpPassword: z.string().max(256).optional(),
      smtpFromEmail: z.string().email().optional().or(z.literal('')),
    })
    .optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session.role, 'action.settings.notifications'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const stored = await getPlatformSettings();
  const overlay = parsed.data.smtp ?? {};
  const password =
    overlay.smtpPassword && overlay.smtpPassword !== SMTP_PASSWORD_MASK
      ? overlay.smtpPassword
      : stored.smtpPassword;

  const config: PlatformConfig = {
    ...stored,
    ...overlay,
    smtpPassword: password,
  };

  const result = await testSmtpConnection(config, parsed.data.to);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mock: 'mock' in result ? result.mock : false,
    message: result.mock
      ? 'Email simulé (mode démo) — vérifiez la console serveur.'
      : 'Email de test envoyé.',
  });
}
