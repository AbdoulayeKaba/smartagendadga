import type { NotificationKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildAppointmentConfirmationMail,
  buildAppointmentReminderMail,
  buildAppointmentRejectedMail,
  collectStaffCopyEmails,
  staffMailboxCc,
  buildAppointmentInvitePendingMail,
  buildAppointmentInviteUpdatedMail,
  buildAppointmentInviteWithdrawnMail,
  buildAppointmentRequestSubmittedMail,
  buildAppointmentRequestUpdatedMail,
  buildAssistantRequestUpdatedMail,
  buildAppointmentStartedMail,
  buildAppointmentEndedMail,
  buildAssistantNewRequestMail,
  buildDgApprovedMail,
  buildDgPlannedAppointmentMail,
  buildAssistantApprovedMail,
  buildRequesterApprovedMail,
  resolveAppointmentMailAudience,
  type AppointmentMailAudience,
  type AppointmentMailContext,
} from '@/lib/emails/appointment-mail';
import {
  listAppointmentReminderRecipients,
  listParticipantRecipientsFromSource,
} from '@/lib/dg/appointment-reminder-recipients';
import {
  MEETING_ENDED_CATCHUP_MS,
  reminderKindForOffset,
  reminderLabelFr,
  resolveReminderOffsets,
} from '@/lib/dg/appointment-reminder-schedule';
import { sendEmail } from '@/lib/services/email';
import type { SmtpInlineAttachment } from '@/lib/services/smtp-mailer';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import {
  clearPendingAppointmentReminders,
  processDueAppointmentReminders,
  triggerAppointmentRemindersDispatch,
} from '@/lib/services/appointment-reminder-dispatch';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockCreateNotification } from '@/lib/mock/notifications-store';
import { mockGetAppointment } from '@/lib/mock/store';
import { mockFindUserByEmail, mockListUsers } from '@/lib/mock/users-store';

export type AppointmentNotificationSource = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  timezone: string;
  reminderMinutesBefore: number | null;
  requestedById: string;
  teamsMeetingUrl?: string | null;
  isOnlineMeeting?: boolean;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
  };
  participants: {
    email: string;
    name: string;
    userId: string | null;
  }[];
};

export type AppointmentRecipient = {
  email: string;
  name: string;
  userId: string | null;
};

function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function listParticipantRecipients(appointment: AppointmentNotificationSource): AppointmentRecipient[] {
  return listParticipantRecipientsFromSource(appointment);
}

export { listAppointmentReminderRecipients };

