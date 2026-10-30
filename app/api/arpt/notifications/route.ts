import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireArptAuth } from '@/lib/auth/arpt-auth';

export async function GET() {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const rows = await prisma.$queryRaw<
    Array<{ id: string; title: string; message: string; type: string; readAt: Date | null; createdAt: Date }>
  >`
    SELECT id, title, message, type, read_at AS readAt, created_at AS createdAt
    FROM arpt_notifications
    WHERE employee_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT 30
  `;
  return NextResponse.json({ items: rows });
}
