import { prisma } from '@/lib/prisma';
import {
  buildAppointmentReminderMail,
  buildAppointmentStartedMail,
  buildAppointmentEndedMail,
  collectStaffCopyEmails,
  staffMailboxCc,
  resolveAppointmentMailAudience,
} from '@/lib/emails/appointment-mail';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { shouldDispatchScheduledAppointmentMail } from '@/lib/dg/appointment-reminder-schedule';
import { sendEmail } from '@/lib/services/email';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { isMockDataEnabled } from '@/lib/mock/config';

const SCHEDULED_APPOINTMENT_KINDS = [
  'REMINDER_24H',
  'REMINDER_1H',
  'MEETING_STARTED',
  'MEETING_ENDED',
] as const;

function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** Supprime les e-mails planifiés non encore envoyés pour un rendez-vous (replanification). */
export async function clearPendingAppointmentReminders(appointmentId: string): Promise<void> {
  if (isMockDataEnabled()) return;
  await prisma.notification.deleteMany({
    where: {
      appointmentId,
      emailSent: false,
      kind: { in: [...SCHEDULED_APPOINTMENT_KINDS] },
    },
  });
}

/**
 * Envoie les rappels RDV et les notifications de démarrage dont l’échéance est atteinte.
 * Appelé par le cron et en opportunité lors des actions utilisateur (validation, consultation).
 */
