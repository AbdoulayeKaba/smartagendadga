import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { getStudentBulletin } from '@/lib/school/services/bulletins';

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { studentId } = await params;
  const bulletin = await getStudentBulletin(studentId);
  if (!bulletin) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(bulletin);
}
