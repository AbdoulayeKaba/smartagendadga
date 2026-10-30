import { resolveAppBaseUrl } from '@/lib/auth/app-base-url';
import {
  formatDateLong,
  formatDateTimeLong,
  formatTimeRange,
} from '@/lib/datetime';
import { reminderLabelFr } from '@/lib/dg/appointment-reminder-schedule';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';

/** Demandeur de la réunion, ou personne seulement invitée à y participer. */
export type AppointmentMailAudience = 'requester' | 'invitee';

export function resolveAppointmentMailAudience(
  requestedByEmail: string | null | undefined,
  recipientEmail: string | null | undefined
): AppointmentMailAudience {
  const requester = requestedByEmail?.trim().toLowerCase() ?? '';
  const recipient = recipientEmail?.trim().toLowerCase() ?? '';
  if (requester && recipient && requester === recipient) return 'requester';
  return 'invitee';
}

export type AppointmentMailContext = {
  organizationName: string;
  recipientName: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  timezone: string;
  requestedByName?: string | null;
  teamsMeetingUrl?: string | null;
  isOnlineMeeting?: boolean;
  logoUrl?: string | null;
  /** Absent : ton « votre rendez-vous » (demandeur). */
  audience?: AppointmentMailAudience;
  /** Phrase du bandeau de mode, à la place du libellé automatique. */
  modalityDetail?: string | null;
  /** Assistante qui a inscrit le créneau. Remplace « Demandé par ». */
  plannedByName?: string | null;
  /** Demandeur saisi sur la fiche, distinct du compte qui planifie. */
  statedRequesterName?: string | null;
  statedRequesterContact?: string | null;
  /** Courrier DGA : le lieu physique ne figure ni dans le bandeau ni dans le détail. */
  hidePlace?: boolean;
  /** Adresses visibles par le DGA et l’assistante : demandeur, puis personnes en copie. */
  copyEmails?: string[] | null;
};

type MailLayoutVariant = 'default' | 'pending' | 'success' | 'rejected' | 'live' | 'completed';

function sanitizeHttpUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Texte affichable dans les e-mails (sans métadonnées techniques APPT_META). */
export function mailDescriptionForEmail(description: string | null | undefined): string | null {
  const { userText } = parseAppointmentMeta(description);
  const cleaned = userText
    .replace(/<!--\s*APPT_META:[\s\S]*?-->/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function formatSchedule(ctx: AppointmentMailContext): string {
  if (ctx.allDay) {
    return `${formatDateLong(ctx.startAt)} — Toute la journée`;
  }
  return `${formatDateLong(ctx.startAt)}, ${formatTimeRange(ctx.startAt, ctx.endAt)}`;
}

function isOnlineLocationLabel(location: string | null | undefined): boolean {
  const value = location?.trim().toLowerCase() ?? '';
  return value.includes('en ligne') || value.includes('teams');
}

/** Présentiel ou en ligne, à partir du flag, du lieu ou d’un lien Teams. */
export function isOnlineAppointmentMail(
  ctx: Pick<AppointmentMailContext, 'isOnlineMeeting' | 'location' | 'teamsMeetingUrl'>
): boolean {
  if (ctx.isOnlineMeeting) return true;
  if (isOnlineLocationLabel(ctx.location)) return true;
  return Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
}

function physicalLocation(ctx: AppointmentMailContext): string | null {
  const room = parseAppointmentMeta(ctx.description).meta.roomName?.trim();
  const location = ctx.location?.trim();
  const place = room || location;
  if (!place || isOnlineLocationLabel(place)) return null;
  return place;
}

/** Lieu affiché dans le courrier : toujours déterminé par le mode. */
function knownMeetingPlace(ctx: AppointmentMailContext): string {
  const onSite = physicalLocation(ctx);
  const online = isOnlineAppointmentMail(ctx);
  const hybrid =
    parseAppointmentMeta(ctx.description).meta.meetingFormat === 'HYBRID' ||
    (online && Boolean(onSite));
  if (hybrid && onSite) return `${onSite} · En ligne — Microsoft Teams`;
  if (online) return 'En ligne — Microsoft Teams';
  return onSite ?? 'Présentiel — sur site';
}

function modalityBanner(ctx: AppointmentMailContext): string {
  const place = knownMeetingPlace(ctx);
  const hybrid = place.includes('· En ligne');
  if (isOnlineAppointmentMail(ctx) && !hybrid) {
    const hasLink = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
    const detail =
      ctx.modalityDetail?.trim() ||
      (hasLink
        ? 'En ligne — Microsoft Teams. Le lien de connexion est indiqué ci-dessous.'
        : 'En ligne — Microsoft Teams. Le lien de connexion sera envoyé après validation.');
    const detailLine = detail
      ? `<div style="margin-top:4px;font-size:14px;line-height:1.5;color:#9a3412;">${escapeHtml(detail)}</div>`
      : '';
    return `
      <div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#fff7ed;border:1.5px solid #fdba74;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#c2410c;">Mode · En ligne</div>
        ${detailLine}
      </div>`;
  }

  const label = hybrid ? 'Mode · Présentiel et en ligne' : 'Mode · Présentiel';
  const detail = ctx.hidePlace ? '' : ctx.modalityDetail?.trim() || place;
  const detailLine = detail
    ? `<div style="margin-top:4px;font-size:14px;line-height:1.5;color:#064e3b;">${escapeHtml(detail)}</div>`
    : '';
  return `
    <div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#ecfdf5;border:1.5px solid #6ee7b7;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#047857;">${label}</div>
      ${detailLine}
    </div>`;
}

function emailLogoBlock(logoUrl: string | null | undefined, organizationName: string): string {
  const safeUrl = logoUrl?.trim();
  if (!safeUrl) return '';

  return `
    <div style="margin-bottom:14px;">
      <div style="display:inline-block;padding:8px 12px;border-radius:10px;background:#ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.14);">
        <img
          src="${escapeHtml(safeUrl)}"
          alt="${escapeHtml(organizationName)}"
          height="44"
          style="display:block;max-height:44px;max-width:180px;width:auto;height:auto;border:0;outline:none;"
        />
      </div>
    </div>`;
}

function statusBadge(variant: MailLayoutVariant): string {
  if (variant === 'pending') {
    return `
      <div style="display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,237,213,0.55);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ffedd5;">
        En attente de validation
      </div>`;
  }
  if (variant === 'success') {
    return `
      <div style="display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(167,243,208,0.55);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ecfdf5;">
        Confirmé
      </div>`;
  }
  if (variant === 'rejected') {
    return `
      <div style="display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(254,202,202,0.55);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fef2f2;">
        Refusé
      </div>`;
  }
  if (variant === 'live') {
    return `
      <div style="display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(167,243,208,0.55);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ecfdf5;">
        En cours
      </div>`;
  }
  if (variant === 'completed') {
    return `
      <div style="display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(191,219,254,0.55);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#eff6ff;">
        Terminé
      </div>`;
  }
  return '';
}

function headerGradient(variant: MailLayoutVariant): string {
  if (variant === 'pending') {
    return 'linear-gradient(135deg,#9a3412 0%,#ea580c 48%,#f97316 100%)';
  }
  if (variant === 'rejected') {
    return 'linear-gradient(135deg,#7f1d1d 0%,#b91c1c 48%,#dc2626 100%)';
  }
  return 'linear-gradient(135deg,#065f46 0%,#047857 55%,#059669 100%)';
}

function rejectionReasonCard(reason: string): string {
  const safe = escapeHtml(reason.trim() || 'Aucun motif précisé.');
  return `
    <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#fef2f2;border:1.5px solid #fecaca;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#b91c1c;margin-bottom:8px;">Motif du refus</div>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#7f1d1d;">${safe}</p>
    </div>`;
}

/** Demandeur indiqué sur la fiche, puis participants en copie (hors compte qui a saisi). */
export function collectStaffCopyEmails(input: {
  description?: string | null;
  requestedByEmail?: string | null;
  requestedByRole?: string | null;
  participants?: { email: string }[] | null;
}): string[] {
  const meta = parseAppointmentMeta(input.description).meta;
  const requesterEmail = meta.requesterEmail?.trim() ?? '';
  const accountEmail = input.requestedByEmail?.trim() ?? '';
  const seen = new Set<string>();
  const emails: string[] = [];
  const add = (value: string) => {
    const email = value.trim();
    const key = email.toLowerCase();
    if (!email.includes('@') || seen.has(key)) return;
    seen.add(key);
    emails.push(email);
  };

  if (requesterEmail) add(requesterEmail);
  else if (input.requestedByRole === 'EXTERNAL') add(accountEmail);

  const hidden = new Set(
    [accountEmail, requesterEmail].map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
  for (const participant of input.participants ?? []) {
    const email = participant.email?.trim() ?? '';
    if (!email || hidden.has(email.toLowerCase())) continue;
    add(email);
  }
  return emails;
}

/** Adresses affichées dans l’en-tête du courrier DGA / assistante, hors le destinataire lui-même. */
export function staffMailboxCc(
  copyEmails: string[] | null | undefined,
  recipientEmail: string
): string[] {
  const self = recipientEmail.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of copyEmails ?? []) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email.includes('@') || key === self || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

function copyEmailsBlock(emails: string[]): string {
  const chips = emails
    .map((email) => {
      const safe = escapeHtml(email);
      return `<a href="mailto:${safe}" style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;border-radius:999px;border:1px solid #d1fae5;background:#ffffff;color:#0f172a;font-size:12px;line-height:1.35;font-weight:600;text-decoration:none;">${safe}</a>`;
    })
    .join('');
  return `
    <div style="margin:16px 0 0;">
      <div style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">En copie</div>
      <div>${chips}</div>
    </div>`;
}

function appointmentDetailsCard(ctx: AppointmentMailContext): string {
  const description = mailDescriptionForEmail(ctx.description);
  const online = isOnlineAppointmentMail(ctx);
  const hybrid = knownMeetingPlace(ctx).includes('· En ligne');
  const rows: { label: string; value: string }[] = [
    { label: 'Objet', value: ctx.title },
    { label: 'Mode', value: hybrid ? 'Présentiel et en ligne' : online ? 'En ligne' : 'Présentiel' },
    { label: 'Date et horaire', value: formatSchedule(ctx) },
  ];
  if (!ctx.hidePlace) {
    rows.push({ label: 'Lieu', value: knownMeetingPlace(ctx) });
  }
  if (ctx.statedRequesterName?.trim()) {
    rows.push({ label: 'Demandeur', value: ctx.statedRequesterName.trim() });
  }
  if (ctx.statedRequesterContact?.trim()) {
    rows.push({ label: 'Coordonnées', value: ctx.statedRequesterContact.trim() });
  }
  if (ctx.plannedByName?.trim()) {
    rows.push({ label: 'Planifié par', value: ctx.plannedByName.trim() });
  } else if (ctx.audience === 'invitee' && ctx.requestedByName?.trim()) {
    rows.push({ label: 'Demandé par', value: ctx.requestedByName.trim() });
  }
  if (description) {
    rows.push({ label: 'Description', value: description });
  }

  const teamsUrl = sanitizeHttpUrl(ctx.teamsMeetingUrl);
  const detailRows = rows
    .map(
      (row) => `
        <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;vertical-align:top;width:132px;font-weight:600;">${escapeHtml(row.label)}</td>
              <td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500;line-height:1.45;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join('');

  const teamsRow = teamsUrl
    ? `
            <tr>
              <td style="padding:11px 16px;color:#64748b;font-size:12px;vertical-align:top;width:132px;font-weight:600;">Lien Teams</td>
              <td style="padding:11px 16px;font-size:14px;font-weight:500;">
                <a href="${escapeHtml(teamsUrl)}" style="color:#ea580c;text-decoration:underline;word-break:break-all;">${escapeHtml(teamsUrl)}</a>
              </td>
            </tr>`
    : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 4px;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(15,23,42,0.04);">
      <tr>
        <td style="padding:12px 16px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border-bottom:1px solid #e2e8f0;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#475569;">Détails du rendez-vous</div>
        </td>
      </tr>
      ${detailRows}
      ${teamsRow}
    </table>`;
}

/** Lien absolu vers l’agenda. Réservé aux courriers DGA et assistante DGA. */
export function staffAgendaUrl(): string {
  return `${resolveAppBaseUrl()}/dg/appointments`;
}

function platformAccessCta(): string {
  const href = staffAgendaUrl();
  const safeUrl = escapeHtml(href);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#047857;">Accès plateforme</div>
          <p style="margin:6px 0 14px;font-size:13px;line-height:1.55;color:#14532d;">Ouvrez l’agenda pour consulter ce rendez-vous. Cet accès est réservé au DGA et à l’assistante DGA.</p>
          <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#047857;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accéder à l’agenda</a>
          <div style="margin-top:10px;font-size:12px;line-height:1.45;color:#166534;word-break:break-all;">${safeUrl}</div>
          </td>
      </tr>
    </table>`;
}

function teamsJoinCta(ctx: AppointmentMailContext): string {
  const teamsUrl = sanitizeHttpUrl(ctx.teamsMeetingUrl);
  if (!teamsUrl) return '';
  const safeUrl = escapeHtml(teamsUrl);
  return `
    <div style="margin:18px 0 0;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#c2410c;margin-bottom:10px;">Microsoft Teams</div>
      <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#ea580c;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Rejoindre la réunion Teams</a>
      <div style="margin-top:10px;font-size:12px;line-height:1.45;color:#9a3412;word-break:break-all;">${safeUrl}</div>
                </div>`;
}

function appointmentMailLayout(input: {
  organizationName: string;
  recipientName: string;
  headline: string;
  intro: string;
  ctx: AppointmentMailContext;
  footerNote?: string;
  variant?: MailLayoutVariant;
  rejectionReason?: string | null;
  /** Bouton d’accès à l’agenda : courriers DGA et assistante uniquement. */
  platformAccess?: boolean;
  /** Formule d’appel. À défaut, le nom du destinataire. */
  salutation?: string;
}): string {
  const org = escapeHtml(input.organizationName);
  const name = escapeHtml(input.salutation?.trim() || input.recipientName);
  const headline = escapeHtml(input.headline);
  const intro = escapeHtml(input.intro);
  const variant = input.variant ?? 'default';
  const logoUrl = input.ctx.logoUrl;

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1.5px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:26px 28px;background:${headerGradient(variant)};color:#ffffff;">
                ${emailLogoBlock(logoUrl, input.organizationName)}
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.92;font-weight:600;">${org}</div>
                <div style="font-size:22px;font-weight:800;margin-top:6px;line-height:1.25;letter-spacing:-0.02em;">${headline}</div>
                ${statusBadge(variant)}
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#1e293b;">Bonjour <strong>${name}</strong>,</p>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#475569;">${intro}</p>
                ${input.ctx.copyEmails?.length ? copyEmailsBlock(input.ctx.copyEmails) : ''}
                ${input.rejectionReason ? rejectionReasonCard(input.rejectionReason) : ''}
                ${modalityBanner(input.ctx)}
                ${appointmentDetailsCard(input.ctx)}
                ${teamsJoinCta(input.ctx)}
                ${input.platformAccess ? platformAccessCta() : ''}
                ${
                  input.footerNote
                    ? `<p style="margin:22px 0 0;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.55;color:#64748b;">${escapeHtml(input.footerNote)}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 20px;border-top:1px solid #f1f5f9;background:#fafafa;">
                <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">
                  Message automatique — ${org} · Agenda DGA
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildAppointmentConfirmationMail(ctx: AppointmentMailContext) {
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const host = ctx.requestedByName?.trim();
  return {
    subject: `Invitation — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Vous êtes invité',
      intro: hasTeams
        ? `${host ? `${host} vous convie` : 'Vous êtes invité'} à cette réunion, confirmée par l’assistante du DGA. Le lien Microsoft Teams est ci-dessous pour la rejoindre.`
        : `${host ? `${host} vous convie` : 'Vous êtes invité'} à cette réunion, confirmée par l’assistante du DGA. Les informations pour vous présenter sont ci-dessous.`,
      ctx: { ...ctx, audience: 'invitee' },
      variant: 'success',
      footerNote: hasTeams
        ? `Ce message s’adresse aux personnes invitées. Fuseau horaire : ${ctx.timezone}. Utilisez le lien Teams pour rejoindre la réunion.`
        : `Ce message s’adresse aux personnes invitées. Fuseau horaire : ${ctx.timezone}. Merci de vous présenter à l’heure indiquée.`,
    }),
  };
}

export function buildAppointmentReminderMail(
  ctx: AppointmentMailContext,
  minutesBefore: number,
  options?: { forStaff?: boolean }
) {
  const label = reminderLabelFr(minutesBefore);
  const invitee = ctx.audience === 'invitee';
  const staff = Boolean(options?.forStaff);
  const when = formatDateTimeLong(ctx.startAt);
  const addressed = staff ? addressDgMail(ctx) : { ctx };
  return {
    subject: staff
      ? `Rappel d’agenda — ${ctx.title} dans ${label}`
      : invitee
        ? `Rappel d’invitation — ${ctx.title} dans ${label}`
        : `Rappel — ${ctx.title} dans ${label}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: staff
        ? 'Rappel d’agenda'
        : invitee
          ? 'Rappel pour les invités'
          : 'Rappel de votre rendez-vous',
      intro: staff
        ? `Un rendez-vous de votre agenda aura lieu dans ${label} (${when}).`
        : invitee
          ? `La réunion à laquelle vous êtes invité aura lieu dans ${label} (${when}).`
          : `Votre rendez-vous aura lieu dans ${label} (${when}).`,
      ctx: addressed.ctx,
      platformAccess: staff,
      footerNote: staff
        ? `Rappel réservé à l’agenda. Fuseau horaire : ${ctx.timezone}.`
        : invitee
          ? 'Ce rappel est adressé aux personnes invitées à la réunion.'
          : 'Ce rappel est adressé au demandeur du rendez-vous.',
    }),
  };
}

export function buildAppointmentStartedMail(
  ctx: AppointmentMailContext,
  options?: { forStaff?: boolean }
) {
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const invitee = ctx.audience === 'invitee';
  const when = formatDateTimeLong(ctx.startAt);
  const staff = Boolean(options?.forStaff);
  const addressed = staff ? addressDgMail(ctx) : { ctx };
  return {
    subject: invitee && !staff ? `La réunion commence — ${ctx.title}` : `Réunion en cours — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: staff
        ? 'Réunion en cours'
        : invitee
          ? 'La réunion commence'
          : 'Votre rendez-vous est en cours',
      intro: staff
        ? hasTeams
          ? `Un rendez-vous de votre agenda vient de commencer (${when}). Rejoignez-le via le lien Microsoft Teams ci-dessous.`
          : addressed.ctx.hidePlace
            ? `Un rendez-vous de votre agenda vient de commencer (${when}).`
            : `Un rendez-vous de votre agenda vient de commencer (${when}). Le créneau se tient au lieu indiqué.`
        : invitee
          ? hasTeams
            ? `La réunion à laquelle vous êtes invité vient de commencer (${when}). Rejoignez-la via le lien Microsoft Teams ci-dessous.`
            : `La réunion à laquelle vous êtes invité vient de commencer (${when}). Merci de vous présenter au lieu indiqué.`
          : hasTeams
            ? `Le créneau de votre rendez-vous a commencé (${when}). Rejoignez la réunion dès maintenant via le lien Microsoft Teams ci-dessous.`
            : `Le créneau de votre rendez-vous a commencé (${when}). Merci de vous présenter sans tarder au lieu indiqué.`,
      ctx: addressed.ctx,
      variant: 'live',
      platformAccess: staff,
      footerNote: `Fuseau horaire de référence : ${ctx.timezone}. Ce message est envoyé automatiquement au démarrage du créneau.`,
    }),
  };
}

export function buildAppointmentEndedMail(
  ctx: AppointmentMailContext,
  options?: { forStaff?: boolean }
) {
  const invitee = ctx.audience === 'invitee';
  const staff = Boolean(options?.forStaff);
  const when = formatDateTimeLong(ctx.endAt);
  const addressed = staff ? addressDgMail(ctx) : { ctx };
  return {
    subject: `Réunion terminée — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: staff
        ? 'Réunion terminée'
        : invitee
          ? 'La réunion est terminée'
          : 'Votre rendez-vous est terminé',
      intro: staff
        ? `Un rendez-vous de votre agenda est terminé (${when}).`
        : invitee
          ? `La réunion à laquelle vous étiez invité est terminée (${when}). Merci d’y avoir participé.`
          : `Le créneau de votre rendez-vous est arrivé à son terme (${when}). Merci pour votre participation.`,
      ctx: addressed.ctx,
      variant: 'completed',
      platformAccess: staff,
      footerNote: `Fuseau horaire de référence : ${ctx.timezone}. Ce message est envoyé automatiquement à la fin du créneau.`,
    }),
  };
}

export function buildRequesterApprovedMail(ctx: AppointmentMailContext) {
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  return {
    subject: `Demande approuvée — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Demande approuvée',
      intro: hasTeams
        ? 'Votre demande de rendez-vous a été validée par l’assistante du DGA. Le lien Microsoft Teams est inclus ci-dessous.'
        : 'Votre demande de rendez-vous a été validée par l’assistante du DGA.',
      ctx: { ...ctx, audience: 'requester' },
      variant: 'success',
      footerNote: 'Ce message confirme votre demande. Les personnes invitées reçoivent un e-mail d’invitation distinct.',
    }),
  };
}

/** Confirmation adressée à l’assistante pour la validation qu’elle vient d’enregistrer. */
export function buildAssistantApprovedMail(
  ctx: AppointmentMailContext,
  options: { selfValidated?: boolean } = {}
) {
  const meta = parseAppointmentMeta(ctx.description).meta;
  const statedRequester = meta.requesterFullName?.trim() || '';
  const statedContact = [meta.requesterPhone?.trim(), meta.requesterEmail?.trim()]
    .filter(Boolean)
    .join(' · ');
  const online = isOnlineAppointmentMail(ctx);
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const place = knownMeetingPlace(ctx);
  const hybrid = place.includes('· En ligne');
  const modalityDetail = hybrid
    ? `Réunion en présentiel et en ligne. Lieu : ${place}.`
    : online
      ? hasTeams
        ? 'Réunion en ligne sur Microsoft Teams. Le lien de connexion est indiqué ci-dessous.'
        : 'Réunion en ligne sur Microsoft Teams.'
      : place === 'Présentiel — sur site'
        ? 'Réunion en présentiel, sur site.'
        : `Réunion en présentiel. Lieu : ${place}.`;
  const requesterSentence = statedRequester ? ` Il est demandé par ${statedRequester}.` : '';
  const modeSentence = hybrid
    ? 'Il se tiendra en présentiel et en ligne.'
    : online
      ? 'Il se tiendra en ligne, sur Microsoft Teams.'
      : 'Il se tiendra en présentiel.';
  const action = options.selfValidated
    ? `Vous avez validé ce rendez-vous.${requesterSentence} ${modeSentence} Il est confirmé sur l’agenda du Directeur général adjoint.`
    : `Le rendez-vous que vous avez inscrit à l’agenda est maintenant validé.${requesterSentence} ${modeSentence} Il est confirmé sur l’agenda du Directeur général adjoint.`;
  return {
    subject: `Rendez-vous validé — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Rendez-vous validé',
      intro: `${action} Les personnes invitées reçoivent un courrier distinct.`,
      ctx: {
        ...ctx,
        audience: 'requester',
        modalityDetail,
        statedRequesterName: statedRequester || null,
        statedRequesterContact: statedContact || null,
      },
      variant: 'success',
      platformAccess: true,
      footerNote: `Confirmation de la validation enregistrée sur l’agenda. Fuseau horaire : ${ctx.timezone}.`,
    }),
  };
}

