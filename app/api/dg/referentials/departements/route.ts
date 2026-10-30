import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import {
  userCanRequestRoomReservation,
  userCanReviewRoomReservations,
} from '@/lib/auth/room-reservation-access';
import { listReferentialItems } from '@/lib/services/referentials-admin';

/** Liste des départements actifs (référentiel) pour les formulaires métier. */
export async function GET() {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const canRequest = await userCanRequestRoomReservation(session.role);
  const canReview = await userCanReviewRoomReservations(session.role);
  const canManageUsers =
    (await userHasPermission(session.role, 'menu.admin.users')) ||
    (await userHasPermission(session.role, 'admin.users.read')) ||
    (await userHasPermission(session.role, 'action.users.create')) ||
    (await userHasPermission(session.role, 'action.users.edit'));

  if (!canRequest && !canReview && !canManageUsers) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const items = await listReferentialItems('departements', { archived: false }).catch(() => []);
  return NextResponse.json({
    items: items.map((item) => ({ id: item.id, name: item.name })),
  });
}
