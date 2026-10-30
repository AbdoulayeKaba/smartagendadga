import type { AppointmentStatus, NotificationKind, Priority, Prisma } from '@prisma/client';
import type { AppointmentListFilters } from '@/lib/dg/appointment-list-filters';
import { prisma } from '@/lib/prisma';
import { resolveInvolvement } from '@/lib/dg/appointment-involvement';
import { findConflicts, validateRange } from '@/lib/dg/scheduling';
import {
  effectiveAutoRejectBeforeStartMinutes,
  isPendingAppointmentExpired,
} from '@/lib/dg/appointment-expiry';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import { isApprovedAppointmentOngoing } from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_PAST_LOCKED_MESSAGE,
  isAppointmentSlotPast,
} from '@/lib/dg/appointment-reschedule-access';
import { cancelOutlookEvent, createOutlookEvent, updateOutlookEvent } from '@/lib/services/graph-calendar';
import { sendEmail } from '@/lib/services/email';
import type { SmtpInlineAttachment } from '@/lib/services/smtp-mailer';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockWriteAudit } from '@/lib/mock/audit';
import { mockCreateNotification } from '@/lib/mock/notifications-store';
import {
  mockApproveAppointment,
  mockArchiveAppointment,
  mockAssertNoConflict,
  mockCountArchivedAppointments,
  mockCreateAppointment,
  mockCancelOwnAppointment,
  mockDeleteAppointmentPermanent,
  mockEmptyAppointmentsTrash,
  mockEmptyOwnAppointmentsTrash,
  mockGetAppointmentById,
  mockGetAppointment,
  mockGetApprovedRanges,
  mockListAppointments,
  mockRejectAppointment,
  mockRestoreAppointment,
  mockUpdateAppointment,
} from '@/lib/mock/store';
import { incrementContactAppointmentCount } from '@/lib/services/workspace-service';
import {
  notifyAppointmentApproved,
  notifyAppointmentRequested,
  notifyAppointmentRequestUpdated,
  sendAppointmentRejectedEmail,
} from '@/lib/services/appointment-participant-notifications';
import { mailDescriptionForEmail } from '@/lib/emails/appointment-mail';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { normalizeScheduleSettings } from '@/lib/services/referentials-admin';
import { validateAppointmentRequest } from '@/lib/services/appointment-request-validation';
import { canCancelOwnAppointmentStatus } from '@/lib/dg/appointment-own-access';
import {
  buildUrgentSlotSyncResult,
  notifyPlanningUrgentIfNeeded,
} from '@/lib/services/appointment-urgent-priority';
import { parseDateTime } from '@/lib/dg/scheduling';
import type { DgRole } from '@/lib/dg/rbac';
import type { PreContactChoice, UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { appointmentToPlanningInitial, type AppointmentFormSource } from '@/lib/dg/appointment-planning';
import { ensureRequestedSlot, parseAppointmentMeta, preserveTracedSlot, traceSlotBeforeReschedule } from '@/lib/dg/appointment-request-meta';
import { assertApprovalSlotAvailable } from '@/lib/services/approval-slot-guard';
import { confirmRoomReservationsForAppointment } from '@/lib/services/room-reservations';

export async function getApprovedRanges(excludeId?: string) {
  if (isMockDataEnabled()) return mockGetApprovedRanges(excludeId);

  const rows = await prisma.appointment.findMany({
    where: { status: 'APPROVED', archived: false, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, startAt: true, endAt: true },
  });
  return rows;
}

export async function assertNoConflict(
  startAt: Date,
  endAt: Date,
  options?: { excludeId?: string; urgentOverride?: boolean; allDay?: boolean }
) {
  const bufferMs = 0;

  if (isMockDataEnabled()) return mockAssertNoConflict(startAt, endAt, options, bufferMs);

  const err = validateRange(startAt, endAt, { allowStartInPast: options?.allDay });
  if (err) return { ok: false as const, error: err };

  if (options?.urgentOverride) return { ok: true as const };

  const approved = await getApprovedRanges(options?.excludeId);
  const conflicts = findConflicts({ startAt, endAt }, approved, options?.excludeId, bufferMs);
  if (conflicts.length > 0) {
    return { ok: false as const, error: 'SCHEDULE_CONFLICT', conflicts };
  }
  return { ok: true as const };
}

export async function notifyUser(input: {
  userId: string;
  appointmentId?: string;
  kind: NotificationKind;
  title: string;
  message: string;
  email?: string;
  recipientEmail?: string;
  scheduledFor?: Date;
  html?: string;
  cc?: string[];
  inlineAttachments?: SmtpInlineAttachment[];
}) {
  if (isMockDataEnabled()) {
    const href =
      input.kind === 'REQUEST_CREATED'
        ? '/dg/appointments'
        : input.kind.startsWith('MISSION_')
          ? '/dg/workspace/missions'
          : input.kind.startsWith('MAIL_')
            ? '/dg/workspace/mail'
            : input.appointmentId
              ? '/appointments/mine'
              : null;
    mockCreateNotification({
      userId: input.userId,
      appointmentId: input.appointmentId,
      kind: input.kind,
      title: input.title,
      message: input.message,
      href: href ?? undefined,
    });
    const to = input.recipientEmail ?? input.email;
    if (to && !input.scheduledFor) {
      await sendEmail({
        to,
        subject: input.title,
        html: input.html ?? `<p>${input.message}</p>`,
        cc: input.cc,
        forceReal: true,
        inlineAttachments: input.inlineAttachments,
      });
    }
    return;
  }

  const to = input.recipientEmail ?? input.email;

  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      appointmentId: input.appointmentId,
      kind: input.kind,
      title: input.title,
      message: input.message,
      recipientEmail: to ?? null,
      scheduledFor: input.scheduledFor ?? null,
    },
  });

  if (to && !input.scheduledFor) {
    const sent = await sendEmail({
      to,
      subject: input.title,
      html: input.html ?? `<p>${input.message}</p>`,
      cc: input.cc,
      forceReal: true,
      inlineAttachments: input.inlineAttachments,
    });
    if (sent) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { emailSent: true, sentAt: new Date() },
      });
    }
  }
}