export function buildAssistantNewRequestMail(ctx: AppointmentMailContext) {
  return {
    subject: `Nouvelle demande de rendez-vous — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Nouvelle demande à valider',
      intro:
        'Une nouvelle demande de rendez-vous a été soumise et attend votre validation dans l’application.',
      ctx,
      variant: 'pending',
      platformAccess: true,
      footerNote:
        'Connectez-vous à la plateforme pour approuver, modifier ou refuser cette demande.',
    }),
  };
}

export function buildAppointmentRequestSubmittedMail(ctx: AppointmentMailContext) {
  return {
    subject: `Demande enregistrée — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Demande en attente de validation',
      intro:
        'Votre demande de rendez-vous a bien été enregistrée sur la plateforme Agenda DGA. Elle sera examinée par l’assistante du DGA avant confirmation.',
      ctx: { ...ctx, audience: 'requester' },
      variant: 'pending',
      footerNote:
        'Vous recevrez un nouvel e-mail lorsque la demande sera validée ou refusée. Les personnes invitées sont prévenues dès maintenant que la réunion est en attente.',
    }),
  };
}

/** Le demandeur a corrigé sa demande, encore en attente. */
export function buildAppointmentRequestUpdatedMail(ctx: AppointmentMailContext) {
  return {
    subject: `Demande mise à jour — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Demande mise à jour',
      intro:
        'Vous avez modifié votre demande de rendez-vous. Elle reste en attente de validation par l’assistante du DGA. Voici les informations à jour, y compris le mode de la réunion.',
      ctx: { ...ctx, audience: 'requester' },
      variant: 'pending',
      footerNote:
        'Les personnes invitées reçoivent ces mêmes informations. Vous serez prévenu lorsque la demande sera validée ou refusée.',
    }),
  };
}

/** Invité déjà prévenu : la demande a changé avant validation. */
export function buildAppointmentInviteUpdatedMail(ctx: AppointmentMailContext) {
  const host = ctx.requestedByName?.trim();
  return {
    subject: `Invitation mise à jour — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Invitation mise à jour',
      intro: host
        ? `${host} a modifié cette réunion avant sa validation. Elle n’est pas encore confirmée. Voici les nouvelles informations, y compris si elle se tient en présentiel ou en ligne.`
        : 'Cette réunion a été modifiée avant sa validation. Elle n’est pas encore confirmée. Voici les nouvelles informations, y compris si elle se tient en présentiel ou en ligne.',
      ctx: { ...ctx, audience: 'invitee' },
      variant: 'pending',
      footerNote:
        'Vous recevrez un nouvel e-mail lorsque l’assistante du DGA aura confirmé ou refusé la réunion.',
    }),
  };
}

