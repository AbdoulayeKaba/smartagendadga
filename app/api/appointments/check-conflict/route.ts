import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import {
  APPOINTMENT_POLICY_MESSAGES,
  validateAppointmentAgainstPolicy,
} from '@/lib/dg/scheduling-policy';
import { parseDateTime } from '@/lib/dg/scheduling';
import { describeApprovalSlotMargin } from '@/lib/dg/approval-slot-guard';
import { getUnavailabilityMeta } from '@/lib/dg/referential-types';
import {
  isSameDayOpenByJustifiedUrgency,
  type PreContactChoice,
  type UrgencyLevel,
} from '@/lib/dg/appointment-business-rules';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import { getAppointmentRequesterContext } from '@/lib/services/appointments';
import { validateAppointmentRequest } from '@/lib/services/appointment-request-validation';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
} from '@/lib/services/referentials-admin';
import { getPlatformSettings } from '@/lib/services/platform-settings';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  allDay: z.boolean().optional().default(false),
  excludeId: z.string().optional(),
  urgentOverride: z.boolean().optional(),
  urgencyLevel: z.enum(['NORMAL', 'URGENT', 'TRES_URGENT', 'CRITIQUE']).optional(),
  justification: z.string().optional(),
  preContact: z.array(z.enum(['chef_service', 'directeur', 'aucun'])).optional(),
  appointmentTypeRef: z.string().max(64).optional(),
  locationRef: z.string().max(64).optional(),
  motifRef: z.string().max(64).optional(),
  location: z.string().max(255).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  isOnlineMeeting: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const startAt = parseDateTime(parsed.data.date, parsed.data.startTime);
  const endAt = parseDateTime(parsed.data.date, parsed.data.endTime);
  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);

  const config = await getPlatformSettings();
  const holidays = await listActiveHolidays();
  const unavailabilities = (await listActiveUnavailabilities())
    .map((i) => getUnavailabilityMeta(i))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const { listAppointments } = await import('@/lib/services/appointments');
  const dayStart = new Date(`${parsed.data.date}T00:00:00`);
  const dayEnd = new Date(`${parsed.data.date}T23:59:59`);
  const approvedDay = await listAppointments({ from: dayStart, to: dayEnd, status: 'APPROVED' });
  const appointmentsOnDay = parsed.data.excludeId
    ? approvedDay.filter((a) => a.id !== parsed.data.excludeId).length
    : approvedDay.length;

  const d = new Date(`${parsed.data.date}T12:00:00`);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  const approvedWeek = await listAppointments({ from: mon, to: sun, status: 'APPROVED' });
  const appointmentsOnWeek = parsed.data.excludeId
    ? approvedWeek.filter((a) => a.id !== parsed.data.excludeId).length
    : approvedWeek.length;

  const businessRules = await getAppointmentBusinessRules();
  const policyViolation = validateAppointmentAgainstPolicy({
    config,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    durationMinutes,
    appointmentsOnDay,
    appointmentsOnWeek,
    holidays,
    unavailabilities,
    allDay: parsed.data.allDay,
    isOnlineMeeting: parsed.data.isOnlineMeeting,
    ignoreDateBlocks: isSameDayOpenByJustifiedUrgency(
      businessRules.urgencyJustification,
      (parsed.data.urgencyLevel ?? 'NORMAL') as UrgencyLevel,
      parsed.data.justification,
      parsed.data.date
    ),
  });

  if (policyViolation) {
    return NextResponse.json({
      available: false,
      error: policyViolation,
      message: APPOINTMENT_POLICY_MESSAGES[policyViolation],
      conflicts: [],
    });
  }

  if (parsed.data.title) {
    let requestedById = session.userId;
    let requesterRole = session.role;
    if (parsed.data.excludeId) {
      const ctx = await getAppointmentRequesterContext(parsed.data.excludeId);
      if (ctx) {
        requestedById = ctx.requestedById;
        requesterRole = ctx.requesterRole;
      }
    }

    const business = await validateAppointmentRequest(
      {
        requestedById,
        requesterRole,
        title: parsed.data.title,
        description: parsed.data.description,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        allDay: parsed.data.allDay,
        excludeId: parsed.data.excludeId,
        urgencyLevel: (parsed.data.urgencyLevel ?? 'NORMAL') as UrgencyLevel,
        justification: parsed.data.justification,
        preContact: (parsed.data.preContact ?? []) as PreContactChoice[],
        appointmentTypeRef: parsed.data.appointmentTypeRef,
        locationRef: parsed.data.locationRef,
        motifRef: parsed.data.motifRef,
        isOnlineMeeting: parsed.data.isOnlineMeeting,
      },
      { skipSlotPolicy: true }
    );
    const blocking = business.violations.filter(
      (v) => v.blocking && v.code !== 'REQUESTER_CONTACT'
    );
    if (blocking.length > 0) {
      return NextResponse.json({
        available: false,
        error: 'BUSINESS_RULE_VIOLATION',
        message: blocking[0]?.message,
        violations: business.violations,
        warnings: business.warnings,
        conflicts: [],
      });
    }
  }

  const marginWarning = describeApprovalSlotMargin({
    startAt,
    endAt,
    appointments: approvedDay.map((item) => ({
      id: item.id,
      title: item.title,
      startAt: item.startAt,
      endAt: item.endAt,
    })),
  });

  return NextResponse.json({
    available: true,
    error: null,
    conflicts: [],
    message: null,
    marginWarning,
  });
  } catch (e) {
    console.error('[POST /api/appointments/check-conflict]', e);
    return NextResponse.json(
      {
        available: false,
        error: 'SERVER_ERROR',
        message: 'Erreur serveur lors de la vérification du créneau.',
        conflicts: [],
      },
      { status: 500 }
    );
  }
}
