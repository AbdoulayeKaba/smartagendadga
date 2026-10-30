import type {
  AppointmentStatus,
  AppointmentType,
  Priority,
} from '@prisma/client';
import { mockFindUserByEmail, mockFindUserById, mockListUsers } from '@/lib/mock/users-store';
import { DG_BUFFER_MS, findConflicts, parseDateTime, validateRange } from '@/lib/dg/scheduling';
import type { AppointmentImportRow } from '@/lib/dg/appointment-excel-import';
import {
  effectiveAutoRejectBeforeStartMinutes,
  isPendingAppointmentExpired,
  resolveAutoRejectReason,
} from '@/lib/dg/appointment-expiry';
import { isMinSubmissionLeadWaivedByUrgency } from '@/lib/dg/appointment-business-rules';
import { APPOINTMENT_PAST_LOCKED_MESSAGE } from '@/lib/dg/appointment-reschedule-access';
import { mockGetAppointmentBusinessRules } from '@/lib/mock/appointment-business-rules-store';
import { mockGetPlatformSettings } from '@/lib/mock/settings';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';
import {
  buildImportedAppointmentDescription,
  embedDescriptionWithMeta,
  ensureRequestedSlot,
  parseAppointmentMeta,
  traceSlotBeforeReschedule,
} from '@/lib/dg/appointment-request-meta';
import type { AppointmentListFilters } from '@/lib/dg/appointment-list-filters';
import { appointmentMatchesTemporalRange } from '@/lib/dg/appointment-temporal-range';
import {
  DEMO_APPOINTMENT_RECORDS,
  buildDemoAppointmentDescription,
  demoAppointmentRejectionReason,
  resolveDemoAppointmentDates,
} from '@/lib/seed/appointments-demo-data';

function getMockAutoRejectBeforeStartMinutes() {
  const settings = mockGetPlatformSettings();
  return (
    settings.autoRejectBeforeStartMinutes ??
    DEFAULT_PLATFORM_CONFIG.autoRejectBeforeStartMinutes
  );
}

export type MockAppointmentRow = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priority: Priority;
  type: AppointmentType;
  requestedById: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  outlookEventId: string | null;
  isOnlineMeeting: boolean;
  teamsMeetingUrl: string | null;
  teamsMeetingId: string | null;
  urgentOverride: boolean;
  location: string | null;
  timezone: string;
  allDay: boolean;
  reminderMinutesBefore: number | null;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  archivedAt: Date | null;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    department: string | null;
    role: string;
    active: boolean;
    createdAt: string;
    avatarUrl: string | null;
  };
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  strategicContactId: string | null;
  participants: {
    id: string;
    email: string;
    name: string;
    userId: string | null;
    isExternal: boolean;
  }[];
};

let appointments: MockAppointmentRow[] = [];
let idSeq = 1;

const defaultPlanningMeta = {
  location: null as string | null,
  timezone: 'Africa/Conakry',
  allDay: false,
  reminderMinutesBefore: null as number | null,
  strategicContactId: null as string | null,
  isOnlineMeeting: false,
  teamsMeetingUrl: null as string | null,
  teamsMeetingId: null as string | null,
};

function nextId() {
  return `mock-appt-${idSeq++}`;
}

function userRef(userId: string) {
  const u = mockFindUserById(userId);
  if (!u) throw new Error(`Mock user ${userId} not found`);
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone ?? null,
    department: u.department,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
    avatarUrl: u.avatarUrl ?? null,
  };
}