export async function notifyAssistantsNewRequest(
  appointmentId: string,
  title?: string,
  creatorRole?: string
) {
  await notifyAppointmentRequested(appointmentId, title, creatorRole);
}

export async function writeAudit(
  userId: string,
  action: string,
  appointmentId?: string,
  meta?: Prisma.InputJsonValue
) {
  if (isMockDataEnabled()) {
    const comments: string[] = [];
    if (meta && typeof meta === 'object' && meta !== null) {
      const m = meta as Record<string, unknown>;
      if (typeof m.reason === 'string') comments.push(m.reason);
      if (Array.isArray(m.violations)) {
        for (const v of m.violations) {
          if (v && typeof v === 'object' && 'message' in v && typeof (v as { message: string }).message === 'string') {
            comments.push((v as { message: string }).message);
          }
        }
      }
    }
    mockWriteAudit(userId, action, appointmentId, comments.length ? comments : undefined);
    return;
  }

  await prisma.auditLog.create({
    data: { userId, appointmentId, action, meta: meta ?? undefined },
  });
}

export async function approveAppointment(input: {
  appointmentId: string;
  reviewerId: string;
  startAt?: Date;
  endAt?: Date;
  urgentOverride?: boolean;
  isOnlineMeeting?: boolean;
}) {
  if (isMockDataEnabled()) {
    const pending = mockGetAppointment(input.appointmentId);
    if (pending && pending.status === 'PENDING') {
      const slotGuard = await assertApprovalSlotAvailable({
        excludeId: input.appointmentId,
        startAt: input.startAt ?? pending.startAt,
        endAt: input.endAt ?? pending.endAt,
      });
      if (!slotGuard.ok) {
        return { ok: false as const, error: 'SLOT_NO_LONGER_FREE' as const, message: slotGuard.message };
      }
    }
    const result = await mockApproveAppointment(input);
    if (result.ok && !('alreadyApproved' in result && result.alreadyApproved)) {
      await notifyAppointmentApproved(result.appointment, { reviewerId: input.reviewerId });
      if (result.appointment.strategicContactId) {
        await incrementContactAppointmentCount(
          result.appointment.strategicContactId,
          input.reviewerId
        );
      }
    }
    return result;
  }

  const current = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { participants: true, requestedBy: true },
  });
  if (!current) {
    return { ok: false as const, error: 'NOT_FOUND' };
  }
  if (current.status === 'APPROVED') {
    return { ok: true as const, appointment: current, alreadyApproved: true as const };
  }
  if (current.status !== 'PENDING') {
    return {
      ok: false as const,
      error: 'INVALID_STATE' as const,
      message:
        current.status === 'REJECTED'
          ? 'Cette demande a déjà été refusée.'
          : 'Cette demande ne peut plus être approuvée.',
    };
  }
  const [schedule, rules] = await Promise.all([
    getPlatformSettings().then((raw) => normalizeScheduleSettings(raw)),
    getAppointmentBusinessRules(),
  ]);
  const beforeStartMinutes = effectiveAutoRejectBeforeStartMinutes(
    schedule.autoRejectBeforeStartMinutes,
    rules.minSubmissionLead
  );
  if (
    isPendingAppointmentExpired(
      current.status,
      current.startAt,
      new Date(),
      beforeStartMinutes
    )
  ) {
    return { ok: false as const, error: 'SLOT_EXPIRED' };
  }

  const startAt = input.startAt ?? current.startAt;
  const endAt = input.endAt ?? current.endAt;

  const rangeError = validateRange(startAt, endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const slotGuard = await assertApprovalSlotAvailable({
    excludeId: current.id,
    startAt,
    endAt,
  });
  if (!slotGuard.ok) {
    return { ok: false as const, error: 'SLOT_NO_LONGER_FREE' as const, message: slotGuard.message };
  }

  const nextIsOnline =
    input.isOnlineMeeting !== undefined ? input.isOnlineMeeting : current.isOnlineMeeting;
  const nextLocation = nextIsOnline
    ? 'En ligne (Teams)'
    : current.location?.trim() === 'En ligne (Teams)'
      ? null
      : current.location;

  const participantEmails = current.participants.map((p) => p.email);
  const outlookResult = await createOutlookEvent({
    title: current.title,
    description: current.description,
    startAt,
    endAt,
    participantEmails,
    isOnlineMeeting: nextIsOnline,
  });

  const nextUrgentOverride = input.urgentOverride ?? current.urgentOverride;
  const slotChanged =
    startAt.getTime() !== current.startAt.getTime() || endAt.getTime() !== current.endAt.getTime();
  const tracedDescription = ensureRequestedSlot(current.description, {
    startAt: current.startAt,
    endAt: current.endAt,
  });
  const urgentSync = buildUrgentSlotSyncResult({
    description: slotChanged
      ? traceSlotBeforeReschedule(tracedDescription, {
          startAt: current.startAt,
          endAt: current.endAt,
        })
      : tracedDescription,
    status: current.status,
    title: current.title,
    urgentOverride: nextUrgentOverride,
  });

  const claimed = await prisma.appointment.updateMany({
    where: { id: current.id, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      startAt,
      endAt,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      outlookEventId: outlookResult?.eventId ?? null,
      isOnlineMeeting: nextIsOnline,
      location: nextLocation,
      teamsMeetingUrl: nextIsOnline ? outlookResult?.teamsJoinUrl ?? null : null,
      teamsMeetingId: nextIsOnline ? outlookResult?.teamsMeetingId ?? null : null,
      urgentOverride: nextUrgentOverride,
      description: urgentSync.description,
      ...(urgentSync.priority ? { priority: urgentSync.priority } : {}),
    },
  });
  if (claimed.count === 0) {
    const latest = await prisma.appointment.findUnique({ where: { id: current.id } });
    if (latest?.status === 'APPROVED') {
      return { ok: true as const, appointment: latest, alreadyApproved: true as const };
    }
    return {
      ok: false as const,
      error: 'INVALID_STATE' as const,
      message: 'Cette demande ne peut plus être approuvée.',
    };
  }
  const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: current.id } });

  await notifyPlanningUrgentIfNeeded({
    appointmentId: current.id,
    title: current.title,
    status: current.status,
    urgentOverride: nextUrgentOverride,
    wasUrgentOverride: current.urgentOverride,
    actorId: input.reviewerId,
  });

  const approvedAppointment = {
    ...current,
    startAt,
    endAt,
    status: 'APPROVED' as const,
    isOnlineMeeting: nextIsOnline,
    location: nextLocation,
    teamsMeetingUrl: outlookResult?.teamsJoinUrl ?? updated.teamsMeetingUrl ?? null,
    teamsMeetingId: outlookResult?.teamsMeetingId ?? updated.teamsMeetingId ?? null,
  };

  await notifyAppointmentApproved(approvedAppointment, { reviewerId: input.reviewerId }).catch((err) => {
    console.error('[appointment-approve] notification failed:', current.id, err);
  });

  const { meta } = parseAppointmentMeta(current.description);
  await confirmRoomReservationsForAppointment({
    appointmentId: current.id,
    reviewerId: input.reviewerId,
    roomReservationId: meta.roomReservationId ?? null,
  }).catch((err) => {
    console.error('[appointment-approve] room confirmation failed:', current.id, err);
  });

  await writeAudit(input.reviewerId, 'appointment.approve', current.id, {
    outlookEventId: outlookResult?.eventId ?? null,
    teamsMeetingUrl: outlookResult?.teamsJoinUrl ?? null,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  }).catch((err) => {
    console.error('[appointment-approve] audit failed:', current.id, err);
  });

  if (current.strategicContactId) {
    await incrementContactAppointmentCount(current.strategicContactId, input.reviewerId).catch(
      (err) => {
        console.error('[appointment-approve] contact count failed:', current.id, err);
      }
    );
  }

  return { ok: true as const, appointment: updated };
}

