import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const leaveType = z.enum(['conge_annuel', 'conge_maladie', 'sans_solde', 'autre']);

const patchSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: leaveType.optional(),
  note: z.string().trim().max(500).optional().nullable(),
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

  const current = await prisma.employeeLeave.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const start = d.startDate ?? current.startDate;
  const end = d.endDate ?? current.endDate;
  if (start > end) {
    return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 422 });
  }

  try {
    const row = await prisma.employeeLeave.update({
      where: { id },
      data: {
        ...(d.startDate !== undefined ? { startDate: d.startDate } : {}),
        ...(d.endDate !== undefined ? { endDate: d.endDate } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.note !== undefined ? { note: d.note } : {}),
      },
    });
    try {
      await logAuditFromRequest(
        req,
        { employeeId: ctx.employeeId, user: ctx.user },
        { action: 'leave.update', entity: 'employee_leave', entityId: id, meta: d }
      );
    } catch {
      /* ignore */
    }
    return NextResponse.json(row);
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
    await prisma.employeeLeave.delete({ where: { id } });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'leave.delete',
        entity: 'employee_leave',
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
