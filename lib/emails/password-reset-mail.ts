function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type PasswordResetMailContext = {
  organizationName: string;
  recipientName: string;
  resetUrl: string;
  expiresMinutes: number;
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

export function buildPasswordResetMail(ctx: PasswordResetMailContext) {
  const org = escapeHtml(ctx.organizationName);
  const name = escapeHtml(ctx.recipientName);
  const resetUrl = escapeHtml(ctx.resetUrl);

  const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#065f46 0%,#047857 55%,#059669 100%);color:#ffffff;">
                ${emailLogoBlock(ctx.logoUrl, ctx.organizationName)}
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.92;font-weight:600;">${org}</div>
                <div style="font-size:24px;font-weight:700;margin-top:8px;line-height:1.25;">Réinitialisation du mot de passe</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#334155;">Bonjour <strong>${name}</strong>,</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#475569;">
                  Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;">
                  <tr>
                    <td style="border-radius:10px;background:#047857;">
                      <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Réinitialiser mon mot de passe</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;word-break:break-all;">${resetUrl}</p>
                <div style="padding:14px 16px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;">
                  <p style="margin:0;font-size:13px;line-height:1.55;color:#78350f;">
                    Ce lien expire dans <strong>${ctx.expiresMinutes} minutes</strong>. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: `[${ctx.organizationName}] Réinitialisation de votre mot de passe`,
    html,
    text: `Bonjour ${ctx.recipientName},\n\nRéinitialisez votre mot de passe : ${ctx.resetUrl}\n\nCe lien expire dans ${ctx.expiresMinutes} minutes.`,
  };
}
