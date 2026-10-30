import { redirect } from 'next/navigation';

/** L’espace personnel « Mes réservations » n’est plus un parcours de la plateforme. */
export default function MyRoomReservationsPage() {
  redirect('/dg/availability/reservations');
}
