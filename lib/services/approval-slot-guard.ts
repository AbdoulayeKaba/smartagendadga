import { formatIsoDateInAppTz } from '@/lib/datetime/format';
import { describeApprovalSlotBlock } from '@/lib/dg/approval-slot-guard';
import { buildSchedulingBlockedRanges } from '@/lib/dg/appointment-scheduling-context';
import { getUnavailabilityMeta } from '@/lib/dg/referential-types';
import { DG_BUFFER_MS } from '@/lib/dg/scheduling';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockListAppointments } from '@/lib/mock/store';
import { prisma } from '@/lib/prisma';
import { listActiveUnavailabilities } from '@/lib/services/referentials-admin';
import { listWorkspaceMissions } from '@/lib/services/workspace-service';
import { isMissionBlockingApproval } from '@/lib/workspace/mission-visual-state';

export async function assertApprovalSlotAvailable(input: {
  excludeId: string;
  startAt: Date;
  endAt: Date;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const windowStart = new Date(input.startAt.getTime() - DG_BUFFER_MS);
  const windowEnd = new Date(input.endAt.getTime() + DG_BUFFER_MS);

  const [appointments, missions, unavailabilityItems] = await Promise.all([
    loadApprovedAppointments(input.excludeId, windowStart, windowEnd),
    listWorkspaceMissions({ archived: false }).catch(() => []),
    listActiveUnavailabilities().catch(() => []),
  ]);

  const unavailabilities = unavailabilityItems
    .map((item) => getUnavailabilityMeta(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const message = describeApprovalSlotBlock({
    startAt: input.startAt,
    endAt: input.endAt,
    dateKey: formatIsoDateInAppTz(input.startAt),
    appointments,
    blockedRanges: buildSchedulingBlockedRanges({
      unavailabilities,
      missions: missions.filter((mission) => isMissionBlockingApproval(mission)),
    }),
  });

  if (message) return { ok: false, message };
  return { ok: true };
}

async function loadApprovedAppointments(excludeId: string, from: Date, to: Date) {
  if (isMockDataEnabled()) {
    return mockListAppointments({ status: 'APPROVED' })
      .filter((item) => item.id !== excludeId && item.startAt < to && item.endAt > from)
      .map((item) => ({
        id: item.id,
        title: item.title,
        startAt: item.startAt,
        endAt: item.endAt,
      }));
  }

  return prisma.appointment.findMany({
    where: {
      status: 'APPROVED',
      archived: false,
      id: { not: excludeId },
      startAt: { lt: to },
      endAt: { gt: from },
    },
    select: { id: true, title: true, startAt: true, endAt: true },
  });
}