function seedAppointments() {
  const assistant = mockFindUserByEmail('assistante@organisation.local');
  if (!assistant) return;

  appointments = DEMO_APPOINTMENT_RECORDS.map((row) => {
    const dates = resolveDemoAppointmentDates(row);
    const reviewed = Boolean(row.reviewed && row.status !== 'PENDING');

    return {
      id: row.id,
      title: row.title,
      description: buildDemoAppointmentDescription(row),
      startAt: dates.startAt,
      endAt: dates.endAt,
      status: row.status,
      priority: row.priority,
      type: row.type,
      requestedById: assistant.id,
      reviewedById: reviewed ? assistant.id : null,
      reviewedAt: reviewed ? dates.updatedAt : null,
      rejectionReason: demoAppointmentRejectionReason(row),
      outlookEventId: row.status === 'APPROVED' ? `mock-outlook-${row.id}` : null,
      urgentOverride: row.urgentOverride ?? false,
      location: row.location ?? null,
      timezone: 'Africa/Conakry',
      allDay: false,
      reminderMinutesBefore: null,
      strategicContactId: row.title.includes('Aissatou') ? 'ct-1' : null,
      isOnlineMeeting: false,
      teamsMeetingUrl: null,
      teamsMeetingId: null,
      createdAt: dates.createdAt,
      updatedAt: dates.updatedAt,
      archived: false,
      archivedAt: null,
      requestedBy: userRef(assistant.id),
      reviewedBy: reviewed
        ? {
            id: assistant.id,
            firstName: assistant.firstName,
            lastName: assistant.lastName,
          }
        : null,
      participants: [
        {
          id: `mock-part-${row.id}`,
          email: assistant.email,
          name: `${assistant.firstName} ${assistant.lastName}`,
          userId: assistant.id,
          isExternal: false,
        },
      ],
    };
  });

  idSeq = DEMO_APPOINTMENT_RECORDS.length + 1;
}

seedAppointments();

export function mockListAppointments(filters: AppointmentListFilters = {}) {
  return appointments
    .filter((a) => {
      const archived = filters.archived ?? false;
      if (a.archived !== archived) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.requestedById && a.requestedById !== filters.requestedById) return false;
      if (filters.isOnlineMeeting && !a.isOnlineMeeting) return false;
      if (!appointmentMatchesTemporalRange(a, filters.from, filters.to, { slotOnly: filters.slotOnly })) return false;
      return true;
    })
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function mockGetAppointment(id: string) {
  return appointments.find((a) => a.id === id) ?? null;
}

export function mockGetApprovedRanges(excludeId?: string) {
  return appointments
    .filter((a) => a.status === 'APPROVED' && !a.archived && a.id !== excludeId)
    .map((a) => ({ id: a.id, startAt: a.startAt, endAt: a.endAt }));
}

export function mockAssertNoConflict(
  startAt: Date,
  endAt: Date,
  options?: { excludeId?: string; urgentOverride?: boolean; allDay?: boolean },
  bufferMs?: number
) {
  const err = validateRange(startAt, endAt, { allowStartInPast: options?.allDay });
  if (err) return { ok: false as const, error: err };
  if (options?.urgentOverride) return { ok: true as const };

  const approved = mockGetApprovedRanges(options?.excludeId);
  const effectiveBuffer =
    bufferMs ?? mockGetPlatformSettings().bufferMinutes * 60 * 1000 ?? DG_BUFFER_MS;
  const conflicts = findConflicts({ startAt, endAt }, approved, options?.excludeId, effectiveBuffer);
  if (conflicts.length > 0) {
    return { ok: false as const, error: 'SCHEDULE_CONFLICT' as const, conflicts };
  }
  return { ok: true as const };
}

export function mockListAppointmentsByContact(contactId: string) {
  return appointments
    .filter((a) => a.strategicContactId === contactId && !a.archived)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      location: a.location,
    }));
}

export function mockCreateAppointment(input: {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  priority: Priority;
  type: AppointmentType;
  requestedById: string;
  urgentOverride?: boolean;
  location?: string | null;
  timezone?: string;
  allDay?: boolean;
  reminderMinutesBefore?: number | null;
  strategicContactId?: string | null;
  isOnlineMeeting?: boolean;
  participants?: { email: string; name: string; userId?: string; isExternal?: boolean }[];
}) {
  const now = new Date();
  const requestedBy = userRef(input.requestedById);
  const row: MockAppointmentRow = {
    id: nextId(),
    title: input.title,
    description: input.description ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    status: 'PENDING',
    priority: input.priority,
    type: input.type,
    requestedById: input.requestedById,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    outlookEventId: null,
    isOnlineMeeting: input.isOnlineMeeting ?? false,
    teamsMeetingUrl: null,
    teamsMeetingId: null,
    urgentOverride: input.urgentOverride ?? false,
    location: input.isOnlineMeeting ? 'En ligne (Teams)' : (input.location ?? null),
    timezone: input.timezone ?? 'Africa/Conakry',
    allDay: input.allDay ?? false,
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    strategicContactId: input.strategicContactId ?? null,
    createdAt: now,
    updatedAt: now,
    archived: false,
    archivedAt: null,
    requestedBy,
    reviewedBy: null,
    participants: [
      {
        id: `mock-part-${idSeq}`,
        email: requestedBy.email,
        name: `${requestedBy.firstName} ${requestedBy.lastName}`,
        userId: input.requestedById,
        isExternal: false,
      },
      ...(input.participants ?? []).map((p) => ({
        id: `mock-part-${++idSeq}`,
        email: p.email,
        name: p.name,
        userId: p.userId ?? null,
        isExternal: p.isExternal ?? true,
      })),
    ],
  };
  appointments.push(row);
  return row;
}