/** Compte plateforme de l'invité ou du demandeur. Null si l'adresse n'a pas de compte. */
export async function resolveAccountUserId(input: {
  userId?: string | null;
  email: string;
}): Promise<string | null> {
  if (input.userId) return input.userId;
  const email = input.email.trim();
  if (!email) return null;
  if (isMockDataEnabled()) return mockFindUserByEmail(email)?.id ?? null;
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveNotificationUserId(
  recipient: AppointmentRecipient,
  fallbackUserId: string
): Promise<string> {
  return (await resolveAccountUserId(recipient)) ?? fallbackUserId;
}

async function createAudienceNotice(input: {
  userId: string | null;
  appointmentId: string;
  title: string;
  message: string;
  recipientEmail: string;
  kind?: NotificationKind;
}) {
  if (!input.userId) return;
  const kind = input.kind ?? 'REQUEST_CREATED';
  if (isMockDataEnabled()) {
    mockCreateNotification({
      userId: input.userId,
      appointmentId: input.appointmentId,
      kind,
      title: input.title,
      message: input.message,
      href: '/appointments/mine',
    });
    return;
  }
  await prisma.notification
    .create({
      data: {
        userId: input.userId,
        appointmentId: input.appointmentId,
        kind,
        title: input.title,
        message: input.message,
        recipientEmail: input.recipientEmail.trim(),
      },
    })
    .catch((err) => {
      console.error('[appointment-audience] notification failed:', input.recipientEmail, err);
    });
}

async function notifyRequesterAndInviteesInApp(
  appointment: AppointmentNotificationSource,
  assistantIds: Set<string>,
  notices: {
    requesterTitle: string;
    requesterMessage: string;
    inviteeTitle: string;
    inviteeMessage: string;
  }
) {
  if (!assistantIds.has(appointment.requestedById)) {
    await createAudienceNotice({
      userId: appointment.requestedById,
      appointmentId: appointment.id,
      title: notices.requesterTitle,
      message: notices.requesterMessage,
      recipientEmail: appointment.requestedBy.email,
    });
  }

  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  for (const participant of listParticipantRecipients(appointment)) {
    const email = participant.email.trim();
    if (!email || email.toLowerCase() === requesterEmail) continue;
    const userId = await resolveAccountUserId(participant);
    if (!userId || userId === appointment.requestedById || assistantIds.has(userId)) continue;
    await createAudienceNotice({
      userId,
      appointmentId: appointment.id,
      title: notices.inviteeTitle,
      message: notices.inviteeMessage,
      recipientEmail: email,
    });
  }
}

function withStaffCopy<T extends AppointmentMailContext>(
  ctx: T,
  appointment: {
    description: string | null;
    requestedBy: { email: string; role?: string };
    participants?: { email: string }[];
  }
): T {
  const copyEmails = collectStaffCopyEmails({
    description: appointment.description,
    requestedByEmail: appointment.requestedBy.email,
    requestedByRole: appointment.requestedBy.role,
    participants: appointment.participants,
  });
  return copyEmails.length ? { ...ctx, copyEmails } : ctx;
}

function buildMailContext(
  appointment: AppointmentNotificationSource,
  recipientName: string,
  organizationName: string,
  audience: AppointmentMailAudience = 'requester'
): AppointmentMailContext {
  return {
    organizationName,
    recipientName,
    title: appointment.title,
    description: appointment.description,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    allDay: appointment.allDay,
    location: appointment.location,
    timezone: appointment.timezone,
    requestedByName: displayName(
      appointment.requestedBy.firstName,
      appointment.requestedBy.lastName
    ),
    teamsMeetingUrl: appointment.teamsMeetingUrl ?? null,
    isOnlineMeeting: appointment.isOnlineMeeting ?? false,
    audience,
  };
}

async function resolveBrandedMailAttachments(): Promise<{
  logoUrl: string | null;
  inlineAttachments?: SmtpInlineAttachment[];
}> {
  const logo = await resolveEmailInlineLogo();
  if (!logo) return { logoUrl: null };
  return {
    logoUrl: emailLogoCidSrc(logo.cid),
    inlineAttachments: [
      {
        cid: logo.cid,
        content: logo.buffer,
        contentType: logo.mimeType,
        filename: logo.filename,
      },
    ],
  };
}

function withBranding(
  ctx: AppointmentMailContext,
  logoUrl: string | null
): AppointmentMailContext {
  return { ...ctx, logoUrl };
}

async function listActiveAssistants(): Promise<AppointmentRecipient[]> {
  if (isMockDataEnabled()) {
    return mockListUsers()
      .filter((user) => user.role === 'ASSISTANT' && user.active && user.email?.trim())
      .map((user) => ({
        email: user.email.trim(),
        name: displayName(user.firstName, user.lastName) || 'Assistante',
        userId: user.id,
      }));
  }
  const rows = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return rows
    .filter((user) => user.email?.trim())
    .map((user) => ({
      email: user.email.trim(),
      name: displayName(user.firstName, user.lastName) || 'Assistante',
      userId: user.id,
    }));
}

/** Demandeur, personnes en copie, puis DGA et assistantes qui ne sont pas déjà destinataires. */
async function listMeetingLifecycleRecipients(
  appointment: AppointmentNotificationSource
): Promise<Array<AppointmentRecipient & { staff: boolean }>> {
  const base = listAppointmentReminderRecipients(appointment);
  const seen = new Set(base.map((recipient) => recipient.email.trim().toLowerCase()));
  const recipients: Array<AppointmentRecipient & { staff: boolean }> = base.map((recipient) => ({
    ...recipient,
    staff: false,
  }));
  const dg = await resolveDgRecipient();
  const assistants = await listActiveAssistants();
  for (const person of [...(dg ? [dg] : []), ...assistants]) {
    const email = person.email.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    recipients.push({ ...person, email, staff: true });
  }
  return recipients;
}

/** Destinataires qui ont déjà une notification de ce type, envoyée ou encore en file. */
async function scheduledLifecycleEmails(
  appointmentId: string,
  kind: 'MEETING_STARTED' | 'MEETING_ENDED'
): Promise<Set<string>> {
  if (isMockDataEnabled()) return new Set();
  const rows = await prisma.notification.findMany({
    where: { appointmentId, kind },
    select: { recipientEmail: true },
  });
  return new Set(
    rows
      .map((row) => row.recipientEmail?.trim().toLowerCase() ?? '')
      .filter(Boolean)
  );
}

export async function resolveDgRecipient(): Promise<AppointmentRecipient | null> {
  if (isMockDataEnabled()) {
    const dg = mockListUsers().find((user) => user.role === 'DG' && user.active);
    if (dg?.email?.trim()) {
      return {
        email: dg.email.trim(),
        name: displayName(dg.firstName, dg.lastName) || 'DGA',
        userId: dg.id,
      };
    }
  } else {
    const dg = await prisma.user.findFirst({
      where: { role: 'DG', active: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (dg?.email?.trim()) {
      return {
        email: dg.email.trim(),
        name: displayName(dg.firstName, dg.lastName) || 'DGA',
        userId: dg.id,
      };
    }
  }

  const envEmail = process.env.DG_OUTLOOK_EMAIL?.trim();
  if (!envEmail) return null;
  return {
    email: envEmail,
    name: 'DGA',
    userId: null,
  };
}

async function persistNotification(input: {
  userId: string;
  appointmentId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  recipientEmail: string;
  scheduledFor?: Date;
  sendNow?: boolean;
  html?: string;
  cc?: string[];
  inlineAttachments?: SmtpInlineAttachment[];
}) {
  if (isMockDataEnabled()) {
    if (input.sendNow) {
      const attachments =
        input.inlineAttachments ?? (await resolveBrandedMailAttachments()).inlineAttachments;
      await sendEmail({
        to: input.recipientEmail,
        subject: input.title,
        html: input.html ?? `<p>${input.message}</p>`,
        cc: input.cc,
        forceReal: true,
        inlineAttachments: attachments,
      });
    } else if (input.scheduledFor) {
      // eslint-disable-next-line no-console
      console.log(
        '[appointment-reminder:scheduled]',
        input.recipientEmail,
        input.title,
        input.scheduledFor.toISOString()
      );
    }
    return;
  }

  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      appointmentId: input.appointmentId,
      kind: input.kind,
      title: input.title,
      message: input.message,
      recipientEmail: input.recipientEmail,
      scheduledFor: input.scheduledFor ?? null,
    },
  });

  if (input.sendNow) {
    const attachments =
      input.inlineAttachments ?? (await resolveBrandedMailAttachments()).inlineAttachments;
    const sent = await sendEmail({
      to: input.recipientEmail,
      subject: input.title,
      html: input.html ?? `<p>${input.message}</p>`,
      cc: input.cc,
      forceReal: true,
      inlineAttachments: attachments,
    });
    if (sent) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { emailSent: true, sentAt: new Date() },
      });
    }
  }
}

