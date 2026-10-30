import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { getAppointmentForReview } from '@/lib/services/appointments-review';
import { getAppointmentMailProof } from '@/lib/services/appointment-mail-proof';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const item = await getAppointmentForReview(id);
  if (!item) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const isOwner = item.requestedBy.id === session.userId;
  const canReview = await userHasPermission(session.role, 'appointments.review');
  const canOwnDetail =
    isOwner &&
    (await userHasPermission(session.role, 'appointments.view_own')) &&
    (await userHasPermission(session.role, 'appointments.own.detail'));

  if (!canReview && !canOwnDetail) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const items = await getAppointmentMailProof(id);
  return NextResponse.json({ items: items ?? [] });
}
