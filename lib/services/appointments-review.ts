import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import type { MockAppointmentRow } from '@/lib/mock/store';
import type {
  AppointmentReviewItem,
  AppointmentsReviewStats,
  AppointmentUrgencyFilter,
} from '@/lib/dg/appointments-review';
import {
  buildSlotTimeline,
  parseAppointmentMeta,
  type AppointmentSlotPoint,
} from '@/lib/dg/appointment-request-meta';
import { isMockDataEnabled } from '@/lib/mock/config';
import { prisma } from '@/lib/prisma';
import {
  isAutoRejectExpiredReason,
  isPendingAppointmentExpired,
} from '@/lib/dg/appointment-expiry';
import {
  effectiveUrgencyLevel,
  planningUrgentSortScore,
} from '@/lib/dg/urgent-slot-priority';
import { listAppointments, countArchivedAppointments, getAppointmentById } from '@/lib/services/appointments';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { triggerAppointmentRemindersDispatch } from '@/lib/services/appointment-reminder-dispatch';
import { listReferentialItems } from '@/lib/services/referentials-admin';

export type { AppointmentUrgencyFilter } from '@/lib/dg/appointments-review';

export type AppointmentsReviewFilters = {
  status?: AppointmentStatus | 'ALL';
  priority?: Priority | 'ALL';
  /** Normal = NON urgent ; Urgence = URGENT / TRES_URGENT / CRITIQUE / override. */
  urgency?: AppointmentUrgencyFilter;
  type?: AppointmentType | 'ALL';
  q?: string;
  from?: Date;
  to?: Date;
  slotOnly?: boolean;
  archived?: boolean;
  isOnlineMeeting?: boolean;
  requestedById?: string;
};

type Row = MockAppointmentRow | Awaited<ReturnType<typeof listAppointments>>[number];

async function recordedSlotsByAppointment(ids: string[]): Promise<Map<string, AppointmentSlotPoint[]>> {
  const map = new Map<string, AppointmentSlotPoint[]>();
  if (ids.length === 0 || isMockDataEnabled()) return map;
  const logs = await prisma.auditLog.findMany({
    where: {
      appointmentId: { in: ids },
      action: { in: ['appointment.reschedule', 'appointment.approve'] },
    },
    select: { appointmentId: true, meta: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const log of logs) {
    if (!log.appointmentId || !log.meta || typeof log.meta !== 'object' || Array.isArray(log.meta)) {
      continue;
    }
    const raw = log.meta as { startAt?: unknown; endAt?: unknown };
    if (typeof raw.startAt !== 'string' || typeof raw.endAt !== 'string') continue;
    const list = map.get(log.appointmentId) ?? [];
    list.push({ startAt: raw.startAt, endAt: raw.endAt });
    map.set(log.appointmentId, list);
  }
  return map;
}

function withSlotTimeline(
  item: AppointmentReviewItem,
  recorded?: AppointmentSlotPoint[]
): AppointmentReviewItem {
  return {
    ...item,
    slotTimeline: buildSlotTimeline({
      description: item.description,
      currentStart: item.startAt,
      currentEnd: item.endAt,
      recorded,
    }),
  };
}

function toIso(d: Date | string) {
  return d instanceof Date ? d.toISOString() : d;
}

function isAutoRejectedRow(row: Row, beforeStartMinutes?: number) {
  const { meta } = parseAppointmentMeta(row.description);
  return (
    Boolean(meta.autoRejected) ||
    isAutoRejectExpiredReason(row.rejectionReason) ||
    isPendingAppointmentExpired(row.status, row.startAt, new Date(), beforeStartMinutes)
  );
}

function serializeRow(row: Row): AppointmentReviewItem {
  const participants = 'participants' in row ? row.participants : [];
  const { meta } = parseAppointmentMeta(row.description);
  const autoRejected = isAutoRejectedRow(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: toIso(row.startAt),
    endAt: toIso(row.endAt),
    status: row.status,
    priority: row.priority,
    type: row.type,
    location: 'location' in row ? row.location ?? null : null,
    locationRef: meta.locationRef ?? null,
    motifRef: meta.motifRef ?? null,
    appointmentTypeRef: meta.appointmentTypeRef ?? null,
    locationLabel: null,
    motifLabel: null,
    appointmentTypeLabel: null,
    urgentOverride: row.urgentOverride,
    rejectionReason: row.rejectionReason,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    requestedBy: {
      ...row.requestedBy,
      avatarUrl:
        'avatarUrl' in row.requestedBy
          ? (row.requestedBy as { avatarUrl?: string | null }).avatarUrl ?? null
          : null,
    },
    reviewedBy: row.reviewedBy,
    participants: participants.map((p) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      isExternal: p.isExternal,
    })),
    businessScore: meta.businessScore ?? 0,
    urgencyLevel: effectiveUrgencyLevel(meta.urgencyLevel ?? 'NORMAL', row.urgentOverride),
    workflowSteps: meta.workflowSteps ?? [],
    autoRejected,
    importedFromExcel: Boolean(meta.excelImport),
    archived: 'archived' in row ? Boolean(row.archived) : false,
    archivedAt:
      'archivedAt' in row && row.archivedAt
        ? toIso(row.archivedAt as Date | string)
        : null,
    isOnlineMeeting: 'isOnlineMeeting' in row ? Boolean(row.isOnlineMeeting) : false,
    teamsMeetingUrl: 'teamsMeetingUrl' in row ? row.teamsMeetingUrl ?? null : null,
    roomReserved: Boolean(meta.roomReserved),
    reservedRoomName: meta.roomName?.trim() || null,
    roomReservationId: meta.roomReservationId?.trim() || null,
    requesterFullName: meta.requesterFullName?.trim() || null,
    requesterPhone: meta.requesterPhone?.trim() || null,
    requesterEmail: meta.requesterEmail?.trim() || null,
  };
}