export async function sendParticipantConfirmationEmails(
  appointment: AppointmentNotificationSource
) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  const recipients = listParticipantRecipients(appointment).filter(
    (recipient) => recipient.email.trim().toLowerCase() !== requesterEmail
  );
  const brand = await resolveBrandedMailAttachments();

  await Promise.all(
    recipients.map(async (recipient) => {
      const ctx = withBranding(
        buildMailContext(appointment, recipient.name, organizationName, 'invitee'),
        brand.logoUrl
      );
      const mail = buildAppointmentConfirmationMail(ctx);
      const userId = await resolveNotificationUserId(recipient, appointment.requestedById);

      await persistNotification({
        userId,
        appointmentId: appointment.id,
        kind: 'APPROVED',
        title: mail.subject,
        message: `Rendez-vous confirmé : ${appointment.title}`,
        recipientEmail: recipient.email,
        sendNow: true,
        html: mail.html,
        inlineAttachments: brand.inlineAttachments,
      });
    })
  );
}

export async function sendRequesterApprovedEmail(
  appointment: AppointmentNotificationSource,
  options?: { reviewerId?: string | null }
) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const brand = await resolveBrandedMailAttachments();
  const recipientName = displayName(
    appointment.requestedBy.firstName,
    appointment.requestedBy.lastName
  );
  const baseCtx = withBranding(
    buildMailContext(appointment, recipientName, organizationName),
    brand.logoUrl
  );
  const forAssistant = appointment.requestedBy.role === 'ASSISTANT';
  const ctx = forAssistant ? withStaffCopy(baseCtx, appointment) : baseCtx;
  const mail = forAssistant
    ? buildAssistantApprovedMail(ctx, {
        selfValidated: !options?.reviewerId || options.reviewerId === appointment.requestedById,
      })
    : buildRequesterApprovedMail(ctx);
  const message = forAssistant
    ? `Vous avez confirmé « ${appointment.title} » sur l’agenda.`
    : `Votre demande « ${appointment.title} » a été validée.`;

  await persistNotification({
    userId: appointment.requestedById,
    appointmentId: appointment.id,
    kind: 'APPROVED',
    title: mail.subject,
    message,
    recipientEmail: appointment.requestedBy.email,
    sendNow: true,
    html: mail.html,
    cc: forAssistant
      ? staffMailboxCc(ctx.copyEmails, appointment.requestedBy.email)
      : undefined,
    inlineAttachments: brand.inlineAttachments,
  });

  if (isMockDataEnabled()) {
    mockCreateNotification({
      userId: appointment.requestedById,
      appointmentId: appointment.id,
      kind: 'APPROVED',
      title: mail.subject,
      message,
      href: forAssistant ? '/dg/appointments' : '/appointments/mine',
    });
  }
}

export type AppointmentRejectedMailSource = Pick<
  AppointmentNotificationSource,
  | 'id'
  | 'title'
  | 'description'
  | 'startAt'
  | 'endAt'
  | 'allDay'
  | 'location'
  | 'timezone'
  | 'requestedById'
  | 'requestedBy'
> & {
  isOnlineMeeting?: boolean;
  participants?: AppointmentNotificationSource['participants'];
};

export async function sendAppointmentRejectedEmail(
  appointment: AppointmentRejectedMailSource,
  options: {
    reason?: string | null;
    autoRejected?: boolean;
    /** Limite l’envoi (reprise d’un refus déjà notifié au demandeur). */
    audiences?: Array<'requester' | 'invitee'>;
  } = {}
) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const brand = await resolveBrandedMailAttachments();
  const reason = options.reason?.trim() || 'Votre demande n’a pas pu être retenue.';
  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  const audiences = new Set(options.audiences ?? ['requester', 'invitee']);
  const sent = new Set<string>();

  const deliver = async (input: {
    email: string;
    name: string;
    userId: string;
    audience: AppointmentMailAudience;
  }) => {
    const key = input.email.trim().toLowerCase();
    if (!key || sent.has(key)) return;
    sent.add(key);
    const ctx = withBranding(
      buildMailContext(
        {
          ...appointment,
          isOnlineMeeting: appointment.isOnlineMeeting,
          teamsMeetingUrl: null,
          participants: appointment.participants ?? [],
          requestedBy: {
            id: appointment.requestedById,
            firstName: appointment.requestedBy.firstName,
            lastName: appointment.requestedBy.lastName,
            email: appointment.requestedBy.email,
          },
        },
        input.name,
        organizationName,
        input.audience
      ),
      brand.logoUrl
    );
    const mail = buildAppointmentRejectedMail(ctx, options);
    await persistNotification({
      userId: input.userId,
      appointmentId: appointment.id,
      kind: 'REJECTED',
      title: mail.subject,
      message: reason,
      recipientEmail: input.email.trim(),
      sendNow: true,
      html: mail.html,
      inlineAttachments: brand.inlineAttachments,
    }).catch((err) => {
      console.error('[appointment-reject] email failed:', input.email, err);
    });

    if (isMockDataEnabled()) {
      mockCreateNotification({
        userId: input.userId,
        appointmentId: appointment.id,
        kind: 'REJECTED',
        title: mail.subject,
        message: reason,
        href: '/appointments/mine',
      });
    }
  };

  if (requesterEmail && audiences.has('requester')) {
    await deliver({
      email: appointment.requestedBy.email,
      name: displayName(appointment.requestedBy.firstName, appointment.requestedBy.lastName),
      userId: appointment.requestedById,
      audience: 'requester',
    });
  }

  for (const participant of appointment.participants ?? []) {
    if (!audiences.has('invitee')) continue;
    const email = participant.email.trim();
    if (!email || email.toLowerCase() === requesterEmail) continue;
    const userId = await resolveNotificationUserId(
      { email, name: participant.name, userId: participant.userId },
      appointment.requestedById
    );
    await deliver({
      email,
      name: participant.name.trim() || email,
      userId,
      audience: 'invitee',
    });
  }
}