export function mockGetAppointmentById(id: string) {
  const row = appointments.find((a) => a.id === id && !a.archived);
  return row ?? null;
}

export function mockUpdateAppointment(input: {
  id: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  priority: Priority;
  type: AppointmentType;
  urgentOverride?: boolean;
  location?: string | null;
  timezone?: string;
  allDay?: boolean;
  reminderMinutesBefore?: number | null;
  strategicContactId?: string | null;
  isOnlineMeeting?: boolean;
  participants?: { email: string; name: string; userId?: string; isExternal?: boolean }[];
}) {
  const idx = appointments.findIndex((a) => a.id === input.id);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };
  const current = appointments[idx];
  if (current.status === 'REJECTED') return { ok: false as const, error: 'INVALID_STATE' as const };

  const rangeError = validateRange(input.startAt, input.endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const isOnlineMeeting = input.isOnlineMeeting ?? current.isOnlineMeeting;
  const requestedBy = userRef(current.requestedById);
  const updated: MockAppointmentRow = {
    ...current,
    title: input.title,
    description: input.description ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    priority: input.priority,
    type: input.type,
    urgentOverride: input.urgentOverride ?? false,
    location: isOnlineMeeting ? 'En ligne (Teams)' : (input.location ?? null),
    timezone: input.timezone ?? current.timezone,
    allDay: input.allDay ?? current.allDay,
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    strategicContactId: input.strategicContactId ?? null,
    isOnlineMeeting,
    updatedAt: new Date(),
    participants: [
      {
        id: `mock-part-${++idSeq}`,
        email: requestedBy.email,
        name: `${requestedBy.firstName} ${requestedBy.lastName}`,
        userId: current.requestedById,
        isExternal: false,
      },
      ...(input.participants ?? []).map((p) => ({
        id: `mock-part-${++idSeq}`,
        email: p.email,
        name: p.name,
        userId: p.userId ?? null,
        isExternal: p.isExternal ?? true,
      })),
    ],
  };
  appointments[idx] = updated;
  return { ok: true as const, appointment: updated };
}

