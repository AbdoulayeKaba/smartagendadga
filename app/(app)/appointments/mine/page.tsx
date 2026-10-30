import { redirect } from 'next/navigation';

/** L’espace personnel « Mes demandes » n’est plus un parcours de la plateforme. */
export default function MyAppointmentsPage() {
  redirect('/dg/appointments');
}