async function listReminderMailRecipients(
  appointment: AppointmentNotificationSource
): Promise<Array<AppointmentRecipient & { staff: boolean }>> {
  const base = listAppointmentReminderRecipients(appointment);
  const seen = new Set(base.map((recipient) => recipient.email.trim().toLowerCase()));
  const recipients: Array<AppointmentRecipient & { staff: boolean }> = base.map((recipient) => ({
    ...recipient,
    staff: false,
  }));
  const dg = await resolveDgRecipient();
  if (dg?.email.trim()) {
    const email = dg.email.trim();
    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recipients.push({ email, name: dg.name, userId: dg.userId, staff: true });
    }
  }
  const staffEmails = new Set<string>();
  if (dg?.email.trim()) staffEmails.add(dg.email.trim().toLowerCase());
  for (const assistant of await listActiveAssistants()) {
    const email = assistant.email.trim().toLowerCase();
    if (email) staffEmails.add(email);
  }
  return recipients.map((recipient) => ({
    ...recipient,
    staff: recipient.staff || staffEmails.has(recipient.email.trim().toLowerCase()),
  }));
}

async function scheduledRecipientEmails(
  appointmentId: string,
  kind: 'REMINDER_24H' | 'REMINDER_1H'
): Promise<Set<string>> {
  if (isMockDataEnabled()) return new Set();
  const rows = await prisma.notification.findMany({
    where: { appointmentId, kind },
    select: { recipientEmail: true },
  });
  return new Set(
    rows.map((row) => row.recipientEmail?.trim().toLowerCase() ?? '').filter(Boolean)
  );
}

export async function scheduleParticipantReminderEmails(
  appointment: AppointmentNotificationSource,
  options?: { replacePending?: boolean }
) {
  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const offsets = resolveReminderOffsets(appointment.reminderMinutesBefore);
  if (offsets.length === 0) return;

  const now = new Date();
  if (now >= appointment.startAt) return;

  if (options?.replacePending !== false) {
    await clearPendingAppointmentReminders(appointment.id);
  }

  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const recipients = await listReminderMailRecipients(appointment);
  const brand = await resolveBrandedMailAttachments();
  const stated = parseAppointmentMeta(appointment.description).meta;
  const statedEmail = stated.requesterEmail?.trim().toLowerCase() ?? '';
  const statedContact = [stated.requesterPhone?.trim(), stated.requesterEmail?.trim()]
    .filter(Boolean)
    .join(' · ');
  const smallestOffset = Math.min(...offsets);
  const alreadyByKind = new Map<'REMINDER_24H' | 'REMINDER_1H', Set<string>>();

  for (const recipient of recipients) {
    const userId = await resolveNotificationUserId(recipient, appointment.requestedById);
    const emailKey = recipient.email.trim().toLowerCase();

    for (const minutesBefore of offsets) {
      const offsetAt = new Date(appointment.startAt.getTime() - minutesBefore * 60_000);
      let scheduledFor = offsetAt;
      if (offsetAt <= now) {
        if (minutesBefore !== smallestOffset) continue;
        scheduledFor = now;
      }

      const kind = reminderKindForOffset(minutesBefore);
      let already = alreadyByKind.get(kind);
      if (!already) {
        already = await scheduledRecipientEmails(appointment.id, kind);
        alreadyByKind.set(kind, already);
      }
      if (already.has(emailKey)) continue;
      already.add(emailKey);

      const audience =
        recipient.staff || (statedEmail && emailKey === statedEmail)
          ? 'requester'
          : resolveAppointmentMailAudience(appointment.requestedBy.email, recipient.email);
      const mailCtx = {
        ...buildMailContext(appointment, recipient.name, organizationName, audience),
        statedRequesterName: stated.requesterFullName?.trim() || null,
        statedRequesterContact: statedContact || null,
      };
      const ctx = withBranding(
        recipient.staff ? withStaffCopy(mailCtx, appointment) : mailCtx,
        brand.logoUrl
      );
      const mail = buildAppointmentReminderMail(ctx, minutesBefore, { forStaff: recipient.staff });

      await persistNotification({
        userId,
        appointmentId: appointment.id,
        kind,
        title: mail.subject,
        message: `Rappel ${reminderLabelFr(minutesBefore)} — ${appointment.title}`,
        recipientEmail: recipient.email,
        scheduledFor,
        html: mail.html,
        inlineAttachments: brand.inlineAttachments,
      });
    }
  }

  await processDueAppointmentReminders().catch((err) => {
    console.error('[appointment-reminders] post-schedule dispatch failed:', err);
  });
}