export async function rejectAppointment(input: {
  appointmentId: string;
  reviewerId: string;
  reason?: string;
}) {
  if (isMockDataEnabled()) return mockRejectAppointment(input);

  const current = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { requestedBy: true, participants: true },
  });
  if (!current || (current.status !== 'PENDING' && current.status !== 'APPROVED')) {
    return { ok: false as const, error: 'INVALID_STATE' };
  }
  if (isAppointmentSlotPast({ endAt: current.endAt })) {
    return {
      ok: false as const,
      error: 'APPOINTMENT_PAST' as const,
      message: APPOINTMENT_PAST_LOCKED_MESSAGE,
    };
  }

  if (current.outlookEventId) {
    await cancelOutlookEvent(current.outlookEventId).catch((err) => {
      console.error('[appointment-reject] outlook cancel failed:', current.id, err);
    });
  }

  const updated = await prisma.appointment.update({
    where: { id: current.id },
    data: {
      status: 'REJECTED',
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: input.reason ?? (current.status === 'APPROVED' ? 'Rendez-vous annulé' : 'Demande refusée'),
      outlookEventId: null,
      teamsMeetingUrl: null,
      teamsMeetingId: null,
    },
  });

  await sendAppointmentRejectedEmail(current, {
    reason:
      input.reason ??
      (current.status === 'APPROVED' ? 'Rendez-vous annulé' : 'Demande refusée'),
    autoRejected: false,
  });

  await writeAudit(input.reviewerId, 'appointment.reject', current.id, { reason: input.reason });

  return { ok: true as const, appointment: updated };
}

