import { prisma } from '@/lib/prisma';
import { notifyUser, writeAudit } from '@/lib/services/appointments';
import { ensureRequestedSlot, traceSlotBeforeReschedule } from '@/lib/dg/appointment-request-meta';
import { validateRange } from '@/lib/dg/scheduling';
import { assertApprovalSlotAvailable } from '@/lib/services/approval-slot-guard';
import { ONLINE_MEETING_LOCATION } from '@/lib/dg/appointment-planning';
import { cancelOutlookEvent, createOutlookEvent, updateOutlookEvent } from '@/lib/services/graph-calendar';
import {
  buildUrgentSlotSyncResult,
  notifyPlanningUrgentIfNeeded,
} from '@/lib/services/appointment-urgent-priority';
import {
  buildAppointmentRescheduledMail,
  collectStaffCopyEmails,
  staffMailboxCc,
  resolveAppointmentMailAudience,
} from '@/lib/emails/appointment-mail';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import {
  loadAppointmentNotificationSource,
  resolveDgRecipient,
  scheduleMeetingStartedEmails,
  scheduleMeetingEndedEmails,
} from '@/lib/services/appointment-participant-notifications';
import {
  emailLogoCidSrc,
  resolveEmailInlineLogo,
} from '@/lib/emails/email-inline-logo';
import { triggerAppointmentRemindersDispatch } from '@/lib/services/appointment-reminder-dispatch';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetAppointment, mockRescheduleAppointment } from '@/lib/mock/store';
import { sendEmail } from '@/lib/services/email';
import {
  APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE,
  isAppointmentSlotPast,
} from '@/lib/dg/appointment-reschedule-access';
import { resolveAccountUserId } from '@/lib/services/appointment-participant-notifications';

function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function sendRescheduleEmails(input: {
  staysApproved?: boolean;
  appointment: {
    id: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    location: string | null;
    timezone: string;
    teamsMeetingUrl: string | null;
    isOnlineMeeting?: boolean;
    requestedById: string;
    requestedBy: { firstName: string; lastName: string; email: string; role?: string };
    participants: { email: string; name: string; userId: string | null }[];
  };
}) {
  const settings = await getPlatformSettings();
  const organizationName = settings.organizationName || 'Direction Générale Adjointe';
  const { appointment } = input;
  const requestedByName = displayName(
    appointment.requestedBy.firstName,
    appointment.requestedBy.lastName
  );

  const buildCtx = (recipientName: string, recipientEmail: string) => ({
    organizationName,
    recipientName,
    title: appointment.title,
    description: appointment.description,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    allDay: appointment.allDay,
    location: appointment.location,
    timezone: appointment.timezone || 'Africa/Conakry',
    requestedByName,
    teamsMeetingUrl: appointment.teamsMeetingUrl,
    isOnlineMeeting: appointment.isOnlineMeeting ?? false,
    audience: resolveAppointmentMailAudience(appointment.requestedBy.email, recipientEmail),
  });

  const requesterIsStaff =
    appointment.requestedBy.role === 'ASSISTANT' || appointment.requestedBy.role === 'DG';
  const requesterCopy = requesterIsStaff
    ? collectStaffCopyEmails({
        description: appointment.description,
        requestedByEmail: appointment.requestedBy.email,
        requestedByRole: appointment.requestedBy.role,
        participants: appointment.participants,
      })
    : [];
  const requesterMail = buildAppointmentRescheduledMail(
    {
      ...buildCtx(requestedByName || appointment.requestedBy.email, appointment.requestedBy.email),
      copyEmails: requesterCopy,
    },
    { staysApproved: input.staysApproved, forDg: appointment.requestedBy.role === 'DG' }
  );

  await notifyUser({
    userId: appointment.requestedById,
    appointmentId: appointment.id,
    kind: 'RESCHEDULED',
    title: requesterMail.subject,
    message: input.staysApproved
      ? `« ${appointment.title} » a été déplacé au ${appointment.startAt.toLocaleString('fr-FR')}. Le rendez-vous reste validé.`
      : `« ${appointment.title} » a été reporté au ${appointment.startAt.toLocaleString('fr-FR')}. Le nouveau créneau est en attente de validation.`,
    email: appointment.requestedBy.email,
    cc: requesterIsStaff ? staffMailboxCc(requesterCopy, appointment.requestedBy.email) : undefined,
    html: requesterMail.html,
  });

  const seen = new Set([appointment.requestedBy.email.trim().toLowerCase()]);
  for (const participant of appointment.participants) {
    const email = participant.email.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const name = participant.name.trim() || email.split('@')[0] || 'Participant';
    const mail = buildAppointmentRescheduledMail(buildCtx(name, email), {
      staysApproved: input.staysApproved,
    });
    const userId = await resolveAccountUserId(participant);

    if (userId) {
      await notifyUser({
        userId,
        appointmentId: appointment.id,
        kind: 'RESCHEDULED',
        title: mail.subject,
        message: input.staysApproved
          ? `« ${appointment.title} » a été déplacé. Le rendez-vous reste validé.`
          : `« ${appointment.title} » a été reporté. Le nouveau créneau est en attente de validation.`,
        email,
        html: mail.html,
      });
    } else {
      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        forceReal: true,
      });
    }
  }

  await notifyDgOfReschedule({
    staysApproved: input.staysApproved,
    appointment,
    organizationName,
    requestedByName,
    alreadyNotified: seen,
  });
}