/** Planifie l’e-mail « réunion en cours » à l’heure de début du créneau. */
export async function scheduleMeetingStartedEmails(
  appointment: AppointmentNotificationSource
) {
  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const now = new Date();
  if (now > appointment.endAt) return;

  const scheduledFor = appointment.startAt > now ? appointment.startAt : now;
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const recipients = await listMeetingLifecycleRecipients(appointment);
  const alreadyScheduled = await scheduledLifecycleEmails(appointment.id, 'MEETING_STARTED');
  const brand = await resolveBrandedMailAttachments();

  for (const recipient of recipients) {
    if (alreadyScheduled.has(recipient.email.trim().toLowerCase())) continue;
    const userId = await resolveNotificationUserId(recipient, appointment.requestedById);

    const audience = resolveAppointmentMailAudience(
      appointment.requestedBy.email,
      recipient.email
    );
    const mailCtx = buildMailContext(appointment, recipient.name, organizationName, audience);
    const ctx = withBranding(
      recipient.staff ? withStaffCopy(mailCtx, appointment) : mailCtx,
      brand.logoUrl
    );
    const mail = buildAppointmentStartedMail(ctx, { forStaff: recipient.staff });

    await persistNotification({
      userId,
      appointmentId: appointment.id,
      kind: 'MEETING_STARTED',
      title: mail.subject,
      message: `Réunion en cours — ${appointment.title}`,
      recipientEmail: recipient.email,
      scheduledFor,
      html: mail.html,
      inlineAttachments: brand.inlineAttachments,
    });
  }

  await processDueAppointmentReminders().catch((err) => {
    console.error('[appointment-meeting-started] post-schedule dispatch failed:', err);
  });
}

/** Rattrapage : RDV déjà « en cours » sans notification de démarrage planifiée. */
export async function enqueueOngoingMeetingStartedNotifications(options?: {
  now?: Date;
  limit?: number;
}) {
  if (isMockDataEnabled()) return;

  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 15;

  const ongoing = await prisma.appointment.findMany({
    where: {
      status: 'APPROVED',
      archived: false,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: appointmentNotificationInclude,
    take: limit,
    orderBy: { startAt: 'asc' },
  });

  for (const row of ongoing) {
    await scheduleMeetingStartedEmails(row);
  }
}

/** Planifie l’e-mail « réunion terminée » à l’heure de fin du créneau. */
export async function scheduleMeetingEndedEmails(
  appointment: AppointmentNotificationSource
) {
  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const now = new Date();
  if (appointment.endAt <= appointment.startAt) return;
  if (now.getTime() - appointment.endAt.getTime() > MEETING_ENDED_CATCHUP_MS) return;

  const scheduledFor = appointment.endAt > now ? appointment.endAt : now;
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const recipients = await listMeetingLifecycleRecipients(appointment);
  const alreadyScheduled = await scheduledLifecycleEmails(appointment.id, 'MEETING_ENDED');
  const brand = await resolveBrandedMailAttachments();

  for (const recipient of recipients) {
    if (alreadyScheduled.has(recipient.email.trim().toLowerCase())) continue;
    const userId = await resolveNotificationUserId(recipient, appointment.requestedById);

    const audience = resolveAppointmentMailAudience(
      appointment.requestedBy.email,
      recipient.email
    );
    const mailCtx = buildMailContext(appointment, recipient.name, organizationName, audience);
    const ctx = withBranding(
      recipient.staff ? withStaffCopy(mailCtx, appointment) : mailCtx,
      brand.logoUrl
    );
    const mail = buildAppointmentEndedMail(ctx, { forStaff: recipient.staff });

    await persistNotification({
      userId,
      appointmentId: appointment.id,
      kind: 'MEETING_ENDED',
      title: mail.subject,
      message: `Réunion terminée — ${appointment.title}`,
      recipientEmail: recipient.email,
      scheduledFor,
      html: mail.html,
      inlineAttachments: brand.inlineAttachments,
    });
  }

  await processDueAppointmentReminders().catch((err) => {
    console.error('[appointment-meeting-ended] post-schedule dispatch failed:', err);
  });
}

/** Rattrapage : RDV terminés récemment sans notification de clôture. */
export async function enqueueEndedMeetingNotifications(options?: {
  now?: Date;
  limit?: number;
  lookbackMs?: number;
}) {
  if (isMockDataEnabled()) return;

  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 15;
  const lookbackMs = options?.lookbackMs ?? MEETING_ENDED_CATCHUP_MS;
  const horizonStart = new Date(now.getTime() - lookbackMs);

  const ended = await prisma.appointment.findMany({
    where: {
      status: 'APPROVED',
      archived: false,
      endAt: { lte: now, gte: horizonStart },
    },
    include: appointmentNotificationInclude,
    take: limit,
    orderBy: { endAt: 'desc' },
  });

  for (const row of ended) {
    await scheduleMeetingEndedEmails(row);
  }
}

/** Rattrapage des rappels manquants tant que le créneau n’a pas commencé. */
export async function enqueueUpcomingReminderNotifications(options?: {
  now?: Date;
  limit?: number;
}) {
  if (isMockDataEnabled()) return;

  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) return;

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 30;
  const upcoming = await prisma.appointment.findMany({
    where: {
      status: 'APPROVED',
      archived: false,
      startAt: { gt: now },
    },
    include: appointmentNotificationInclude,
    take: limit,
    orderBy: { startAt: 'asc' },
  });

  for (const row of upcoming) {
    await scheduleParticipantReminderEmails(row, { replacePending: false });
  }
}

/** Rattrapage démarrage + fin de réunion. */
export async function enqueueMeetingLifecycleNotifications(options?: {
  now?: Date;
  limit?: number;
}) {
  await enqueueUpcomingReminderNotifications(options);
  await enqueueOngoingMeetingStartedNotifications(options);
  await enqueueEndedMeetingNotifications(options);
}

export async function sendDgApprovedEmail(
  appointment: AppointmentNotificationSource,
  dg: AppointmentRecipient
) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const brand = await resolveBrandedMailAttachments();
  const ctx = withStaffCopy(
    withBranding(buildMailContext(appointment, dg.name, organizationName), brand.logoUrl),
    appointment
  );
  const mail = buildDgApprovedMail(ctx);
  const userId = await resolveNotificationUserId(dg, appointment.requestedById);

  await persistNotification({
    userId,
    appointmentId: appointment.id,
    kind: 'APPROVED',
    title: mail.subject,
    message: `Rendez-vous validé : ${appointment.title}`,
    recipientEmail: dg.email,
    sendNow: true,
    html: mail.html,
    cc: staffMailboxCc(ctx.copyEmails, dg.email),
    inlineAttachments: brand.inlineAttachments,
  });

  if (isMockDataEnabled() && dg.userId) {
    mockCreateNotification({
      userId: dg.userId,
      appointmentId: appointment.id,
      kind: 'APPROVED',
      title: mail.subject,
      message: `Rendez-vous validé : ${appointment.title}`,
      href: '/appointments/review',
    });
  }
}

