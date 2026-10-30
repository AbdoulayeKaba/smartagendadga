import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { parseDateTime } from '@/lib/dg/scheduling';
import { approveAppointment, rejectAppointment } from '@/lib/services/appointments';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { triggerAppointmentRemindersDispatch } from '@/lib/services/appointment-reminder-dispatch';

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'RESCHEDULE']),
  reason: z.string().max(500).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  urgentOverride: z.boolean().optional(),
  isOnlineMeeting: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const actionPermission =
    parsed.data.action === 'REJECT'
      ? 'action.appointments.reject'
      : parsed.data.action === 'RESCHEDULE'
        ? 'action.appointments.reschedule'
        : 'action.appointments.approve';
  if (!(await userHasPermission(session.role, actionPermission))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    await autoRejectExpiredPendingAppointments({ force: true });
  } catch (err) {
    console.error('[appointment-decision] auto-reject failed:', err);
  }
  triggerAppointmentRemindersDispatch();

  try {
    if (parsed.data.action === 'REJECT') {
      const result = await rejectAppointment({
        appointmentId: id,
        reviewerId: session.userId,
        reason: parsed.data.reason ?? undefined,
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            message: 'message' in result ? result.message : undefined,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true, appointment: result.appointment });
    }

    let startAt: Date | undefined;
    let endAt: Date | undefined;
    if (parsed.data.date && parsed.data.startTime && parsed.data.endTime) {
      startAt = parseDateTime(parsed.data.date, parsed.data.startTime);
      endAt = parseDateTime(parsed.data.date, parsed.data.endTime);
    }

    const result = await approveAppointment({
      appointmentId: id,
      reviewerId: session.userId,
      startAt,
      endAt,
      urgentOverride: parsed.data.urgentOverride,
      isOnlineMeeting: parsed.data.isOnlineMeeting,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          message: 'message' in result ? result.message : undefined,
          conflicts: 'conflicts' in result ? result.conflicts : undefined,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      appointment: result.appointment,
      alreadyApproved: 'alreadyApproved' in result && result.alreadyApproved === true,
    });
  } catch (err) {
    console.error('[appointment-decision] failed:', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Erreur serveur. Réessayez.' },
      { status: 500 }
    );
  }
}
