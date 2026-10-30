import { prisma } from '@/lib/prisma';
import {
  effectiveAutoRejectBeforeStartMinutes,
  isAutoRejectExpiredReason,
  resolveAutoRejectReason,
} from '@/lib/dg/appointment-expiry';
import { isMinSubmissionLeadWaivedByUrgency } from '@/lib/dg/appointment-business-rules';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import {
  embedDescriptionWithMeta,
  parseAppointmentMeta,
} from '@/lib/dg/appointment-request-meta';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockListUsers } from '@/lib/mock/users-store';
import { mockAutoRejectExpiredPendingAppointments } from '@/lib/mock/store';
import { sendAppointmentRejectedEmail } from '@/lib/services/appointment-participant-notifications';
import { writeAudit } from '@/lib/services/appointments';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { normalizeScheduleSettings } from '@/lib/services/referentials-admin';

let cachedAutoRejectActorId: string | null = null;
let lastAutoRejectRunAt = 0;

/** Intervalle minimal entre deux auto-rejets déclenchés par les lectures API. */
export const AUTO_REJECT_READ_INTERVAL_MS = 60_000;

export type AutoRejectExpiredResult = {
  rejected: number;
  ids: string[];
};

async function resolveAutoRejectActorId(): Promise<string> {
  if (isMockDataEnabled()) {
    const assistant = mockListUsers().find((user) => user.role === 'ASSISTANT');
    return assistant?.id ?? 'mock-assistant';
  }

  if (cachedAutoRejectActorId) return cachedAutoRejectActorId;

  const actor = await prisma.user.findFirst({
    where: {
      role: { in: ['ASSISTANT', 'DG'] },
      active: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!actor) {
    throw new Error('AUTO_REJECT_ACTOR_NOT_FOUND');
  }
  cachedAutoRejectActorId = actor.id;
  return actor.id;
}

/** Passe en refusé les demandes PENDING non validées avant le début du créneau (délai référentiel). */
export async function autoRejectExpiredPendingAppointments(options?: {
  now?: Date;
  /** Ignore le throttle (cron, décision, mutation explicite). */
  force?: boolean;
}): Promise<AutoRejectExpiredResult> {
  const now = options?.now ?? new Date();

  if (!options?.force) {
    const elapsed = now.getTime() - lastAutoRejectRunAt;
    if (elapsed < AUTO_REJECT_READ_INTERVAL_MS) {
      return { rejected: 0, ids: [] };
    }
  }

  lastAutoRejectRunAt = now.getTime();

  if (isMockDataEnabled()) {
    return mockAutoRejectExpiredPendingAppointments(now);
  }

  const [schedule, rules] = await Promise.all([
    getPlatformSettings().then((raw) => normalizeScheduleSettings(raw)),
    getAppointmentBusinessRules(),
  ]);
  const beforeStartMinutes = effectiveAutoRejectBeforeStartMinutes(
    schedule.autoRejectBeforeStartMinutes,
    rules.minSubmissionLead
  );
  const cutoff = new Date(now.getTime() + beforeStartMinutes * 60_000);

  if (beforeStartMinutes === 0) {
    await restorePrematureAutoRejects(now);
  }

  const expired = await prisma.appointment.findMany({
    where: {
      status: 'PENDING',
      archived: false,
      startAt: { lte: cutoff },
    },
    include: {
      requestedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      participants: {
        select: { email: true, name: true, userId: true },
      },
    },
  });

  if (expired.length === 0) {
    return { rejected: 0, ids: [] };
  }

  const actorId = await resolveAutoRejectActorId();
  const ids: string[] = [];

  for (const row of expired) {
    const { meta, userText } = parseAppointmentMeta(row.description);
    const startPassed = now.getTime() >= row.startAt.getTime();
    if (
      !startPassed &&
      isMinSubmissionLeadWaivedByUrgency(
        rules.urgencyJustification,
        meta.urgencyLevel ?? 'NORMAL',
        meta.justification
      )
    ) {
      continue;
    }

    const rejectionReason = resolveAutoRejectReason(
      row.startAt,
      now,
      beforeStartMinutes
    );
    const description = embedDescriptionWithMeta(userText, {
      ...meta,
      autoRejected: true,
      autoRejectReason: rejectionReason,
    });

    await prisma.appointment.update({
      where: { id: row.id },
      data: {
        status: 'REJECTED',
        reviewedById: actorId,
        reviewedAt: now,
        rejectionReason,
        description,
      },
    });

    await sendAppointmentRejectedEmail(row, {
      reason: rejectionReason,
      autoRejected: true,
    });

    await writeAudit(actorId, 'appointment.auto_reject_expired', row.id, {
      reason: rejectionReason,
      startAt: row.startAt.toISOString(),
      beforeStartMinutes,
      auto: true,
    });

    ids.push(row.id);
  }

  return { rejected: ids.length, ids };
}

/** Remet en attente un rejet « N h avant le début » alors que le créneau n’a pas commencé. */
async function restorePrematureAutoRejects(now: Date) {
  const rows = await prisma.appointment.findMany({
    where: {
      status: 'REJECTED',
      archived: false,
      startAt: { gt: now },
      rejectionReason: { startsWith: 'Rejet automatique :' },
    },
    select: { id: true, description: true, startAt: true },
  });

  const actorId = await resolveAutoRejectActorId();

  for (const row of rows) {
    const { meta, userText } = parseAppointmentMeta(row.description);
    const description = embedDescriptionWithMeta(userText, {
      ...meta,
      autoRejected: false,
      autoRejectReason: undefined,
    });

    await prisma.appointment.update({
      where: { id: row.id },
      data: {
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        description,
      },
    });

    await writeAudit(actorId, 'appointment.auto_reject_restored', row.id, {
      startAt: row.startAt.toISOString(),
      reason: 'min_submission_lead_zero',
    });
  }
}

export { isAutoRejectExpiredReason };