/** Personne retirée de la demande avant validation. */
export function buildAppointmentInviteWithdrawnMail(ctx: AppointmentMailContext) {
  const host = ctx.requestedByName?.trim();
  return {
    subject: `Invitation retirée — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Invitation retirée',
      intro: host
        ? `${host} vous a retiré de cette réunion avant sa validation. Vous n’avez plus à y participer.`
        : 'Vous avez été retiré de cette réunion avant sa validation. Vous n’avez plus à y participer.',
      ctx: { ...ctx, audience: 'invitee' },
      variant: 'default',
      footerNote: 'Aucun autre message ne vous sera envoyé pour cette demande, sauf si vous êtes de nouveau invité.',
    }),
  };
}

export function buildAssistantRequestUpdatedMail(ctx: AppointmentMailContext) {
  return {
    subject: `Demande mise à jour — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Demande mise à jour',
      intro:
        'Le demandeur a modifié sa demande avant validation. Voici la version à examiner, avec le mode présentiel ou en ligne.',
      ctx,
      variant: 'pending',
      platformAccess: true,
      footerNote: 'Connectez-vous à la plateforme pour valider cette version.',
    }),
  };
}

/** Prévenu dès le lancement, avant validation de l’assistante. */
export function buildAppointmentInvitePendingMail(ctx: AppointmentMailContext) {
  const host = ctx.requestedByName?.trim();
  return {
    subject: `Invitation en attente — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: 'Vous êtes invité',
      intro: host
        ? `${host} vous a invité à cette réunion. Elle n’est pas encore confirmée : l’assistante du DGA doit encore la valider.`
        : 'Vous avez été invité à cette réunion. Elle n’est pas encore confirmée : l’assistante du DGA doit encore la valider.',
      ctx: { ...ctx, audience: 'invitee' },
      variant: 'pending',
      footerNote:
        'Ce message vous prévient du lancement de la réunion, avant son approbation. Vous recevrez un nouvel e-mail lorsqu’elle sera confirmée ou refusée.',
    }),
  };
}

/** Signalement ultra urgent : courrier structuré pour le DGA ou l’assistante. */
export function buildUrgentAppointmentMail(
  ctx: AppointmentMailContext,
  audience: 'dg' | 'assistant',
  options?: { alreadyApproved?: boolean }
) {
  const forDg = audience === 'dg';
  const alreadyApproved = options?.alreadyApproved === true;
  const addressed = forDg ? addressDgMail(ctx, { force: true }) : { ctx };
  const intro = alreadyApproved
    ? forDg
      ? 'Un rendez-vous déjà validé a été signalé comme ultra urgent pour votre agenda. Le détail du créneau est ci-dessous.'
      : 'Un rendez-vous validé a été marqué ultra urgent. Le détail du créneau est ci-dessous.'
    : forDg
      ? 'Une demande ultra urgente a été signalée pour votre agenda. Le détail du créneau est ci-dessous.'
      : 'Une demande ultra urgente est en attente de validation. Merci de l’examiner en priorité.';
  return {
    subject: `${alreadyApproved ? 'Rendez-vous ultra urgent' : 'Demande ultra urgente'} — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: alreadyApproved
        ? 'Priorité ultra urgente'
        : forDg
          ? 'Demande ultra urgente'
          : 'Demande à traiter en priorité',
      intro,
      ctx: {
        ...addressed.ctx,
        audience: forDg ? 'invitee' : 'requester',
        requestedByName: forDg ? null : addressed.ctx.requestedByName,
      },
      variant: alreadyApproved ? 'success' : 'pending',
      platformAccess: true,
      footerNote: alreadyApproved
        ? 'Ce rendez-vous est déjà validé. Il est placé en priorité dans l’agenda.'
        : forDg
          ? 'Cette demande reste en attente de validation. Elle est placée en priorité dans la file de l’agenda.'
          : 'Connectez-vous à l’agenda pour approuver, ajuster ou refuser ce créneau.',
    }),
  };
}

