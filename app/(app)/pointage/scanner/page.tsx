import { redirect } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { KioskScanner } from './kiosk-scanner';

export default async function ScannerPage() {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrPrivileged(ctx.appRole)) {
    redirect('/pointage');
  }
  return <KioskScanner />;
}
