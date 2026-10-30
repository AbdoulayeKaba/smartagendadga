import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { searchDgAppointments, searchMyAppointments } from '@/lib/services/dg-search';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';

  if (await userHasPermission(session.role, 'appointments.review')) {
    const items = await searchDgAppointments(q);
    return NextResponse.json({ items });
  }

  const items = await searchMyAppointments(session.userId, q);
  return NextResponse.json({ items });
}
