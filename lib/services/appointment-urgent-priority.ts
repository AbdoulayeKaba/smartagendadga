import type { AppointmentStatus, Priority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  applyPlanningUrgentMeta,
  clearPlanningUrgentMeta,
} from '@/lib/dg/urgent-slot-priority';
import {
  embedDescriptionWithMeta,
  parseAppointmentMeta,
} from '@/lib/dg/appointment-request-meta';
import {
  buildUrgentAppointmentMail,
  collectStaffCopyEmails,
  staffMailboxCc,
  type AppointmentMailContext,
} from '@/lib/emails/appointment-mail';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetAppointment } from '@/lib/mock/store';
import { notifyUser, writeAudit } from '@/lib/services/appointments';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import type { SmtpInlineAttachment } from '@/lib/services/smtp-mailer';

export type UrgentSlotSyncInput = {
  description: string | null;
  status: AppointmentStatus;
  title: string;
  urgentOverride: boolean;
};

export type UrgentSlotSyncResult = {
  description: string | null;
  priority?: Priority;
};

export function buildUrgentSlotSyncResult(input: UrgentSlotSyncInput): UrgentSlotSyncResult {
  const { meta, userText } = parseAppointmentMeta(input.description);
  const description = embedDescriptionWithMeta(
    userText,
    input.urgentOverride ? applyPlanningUrgentMeta(meta) : clearPlanningUrgentMeta(meta)
  );

  return {
    description,
    ...(input.status === 'PENDING' && input.urgentOverride ? { priority: 'HIGH' as const } : {}),
  };
}

function personName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

async function notifyAssistantsPlanningUrgent(appointmentId: string, title: string) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Agenda DGA';
  const logo = await resolveEmailInlineLogo();
  const inlineAttachments: SmtpInlineAttachment[] | undefined = logo
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

  if (isMockDataEnabled()) {
    const row = mockGetAppointment(appointmentId);
    const ctx: AppointmentMailContext = {
      organizationName,
      recipientName: 'DGA',
      title: row?.title ?? title,
      description: row?.description ?? null,
      startAt: row?.startAt ?? new Date(),
      endAt: row?.endAt ?? new Date(),
      allDay: row?.allDay ?? false,
      location: row?.location ?? null,
      timezone: row?.timezone ?? 'Africa/Conakry',
      requestedByName: row
        ? personName(row.requestedBy.firstName, row.requestedBy.lastName)
        : null,
      teamsMeetingUrl: row?.teamsMeetingUrl ?? null,
      isOnlineMeeting: row?.isOnlineMeeting ?? false,
      logoUrl,
      audience: 'invitee',
    };
    const mail = buildUrgentAppointmentMail(ctx, 'dg', {
      alreadyApproved: row?.status === 'APPROVED',
    });
    await notifyUser({
      userId: 'mock-dg',
      appointmentId,
      kind: 'REQUEST_CREATED',
      title: mail.subject,
      message: `Demande ultra urgente : « ${ctx.title} »`,
      email: 'dg@organisation.local',
      html: mail.html,
      inlineAttachments,
    });
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      requestedBy: { select: { firstName: true, lastName: true, email: true, role: true } },
      participants: { select: { email: true } },
    },
  });
  const copyEmails = appointment
    ? collectStaffCopyEmails({
        description: appointment.description,
        requestedByEmail: appointment.requestedBy.email,
        requestedByRole: appointment.requestedBy.role,
        participants: appointment.participants,
      })
    : [];
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ASSISTANT', 'DG'] }, active: true },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  for (const recipient of recipients) {
    const email = recipient.email?.trim();
    if (!email) continue;
    const audience = recipient.role === 'DG' ? 'dg' : 'assistant';
    const ctx: AppointmentMailContext = {
      organizationName,
      recipientName: personName(recipient.firstName, recipient.lastName) || (audience === 'dg' ? 'DGA' : 'Assistante'),
      title: appointment?.title ?? title,
      description: appointment?.description ?? null,
      startAt: appointment?.startAt ?? new Date(),
      endAt: appointment?.endAt ?? new Date(),
      allDay: appointment?.allDay ?? false,
      location: appointment?.location ?? null,
      timezone: appointment?.timezone ?? 'Africa/Conakry',
      requestedByName: appointment
        ? personName(appointment.requestedBy.firstName, appointment.requestedBy.lastName)
        : null,
      teamsMeetingUrl: appointment?.teamsMeetingUrl ?? null,
      isOnlineMeeting: appointment?.isOnlineMeeting ?? false,
      logoUrl,
      audience: audience === 'dg' ? 'invitee' : 'requester',
      copyEmails,
    };
    const mail = buildUrgentAppointmentMail(ctx, audience, {
      alreadyApproved: appointment?.status === 'APPROVED',
    });
    await notifyUser({
      userId: recipient.id,
      appointmentId,
      kind: 'REQUEST_CREATED',
      title: mail.subject,
      message: `Demande ultra urgente : « ${ctx.title} »`,
      email,
      cc: staffMailboxCc(copyEmails, email),
      html: mail.html,
      inlineAttachments,
    });
  }
}

export async function notifyPlanningUrgentIfNeeded(input: {
  appointmentId: string;
  title: string;
  status: AppointmentStatus;
  urgentOverride: boolean;
  wasUrgentOverride: boolean;
  actorId: string;
}) {
  if (!input.urgentOverride || input.wasUrgentOverride) return;
  if (input.status !== 'PENDING' && input.status !== 'APPROVED') return;

  await notifyAssistantsPlanningUrgent(input.appointmentId, input.title);
  await writeAudit(input.actorId, 'appointment.planning_urgent', input.appointmentId, {
    urgentOverride: true,
  });
}

export function mockAppointmentWithUrgentSync(
  current: NonNullable<ReturnType<typeof mockGetAppointment>>,
  urgentOverride: boolean
) {
  const sync = buildUrgentSlotSyncResult({
    description: current.description,
    status: current.status,
    title: current.title,
    urgentOverride,
  });

  return {
    ...current,
    urgentOverride,
    description: sync.description,
    priority: sync.priority ?? current.priority,
    updatedAt: new Date(),
  };
}