async function notifyDgOfReschedule(input: {
  staysApproved?: boolean;
  organizationName: string;
  requestedByName: string;
  alreadyNotified: Set<string>;
  appointment: {
    id: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    location: string | null;
    timezone: string;
    teamsMeetingUrl: string | null;
    isOnlineMeeting?: boolean;
    requestedById: string;
    requestedBy?: { email: string; role?: string };
    participants?: { email: string }[];
  };
}) {
  const dg = await resolveDgRecipient();
  const email = dg?.email?.trim();
  if (!dg || !email) return;
  if (input.alreadyNotified.has(email.toLowerCase())) return;

  const logo = await resolveEmailInlineLogo();
  const copyEmails = collectStaffCopyEmails({
    description: input.appointment.description,
    requestedByEmail: input.appointment.requestedBy?.email,
    requestedByRole: input.appointment.requestedBy?.role,
    participants: input.appointment.participants,
  });
  const mail = buildAppointmentRescheduledMail(
    {
      organizationName: input.organizationName,
      recipientName: dg.name,
      title: input.appointment.title,
      description: input.appointment.description,
      startAt: input.appointment.startAt,
      endAt: input.appointment.endAt,
      allDay: input.appointment.allDay,
      location: input.appointment.location,
      timezone: input.appointment.timezone || 'Africa/Conakry',
      requestedByName: input.requestedByName,
      teamsMeetingUrl: input.appointment.teamsMeetingUrl,
      isOnlineMeeting: input.appointment.isOnlineMeeting ?? false,
      logoUrl: logo ? emailLogoCidSrc(logo.cid) : null,
      audience: 'invitee',
      copyEmails,
    },
    { staysApproved: input.staysApproved, forDg: true }
  );

  const userId = dg.userId ?? input.appointment.requestedById;
  await notifyUser({
    userId,
    appointmentId: input.appointment.id,
    kind: 'RESCHEDULED',
    title: mail.subject,
    message: input.staysApproved
      ? `« ${input.appointment.title} » a été déplacé. Le rendez-vous reste validé.`
      : `« ${input.appointment.title} » a été replanifié. Le nouveau créneau est en attente de validation.`,
    email,
    cc: staffMailboxCc(copyEmails, email),
    html: mail.html,
    inlineAttachments: logo
      ? [
          {
            cid: logo.cid,
            content: logo.buffer,
            contentType: logo.mimeType,
            filename: logo.filename,
          },
        ]
      : undefined,
  });
}

