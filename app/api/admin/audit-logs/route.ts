import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { hasPermission, permissionDeniedResponse } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'audit.read')) return permissionDeniedResponse();

  const url = new URL(_req.url);
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get('limit') ?? 50)));

  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    items: items.map((x) => ({
      id: x.id,
      action: x.action,
      entity: x.entity,
      entityId: x.entityId,
      meta: x.meta ?? null,
      actorId: x.actorId,
      actorEmail: x.actorEmail,
      actorName: x.actorName,
      ip: x.ip,
      userAgent: x.userAgent,
      createdAt: x.createdAt.toISOString(),
    })),
  });
}
