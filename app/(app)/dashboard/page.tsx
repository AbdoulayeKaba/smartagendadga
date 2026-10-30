import { redirect } from 'next/navigation';
import { getDgSession } from '@/lib/auth/session-server';

export default async function DashboardPage() {
  const session = await getDgSession();
  if (!session) redirect('/dg/assistant');

  if (session.role === 'ASSISTANT') redirect('/dg/assistant');
  if (session.role === 'DG') redirect('/dg/dashboard');
  redirect('/dg/plan');
}
