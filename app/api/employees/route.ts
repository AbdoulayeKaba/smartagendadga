import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!isHrFamily(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const items = await prisma.employee.findMany({
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    include: {
      schedule: true,
      credential: { select: { appRole: true } },
    },
  });

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      email: e.email,
      matricule: e.matricule,
      service: e.service,
      statut: e.statut,
      appRole: e.credential?.appRole ?? null,
      schedule: e.schedule
        ? {
            startTime: e.schedule.startTime,
            endTime: e.schedule.endTime,
            workDays: e.schedule.workDays,
          }
        : null,
    })),
  });
}