export async function listAppointmentsForAudience(input: {
  userId: string;
  email: string;
  status?: import('@prisma/client').AppointmentStatus;
  from?: Date;
  to?: Date;
  archived?: boolean;
}) {
  if (isMockDataEnabled()) {
    return mockListAppointments({
      archived: input.archived ?? false,
      status: input.status,
      from: input.from,
      to: input.to,
    }).filter(
      (row) =>
        resolveInvolvement({
          userId: input.userId,
          email: input.email,
          requestedById: row.requestedById,
          participants: row.participants,
        }) != null
    );
  }

  const email = input.email.trim();
  return prisma.appointment.findMany({
    where: {
      archived: input.archived ?? false,
      ...(input.status ? { status: input.status } : {}),
      ...(input.from ? { endAt: { gte: input.from } } : {}),
      ...(input.to ? { startAt: { lte: input.to } } : {}),
      OR: [
        { requestedById: input.userId },
        { participants: { some: { userId: input.userId } } },
        ...(email ? [{ participants: { some: { email } } }] : []),
      ],
    },
    select: { id: true, title: true, startAt: true, endAt: true, status: true },
    orderBy: { startAt: 'asc' },
  });
}

export type { AppointmentListFilters };

export async function listAppointments(filters: AppointmentListFilters = {}) {
  if (isMockDataEnabled()) return mockListAppointments(filters);

  return prisma.appointment.findMany({
    where: {
      archived: filters.archived ?? false,
      ...(filters.isOnlineMeeting ? { isOnlineMeeting: true } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
      ...(filters.slotOnly
        ? {
            ...(filters.from ? { startAt: { gte: filters.from } } : {}),
            ...(filters.to ? { startAt: { lte: filters.to } } : {}),
          }
        : filters.from || filters.to
          ? {
              OR: [
                {
                  AND: [
                    ...(filters.from ? [{ endAt: { gte: filters.from } }] : []),
                    ...(filters.to ? [{ startAt: { lte: filters.to } }] : []),
                  ],
                },
                {
                  AND: [
                    ...(filters.from ? [{ createdAt: { gte: filters.from } }] : []),
                    ...(filters.to ? [{ createdAt: { lte: filters.to } }] : []),
                  ],
                },
              ],
            }
          : {}),
    },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, department: true, role: true, active: true, createdAt: true, avatarUrl: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      participants: true,
    },
    orderBy: { startAt: 'asc' },
  });
}