export function mockApproveAppointment(input: {
  appointmentId: string;
  reviewerId: string;
  startAt?: Date;
  endAt?: Date;
  urgentOverride?: boolean;
  isOnlineMeeting?: boolean;
}) {
  const idx = appointments.findIndex((a) => a.id === input.appointmentId);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };
  const current = appointments[idx];
  if (current.status === 'APPROVED') {
    return { ok: true as const, appointment: current, alreadyApproved: true as const };
  }
  if (current.status !== 'PENDING') return { ok: false as const, error: 'INVALID_STATE' as const };

  const rules = mockGetAppointmentBusinessRules();
  const beforeStartMinutes = effectiveAutoRejectBeforeStartMinutes(
    getMockAutoRejectBeforeStartMinutes(),
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
    return { ok: false as const, error: 'SLOT_EXPIRED' as const };
  }

  const startAt = input.startAt ?? current.startAt;
  const endAt = input.endAt ?? current.endAt;
  const rangeError = validateRange(startAt, endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const reviewer = mockFindUserById(input.reviewerId);
  const nextUrgentOverride = input.urgentOverride ?? current.urgentOverride;
  const nextIsOnline = input.isOnlineMeeting ?? current.isOnlineMeeting;
  const slotMoved =
    startAt.getTime() !== current.startAt.getTime() || endAt.getTime() !== current.endAt.getTime();
  const tracedDescription = ensureRequestedSlot(current.description, {
    startAt: current.startAt,
    endAt: current.endAt,
  });
  const urgentSync = buildUrgentSlotSyncResult({
    description: slotMoved
      ? traceSlotBeforeReschedule(tracedDescription, {
          startAt: current.startAt,
          endAt: current.endAt,
        })
      : tracedDescription,
    status: current.status,
    title: current.title,
    urgentOverride: nextUrgentOverride,
  });
  const updated: MockAppointmentRow = {
    ...current,
    status: 'APPROVED',
    startAt,
    endAt,
    reviewedById: input.reviewerId,
    reviewedAt: new Date(),
    outlookEventId: `mock-outlook-${Date.now()}`,
    isOnlineMeeting: nextIsOnline,
    location: nextIsOnline
      ? 'En ligne (Teams)'
      : current.location?.trim() === 'En ligne (Teams)'
        ? null
        : current.location,
    teamsMeetingUrl: nextIsOnline
      ? `https://teams.microsoft.com/l/meetup-join/mock-${Date.now()}`
      : null,
    teamsMeetingId: nextIsOnline ? `mock-teams-${Date.now()}` : null,
    urgentOverride: nextUrgentOverride,
    description: urgentSync.description,
    priority: urgentSync.priority ?? current.priority,
    updatedAt: new Date(),
    reviewedBy: reviewer
      ? { id: reviewer.id, firstName: reviewer.firstName, lastName: reviewer.lastName }
      : null,
  };
  appointments[idx] = updated;
  return { ok: true as const, appointment: updated };
}

export function mockRejectAppointment(input: {
  appointmentId: string;
  reviewerId: string;
  reason?: string;
}) {
  const idx = appointments.findIndex((a) => a.id === input.appointmentId);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };
  const current = appointments[idx];
  if (current.status !== 'PENDING' && current.status !== 'APPROVED') {
    return { ok: false as const, error: 'INVALID_STATE' as const };
  }
  if (new Date(current.endAt).getTime() < Date.now()) {
    return {
      ok: false as const,
      error: 'APPOINTMENT_PAST' as const,
      message: APPOINTMENT_PAST_LOCKED_MESSAGE,
    };
  }

  const reviewer = mockFindUserById(input.reviewerId);
  const updated: MockAppointmentRow = {
    ...current,
    status: 'REJECTED',
    reviewedById: input.reviewerId,
    reviewedAt: new Date(),
    rejectionReason: input.reason ?? (current.status === 'APPROVED' ? 'Rendez-vous annulé' : 'Demande refusée'),
    outlookEventId: null,
    teamsMeetingUrl: null,
    teamsMeetingId: null,
    updatedAt: new Date(),
    reviewedBy: reviewer
      ? { id: reviewer.id, firstName: reviewer.firstName, lastName: reviewer.lastName }
      : null,
  };
  appointments[idx] = updated;
  return { ok: true as const, appointment: updated };
}

export function mockAutoRejectExpiredPendingAppointments(now = new Date()) {
  const rules = mockGetAppointmentBusinessRules();
  const beforeStartMinutes = effectiveAutoRejectBeforeStartMinutes(
    getMockAutoRejectBeforeStartMinutes(),
    rules.minSubmissionLead
  );
  const cutoff = new Date(now.getTime() + beforeStartMinutes * 60_000);
  if (beforeStartMinutes === 0) {
    for (let idx = 0; idx < appointments.length; idx += 1) {
      const current = appointments[idx];
      if (
        current.status !== 'REJECTED' ||
        current.archived ||
        current.startAt.getTime() <= now.getTime() ||
        !current.rejectionReason?.startsWith('Rejet automatique :')
      ) {
        continue;
      }
      const { meta, userText } = parseAppointmentMeta(current.description);
      appointments[idx] = {
        ...current,
        status: 'PENDING',
        description: embedDescriptionWithMeta(userText, {
          ...meta,
          autoRejected: false,
          autoRejectReason: undefined,
        }),
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        updatedAt: now,
        reviewedBy: null,
      };
    }
  }
  const actor =
    mockListUsers().find((user) => user.role === 'ASSISTANT') ??
    mockListUsers().find((user) => user.role === 'DG');
  const actorId = actor?.id ?? 'mock-assistant';
  const ids: string[] = [];

  for (let idx = 0; idx < appointments.length; idx += 1) {
    const current = appointments[idx];
    if (
      current.status !== 'PENDING' ||
      current.archived ||
      current.startAt.getTime() > cutoff.getTime()
    ) {
      continue;
    }

    const { meta, userText } = parseAppointmentMeta(current.description);
    const startPassed = now.getTime() >= current.startAt.getTime();
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
      current.startAt,
      now,
      beforeStartMinutes
    );
    const reviewer = mockFindUserById(actorId);
    const updated: MockAppointmentRow = {
      ...current,
      status: 'REJECTED',
      description: embedDescriptionWithMeta(userText, {
        ...meta,
        autoRejected: true,
        autoRejectReason: rejectionReason,
      }),
      reviewedById: actorId,
      reviewedAt: now,
      rejectionReason,
      updatedAt: now,
      reviewedBy: reviewer
        ? { id: reviewer.id, firstName: reviewer.firstName, lastName: reviewer.lastName }
        : null,
    };
    appointments[idx] = updated;
    ids.push(current.id);
  }

  return { rejected: ids.length, ids };
}

