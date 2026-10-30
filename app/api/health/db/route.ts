import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';

export async function GET() {
  if (isMockDataEnabled()) {
    return NextResponse.json({ ok: true, mock: true, seeded: true, userCount: 4 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount: count, seeded: count > 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
