import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import type { PreContactChoice, UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { isApprovedAppointmentOngoing } from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_PAST_LOCKED_MESSAGE,
  isAppointmentSlotPast,
} from '@/lib/dg/appointment-reschedule-access';
import {
  archiveAppointment,
  appointmentRowToPlanningInitial,
  deleteAppointmentPermanent,
  getAppointmentForEdit,
  getAppointmentDeleteContext,
  restoreAppointment,
  updateAppointment,
} from '@/lib/services/appointments';

const archivePatchSchema = z.object({
  archived: z.boolean(),
});

const participantSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  userId: z.string().optional(),
  isExternal: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().min(3).max(191),
  description: z.string().max(2000).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  allDay: z.boolean().optional().default(false),
  timezone: z.string().min(2).max(64).optional().default('Africa/Conakry'),
  location: z.string().max(255).optional().nullable(),
  reminderMinutesBefore: z.number().int().min(0).max(10_080).optional().nullable(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'MINISTRY', 'PERSONAL']).default('INTERNAL'),
  urgentOverride: z.boolean().optional(),
  urgencyLevel: z.enum(['NORMAL', 'URGENT', 'TRES_URGENT', 'CRITIQUE']).optional().default('NORMAL'),
  justification: z.string().max(2000).optional(),
  preContact: z.array(z.enum(['chef_service', 'directeur', 'aucun'])).optional().default([]),
  appointmentTypeRef: z.string().max(64).optional(),
  locationRef: z.string().max(64).optional(),
  motifRef: z.string().max(64).optional(),
  roomReserved: z.boolean().optional(),
  roomId: z.string().max(64).optional(),
  roomName: z.string().max(255).optional(),
  roomUsageType: z.string().max(32).optional(),
  roomEquipment: z.array(z.string().max(64)).max(20).optional(),
  roomReservationId: z.string().max(64).optional(),
  participants: z.array(participantSchema).default([]),
  strategicContactId: z.string().min(1).optional(),
  isOnlineMeeting: z.boolean().optional().default(false),
  meetingFormat: z.enum(['PRESENTIEL', 'ONLINE', 'HYBRID']).optional(),
  requesterFullName: z.string().max(120).optional(),
  requesterPhone: z.string().max(32).optional(),
  requesterEmail: z.string().max(191).optional(),
});