export function mockRescheduleAppointment(input: {
  appointmentId: string;
  startAt: Date;
  endAt: Date;
  urgentOverride?: boolean;
  isOnlineMeeting?: boolean;
  keepApproved?: boolean;
}) {
  const idx = appointments.findIndex((a) => a.id === input.appointmentId);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' as const };
  const current = appointments[idx];
  if (current.status === 'REJECTED') return { ok: false as const, error: 'INVALID_STATE' as const };

  const rangeError = validateRange(input.startAt, input.endAt, { allowStartInPast: true });
  if (rangeError) return { ok: false as const, error: rangeError };

  const nextUrgentOverride = input.urgentOverride ?? current.urgentOverride;
  const nextIsOnline = input.isOnlineMeeting ?? current.isOnlineMeeting;
  const slotMoved =
    input.startAt.getTime() !== current.startAt.getTime() ||
    input.endAt.getTime() !== current.endAt.getTime();
  const tracedDescription = ensureRequestedSlot(current.description, {
    startAt: current.startAt,
    endAt: current.endAt,
  });
  const urgentSync = buildUrgentSlotSyncResult({
    description: slotMoved
      ? traceSlotBeforeReschedule(tracedDescription, {
          startAt: current.startAt,
          endAt: current.endAt,
        })
      : tracedDescription,
    status: input.keepApproved ? 'APPROVED' : current.status === 'APPROVED' ? 'PENDING' : current.status,
    title: current.title,
    urgentOverride: nextUrgentOverride,
  });

  const releaseApproval = current.status === 'APPROVED' && !input.keepApproved;
  const confirmApproval = Boolean(input.keepApproved);
  const updated: MockAppointmentRow = {
    ...current,
    startAt: input.startAt,
    endAt: input.endAt,
    urgentOverride: nextUrgentOverride,
    description: urgentSync.description,
    priority: urgentSync.priority ?? current.priority,
    status: confirmApproval ? 'APPROVED' : releaseApproval ? 'PENDING' : current.status,
    reviewedById: confirmApproval ? current.reviewedById : releaseApproval ? null : current.reviewedById,
    reviewedAt: confirmApproval
      ? current.reviewedAt ?? new Date()
      : releaseApproval
        ? null
        : current.reviewedAt,
    reviewedBy: releaseApproval ? null : current.reviewedBy,
    isOnlineMeeting: nextIsOnline,
    location: nextIsOnline
      ? 'En ligne (Teams)'
      : current.location?.trim() === 'En ligne (Teams)'
        ? null
        : current.location,
    teamsMeetingUrl: releaseApproval ? null : nextIsOnline ? current.teamsMeetingUrl : null,
    teamsMeetingId: releaseApproval ? null : nextIsOnline ? current.teamsMeetingId : null,
    updatedAt: new Date(),
    outlookEventId: releaseApproval ? null : current.outlookEventId,
  };
  appointments[idx] = updated;
  return { ok: true as const, appointment: updated };
}

