import { redirect } from 'next/navigation';

export default function LegacyEmployesRedirect() {
  redirect('/admin/parametrage/employes');
}
