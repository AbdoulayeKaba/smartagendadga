type SendMessageInput = {
  to: string;
  subject?: string;
  message: string;
};

function asEsmtText(input: SendMessageInput): string {
  return [
    'ESMT - Notification officielle',
    input.subject ? `Objet: ${input.subject}` : null,
    '',
    input.message,
    '',
    'Ceci est un message automatique. Merci de ne pas repondre.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Provider call failed: ${res.status} ${text}`);
  }
}

export async function sendEmailNotification(input: SendMessageInput) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim() || 'ESMT <no-reply@esmt.local>';
  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [input.to],
        subject: input.subject ?? 'Notification ESMT',
        text: asEsmtText(input),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Resend failed: ${res.status} ${text}`);
    }
    return { sent: true, provider: 'resend' as const };
  }

  const webhook = process.env.NOTIFICATION_EMAIL_WEBHOOK?.trim();
  if (!webhook) {
    // Fallback dev mode: consider as sent to keep flow testable.
    return { sent: true, provider: 'mock-email' as const };
  }
  await postJson(webhook, {
    to: input.to,
    subject: input.subject ?? 'Notification ESMT',
    message: asEsmtText(input),
  });
  return { sent: true, provider: 'webhook-email' as const };
}

export async function sendSmsNotification(input: SendMessageInput) {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();
  if (twilioSid && twilioToken && twilioFrom) {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const body = new URLSearchParams({
      To: input.to,
      From: twilioFrom,
      Body: asEsmtText(input),
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Twilio failed: ${res.status} ${text}`);
    }
    return { sent: true, provider: 'twilio' as const };
  }

  const webhook = process.env.NOTIFICATION_SMS_WEBHOOK?.trim();
  if (!webhook) {
    return { sent: true, provider: 'mock-sms' as const };
  }
  await postJson(webhook, {
    to: input.to,
    message: asEsmtText(input),
  });
  return { sent: true, provider: 'webhook-sms' as const };
}

