function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type WelcomeMailContext = {
  organizationName: string;
  recipientName: string;
  roleLabel: string;
  email: string;
  initialPassword: string;
  loginUrl: string;
  logoUrl?: string | null;
};

function emailLogoBlock(logoUrl: string | null | undefined, organizationName: string): string {
  const safeUrl = logoUrl?.trim();
  if (!safeUrl) return '';

  const org = escapeHtml(organizationName);
  const src = escapeHtml(safeUrl);

  return `
    <div style="margin-bottom:16px;">
      <div style="display:inline-block;padding:10px 14px;border-radius:12px;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
        <img
          src="${src}"
          alt="${org}"
          width="auto"
          height="48"
          style="display:block;max-height:48px;max-width:200px;width:auto;height:auto;border:0;outline:none;"
        />
      </div>
    </div>`;
}

function welcomeMailLayout(input: {
  organizationName: string;
  recipientName: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  logoUrl?: string | null;
  footerNote?: string;
}): string {
  const org = escapeHtml(input.organizationName);
  const name = escapeHtml(input.recipientName);
  const headline = escapeHtml(input.headline);
  const intro = escapeHtml(input.intro);

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#065f46 0%,#047857 55%,#059669 100%);color:#ffffff;">
                ${emailLogoBlock(input.logoUrl, input.organizationName)}
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.92;font-weight:600;">${org}</div>
                <div style="font-size:24px;font-weight:700;margin-top:8px;line-height:1.25;">${headline}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#334155;">Bonjour <strong>${name}</strong>,</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#475569;">${intro}</p>
                ${input.bodyHtml}
                ${
                  input.footerNote
                    ? `<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">${escapeHtml(input.footerNote)}</p>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildWelcomeUserMail(ctx: WelcomeMailContext) {
  const safeEmail = escapeHtml(ctx.email);
  const safePassword = escapeHtml(ctx.initialPassword);
  const safeRole = escapeHtml(ctx.roleLabel);
  const safeLoginUrl = escapeHtml(ctx.loginUrl);

  const bodyHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Vos identifiants de connexion</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:130px;vertical-align:top;">Adresse e-mail</td>
              <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;word-break:break-all;">${safeEmail}</td>
            </tr>
            <tr>
              <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top;">Mot de passe</td>
              <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;">
                <code style="display:inline-block;padding:8px 12px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:15px;font-weight:700;color:#065f46;letter-spacing:0.04em;font-family:Consolas,Monaco,monospace;">${safePassword}</code>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 18px;color:#64748b;font-size:13px;vertical-align:top;">Rôle</td>
              <td style="padding:12px 18px;font-size:14px;font-weight:500;color:#0f172a;">${safeRole}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin:0 0 20px;padding:16px 18px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;">Sécurité — première connexion</div>
      <div style="font-size:13px;line-height:1.55;color:#78350f;">
        Pour votre sécurité, vous devrez <strong>modifier ce mot de passe</strong> dès votre première connexion à la plateforme.
      </div>
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
      <tr>
        <td style="border-radius:10px;background:#047857;">
          <a href="${safeLoginUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Se connecter à la plateforme</a>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;word-break:break-all;">${safeLoginUrl}</p>`;

  return {
    subject: `Bienvenue sur ${ctx.organizationName} — vos identifiants`,
    html: welcomeMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Bienvenue sur la plateforme',
      logoUrl: ctx.logoUrl,
      intro:
        'Votre compte a été créé sur la plateforme Agenda DGA. Retrouvez ci-dessous vos identifiants pour accéder à vos rendez-vous et demandes de réservation de salles.',
      bodyHtml,
      footerNote:
        'Conservez cet e-mail en lieu sûr. Ne partagez pas votre mot de passe. En cas de difficulté, contactez l’assistante de direction.',
    }),
  };
}