async function resolveActiveUserRecipient(
  userId: string | null | undefined
): Promise<(AppointmentRecipient & { role: string }) | null> {
  if (!userId) return null;
  if (isMockDataEnabled()) {
    const user = mockListUsers().find((row) => row.id === userId && row.active);
    if (!user?.email?.trim()) return null;
    return {
      email: user.email.trim(),
      name: displayName(user.firstName, user.lastName) || 'Assistante',
      userId: user.id,
      role: user.role,
    };
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!user?.email?.trim()) return null;
  return {
    email: user.email.trim(),
    name: displayName(user.firstName, user.lastName) || 'Assistante',
    userId: user.id,
    role: user.role,
  };
}

/** Confirmation de l’action de validation, adressée à l’assistante qui vient de valider. */
export async function sendAssistantApprovedEmail(
  appointment: AppointmentNotificationSource,
  assistant: AppointmentRecipient
) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const brand = await resolveBrandedMailAttachments();
  const ctx = withStaffCopy(
    withBranding(buildMailContext(appointment, assistant.name, organizationName), brand.logoUrl),
    appointment
  );
  const mail = buildAssistantApprovedMail(ctx, { selfValidated: true });
  const message = `Vous avez validé « ${appointment.title} ».`;
  const userId = await resolveNotificationUserId(assistant, appointment.requestedById);

  await persistNotification({
    userId,
    appointmentId: appointment.id,
    kind: 'APPROVED',
    title: mail.subject,
    message,
    recipientEmail: assistant.email,
    sendNow: true,
    html: mail.html,
    cc: staffMailboxCc(ctx.copyEmails, assistant.email),
    inlineAttachments: brand.inlineAttachments,
  });

  if (isMockDataEnabled()) {
    mockCreateNotification({
      userId,
      appointmentId: appointment.id,
      kind: 'APPROVED',
      title: mail.subject,
      message,
      href: '/dg/appointments',
    });
  }
}

export async function notifyAppointmentApproved(
  appointment: AppointmentNotificationSource,
  options?: { reviewerId?: string | null }
) {
  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  const notifiedEmails = new Set<string>();

  if (requesterEmail) {
    await sendRequesterApprovedEmail(appointment, options);
    notifiedEmails.add(requesterEmail);
  }

  await sendParticipantConfirmationEmails(appointment);
  for (const participant of listParticipantRecipients(appointment)) {
    const email = participant.email.trim().toLowerCase();
    if (email && email !== requesterEmail) notifiedEmails.add(email);
  }

  const reviewer = await resolveActiveUserRecipient(options?.reviewerId);
  if (
    reviewer?.role === 'ASSISTANT' &&
    !notifiedEmails.has(reviewer.email.toLowerCase())
  ) {
    await sendAssistantApprovedEmail(appointment, reviewer);
    notifiedEmails.add(reviewer.email.toLowerCase());
  }

  const dg = await resolveDgRecipient();
  if (dg && !notifiedEmails.has(dg.email.toLowerCase())) {
    await sendDgApprovedEmail(appointment, dg);
  }

  await scheduleParticipantReminderEmails(appointment);
  await scheduleMeetingStartedEmails(appointment);
  await scheduleMeetingEndedEmails(appointment);
  triggerAppointmentRemindersDispatch();
}

const appointmentNotificationInclude = {
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
  participants: {
    select: { email: true, name: true, userId: true },
  },
} as const;

export async function loadAppointmentNotificationSource(
  appointmentId: string
): Promise<AppointmentNotificationSource | null> {
  if (isMockDataEnabled()) return null;

  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentNotificationInclude,
  });
}

async function notifyAssistantsInApp(
  appointmentId: string,
  title: string,
  assistants: { id: string; email: string }[]
) {
  for (const assistant of assistants) {
    if (isMockDataEnabled()) {
      mockCreateNotification({
        userId: assistant.id,
        appointmentId,
        kind: 'REQUEST_CREATED',
        title: 'Nouvelle demande de rendez-vous',
        message: `Demande en attente : ${title}`,
        href: '/appointments/review',
      });
      continue;
    }

    await prisma.notification.create({
      data: {
        userId: assistant.id,
        appointmentId,
        kind: 'REQUEST_CREATED',
        title: 'Nouvelle demande de rendez-vous',
        message: `Demande en attente : ${title}`,
        recipientEmail: assistant.email,
      },
    });
  }
}

