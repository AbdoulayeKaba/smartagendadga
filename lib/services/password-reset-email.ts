import { buildPasswordResetMail } from '@/lib/emails/password-reset-mail';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { sendEmail } from '@/lib/services/email';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { sendSmtpMail, smtpConfigReady } from '@/lib/services/smtp-mailer';
import { isMockDataEnabled } from '@/lib/mock/config';

export type PasswordResetDelivery =
  | 'sent'
  | 'mock'
  | 'simulated'
  | 'no_smtp'
  | 'failed'
  | 'user_not_eligible';

export async function sendPasswordResetEmail(input: {
  email: string;
  recipientName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<PasswordResetDelivery> {
  const settings = await getPlatformSettings();
  const org = settings.organizationName || 'Agenda DGA';
  const inlineLogo = await resolveEmailInlineLogo();

  const mail = buildPasswordResetMail({
    organizationName: org,
    recipientName: input.recipientName,
    resetUrl: input.resetUrl,
    expiresMinutes: input.expiresMinutes,
    logoUrl: inlineLogo ? emailLogoCidSrc(inlineLogo.cid) : null,
  });

  const payload = {
    to: input.email.trim(),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
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

  if (!smtpConfigReady(settings)) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[password-reset:dev:no-smtp]', input.resetUrl);
      await sendEmail({ ...payload, forceReal: true });
      return 'simulated';
    }
    return 'no_smtp';
  }

  const result = await sendSmtpMail(settings, payload, { forceReal: true });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error('[password-reset:smtp-failed]', input.email, result.error);
    return 'failed';
  }

  if (result.mock || isMockDataEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[password-reset:mock]', input.email, input.resetUrl);
    return 'mock';
  }

  return 'sent';
}