function foldRecipientName(recipientName: string): string {
  return recipientName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le compte DGA est intitulé par la fonction, pas par un nom de personne. */
function isDgTitleRecipient(recipientName: string): boolean {
  const folded = foldRecipientName(recipientName);
  if (!folded) return false;
  return (
    folded === 'dga' ||
    folded === 'dg' ||
    (folded.includes('directeur') && folded.includes('general') && folded.includes('adjoint'))
  );
}

/** Formule d’appel lorsque le compte DGA est intitulé par la fonction, pas par un nom. */
function formalDgSalutation(recipientName: string): string {
  if (!foldRecipientName(recipientName) || isDgTitleRecipient(recipientName)) {
    return 'Monsieur le Directeur général adjoint';
  }
  return recipientName.trim();
}

/** Courrier adressé au DGA : formule « Monsieur… » et aucun lieu physique. */
function addressDgMail(
  ctx: AppointmentMailContext,
  options: { force?: boolean } = {}
): { salutation?: string; ctx: AppointmentMailContext } {
  const titled = isDgTitleRecipient(ctx.recipientName);
  if (!options.force && !titled) return { ctx };
  return {
    salutation: titled || !foldRecipientName(ctx.recipientName) ? formalDgSalutation(ctx.recipientName) : undefined,
    ctx: { ...ctx, hidePlace: true, copyEmails: undefined },
  };
}

/** L’assistante DGA vient de saisir un rendez-vous : le DGA en est informé. */
export function buildDgPlannedAppointmentMail(ctx: AppointmentMailContext) {
  const assistant = ctx.requestedByName?.trim() || 'L’assistante du Directeur général adjoint';
  const meta = parseAppointmentMeta(ctx.description).meta;
  const statedRequester = meta.requesterFullName?.trim() || '';
  const statedContact = [meta.requesterPhone?.trim(), meta.requesterEmail?.trim()]
    .filter(Boolean)
    .join(' · ');
  const online = isOnlineAppointmentMail(ctx);
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const place = knownMeetingPlace(ctx);
  const hybrid = place.includes('· En ligne');
  const modalityDetail = hybrid
    ? 'Réunion en présentiel et en ligne.'
    : online
      ? hasTeams
        ? 'Réunion en ligne sur Microsoft Teams. Le lien de connexion est indiqué ci-dessous.'
        : 'Réunion en ligne sur Microsoft Teams. Le lien de connexion vous sera transmis dès la validation du créneau.'
      : 'Réunion en présentiel.';
  const requesterSentence = statedRequester ? ` Il est demandé par ${statedRequester}.` : '';
  const modeSentence = hybrid
    ? 'Elle se tiendra en présentiel et en ligne.'
    : online
      ? 'Elle se tiendra en ligne, sur Microsoft Teams.'
      : 'Elle se tiendra en présentiel.';
  const addressed = addressDgMail(ctx, { force: true });
  return {
    subject: `Votre agenda — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: 'Rendez-vous inscrit à votre agenda',
      intro: `${assistant} a inscrit un rendez-vous à votre agenda.${requesterSentence} ${modeSentence} L’objet et le créneau figurent ci-dessous. Ce courrier vous est adressé pour information : le créneau est confirmé sur votre agenda après validation.`,
      ctx: {
        ...addressed.ctx,
        audience: 'invitee',
        modalityDetail,
        plannedByName: assistant,
        statedRequesterName: statedRequester || null,
        statedRequesterContact: statedContact || null,
      },
      variant: 'default',
      platformAccess: true,
      footerNote: `Courrier réservé au Directeur général adjoint. Fuseau horaire : ${ctx.timezone}. Aucune action n’est requise de votre part à ce stade.`,
    }),
  };
}

export function buildDgApprovedMail(ctx: AppointmentMailContext) {
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const addressed = addressDgMail(ctx, { force: true });
  return {
    subject: `Rendez-vous validé — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      salutation: addressed.salutation,
      headline: 'Rendez-vous validé',
      intro: hasTeams
        ? 'Un rendez-vous a été validé et figé dans votre agenda. Le lien Microsoft Teams est disponible ci-dessous pour vous et les participants.'
        : 'Un rendez-vous a été validé et figé dans votre agenda. Voici le détail de la demande.',
      ctx: addressed.ctx,
      variant: 'success',
      platformAccess: true,
      footerNote: hasTeams
        ? 'Ce lien Teams a également été transmis au demandeur et aux participants.'
        : undefined,
    }),
  };
}

