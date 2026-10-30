import { redirect } from 'next/navigation';

/** La racine de la plateforme ouvre directement la connexion. */
export default function HomePage() {
  redirect('/login');
}
