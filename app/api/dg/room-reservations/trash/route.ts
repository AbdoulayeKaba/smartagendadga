import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { userCanReviewRoomReservations } from '@/lib/auth/room-reservation-access';
import { emptyRoomReservationsTrash } from '@/lib/services/room-reservations';

export async function POST() {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userCanReviewRoomReservations(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.room_reservations.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyRoomReservationsTrash(session.userId);
  return NextResponse.json(result);
}
