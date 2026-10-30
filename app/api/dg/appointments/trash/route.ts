import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { emptyAppointmentsTrash } from '@/lib/services/appointments';

export async function POST() {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyAppointmentsTrash(session.userId);
  return NextResponse.json(result);
}
