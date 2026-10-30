import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { sameEmail } from '@/lib/dg/appointment-involvement';
import { getAppointmentById } from '@/lib/services/appointments';
import { getAppointmentForReview } from '@/lib/services/appointments-review';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const row = await getAppointmentById(id);
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const isOwner = row.requestedById === session.userId;
  const isInvitee = row.participants.some(
    (participant) =>
      participant.userId === session.userId || sameEmail(participant.email, session.email)
  );
  const canReview = await userHasPermission(session.role, 'appointments.review');
  const canOwn =
    (await userHasPermission(session.role, 'appointments.view_own')) &&
    (await userHasPermission(session.role, 'appointments.own.detail'));
  const canOwnDetail = (isOwner || isInvitee) && canOwn;

  if (!canReview && !canOwnDetail) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const item = await getAppointmentForReview(id);
  if (!item) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ item });
}
