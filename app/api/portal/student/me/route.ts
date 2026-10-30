import { NextResponse } from 'next/server';
import { verifyPortalToken } from '@/lib/portal/token';
import { getStudentBulletin } from '@/lib/school/services/bulletins';

function readBearer(req: Request): string | null {
  const raw = req.headers.get('authorization');
  if (!raw) return null;
  const [type, token] = raw.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function GET(req: Request) {
  const token = readBearer(req);
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload || payload.role !== 'student') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const bulletin = await getStudentBulletin(payload.studentId);
  if (!bulletin) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json(bulletin);
}