export function mockSetUrgent(appointmentId: string, urgentOverride: boolean) {
  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx < 0) return null;
  const current = appointments[idx];
  const urgentSync = buildUrgentSlotSyncResult({
    description: current.description,
    status: current.status,
    title: current.title,
    urgentOverride,
  });
  appointments[idx] = {
    ...current,
    urgentOverride,
    description: urgentSync.description,
    priority: urgentSync.priority ?? current.priority,
    updatedAt: new Date(),
  };
  return appointments[idx];
}

export function mockArchiveAppointment(id: string) {
  const idx = appointments.findIndex((a) => a.id === id);
  if (idx < 0) return false;
  appointments[idx] = {
    ...appointments[idx],
    archived: true,
    archivedAt: new Date(),
    updatedAt: new Date(),
  };
  return true;
}

export function mockRestoreAppointment(id: string) {
  const idx = appointments.findIndex((a) => a.id === id);
  if (idx < 0) return false;
  appointments[idx] = {
    ...appointments[idx],
    archived: false,
    archivedAt: null,
    updatedAt: new Date(),
  };
  return true;
}

export function mockDeleteAppointmentPermanent(id: string) {
  const idx = appointments.findIndex((a) => a.id === id);
  if (idx < 0) return false;
  if (!appointments[idx].archived) return false;
  appointments.splice(idx, 1);
  return true;
}

export function mockCancelOwnAppointment(id: string, actorId: string) {
  const idx = appointments.findIndex((a) => a.id === id);
  if (idx < 0) return { ok: false as const, error: 'NOT_FOUND' };
  const row = appointments[idx];
  if (row.requestedById !== actorId) return { ok: false as const, error: 'FORBIDDEN' };
  if (row.status !== 'PENDING' && row.status !== 'REJECTED') {
    return { ok: false as const, error: 'INVALID_STATE' };
  }
  appointments.splice(idx, 1);
  return { ok: true as const };
}

export function mockEmptyAppointmentsTrash() {
  const before = appointments.length;
  appointments = appointments.filter((a) => !a.archived);
  return before - appointments.length;
}

export function mockEmptyOwnAppointmentsTrash(actorId: string) {
  const before = appointments.length;
  appointments = appointments.filter((a) => !(a.archived && a.requestedById === actorId));
  return before - appointments.length;
}

export function mockCountArchivedAppointments() {
  return appointments.filter((a) => a.archived).length;
}

export function mockImportAppointments(rows: AppointmentImportRow[], actorId: string) {
  const reviewer = mockFindUserById(actorId);
  const errors: { line: number; message: string }[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const requester = mockFindUserByEmail(row.requesterEmail);
    if (!requester || !requester.active) {
      errors.push({
        line: row.line,
        message: `Demandeur introuvable : ${row.requesterEmail}`,
      });
      skipped += 1;
      continue;
    }

    const startAt = parseDateTime(row.date, row.startTime);
    const endAt = parseDateTime(row.date, row.endTime);
    const now = new Date();
    const reviewed = row.status !== 'PENDING';

    appointments.push({
      id: nextId(),
      title: row.title.slice(0, 191),
      description: buildImportedAppointmentDescription(row.description),
      startAt,
      endAt,
      status: row.status,
      priority: row.priority,
      type: row.type,
      requestedById: requester.id,
      reviewedById: reviewed ? actorId : null,
      reviewedAt: reviewed ? now : null,
      rejectionReason: null,
      outlookEventId: reviewed && row.status === 'APPROVED' ? `mock-outlook-import-${Date.now()}` : null,
      urgentOverride: false,
      location: row.location,
      timezone: 'Africa/Conakry',
      allDay: row.allDay,
      reminderMinutesBefore: null,
      strategicContactId: null,
      createdAt: now,
      updatedAt: now,
      archived: false,
      archivedAt: null,
      requestedBy: userRef(requester.id),
      reviewedBy:
        reviewed && reviewer
          ? { id: reviewer.id, firstName: reviewer.firstName, lastName: reviewer.lastName }
          : null,
      participants: [
        {
          id: `mock-part-${++idSeq}`,
          email: requester.email,
          name: `${requester.firstName} ${requester.lastName}`,
          userId: requester.id,
          isExternal: false,
        },
      ],
    });
    created += 1;
  }

  return { created, skipped, errors };
}
