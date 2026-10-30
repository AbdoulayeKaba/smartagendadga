import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { prisma } from '@/lib/prisma';
import { mockWriteAudit } from '@/lib/mock/audit';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetAppointment, mockSetUrgent } from '@/lib/mock/store';
import { writeAudit } from '@/lib/services/appointments';
import {
  buildUrgentSlotSyncResult,
  notifyPlanningUrgentIfNeeded,
} from '@/lib/services/appointment-urgent-priority';

const schema = z.object({
  urgentOverride: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'calendar.urgent'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (isMockDataEnabled()) {
    const current = mockGetAppointment(id);
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (current.status === 'REJECTED') {
      return NextResponse.json({ error: 'INVALID_STATE' }, { status: 409 });
    }
    const row = mockSetUrgent(id, parsed.data.urgentOverride);
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    await notifyPlanningUrgentIfNeeded({
      appointmentId: id,
      title: current.title,
      status: current.status,
      urgentOverride: parsed.data.urgentOverride,
      wasUrgentOverride: current.urgentOverride,
      actorId: session.userId,
    });
    mockWriteAudit(session.userId, 'appointment.urgent_override', id);
    return NextResponse.json({ ok: true, appointment: row });
  }

  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (current.status === 'REJECTED') {
    return NextResponse.json({ error: 'INVALID_STATE' }, { status: 409 });
  }

  const urgentSync = buildUrgentSlotSyncResult({
    description: current.description,
    status: current.status,
    title: current.title,
    urgentOverride: parsed.data.urgentOverride,
  });

  const row = await prisma.appointment.update({
    where: { id },
    data: {
      urgentOverride: parsed.data.urgentOverride,
      description: urgentSync.description,
      ...(urgentSync.priority ? { priority: urgentSync.priority } : {}),
    },
  });

  await notifyPlanningUrgentIfNeeded({
    appointmentId: id,
    title: current.title,
    status: current.status,
    urgentOverride: parsed.data.urgentOverride,
    wasUrgentOverride: current.urgentOverride,
    actorId: session.userId,
  });

  await writeAudit(session.userId, 'appointment.urgent_override', id, {
    urgentOverride: parsed.data.urgentOverride,
  });

  return NextResponse.json({ ok: true, appointment: row });
}