/** E-mail au DGA lorsque l’assistante planifie un rendez-vous pour lui. */
export async function notifyDgOfAssistantPlanning(
  appointment: AppointmentNotificationSource,
  creatorRole?: string
): Promise<string | null> {
  const role = creatorRole ?? appointment.requestedBy.role;
  if (role !== 'ASSISTANT') return null;

  const dg = await resolveDgRecipient();
  const dgEmail = dg?.email?.trim();
  if (!dg || !dgEmail) return null;

  const creatorEmail = appointment.requestedBy.email.trim().toLowerCase();
  if (dgEmail.toLowerCase() === creatorEmail) return null;

  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Agenda DGA';
  const brand = await resolveBrandedMailAttachments();
  const ctx = withStaffCopy(
    withBranding(buildMailContext(appointment, dg.name, organizationName, 'invitee'), brand.logoUrl),
    appointment
  );
  const mail = buildDgPlannedAppointmentMail(ctx);
  const userId = await resolveNotificationUserId(dg, appointment.requestedById);

  await persistNotification({
    userId,
    appointmentId: appointment.id,
    kind: 'REQUEST_CREATED',
    title: mail.subject,
    message: `Rendez-vous prévu pour vous : ${appointment.title}`,
    recipientEmail: dgEmail,
    sendNow: true,
    html: mail.html,
    cc: staffMailboxCc(ctx.copyEmails, dgEmail),
    inlineAttachments: brand.inlineAttachments,
  });

  if (isMockDataEnabled() && dg.userId) {
    mockCreateNotification({
      userId: dg.userId,
      appointmentId: appointment.id,
      kind: 'REQUEST_CREATED',
      title: mail.subject,
      message: `Rendez-vous prévu pour vous : ${appointment.title}`,
      href: '/dg/appointments',
    });
  }

  return dgEmail.toLowerCase();
}

export async function notifyAppointmentRequested(
  appointmentId: string,
  fallbackTitle?: string,
  creatorRole?: string
) {
  if (isMockDataEnabled()) {
    const planned = mockGetAppointment(appointmentId);
    if (planned && (creatorRole === 'ASSISTANT' || planned.requestedBy.role === 'ASSISTANT')) {
      await notifyDgOfAssistantPlanning({
        id: planned.id,
        title: planned.title,
        description: planned.description,
        startAt: planned.startAt,
        endAt: planned.endAt,
        allDay: planned.allDay,
        location: planned.location,
        timezone: planned.timezone,
        reminderMinutesBefore: planned.reminderMinutesBefore,
        requestedById: planned.requestedById,
        teamsMeetingUrl: planned.teamsMeetingUrl,
        isOnlineMeeting: planned.isOnlineMeeting,
        requestedBy: {
          id: planned.requestedBy.id,
          firstName: planned.requestedBy.firstName,
          lastName: planned.requestedBy.lastName,
          email: planned.requestedBy.email,
          role: planned.requestedBy.role,
        },
        participants: planned.participants.map((participant) => ({
          email: participant.email,
          name: participant.name,
          userId: participant.userId,
        })),
      }, creatorRole).catch((err) => {
        console.error('[appointments] DGA planning mail failed:', err);
      });
    }

    const assistants = mockListUsers().filter((user) => user.role === 'ASSISTANT' && user.active);
    const assistantRows =
      assistants.length > 0
        ? assistants.map((a) => ({ id: a.id, email: a.email }))
        : [{ id: 'mock-assistant', email: 'assistante@organisation.local' }];

    const title = fallbackTitle?.trim() || 'Rendez-vous';
    await notifyAssistantsInApp(appointmentId, title, assistantRows);

    const settings = await getPlatformSettings();
    if (!settings.notifyNewAppointments) return;

    const brand = await resolveBrandedMailAttachments();
    const mail = buildAssistantNewRequestMail(
      withBranding(
        {
          organizationName: settings.organizationName || 'Agenda DGA',
          recipientName: 'Assistante',
          title,
          description: null,
          startAt: new Date(),
          endAt: new Date(),
          allDay: false,
          location: null,
          timezone: 'Africa/Conakry',
          requestedByName: 'Demandeur',
        },
        brand.logoUrl
      )
    );

    for (const assistant of assistantRows) {
      if (!assistant.email?.trim()) continue;
      await sendEmail({
        to: assistant.email.trim(),
        subject: mail.subject,
        html: mail.html,
        forceReal: true,
        inlineAttachments: brand.inlineAttachments,
      });
    }
    return;
  }

  const appointment = await loadAppointmentNotificationSource(appointmentId);
  if (!appointment) return;

  const assistants = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  await notifyAssistantsInApp(appointmentId, appointment.title, assistants);
  const dgPlannedEmail = await notifyDgOfAssistantPlanning(appointment, creatorRole).catch((err) => {
    console.error('[appointments] DGA planning mail failed:', err);
    return null;
  });
  await notifyRequesterAndInviteesInApp(appointment, new Set(assistants.map((row) => row.id)), {
    requesterTitle: 'Demande enregistrée',
    requesterMessage: `Votre demande « ${appointment.title} » a été transmise.`,
    inviteeTitle: 'Invitation à un rendez-vous',
    inviteeMessage: `Vous êtes invité à « ${appointment.title} ».`,
  });

  const settings = await getPlatformSettings();
  if (!settings.notifyNewAppointments) return;

  const organizationName = settings.organizationName || 'Agenda DGA';
  const brand = await resolveBrandedMailAttachments();
  const baseCtx = withBranding(buildMailContext(appointment, '', organizationName), brand.logoUrl);
  const staffCtx = withStaffCopy(baseCtx, appointment);

  await Promise.all(
    assistants.map(async (assistant) => {
      const email = assistant.email?.trim();
      if (!email) return;

      const recipientName = displayName(assistant.firstName, assistant.lastName) || 'Assistante';
      const mail = buildAssistantNewRequestMail({
        ...staffCtx,
        recipientName,
      });

      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        cc: staffMailboxCc(staffCtx.copyEmails, email),
        forceReal: true,
        inlineAttachments: brand.inlineAttachments,
      });
    })
  );

  const notifiedEmails = new Set(
    assistants.map((a) => a.email.trim().toLowerCase()).filter(Boolean)
  );
  if (dgPlannedEmail) notifiedEmails.add(dgPlannedEmail);

  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  if (requesterEmail && !notifiedEmails.has(requesterEmail)) {
    const recipientName = displayName(
      appointment.requestedBy.firstName,
      appointment.requestedBy.lastName
    );
    const mail = buildAppointmentRequestSubmittedMail({
      ...baseCtx,
      recipientName,
    });
    await sendEmail({
      to: appointment.requestedBy.email.trim(),
      subject: mail.subject,
      html: mail.html,
      forceReal: true,
      inlineAttachments: brand.inlineAttachments,
    });
    notifiedEmails.add(requesterEmail);
  }

  for (const participant of listParticipantRecipients(appointment)) {
    const key = participant.email.trim().toLowerCase();
    if (!key || key === requesterEmail) continue;

    const mail = buildAppointmentInvitePendingMail({
      ...baseCtx,
      recipientName: participant.name,
      audience: 'invitee',
    });
    await sendEmail({
      to: participant.email.trim(),
      subject: mail.subject,
      html: mail.html,
      forceReal: true,
      inlineAttachments: brand.inlineAttachments,
    });
  }
}