async function canAccessAppointmentEdit(
  session: { userId: string; role: import('@prisma/client').Role },
  appointment: NonNullable<Awaited<ReturnType<typeof getAppointmentForEdit>>>
) {
  if (appointment.status === 'REJECTED') return false;
  if (isAppointmentSlotPast({ endAt: appointment.endAt })) return false;
  if (appointment.status === 'APPROVED') {
    const canReviewEdit =
      (await userHasPermission(session.role, 'appointments.review')) &&
      (await userHasPermission(session.role, 'action.appointments.edit'));
    if (!canReviewEdit) return false;
    return !isApprovedAppointmentOngoing({
      status: 'APPROVED',
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
    });
  }

  const ownsPendingRequest =
    appointment.requestedById === session.userId &&
    appointment.status === 'PENDING' &&
    (await userHasPermission(session.role, 'appointments.own.edit'));
  if (ownsPendingRequest) return true;

  if (await userHasPermission(session.role, 'appointments.review')) {
    return userHasPermission(session.role, 'action.appointments.edit');
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const row = await getAppointmentForEdit(id);
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (!(await canAccessAppointmentEdit(session, row))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  return NextResponse.json({
    initial: appointmentRowToPlanningInitial({
      id: row.id,
      requestedById: row.requestedById,
      title: row.title,
      description: row.description,
      startAt: row.startAt,
      endAt: row.endAt,
      priority: row.priority,
      type: row.type,
      allDay: row.allDay,
      timezone: row.timezone,
      location: row.location,
      reminderMinutesBefore: row.reminderMinutesBefore,
      strategicContactId: row.strategicContactId,
      urgentOverride: row.urgentOverride,
      isOnlineMeeting: row.isOnlineMeeting ?? false,
      participants: row.participants.map((p) => ({
        userId: p.userId,
        email: p.email,
        name: p.name,
        isExternal: p.isExternal,
      })),
    }),
    status: row.status,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;

    const { id } = await params;
    const json = await req.json().catch(() => null);

    if (json && typeof json === 'object' && 'archived' in json && json.title === undefined) {
    const archived = Boolean((json as { archived?: boolean }).archived);
    const parsed = archivePatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    const row = await getAppointmentDeleteContext(id);
    if (!row) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const canAdminArchive = await userHasPermission(
      session.role,
      archived ? 'action.appointments.archive' : 'action.appointments.restore'
    );

    let result: { ok: true } | { ok: false; error: string };
    if (canAdminArchive) {
      result = archived
        ? await archiveAppointment(id, session.userId)
        : await restoreAppointment(id, session.userId);
    } else {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (!result.ok) {
      const status =
        result.error === 'NOT_FOUND'
          ? 404
          : result.error === 'FORBIDDEN'
            ? 403
            : result.error === 'INVALID_STATE'
              ? 409
              : result.error === 'ALREADY_ARCHIVED' || result.error === 'NOT_ARCHIVED'
                ? 409
                : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  }

  const row = await getAppointmentForEdit(id);
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (!(await canAccessAppointmentEdit(session, row))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const result = await updateAppointment({
    id,
    actorId: session.userId,
    actorRole: session.role,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    allDay: parsed.data.allDay,
    timezone: parsed.data.timezone,
    location: parsed.data.location ?? null,
    reminderMinutesBefore: parsed.data.reminderMinutesBefore ?? null,
    priority: parsed.data.priority,
    type: parsed.data.type,
    urgentOverride: parsed.data.urgentOverride,
    urgencyLevel: (parsed.data.urgencyLevel ?? 'NORMAL') as UrgencyLevel,
    justification: parsed.data.justification,
    preContact: (parsed.data.preContact ?? []) as PreContactChoice[],
    appointmentTypeRef: parsed.data.appointmentTypeRef,
    locationRef: parsed.data.locationRef,
    motifRef: parsed.data.motifRef,
    roomReserved: parsed.data.roomReserved,
    roomId: parsed.data.roomId,
    roomName: parsed.data.roomName,
    roomUsageType: parsed.data.roomUsageType,
    roomEquipment: parsed.data.roomEquipment,
    roomReservationId: parsed.data.roomReservationId,
    strategicContactId: parsed.data.strategicContactId ?? null,
    isOnlineMeeting: parsed.data.isOnlineMeeting ?? false,
    meetingFormat: parsed.data.meetingFormat,
    requesterFullName: parsed.data.requesterFullName,
    requesterPhone: parsed.data.requesterPhone,
    requesterEmail: parsed.data.requesterEmail,
    participants: parsed.data.participants,
  });

  if (!result.ok) {
    if (result.error === 'BUSINESS_RULE_VIOLATION') {
      return NextResponse.json(
        {
          error: result.error,
          violations: result.violations,
          warnings: result.warnings,
        },
        { status: 422 }
      );
    }
    if (result.error === 'SCHEDULE_CONFLICT') {
      return NextResponse.json(
        { error: result.error, conflicts: 'conflicts' in result ? result.conflicts : undefined },
        { status: 409 }
      );
    }
    if (result.error === 'ROOM_CONFLICT') {
      return NextResponse.json(
        {
          error: result.error,
          message: 'message' in result ? result.message : undefined,
          conflict: 'conflict' in result ? result.conflict : undefined,
        },
        { status: 409 }
      );
    }
    const status =
      result.error === 'NOT_FOUND'
        ? 404
        : result.error === 'INVALID_STATE' || result.error === 'APPOINTMENT_PAST'
          ? 409
          : 400;
    return NextResponse.json(
      {
        error: result.error,
        message: 'message' in result ? result.message : undefined,
      },
      { status }
    );
  }

  return NextResponse.json({
    id,
    warnings: result.warnings,
  });
  } catch (e) {
    console.error('[PATCH /api/appointments/[id]]', e);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Erreur serveur lors de la mise à jour du rendez-vous.' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const row = await getAppointmentDeleteContext(id);
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const canAdminDelete = await userHasPermission(session.role, 'action.appointments.delete');

  if (canAdminDelete) {
    const result = await deleteAppointmentPermanent(id, session.userId);
    if (!result.ok) {
      const status =
        result.error === 'NOT_FOUND'
          ? 404
          : result.error === 'NOT_ARCHIVED'
            ? 409
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, mode: 'purge' });
  }

  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}
