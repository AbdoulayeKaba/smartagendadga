import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userCanRequestRoomReservation } from '@/lib/auth/room-reservation-access';
import { listMeetingRooms } from '@/lib/services/room-availability';

export async function GET() {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userCanRequestRoomReservation(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rooms = await listMeetingRooms();
  return NextResponse.json({ items: rooms });
}