/** Demande encore en attente : le demandeur a modifié le rendez-vous. */
export async function notifyAppointmentRequestUpdated(
  appointmentId: string,
  previousParticipants: { email: string; name: string }[]
) {
  if (isMockDataEnabled()) return;

  const appointment = await loadAppointmentNotificationSource(appointmentId);
  if (!appointment) return;

  const assistantsForAudience = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true },
    select: { id: true },
  });
  const audienceAssistantIds = new Set(assistantsForAudience.map((row) => row.id));
  await notifyRequesterAndInviteesInApp(appointment, audienceAssistantIds, {
    requesterTitle: 'Demande mise à jour',
    requesterMessage: `Votre demande « ${appointment.title} » a été modifiée.`,
    inviteeTitle: 'Invitation mise à jour',
    inviteeMessage: `L'invitation à « ${appointment.title} » a été modifiée.`,
  });

  const requesterKey = appointment.requestedBy.email.trim().toLowerCase();
  const currentInvitees = new Set(
    listParticipantRecipients(appointment).map((participant) => participant.email.trim().toLowerCase())
  );
  for (const participant of previousParticipants) {
    const email = participant.email.trim();
    const key = email.toLowerCase();
    if (!key || key === requesterKey || currentInvitees.has(key)) continue;
    const userId = await resolveAccountUserId({ email, userId: null });
    if (!userId || audienceAssistantIds.has(userId) || userId === appointment.requestedById) continue;
    await createAudienceNotice({
      userId,
      appointmentId: appointment.id,
      title: 'Invitation retirée',
      message: `Vous n'êtes plus invité à « ${appointment.title} ».`,
      recipientEmail: email,
    });
  }

  const settings = await getPlatformSettings();
  if (!settings.notifyNewAppointments) return;

  const organizationName = settings.organizationName || 'Agenda DGA';
  const brand = await resolveBrandedMailAttachments();
  const ctx = withBranding(buildMailContext(appointment, '', organizationName), brand.logoUrl);
  const requesterEmail = appointment.requestedBy.email.trim().toLowerCase();
  const sent = new Set<string>();

  const send = async (to: string, subject: string, html: string, cc?: string[]) => {
    const key = to.trim().toLowerCase();
    if (!key || sent.has(key)) return;
    sent.add(key);
    await sendEmail({
      to: to.trim(),
      subject,
      html,
      cc,
      forceReal: true,
      inlineAttachments: brand.inlineAttachments,
    });
  };

  if (requesterEmail) {
    const recipientName = displayName(
      appointment.requestedBy.firstName,
      appointment.requestedBy.lastName
    );
    const mail = buildAppointmentRequestUpdatedMail({ ...ctx, recipientName });
    await send(appointment.requestedBy.email, mail.subject, mail.html);
  }

  const previousByEmail = new Map<string, string>();
  for (const participant of previousParticipants) {
    const key = participant.email.trim().toLowerCase();
    if (!key || key === requesterEmail) continue;
    previousByEmail.set(key, participant.name.trim() || participant.email.trim());
  }

  for (const participant of listParticipantRecipients(appointment)) {
    const key = participant.email.trim().toLowerCase();
    if (!key || key === requesterEmail || sent.has(key)) continue;
    const known = previousByEmail.has(key);
    const mail = known
      ? buildAppointmentInviteUpdatedMail({
          ...ctx,
          recipientName: participant.name,
          audience: 'invitee',
        })
      : buildAppointmentInvitePendingMail({
          ...ctx,
          recipientName: participant.name,
          audience: 'invitee',
        });
    await send(participant.email, mail.subject, mail.html);
  }

  for (const [email, name] of previousByEmail) {
    if (sent.has(email)) continue;
    const mail = buildAppointmentInviteWithdrawnMail({
      ...ctx,
      recipientName: name,
      audience: 'invitee',
    });
    await send(email, mail.subject, mail.html);
  }

  const assistants = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  for (const assistant of assistants) {
    const email = assistant.email?.trim();
    if (!email || sent.has(email.toLowerCase())) continue;

    await prisma.notification
      .create({
        data: {
          userId: assistant.id,
          appointmentId,
          kind: 'REQUEST_CREATED',
          title: 'Demande mise à jour',
          message: `Le demandeur a modifié : ${appointment.title}`,
          recipientEmail: email,
        },
      })
      .catch((err) => {
        console.error('[appointment-update] assistant notification failed:', err);
      });

    const staffCtx = withStaffCopy(ctx, appointment);
    const mail = buildAssistantRequestUpdatedMail({
      ...staffCtx,
      recipientName: displayName(assistant.firstName, assistant.lastName) || 'Assistante',
    });
    await send(email, mail.subject, mail.html, staffMailboxCc(staffCtx.copyEmails, email));
  }
}
