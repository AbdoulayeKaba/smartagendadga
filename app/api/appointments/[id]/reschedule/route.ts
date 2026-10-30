import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { parseDateTime } from '@/lib/dg/scheduling';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetAppointment } from '@/lib/mock/store';
import { rescheduleAppointment } from '@/lib/services/reschedule';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  urgentOverride: z.boolean().optional(),
  isOnlineMeeting: z.boolean().optional(),
  keepApproved: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;
    if (!(await userHasPermission(session.role, 'action.appointments.reschedule'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await params;
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    const startAt = parseDateTime(parsed.data.date, parsed.data.startTime);
    let endAt: Date;
    if (parsed.data.endTime) {
      endAt = parseDateTime(parsed.data.date, parsed.data.endTime);
    } else {
      const current = isMockDataEnabled()
        ? mockGetAppointment(id)
        : await prisma.appointment.findUnique({
            where: { id },
            select: { startAt: true, endAt: true },
          });
      if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      const durationMs = current.endAt.getTime() - current.startAt.getTime();
      endAt = new Date(startAt.getTime() + durationMs);
    }

    const result = await rescheduleAppointment({
      appointmentId: id,
      actorId: session.userId,
      startAt,
      endAt,
      urgentOverride:
        parsed.data.urgentOverride !== undefined &&
        (await userHasPermission(session.role, 'calendar.urgent'))
          ? parsed.data.urgentOverride
          : undefined,
      isOnlineMeeting: parsed.data.isOnlineMeeting,
      keepApproved: parsed.data.keepApproved,
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

    return NextResponse.json({ ok: true, appointment: result.appointment });
  } catch (e) {
    console.error('[PATCH /api/appointments/[id]/reschedule]', e);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Erreur serveur lors du report du rendez-vous.' },
      { status: 500 }
    );
  }
}
