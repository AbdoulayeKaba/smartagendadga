import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockAdmissionsOverview } from '@/lib/mock-data';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json(mockAdmissionsOverview);

  const [preRegistrationsTotal, preRegistrationsSubmitted, preRegistrationsValidated, applicationsTotal, applicationsSubmitted, applicationsValidated] =
    await Promise.all([
      prisma.preRegistration.count(),
      prisma.preRegistration.count({ where: { status: 'submitted' } }),
      prisma.preRegistration.count({ where: { status: 'validated' } }),
      prisma.application.count(),
      prisma.application.count({ where: { status: 'submitted' } }),
      prisma.application.count({ where: { status: 'validated' } }),
    ]);

  return NextResponse.json({
    preRegistrationsTotal,
    preRegistrationsSubmitted,
    preRegistrationsValidated,
    applicationsTotal,
    applicationsSubmitted,
    applicationsValidated,
  });
}