export function buildAppointmentRescheduledMail(
  ctx: AppointmentMailContext,
  options: { staysApproved?: boolean; forDg?: boolean } = {}
) {
  const hasTeams = Boolean(sanitizeHttpUrl(ctx.teamsMeetingUrl));
  const invitee = ctx.audience === 'invitee';
  if (options.forDg) {
    const addressed = addressDgMail(ctx, { force: true });
    return {
      subject: options.staysApproved
        ? `Rendez-vous déplacé — ${ctx.title}`
        : `Rendez-vous replanifié — ${ctx.title}`,
      html: appointmentMailLayout({
        organizationName: ctx.organizationName,
        recipientName: ctx.recipientName,
        salutation: addressed.salutation,
        headline: options.staysApproved ? 'Rendez-vous déplacé' : 'Rendez-vous replanifié',
        intro: options.staysApproved
          ? 'Un rendez-vous validé de votre agenda a été déplacé. Le nouveau créneau reste confirmé.'
          : 'Un rendez-vous de votre agenda a été replanifié. Voici le nouveau créneau. Il reste en attente de validation.',
        ctx: { ...addressed.ctx, audience: 'invitee' },
        variant: options.staysApproved ? 'success' : 'pending',
        platformAccess: true,
        footerNote: options.staysApproved
          ? `Fuseau horaire de référence : ${ctx.timezone}. Le créneau confirmé est celui indiqué ci-dessus.`
          : `Fuseau horaire de référence : ${ctx.timezone}. Le créneau apparaît sur votre agenda après validation.`,
      }),
    };
  }
  if (options.staysApproved) {
    return {
      subject: invitee ? `Réunion déplacée — ${ctx.title}` : `Rendez-vous déplacé — ${ctx.title}`,
      html: appointmentMailLayout({
        organizationName: ctx.organizationName,
        recipientName: ctx.recipientName,
        headline: invitee ? 'Réunion déplacée' : 'Rendez-vous déplacé',
        intro: invitee
          ? hasTeams
            ? 'La réunion validée à laquelle vous êtes invité a été déplacée sur l’agenda. Le nouveau créneau reste confirmé. Le lien Microsoft Teams est inchangé.'
            : 'La réunion validée à laquelle vous êtes invité a été déplacée sur l’agenda. Le nouveau créneau reste confirmé.'
          : hasTeams
            ? 'Votre rendez-vous validé a été déplacé sur l’agenda. Il reste approuvé. Voici le nouveau créneau et le lien Microsoft Teams.'
            : 'Votre rendez-vous validé a été déplacé sur l’agenda. Il reste approuvé. Voici le nouveau créneau.',
        ctx,
        variant: 'success',
        footerNote: `Fuseau horaire de référence : ${ctx.timezone}. Merci de vous présenter à la nouvelle heure indiquée.`,
      }),
    };
  }
  return {
    subject: invitee ? `Réunion déplacée — ${ctx.title}` : `Rendez-vous reporté — ${ctx.title}`,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline: invitee ? 'Réunion déplacée' : 'Rendez-vous reporté',
      intro: invitee
        ? 'La réunion à laquelle vous êtes invité a été reportée. Le nouveau créneau doit être validé à nouveau par l’assistante du DGA.'
        : 'Votre rendez-vous a été reporté. Le nouveau créneau n’est pas encore approuvé : il repasse en attente de validation.',
      ctx: { ...ctx, teamsMeetingUrl: hasTeams ? ctx.teamsMeetingUrl : null },
      variant: 'pending',
      footerNote: `Fuseau horaire de référence : ${ctx.timezone}. Vous serez informé lorsque ce créneau sera validé.`,
    }),
  };
}