export async function rescheduleAppointment(input: {
  appointmentId: string;
  actorId: string;
  startAt: Date;
  endAt: Date;
  urgentOverride?: boolean;
  isOnlineMeeting?: boolean;
  /** Déplacement sur l’agenda : un rendez-vous déjà approuvé le reste. */
  keepApproved?: boolean;
}) {
  if (isMockDataEnabled()) {
    const current = mockGetAppointment(input.appointmentId);
    if (!current) return { ok: false as const, error: 'NOT_FOUND' };
    if (isAppointmentSlotPast(current)) {
      return {
        ok: false as const,
        error: 'APPOINTMENT_NOT_RESCHEDULABLE' as const,
        message: APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE,
      };
    }
    if (current.status === 'APPROVED' && input.keepApproved) {
      const slotGuard = await assertApprovalSlotAvailable({
        excludeId: current.id,
        startAt: input.startAt,
        endAt: input.endAt,
      });
      if (!slotGuard.ok) {
        return { ok: false as const, error: 'SLOT_NO_LONGER_FREE' as const, message: slotGuard.message };
      }
    }
    const result = mockRescheduleAppointment({
      appointmentId: input.appointmentId,
      startAt: input.startAt,
      endAt: input.endAt,
      urgentOverride: input.urgentOverride,
      isOnlineMeeting: input.isOnlineMeeting,
      keepApproved: input.keepApproved,
    });
    if (!result.ok) return result;
    const mockSlotChanged =
      current.startAt.getTime() !== result.appointment.startAt.getTime() ||
      current.endAt.getTime() !== result.appointment.endAt.getTime();
    const mockModeChanged = current.isOnlineMeeting !== result.appointment.isOnlineMeeting;
    if (mockSlotChanged) {
      await sendRescheduleEmails({
        staysApproved: Boolean(input.keepApproved) && current.status === 'APPROVED',
        appointment: {
          id: result.appointment.id,
          title: result.appointment.title,
          description: result.appointment.description,
          startAt: result.appointment.startAt,
          endAt: result.appointment.endAt,
          allDay: result.appointment.allDay,
          location: result.appointment.location,
          timezone: result.appointment.timezone,
          teamsMeetingUrl: result.appointment.teamsMeetingUrl,
          requestedById: result.appointment.requestedById,
          requestedBy: result.appointment.requestedBy,
          participants: result.appointment.participants.map((p) => ({
            email: p.email,
            name: p.name,
            userId: p.userId,
          })),
        },
      });
    } else if (mockModeChanged) {
      await notifyDgOfReschedule({
        staysApproved: Boolean(input.keepApproved) && current.status === 'APPROVED',
        organizationName: 'Agenda DGA',
        requestedByName: displayName(
          result.appointment.requestedBy.firstName,
          result.appointment.requestedBy.lastName
        ),
        alreadyNotified: new Set(),
        appointment: {
          id: result.appointment.id,
          title: result.appointment.title,
          description: result.appointment.description,
          startAt: result.appointment.startAt,
          endAt: result.appointment.endAt,
          allDay: result.appointment.allDay,
          location: result.appointment.location,
          timezone: result.appointment.timezone,
          teamsMeetingUrl: result.appointment.teamsMeetingUrl,
          isOnlineMeeting: result.appointment.isOnlineMeeting,
          requestedById: result.appointment.requestedById,
        },
      });
    }
    await writeAudit(input.actorId, 'appointment.reschedule', current.id, {
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
      isOnlineMeeting: result.appointment.isOnlineMeeting,
    });
    return result;
  }

  const current = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { requestedBy: true, participants: true },
  });

  if (!current) return { ok: false as const, error: 'NOT_FOUND' };
  if (current.status === 'REJECTED') return { ok: false as const, error: 'INVALID_STATE' };
  if (isAppointmentSlotPast(current)) {
    return {
      ok: false as const,
      error: 'APPOINTMENT_NOT_RESCHEDULABLE' as const,
      message: APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE,
    };
  }

  const rangeError = validateRange(input.startAt, input.endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const nextIsOnline =
    input.isOnlineMeeting !== undefined ? input.isOnlineMeeting : current.isOnlineMeeting;
  const nextLocation = nextIsOnline
    ? ONLINE_MEETING_LOCATION
    : current.location?.trim() === ONLINE_MEETING_LOCATION
      ? null
      : current.location;

  const wasApproved = current.status === 'APPROVED';
  const resultApproved = Boolean(input.keepApproved);
  if (resultApproved) {
    const slotGuard = await assertApprovalSlotAvailable({
      excludeId: current.id,
      startAt: input.startAt,
      endAt: input.endAt,
    });
    if (!slotGuard.ok) {
      return { ok: false as const, error: 'SLOT_NO_LONGER_FREE' as const, message: slotGuard.message };
    }
  }
  const returnToPending = wasApproved && !resultApproved;
  let outlookEventId = returnToPending ? null : current.outlookEventId;
  let teamsMeetingUrl = returnToPending ? null : nextIsOnline ? current.teamsMeetingUrl : null;
  let teamsMeetingId = returnToPending ? null : nextIsOnline ? current.teamsMeetingId : null;

  if (resultApproved) {
    const participantEmails = current.participants.map((p) => p.email);
    const eventPayload = {
      title: current.title,
      description: current.description,
      startAt: input.startAt,
      endAt: input.endAt,
      participantEmails,
      isOnlineMeeting: nextIsOnline,
    };
    if (current.outlookEventId) {
      const updated = await updateOutlookEvent({
        eventId: current.outlookEventId,
        ...eventPayload,
      });
      if (updated) {
        outlookEventId = updated.eventId;
        if (nextIsOnline) {
          teamsMeetingUrl = updated.teamsJoinUrl ?? teamsMeetingUrl;
          teamsMeetingId = updated.teamsMeetingId ?? teamsMeetingId;
        }
      }
    } else {
      const created = await createOutlookEvent(eventPayload);
      if (created) {
        outlookEventId = created.eventId;
        teamsMeetingUrl = created.teamsJoinUrl ?? teamsMeetingUrl;
        teamsMeetingId = created.teamsMeetingId ?? teamsMeetingId;
      }
    }
  } else if (returnToPending && current.outlookEventId) {
    await cancelOutlookEvent(current.outlookEventId).catch((err) => {
      console.error('[appointment-reschedule] outlook cancel failed:', err);
    });
  }

  const nextUrgentOverride =
    input.urgentOverride !== undefined ? input.urgentOverride : current.urgentOverride;
  const slotChanged =
    current.startAt.getTime() !== input.startAt.getTime() ||
    current.endAt.getTime() !== input.endAt.getTime();
  const tracedDescription = ensureRequestedSlot(current.description, {
    startAt: current.startAt,
    endAt: current.endAt,
  });
  const nextStatus = resultApproved ? 'APPROVED' : returnToPending ? 'PENDING' : current.status;
  const urgentSync = buildUrgentSlotSyncResult({
    description: slotChanged
      ? traceSlotBeforeReschedule(tracedDescription, {
          startAt: current.startAt,
          endAt: current.endAt,
        })
      : tracedDescription,
    status: nextStatus,
    title: current.title,
    urgentOverride: nextUrgentOverride,
  });

  const row = await prisma.appointment.update({
    where: { id: current.id },
    data: {
      startAt: input.startAt,
      endAt: input.endAt,
      outlookEventId,
      isOnlineMeeting: nextIsOnline,
      location: nextLocation,
      teamsMeetingUrl,
      teamsMeetingId,
      urgentOverride: nextUrgentOverride,
      description: urgentSync.description,
      ...(urgentSync.priority ? { priority: urgentSync.priority } : {}),
      ...(resultApproved
        ? {
            status: 'APPROVED' as const,
            ...(wasApproved
              ? {}
              : { reviewedById: input.actorId, reviewedAt: new Date() }),
          }
        : returnToPending
          ? {
              status: 'PENDING' as const,
              reviewedById: null,
              reviewedAt: null,
            }
          : {}),
    },
    include: { requestedBy: true, participants: true },
  });

  await notifyPlanningUrgentIfNeeded({
    appointmentId: current.id,
    title: current.title,
    status: nextStatus,
    urgentOverride: nextUrgentOverride,
    wasUrgentOverride: current.urgentOverride,
    actorId: input.actorId,
  });

  if (slotChanged) {
    await sendRescheduleEmails({
      staysApproved: resultApproved,
      appointment: {
        id: row.id,
        title: row.title,
        description: row.description,
        startAt: row.startAt,
        endAt: row.endAt,
        allDay: row.allDay,
        location: row.location,
        timezone: row.timezone,
        teamsMeetingUrl: row.teamsMeetingUrl,
        isOnlineMeeting: row.isOnlineMeeting,
        requestedById: row.requestedById,
        requestedBy: row.requestedBy,
        participants: row.participants.map((p) => ({
          email: p.email,
          name: p.name,
          userId: p.userId,
        })),
      },
    }).catch((err) => {
      console.error('[appointment-reschedule] notification failed:', err);
    });
  } else if (nextIsOnline !== current.isOnlineMeeting) {
    const settings = await getPlatformSettings();
    await notifyDgOfReschedule({
      staysApproved: resultApproved,
      organizationName: settings.organizationName || 'Direction Générale Adjointe',
      requestedByName: displayName(row.requestedBy.firstName, row.requestedBy.lastName),
      alreadyNotified: new Set(),
      appointment: {
        id: row.id,
        title: row.title,
        description: row.description,
        startAt: row.startAt,
        endAt: row.endAt,
        allDay: row.allDay,
        location: row.location,
        timezone: row.timezone,
        teamsMeetingUrl: row.teamsMeetingUrl,
        isOnlineMeeting: row.isOnlineMeeting,
        requestedById: row.requestedById,
      },
    }).catch((err) => {
      console.error('[appointment-reschedule] DGA notification failed:', err);
    });
  }

  if (row.status === 'APPROVED') {
    const source = await loadAppointmentNotificationSource(row.id).catch((err) => {
      console.error('[appointment-reschedule] notification source failed:', err);
      return null;
    });
    if (source) {
      await scheduleMeetingStartedEmails(source).catch((err) => {
        console.error('[appointment-reschedule] meeting-started failed:', err);
      });
      await scheduleMeetingEndedEmails(source).catch((err) => {
        console.error('[appointment-reschedule] meeting-ended failed:', err);
      });
    }
    triggerAppointmentRemindersDispatch();
  }

  await writeAudit(input.actorId, 'appointment.reschedule', current.id, {
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
    urgentOverride: input.urgentOverride ?? current.urgentOverride,
    isOnlineMeeting: nextIsOnline,
  });

  return { ok: true as const, appointment: row };
}
