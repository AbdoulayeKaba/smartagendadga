import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { parseDateTime } from '@/lib/dg/scheduling';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockCreateAppointment } from '@/lib/mock/store';
import type { PreContactChoice, UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { resolveFromToWithYear } from '@/lib/api/parse-year-filter';
import {
  listAppointments,
  notifyAssistantsNewRequest,
  writeAudit,
} from '@/lib/services/appointments';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { triggerAppointmentRemindersDispatch } from '@/lib/services/appointment-reminder-dispatch';
import { ensureRequestedSlot } from '@/lib/dg/appointment-request-meta';
import { validateAppointmentRequest } from '@/lib/services/appointment-request-validation';

const participantSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  userId: z.string().optional(),
  isExternal: z.boolean().optional(),
});

const createSchema = z.object({
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

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  const isOnlineMeeting = url.searchParams.get('isOnlineMeeting') === 'true';
  const { from, to } = resolveFromToWithYear(url);

  const filters: Parameters<typeof listAppointments>[0] = {
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(isOnlineMeeting ? { isOnlineMeeting: true } : {}),
  };

  if (session.role === 'MANAGER' || session.role === 'EXTERNAL') {
    if (!(await userHasPermission(session.role, 'appointments.view_own'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    filters.requestedById = session.userId;
  } else if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await autoRejectExpiredPendingAppointments();
  triggerAppointmentRemindersDispatch();

  const items = await listAppointments(filters);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.request'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const startAt = parseDateTime(parsed.data.date, parsed.data.startTime);
  const endAt = parseDateTime(parsed.data.date, parsed.data.endTime);

  const businessCheck = await validateAppointmentRequest({
    requestedById: session.userId,
    requesterRole: session.role,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    allDay: parsed.data.allDay,
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
    isOnlineMeeting: parsed.data.isOnlineMeeting ?? false,
    meetingFormat: parsed.data.meetingFormat,
    requesterFullName: parsed.data.requesterFullName,
    requesterPhone: parsed.data.requesterPhone,
    requesterEmail: parsed.data.requesterEmail,
  });

  if (!businessCheck.ok) {
    await writeAudit(session.userId, 'appointment.auto_block', undefined, {
      title: parsed.data.title,
      violations: businessCheck.violations,
    });
    return NextResponse.json(
      {
        error: 'BUSINESS_RULE_VIOLATION',
        violations: businessCheck.violations,
        warnings: businessCheck.warnings,
      },
      { status: 422 }
    );
  }

  const description = ensureRequestedSlot(businessCheck.description, { startAt, endAt });

  const row = isMockDataEnabled()
    ? mockCreateAppointment({
        title: parsed.data.title,
        description,
        startAt,
        endAt,
        priority: parsed.data.priority,
        type: parsed.data.type,
        requestedById: session.userId,
        urgentOverride: parsed.data.urgentOverride ?? false,
        location: parsed.data.location ?? null,
        timezone: parsed.data.timezone,
        allDay: parsed.data.allDay,
        reminderMinutesBefore: parsed.data.reminderMinutesBefore ?? null,
        strategicContactId: parsed.data.strategicContactId ?? null,
        isOnlineMeeting: parsed.data.isOnlineMeeting ?? false,
        participants: parsed.data.participants,
      })
    : await prisma.appointment.create({
        data: {
          title: parsed.data.title,
          description,
          startAt,
          endAt,
          status: 'PENDING',
          priority: parsed.data.priority,
          type: parsed.data.type,
          requestedById: session.userId,
          urgentOverride: parsed.data.urgentOverride ?? false,
          location: parsed.data.location ?? null,
          timezone: parsed.data.timezone,
          allDay: parsed.data.allDay,
          reminderMinutesBefore: parsed.data.reminderMinutesBefore ?? null,
          strategicContactId: parsed.data.strategicContactId ?? null,
          isOnlineMeeting: parsed.data.isOnlineMeeting ?? false,
          participants: {
            create: [
              {
                email: session.email,
                name: `${session.firstName} ${session.lastName}`,
                userId: session.userId,
                isExternal: session.role === 'EXTERNAL',
              },
              ...parsed.data.participants.map((p) => ({
                email: p.email,
                name: p.name,
                userId: p.userId ?? null,
                isExternal: p.isExternal ?? false,
              })),
            ],
          },
        },
        include: { participants: true },
      });

  await notifyAssistantsNewRequest(row.id, row.title, session.role).catch((err) => {
    console.error('[appointments] notifyAssistantsNewRequest failed:', err);
  });
  await writeAudit(session.userId, 'appointment.request', row.id, {
    priority: row.priority,
    warnings: businessCheck.warnings,
  });

  return NextResponse.json({
    id: row.id,
    warnings: businessCheck.warnings,
  }, { status: 201 });
}
