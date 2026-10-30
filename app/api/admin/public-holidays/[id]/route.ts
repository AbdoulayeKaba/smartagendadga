import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().trim().min(1).max(191).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;
  if (Object.keys(d).length === 0) {
    return NextResponse.json({ error: 'EMPTY_UPDATE' }, { status: 422 });
  }

  try {
    const row = await prisma.publicHoliday.update({ where: { id }, data: d });
    try {
      await logAuditFromRequest(
        req,
        { employeeId: ctx.employeeId, user: ctx.user },
        { action: 'holiday.update', entity: 'public_holiday', entityId: id, meta: d }
      );
    } catch {
      /* ignore */
    }
    return NextResponse.json(row);
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'DATE_ALREADY_EXISTS' }, { status: 409 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.publicHoliday.delete({ where: { id } });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'holiday.delete',
        entity: 'public_holiday',
        entityId: id,
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}