function matchesSearch(row: Row, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.title,
    row.description ?? '',
    row.requestedBy.firstName,
    row.requestedBy.lastName,
    row.requestedBy.email,
    row.requestedBy.phone ?? '',
    row.requestedBy.department ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

function sortReviewItems(a: AppointmentReviewItem, b: AppointmentReviewItem) {
  const scoreDiff =
    planningUrgentSortScore({
      status: b.status,
      urgentOverride: b.urgentOverride,
      urgencyLevel: b.urgencyLevel,
      businessScore: b.businessScore,
    }) -
    planningUrgentSortScore({
      status: a.status,
      urgentOverride: a.urgentOverride,
      urgencyLevel: a.urgencyLevel,
      businessScore: a.businessScore,
    });
  if (scoreDiff !== 0) return scoreDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export async function listAppointmentsForReview(filters: AppointmentsReviewFilters = {}) {
  await autoRejectExpiredPendingAppointments();
  triggerAppointmentRemindersDispatch();

  const rangeFilters = {
    archived: filters.archived ?? false,
    ...(filters.isOnlineMeeting ? { isOnlineMeeting: true } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.slotOnly ? { slotOnly: true } : {}),
    ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
  };

  const [rows, trash] = await Promise.all([
    listAppointments(rangeFilters),
    filters.requestedById
      ? listAppointments({ archived: true, requestedById: filters.requestedById }).then(
          (archivedRows) => archivedRows.length
        )
      : countArchivedAppointments(),
  ]);

  const now = new Date();
  const stats: AppointmentsReviewStats = {
    total: rows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingHighPriority: 0,
    upcomingApproved: 0,
    priorityQueue: 0,
    urgentQueue: 0,
    blockedQueue: 0,
    autoRejectedCount: 0,
    trash: 0,
  };

  for (const row of rows) {
    const { meta } = parseAppointmentMeta(row.description);
    const score = meta.businessScore ?? 0;
    const urgent =
      meta.urgencyLevel === 'URGENT' ||
      meta.urgencyLevel === 'TRES_URGENT' ||
      meta.urgencyLevel === 'CRITIQUE' ||
      row.urgentOverride;

    if (row.status === 'PENDING') {
      stats.pending += 1;
      if (row.priority === 'HIGH') stats.pendingHighPriority += 1;
      if (urgent) stats.urgentQueue += 1;
      if (
        (meta.urgencyLevel === 'CRITIQUE' || meta.urgencyLevel === 'TRES_URGENT') &&
        !(meta.justification && meta.justification.length >= 50)
      ) {
        stats.blockedQueue += 1;
      }
    } else if (row.status === 'APPROVED') {
      stats.approved += 1;
      if (row.startAt >= now) stats.upcomingApproved += 1;
    } else if (row.status === 'REJECTED') {
      stats.rejected += 1;
      if (isAutoRejectedRow(row)) stats.autoRejectedCount += 1;
    }
  }

  stats.trash = trash;

  let filtered = rows.filter((row) => {
    if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) return false;
    if (filters.priority && filters.priority !== 'ALL' && row.priority !== filters.priority) return false;
    if (filters.urgency && filters.urgency !== 'ALL') {
      const { meta } = parseAppointmentMeta(row.description);
      const level = effectiveUrgencyLevel(meta.urgencyLevel ?? 'NORMAL', row.urgentOverride);
      const isUrgent = level !== 'NORMAL';
      if (filters.urgency === 'NORMAL' && isUrgent) return false;
      if (filters.urgency === 'URGENT' && !isUrgent) return false;
    }
    if (filters.type && filters.type !== 'ALL' && row.type !== filters.type) return false;
    if (filters.q && !matchesSearch(row, filters.q)) return false;
    return true;
  });

  const [rdvTypes, lieux, motifs] = await Promise.all([
    listReferentialItems('types-rdv', { archived: false }).catch(() => []),
    listReferentialItems('lieux', { archived: false }).catch(() => []),
    listReferentialItems('motifs', { archived: false }).catch(() => []),
  ]);
  const rdvTypeById = new Map(rdvTypes.map((item) => [item.id, item.name]));
  const lieuById = new Map(lieux.map((item) => [item.id, item.name]));
  const motifById = new Map(motifs.map((item) => [item.id, item.name]));

  const items = filtered
    .map((row) => {
      const item = serializeRow(row);
      return {
        ...item,
        appointmentTypeLabel: item.appointmentTypeRef
          ? rdvTypeById.get(item.appointmentTypeRef) ?? null
          : null,
        locationLabel: item.locationRef ? lieuById.get(item.locationRef) ?? null : null,
        motifLabel: item.motifRef ? motifById.get(item.motifRef) ?? null : null,
      };
    })
    .sort(sortReviewItems);

  const recorded = await recordedSlotsByAppointment(items.map((item) => item.id));
  return {
    items: items.map((item) => withSlotTimeline(item, recorded.get(item.id))),
    stats,
  };
}

export async function getAppointmentForReview(id: string): Promise<AppointmentReviewItem | null> {
  await autoRejectExpiredPendingAppointments();
  triggerAppointmentRemindersDispatch();
  const row = await getAppointmentById(id);
  if (!row) return null;

  const [rdvTypes, lieux, motifs] = await Promise.all([
    listReferentialItems('types-rdv', { archived: false }).catch(() => []),
    listReferentialItems('lieux', { archived: false }).catch(() => []),
    listReferentialItems('motifs', { archived: false }).catch(() => []),
  ]);
  const rdvTypeById = new Map(rdvTypes.map((item) => [item.id, item.name]));
  const lieuById = new Map(lieux.map((item) => [item.id, item.name]));
  const motifById = new Map(motifs.map((item) => [item.id, item.name]));

  const item = serializeRow(row);
  const recorded = await recordedSlotsByAppointment([item.id]);
  return withSlotTimeline(
    {
      ...item,
      appointmentTypeLabel: item.appointmentTypeRef
        ? rdvTypeById.get(item.appointmentTypeRef) ?? null
        : null,
      locationLabel: item.locationRef ? lieuById.get(item.locationRef) ?? null : null,
      motifLabel: item.motifRef ? motifById.get(item.motifRef) ?? null : null,
    },
    recorded.get(item.id)
  );
}