/** Colonnes strictement utiles au cockpit : pas de description ni de participants. */
export async function listAppointmentsForDashboard(
  filters: Pick<AppointmentListFilters, 'from' | 'to' | 'archived'> = {}
) {
  if (isMockDataEnabled()) return mockListAppointments(filters);

  return prisma.appointment.findMany({
    where: {
      archived: filters.archived ?? false,
      ...(filters.from || filters.to
        ? {
            OR: [
              {
                AND: [
                  ...(filters.from ? [{ endAt: { gte: filters.from } }] : []),
                  ...(filters.to ? [{ startAt: { lte: filters.to } }] : []),
                ],
              },
              {
                AND: [
                  ...(filters.from ? [{ createdAt: { gte: filters.from } }] : []),
                  ...(filters.to ? [{ createdAt: { lte: filters.to } }] : []),
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      status: true,
      priority: true,
      urgentOverride: true,
      createdAt: true,
      reviewedAt: true,
      requestedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startAt: 'asc' },
  });
}

const appointmentReviewInclude = {
  requestedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      department: true,
      role: true,
      active: true,
      createdAt: true,
      avatarUrl: true,
    },
  },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
  participants: true,
} as const;

export async function getAppointmentById(id: string) {
  if (isMockDataEnabled()) return mockGetAppointment(id);
  return prisma.appointment.findUnique({
    where: { id },
    include: appointmentReviewInclude,
  });
}

export function priorityWeight(p: Priority) {
  if (p === 'HIGH') return 3;
  if (p === 'MEDIUM') return 2;
  return 1;
}

export async function archiveAppointment(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const ok = mockArchiveAppointment(id);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    mockWriteAudit(actorId, 'appointment.archive', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.archived) return { ok: false, error: 'ALREADY_ARCHIVED' };
  if (
    isApprovedAppointmentOngoing({
      status: current.status,
      startAt: current.startAt.toISOString(),
      endAt: current.endAt.toISOString(),
    })
  ) {
    return { ok: false, error: 'APPOINTMENT_ONGOING' };
  }

  await prisma.appointment.update({
    where: { id },
    data: { archived: true, archivedAt: new Date() },
  });
  await writeAudit(actorId, 'appointment.archive', id);
  return { ok: true };
}

export async function restoreAppointment(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const ok = mockRestoreAppointment(id);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    mockWriteAudit(actorId, 'appointment.restore', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (!current.archived) return { ok: false, error: 'NOT_ARCHIVED' };

  await prisma.appointment.update({
    where: { id },
    data: { archived: false, archivedAt: null },
  });
  await writeAudit(actorId, 'appointment.restore', id);
  return { ok: true };
}

export async function archiveOwnAppointment(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const row = mockGetAppointment(id);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    if (row.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
    if (!canCancelOwnAppointmentStatus(row.status)) {
      return { ok: false, error: 'INVALID_STATE' };
    }
    const ok = mockArchiveAppointment(id);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    mockWriteAudit(actorId, 'appointment.archive', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
  if (!canCancelOwnAppointmentStatus(current.status)) {
    return { ok: false, error: 'INVALID_STATE' };
  }

  return archiveAppointment(id, actorId);
}

export async function restoreOwnAppointment(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const row = mockGetAppointment(id);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    if (row.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
    const ok = mockRestoreAppointment(id);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    mockWriteAudit(actorId, 'appointment.restore', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };

  return restoreAppointment(id, actorId);
}

export async function deleteOwnAppointmentPermanent(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const row = mockGetAppointment(id);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    if (row.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
    const ok = mockDeleteAppointmentPermanent(id);
    if (!ok) return { ok: false, error: 'NOT_ARCHIVED' };
    mockWriteAudit(actorId, 'appointment.delete', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
  if (!current.archived) return { ok: false, error: 'NOT_ARCHIVED' };

  await prisma.appointment.delete({ where: { id } });
  await writeAudit(actorId, 'appointment.delete', id);
  return { ok: true };
}

export async function emptyOwnAppointmentsTrash(
  actorId: string
): Promise<{ purged: number }> {
  if (isMockDataEnabled()) {
    const purged = mockEmptyOwnAppointmentsTrash(actorId);
    if (purged > 0) mockWriteAudit(actorId, 'appointment.trash.empty', undefined, { purged });
    return { purged };
  }

  const result = await prisma.appointment.deleteMany({
    where: { archived: true, requestedById: actorId },
  });
  if (result.count > 0) {
    await writeAudit(actorId, 'appointment.trash.empty', undefined, { purged: result.count });
  }
  return { purged: result.count };
}

export async function cancelOwnAppointment(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const result = mockCancelOwnAppointment(id, actorId);
    if (!result.ok) return result;
    mockWriteAudit(actorId, 'appointment.cancel', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.requestedById !== actorId) return { ok: false, error: 'FORBIDDEN' };
  if (!canCancelOwnAppointmentStatus(current.status)) {
    return { ok: false, error: 'INVALID_STATE' };
  }

  await prisma.appointment.delete({ where: { id } });
  await writeAudit(actorId, 'appointment.cancel', id);
  return { ok: true };
}

export async function deleteAppointmentPermanent(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const ok = mockDeleteAppointmentPermanent(id);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    mockWriteAudit(actorId, 'appointment.delete', id);
    return { ok: true };
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (!current.archived) return { ok: false, error: 'NOT_ARCHIVED' };

  await prisma.appointment.delete({ where: { id } });
  await writeAudit(actorId, 'appointment.delete', id);
  return { ok: true };
}

export async function emptyAppointmentsTrash(
  actorId: string
): Promise<{ purged: number }> {
  if (isMockDataEnabled()) {
    const purged = mockEmptyAppointmentsTrash();
    if (purged > 0) mockWriteAudit(actorId, 'appointment.trash.empty', undefined, { purged });
    return { purged };
  }

  const result = await prisma.appointment.deleteMany({ where: { archived: true } });
  if (result.count > 0) {
    await writeAudit(actorId, 'appointment.trash.empty', undefined, { purged: result.count });
  }
  return { purged: result.count };
}

export async function countArchivedAppointments(): Promise<number> {
  if (isMockDataEnabled()) {
    return mockCountArchivedAppointments();
  }
  return prisma.appointment.count({ where: { archived: true } });
}

export async function getAppointmentRequesterContext(
  id: string
): Promise<{ requestedById: string; requesterRole: DgRole } | null> {
  const row = await getAppointmentForEdit(id);
  if (!row) return null;
  return {
    requestedById: row.requestedById,
    requesterRole: row.requestedBy.role as DgRole,
  };
}

export async function getAppointmentDeleteContext(
  id: string
): Promise<{ requestedById: string; status: import('@prisma/client').AppointmentStatus; archived: boolean } | null> {
  if (isMockDataEnabled()) {
    const row = mockGetAppointment(id);
    if (!row) return null;
    return {
      requestedById: row.requestedById,
      status: row.status,
      archived: Boolean(row.archived),
    };
  }

  return prisma.appointment.findUnique({
    where: { id },
    select: { requestedById: true, status: true, archived: true },
  });
}

export async function getAppointmentForEdit(id: string) {
  if (isMockDataEnabled()) return mockGetAppointmentById(id);

  return prisma.appointment.findFirst({
    where: { id, archived: false },
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          role: true,
          active: true,
          createdAt: true,
        },
      },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      participants: true,
    },
  });
}

export function appointmentRowToPlanningInitial(row: AppointmentFormSource & { id: string }) {
  return appointmentToPlanningInitial(row);
}

export type UpdateAppointmentInput = {
  id: string;
  actorId: string;
  actorRole: DgRole;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
  location?: string | null;
  reminderMinutesBefore?: number | null;
  priority: Priority;
  type: import('@prisma/client').AppointmentType;
  urgentOverride?: boolean;
  urgencyLevel: UrgencyLevel;
  justification?: string;
  preContact: PreContactChoice[];
  appointmentTypeRef?: string;
  locationRef?: string;
  motifRef?: string;
  roomReserved?: boolean;
  roomId?: string;
  roomName?: string;
  roomUsageType?: string;
  roomEquipment?: string[];
  roomReservationId?: string;
  strategicContactId?: string | null;
  isOnlineMeeting?: boolean;
  meetingFormat?: 'PRESENTIEL' | 'ONLINE' | 'HYBRID';
  requesterFullName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
  participants: { email: string; name: string; userId?: string; isExternal?: boolean }[];
};

export async function updateAppointment(input: UpdateAppointmentInput) {
  const current = await getAppointmentForEdit(input.id);
  if (!current) return { ok: false as const, error: 'NOT_FOUND' as const };
  if (current.status === 'REJECTED') return { ok: false as const, error: 'INVALID_STATE' as const };
  if (isAppointmentSlotPast({ endAt: current.endAt })) {
    return {
      ok: false as const,
      error: 'APPOINTMENT_PAST' as const,
      message: APPOINTMENT_PAST_LOCKED_MESSAGE,
    };
  }
  if (
    current.status === 'APPROVED' &&
    isApprovedAppointmentOngoing({
      status: 'APPROVED',
      startAt: current.startAt.toISOString(),
      endAt: current.endAt.toISOString(),
    })
  ) {
    return { ok: false as const, error: 'INVALID_STATE' as const };
  }

  const startAt = parseDateTime(input.date, input.startTime);
  const endAt = parseDateTime(input.date, input.endTime);

  const businessCheck = await validateAppointmentRequest({
    requestedById: current.requestedById,
    requesterRole: current.requestedBy.role as DgRole,
    title: input.title,
    description: input.description ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: input.allDay,
    excludeId: input.id,
    urgencyLevel: input.urgencyLevel,
    justification: input.justification,
    preContact: input.preContact,
    appointmentTypeRef: input.appointmentTypeRef,
    locationRef: input.locationRef,
    motifRef: input.motifRef,
    roomReserved: input.roomReserved,
    roomId: input.roomId,
    roomName: input.roomName,
    roomUsageType: input.roomUsageType,
    roomEquipment: input.roomEquipment,
    roomReservationId: input.roomReservationId,
    isOnlineMeeting: input.isOnlineMeeting,
    meetingFormat: input.meetingFormat,
    requesterFullName: input.requesterFullName,
    requesterPhone: input.requesterPhone,
    requesterEmail: input.requesterEmail,
  });

  const description = preserveTracedSlot(
    ensureRequestedSlot(businessCheck.description, {
      startAt: current.startAt,
      endAt: current.endAt,
    }),
    current.description
  );

  if (!businessCheck.ok) {
    return {
      ok: false as const,
      error: 'BUSINESS_RULE_VIOLATION' as const,
      violations: businessCheck.violations,
      warnings: businessCheck.warnings,
    };
  }

  const rangeError = validateRange(startAt, endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const requesterEmail = current.requestedBy.email.trim().toLowerCase();
  const participantCreates = [
    {
      email: current.requestedBy.email,
      name: `${current.requestedBy.firstName} ${current.requestedBy.lastName}`.trim(),
      userId: current.requestedById,
      isExternal: current.requestedBy.role === 'EXTERNAL',
    },
    ...input.participants
      .filter((p) => p.email.trim().toLowerCase() !== requesterEmail)
      .map((p) => ({
        email: p.email,
        name: p.name,
        userId: p.userId ?? null,
        isExternal: p.isExternal ?? false,
      })),
  ];

  if (isMockDataEnabled()) {
    const result = mockUpdateAppointment({
      id: input.id,
      title: input.title,
      description,
      startAt,
      endAt,
      priority: input.priority,
      type: input.type,
      urgentOverride: input.urgentOverride ?? false,
      location: input.location ?? null,
      timezone: input.timezone,
      allDay: input.allDay,
      reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      strategicContactId: input.strategicContactId ?? null,
      isOnlineMeeting: input.isOnlineMeeting ?? false,
      participants: input.participants,
    });
    if (!result.ok) return result;
    await writeAudit(input.actorId, 'appointment.update', input.id, {
      warnings: businessCheck.warnings,
    });
    return { ok: true as const, appointment: result.appointment, warnings: businessCheck.warnings };
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.participant.deleteMany({ where: { appointmentId: input.id } });
    return tx.appointment.update({
      where: { id: input.id },
      data: {
        title: input.title,
        description,
        startAt,
        endAt,
        priority: input.priority,
        type: input.type,
        urgentOverride: input.urgentOverride ?? false,
        location: input.location ?? null,
        timezone: input.timezone,
        allDay: input.allDay,
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
        strategicContactId: input.strategicContactId ?? null,
        isOnlineMeeting: input.isOnlineMeeting ?? false,
        participants: { create: participantCreates },
      },
      include: { participants: true, requestedBy: true },
    });
  });

  if (current.status === 'APPROVED' && current.outlookEventId) {
    await updateOutlookEvent({
      eventId: current.outlookEventId,
      title: input.title,
      description,
      startAt,
      endAt,
      participantEmails: updated.participants.map((p) => p.email),
      isOnlineMeeting: input.isOnlineMeeting ?? current.isOnlineMeeting,
    }).catch((err) => {
      console.error('[appointments] updateOutlookEvent failed:', err);
    });
  }

  await writeAudit(input.actorId, 'appointment.update', input.id, {
    warnings: businessCheck.warnings,
  });

  if (
    current.status === 'PENDING' &&
    pendingRequestFingerprint(current) !== pendingRequestFingerprint(updated)
  ) {
    await notifyAppointmentRequestUpdated(
      input.id,
      current.participants.map((participant) => ({
        email: participant.email,
        name: participant.name,
      }))
    ).catch((err) => {
      console.error('[appointments] pending update notification failed:', err);
    });
  }

  return { ok: true as const, appointment: updated, warnings: businessCheck.warnings };
}

function pendingRequestFingerprint(row: {
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  isOnlineMeeting: boolean;
  participants: { email: string }[];
}): string {
  const emails = row.participants
    .map((participant) => participant.email.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return [
    row.title.trim(),
    mailDescriptionForEmail(row.description) ?? '',
    row.startAt.getTime(),
    row.endAt.getTime(),
    row.allDay ? '1' : '0',
    row.location?.trim() ?? '',
    row.isOnlineMeeting ? '1' : '0',
    emails,
  ].join('\u001f');
}