export function buildAppointmentRejectedMail(
  ctx: AppointmentMailContext,
  options: { reason?: string | null; autoRejected?: boolean } = {}
) {
  const reason = options.reason?.trim() || 'Votre demande n’a pas pu être retenue.';
  const autoRejected = options.autoRejected ?? false;
  const invitee = ctx.audience === 'invitee';
  const host = ctx.requestedByName?.trim();
  const subject = invitee
    ? `Réunion annulée — ${ctx.title}`
    : autoRejected
      ? `Demande refusée automatiquement — ${ctx.title}`
      : `Demande refusée — ${ctx.title}`;
  const headline = invitee
    ? 'Réunion annulée'
    : autoRejected
      ? 'Demande refusée automatiquement'
      : 'Demande refusée';
  const intro = invitee
    ? autoRejected
      ? host
        ? `${host} vous avait invité à cette réunion. Elle n’aura pas lieu : la demande n’a pas été validée à temps et a été refusée automatiquement.`
        : 'La réunion à laquelle vous étiez invité n’aura pas lieu : la demande n’a pas été validée à temps et a été refusée automatiquement.'
      : host
        ? `${host} vous avait invité à cette réunion. L’assistante du DGA ne l’a pas retenue. Vous n’avez plus à y participer.`
        : 'La réunion à laquelle vous étiez invité n’a pas été retenue par l’assistante du DGA. Vous n’avez plus à y participer.'
    : autoRejected
      ? 'Votre demande de rendez-vous n’a pas été validée à temps avant le créneau souhaité. Elle a donc été refusée automatiquement par la plateforme Agenda DGA.'
      : 'L’assistante du DGA a examiné votre demande de rendez-vous. Malheureusement, celle-ci n’a pas pu être retenue pour le créneau demandé.';
  return {
    subject,
    html: appointmentMailLayout({
      organizationName: ctx.organizationName,
      recipientName: ctx.recipientName,
      headline,
      intro,
      ctx,
      variant: 'rejected',
      rejectionReason: reason,
      footerNote: invitee
        ? 'Vous n’avez plus à vous présenter. Un nouveau message vous sera envoyé seulement si vous êtes de nouveau invité.'
        : 'Vous pouvez soumettre une nouvelle demande sur la plateforme Agenda DGA avec un autre créneau ou un objet différent. Pour toute question, contactez l’assistante du DGA.',
    }),
  };
}
