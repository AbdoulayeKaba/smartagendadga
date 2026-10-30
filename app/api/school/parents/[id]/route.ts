import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(191).optional(),
  lastName: z.string().trim().min(1).max(191).optional(),
  email: z.string().trim().email().max(191).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  profession: z.string().trim().max(191).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });

  try {
    await prisma.parent.update({
      where: { id },
      data: {
        ...parsed.data,
        email: parsed.data.email === undefined ? undefined : parsed.data.email?.toLowerCase() || null,
      },
    });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'school.parent.update',
        entity: 'parent',
        entityId: id,
      });
    } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.parent.delete({ where: { id } });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'school.parent.delete',
        entity: 'parent',
        entityId: id,
      });
    } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}

