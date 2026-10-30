import { getPlatformSettings } from '@/lib/services/platform-settings';
import { sendSmtpMail, smtpConfigReady, type SmtpInlineAttachment } from '@/lib/services/smtp-mailer';
import { isMockDataEnabled } from '@/lib/mock/config';

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  /** Adresses visibles en copie, sans envoi supplémentaire. */
  cc?: string[];
  /** Envoie via SMTP réel même en mode démo si la configuration est complète. */
  forceReal?: boolean;
  inlineAttachments?: SmtpInlineAttachment[];
};

export async function sendEmail(input: SendMailInput): Promise<boolean> {
  const config = await getPlatformSettings();

  if (smtpConfigReady(config)) {
    const result = await sendSmtpMail(
      config,
      {
        to: input.to,
        subject: input.subject,
        html: input.html,
        cc: input.cc,
        inlineAttachments: input.inlineAttachments,
      },
      { forceReal: input.forceReal }
    );
    return result.ok;
  }

  if (isMockDataEnabled() || process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[email:mock]', input.to, input.subject);
  }
  return false;
}
