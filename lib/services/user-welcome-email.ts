import 'server-only';

import { buildWelcomeUserMail } from '@/lib/emails/welcome-mail';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { resolveAppBaseUrl } from '@/lib/auth/app-base-url';
import { sendEmail } from '@/lib/services/email';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { smtpConfigReady } from '@/lib/services/smtp-mailer';
import { isMockDataEnabled } from '@/lib/mock/config';
import type { WelcomeEmailDelivery } from '@/lib/welcome-email-delivery';

export type { WelcomeEmailDelivery } from '@/lib/welcome-email-delivery';

/**
 * Envoie (ou simule) l’email de bienvenue à la création d’un utilisateur.
 */
export async function sendUserWelcomeEmail(input: {
  email: string;
  firstName: string;
  lastName: string;
  roleLabel: string;
  initialPassword: string;
}): Promise<WelcomeEmailDelivery> {
  const settings = await getPlatformSettings();
  const org = settings.organizationName || 'Agenda DGA';
  const name = `${input.firstName} ${input.lastName}`.trim();
  const loginUrl = `${resolveAppBaseUrl()}/login`;
  const inlineLogo = await resolveEmailInlineLogo();

  const mail = buildWelcomeUserMail({
    organizationName: org,
    recipientName: name,
    roleLabel: input.roleLabel,
    email: input.email.trim(),
    initialPassword: input.initialPassword,
    loginUrl,
    logoUrl: inlineLogo ? emailLogoCidSrc(inlineLogo.cid) : null,
  });

  const payload = {
    to: input.email.trim(),
    subject: mail.subject,
    html: mail.html,
    forceReal: true as const,
    inlineAttachments: inlineLogo
      ? [
          {
            cid: inlineLogo.cid,
            content: inlineLogo.buffer,
            contentType: inlineLogo.mimeType,
            filename: inlineLogo.filename,
          },
        ]
      : undefined,
  };

  if (isMockDataEnabled()) {
    await sendEmail(payload);
    // eslint-disable-next-line no-console
    console.log('[welcome-email:mock]', input.email);
    return 'mock';
  }

  if (!smtpConfigReady(settings)) {
    if (process.env.NODE_ENV === 'development') {
      await sendEmail(payload);
      return 'simulated';
    }
    return 'no_smtp';
  }

  const sent = await sendEmail(payload);
  return sent ? 'sent' : 'failed';
}
