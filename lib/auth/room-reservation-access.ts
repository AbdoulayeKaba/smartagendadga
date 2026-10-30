import { userHasPermission } from '@/lib/auth/permission-guard';

/** Création d’une réservation de salle : assistante et DGA uniquement. */
export function userCanCreateRoomReservation(role: string) {
  return role === 'ASSISTANT' || role === 'DG';
}

export async function userCanRequestRoomReservation(role: string) {
  if (userCanCreateRoomReservation(role)) return true;
  return (
    (await userHasPermission(role, 'menu.room_slots')) ||
    (await userHasPermission(role, 'menu.room_reservations')) ||
    (await userHasPermission(role, 'menu.my_room_reservations')) ||
    (await userHasPermission(role, 'calendar.view')) ||
    (await userHasPermission(role, 'appointments.review'))
  );
}

export async function userCanReviewRoomReservations(role: string) {
  return userHasPermission(role, 'appointments.review');
}
