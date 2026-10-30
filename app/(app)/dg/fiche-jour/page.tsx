import { redirect } from 'next/navigation';
import { DgDaySheetView } from '@/components/dg/dg-day-sheet';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { getDgDaySheet } from '@/lib/services/dg-day-sheet';

export default async function DgDaySheetPage() {
  const ctx = await getServerSessionContext();
  if (!ctx || (ctx.dgRole !== 'DG' && ctx.dgRole !== 'ASSISTANT')) {
    redirect('/dg/dashboard');
  }

  const sheet = await getDgDaySheet();
  return (
    <div className="dg-day-sheet-page">
      <DgDaySheetView sheet={sheet} />
    </div>
  );
}
