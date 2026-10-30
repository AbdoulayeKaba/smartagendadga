import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const items = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  return NextResponse.json({ items });
}

const postSchema = z.object({
  name: z.string().trim().min(1).max(191),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
});

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!isHrPrivileged(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const loc = await prisma.location.create({
    data: {
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    },
  });

  try {
    await logAuditFromRequest(
      req,
      { employeeId: ctx.employeeId, user: ctx.user },
      { action: 'location.create', entity: 'location', entityId: loc.id, meta: { name: loc.name } }
    );
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    id: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
  });
}