export async function processDueAppointmentReminders(options?: {
  limit?: number;
  now?: Date;
}): Promise<{ processed: number; sent: number }> {
  if (isMockDataEnabled()) return { processed: 0, sent: 0 };

  const settings = await getPlatformSettings();
  if (!settings.notifyAppointmentReminders) {
    return { processed: 0, sent: 0 };
  }

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 50;
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['DG', 'ASSISTANT'] }, active: true },
    select: { email: true },
  });
  const staffEmails = new Set(
    staffUsers.map((user) => user.email.trim().toLowerCase()).filter(Boolean)
  );
  const envDg = process.env.DG_OUTLOOK_EMAIL?.trim().toLowerCase();
  if (envDg) staffEmails.add(envDg);
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const logo = await resolveEmailInlineLogo();
  const inlineAttachments = logo
    ? [
        {
          cid: logo.cid,
          content: logo.buffer,
          contentType: logo.mimeType,
          filename: logo.filename,
        },
      ]
    : undefined;
  const logoUrl = logo ? emailLogoCidSrc(logo.cid) : null;

  const due = await prisma.notification.findMany({
    where: {
      emailSent: false,
      scheduledFor: { lte: now },
      kind: { in: [...SCHEDULED_APPOINTMENT_KINDS] },
      appointment: {
        status: 'APPROVED',
        archived: false,
      },
    },
    include: {
      user: true,
      appointment: {
        include: {
          requestedBy: true,
          participants: true,
        },
      },
    },
    take: limit,
    orderBy: { scheduledFor: 'asc' },
  });

  let sent = 0;
  const dispatched = new Set<string>();
  for (const n of due) {
    const to = n.recipientEmail?.trim() || n.user.email?.trim();
    if (!to || !n.appointment || !n.scheduledFor) continue;

    if (n.kind === 'MEETING_STARTED' || n.kind === 'MEETING_ENDED') {
      const key = `${n.appointmentId}|${n.kind}|${to.toLowerCase()}`;
      const peers = await prisma.notification.findMany({
        where: { appointmentId: n.appointmentId, kind: n.kind },
        select: { id: true, recipientEmail: true, createdAt: true, emailSent: true },
        orderBy: { createdAt: 'asc' },
      });
      const sameRecipient = peers.filter(
        (row) => (row.recipientEmail?.trim().toLowerCase() || '') === to.toLowerCase()
      );
      const winner = sameRecipient[0];
      if (!winner || winner.id !== n.id || dispatched.has(key)) {
        await prisma.notification
          .update({
            where: { id: n.id },
            data: { emailSent: true, sentAt: new Date() },
          })
          .catch(() => undefined);
        continue;
      }
      dispatched.add(key);
    }

    if (
      !shouldDispatchScheduledAppointmentMail({
        kind: n.kind,
        now,
        startAt: n.appointment.startAt,
        endAt: n.appointment.endAt,
      })
    ) {
      await prisma.notification.delete({ where: { id: n.id } }).catch(() => undefined);
      continue;
    }

    const participant = n.appointment.participants.find(
      (p) => p.email.toLowerCase() === to.toLowerCase()
    );
    const stated = parseAppointmentMeta(n.appointment.description).meta;
    const statedEmail = stated.requesterEmail?.trim().toLowerCase() ?? '';
    const statedContact = [stated.requesterPhone?.trim(), stated.requesterEmail?.trim()]
      .filter(Boolean)
      .join(' · ');
    const recipientName =
      (statedEmail && to.toLowerCase() === statedEmail ? stated.requesterFullName?.trim() : '') ||
      participant?.name?.trim() ||
      (n.recipientEmail && n.recipientEmail !== n.user.email
        ? n.recipientEmail.split('@')[0] ?? 'Participant'
        : displayName(n.user.firstName, n.user.lastName));

    const isStaffRecipient = staffEmails.has(to.trim().toLowerCase());
    const isReminder = n.kind === 'REMINDER_24H' || n.kind === 'REMINDER_1H';
    const mailCtx = {
      organizationName,
      recipientName,
      title: n.appointment.title,
      description: n.appointment.description,
      startAt: n.appointment.startAt,
      endAt: n.appointment.endAt,
      allDay: n.appointment.allDay,
      location: n.appointment.location,
      timezone: n.appointment.timezone,
      requestedByName: displayName(
        n.appointment.requestedBy.firstName,
        n.appointment.requestedBy.lastName
      ),
      teamsMeetingUrl: n.appointment.teamsMeetingUrl,
      isOnlineMeeting: n.appointment.isOnlineMeeting,
      logoUrl,
      statedRequesterName: stated.requesterFullName?.trim() || null,
      statedRequesterContact: statedContact || null,
      copyEmails: isStaffRecipient
        ? collectStaffCopyEmails({
            description: n.appointment.description,
            requestedByEmail: n.appointment.requestedBy.email,
            requestedByRole: n.appointment.requestedBy.role,
            participants: n.appointment.participants,
          })
        : undefined,
      audience:
        (isReminder && isStaffRecipient) || (statedEmail && to.toLowerCase() === statedEmail)
          ? ('requester' as const)
          : resolveAppointmentMailAudience(n.appointment.requestedBy.email, to),
    };

    const forStaff = mailCtx.audience === 'invitee' && isStaffRecipient;
    const mail =
      n.kind === 'MEETING_STARTED'
        ? buildAppointmentStartedMail(mailCtx, { forStaff })
        : n.kind === 'MEETING_ENDED'
          ? buildAppointmentEndedMail(mailCtx, { forStaff })
          : buildAppointmentReminderMail(
              mailCtx,
              Math.max(
                1,
                Math.round((n.appointment.startAt.getTime() - n.scheduledFor.getTime()) / 60_000)
              ),
              { forStaff: isStaffRecipient }
            );

    const claimed = await prisma.notification.updateMany({
      where: { id: n.id, emailSent: false },
      data: { emailSent: true, sentAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const ok = await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      cc: isStaffRecipient ? staffMailboxCc(mailCtx.copyEmails, to) : undefined,
      forceReal: true,
      inlineAttachments,
    });
    if (ok) {
      sent++;
    } else {
      await prisma.notification
        .update({
          where: { id: n.id },
          data: { emailSent: false, sentAt: null },
        })
        .catch(() => undefined);
    }
  }

  return { processed: due.length, sent };
}

let reminderDispatchQueue: Promise<void> = Promise.resolve();

/** Déclenche l’envoi des rappels en arrière-plan sans bloquer la requête HTTP. */
export function triggerAppointmentRemindersDispatch(): void {
  reminderDispatchQueue = reminderDispatchQueue
    .catch(() => undefined)
    .then(async () => {
      const { enqueueMeetingLifecycleNotifications } = await import(
        '@/lib/services/appointment-participant-notifications'
      );
      await enqueueMeetingLifecycleNotifications();
      await processDueAppointmentReminders();
    })
    .catch((err) => {
      console.error('[appointment-reminders] dispatch failed:', err);
    });
}
