import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { computeAttendanceDashboard } from '@/lib/attendance/punch-service';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isHrFamily(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const stats = await computeAttendanceDashboard();
  return NextResponse.json(stats);
}
