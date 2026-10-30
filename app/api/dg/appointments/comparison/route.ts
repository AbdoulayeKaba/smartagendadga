import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import {
  getAppointmentYearComparison,
  parseComparisonQuery,
} from '@/lib/services/appointment-comparison';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const data = await getAppointmentYearComparison(parseComparisonQuery(url.searchParams));

  if (!data) {
    return NextResponse.json({ error: 'INVALID_PERIOD' }, { status: 422 });
  }

  return NextResponse.json(data);
}
