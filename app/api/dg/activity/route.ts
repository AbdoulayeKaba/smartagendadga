import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { listDgAppointmentActivity } from '@/lib/services/dg-activity';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  const canReview = await userHasPermission(session.role, 'appointments.review');
  const canOwn = await userHasPermission(session.role, 'appointments.view_own');
  if (!canReview && !canOwn) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const data = await listDgAppointmentActivity({
    q: url.searchParams.get('q') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    ownUserId: canReview ? undefined : session.userId,
    ownEmail: canReview ? undefined : session.email,
  });

  return NextResponse.json(data);
}
