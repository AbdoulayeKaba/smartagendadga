import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { emptyOwnAppointmentsTrash } from '@/lib/services/appointments';

/** Vide la corbeille de l'utilisateur connecté (demandes archivées). */
export async function POST() {
  const { session, error } = await requireApiSession();
  if (error) return error;

  if (!(await userHasPermission(session.role, 'appointments.own.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyOwnAppointmentsTrash(session.userId);
  return NextResponse.json(result);
}
