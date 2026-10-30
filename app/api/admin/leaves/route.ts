import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { hasPermission, permissionDeniedResponse } from '@/lib/auth/permissions';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const leaveType = z.enum(['conge_annuel', 'conge_maladie', 'sans_solde', 'autre']);

const postSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: leaveType,
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'leaves.read')) return permissionDeniedResponse();

  const url = new URL(req.url);
  const employeeId = url.searchParams.get('employeeId')?.trim();

  const items = await prisma.employeeLeave.findMany({
    where: employeeId ? { employeeId } : undefined,
    orderBy: [{ startDate: 'desc' }, { endDate: 'desc' }],
    include: {
      employee: { select: { id: true, nom: true, prenom: true, matricule: true } },
    },
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      startDate: r.startDate,
      endDate: r.endDate,
      type: r.type,
      note: r.note,
      employee: r.employee,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

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

  const { startDate, endDate } = parsed.data;
  if (startDate > endDate) {
    return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 422 });
  }

  const emp = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
  if (!emp) {
    return NextResponse.json({ error: 'EMPLOYEE_NOT_FOUND' }, { status: 404 });
  }

  const row = await prisma.employeeLeave.create({
    data: {
      employeeId: parsed.data.employeeId,
      startDate,
      endDate,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
    },
  });

  try {
    await logAuditFromRequest(
      req,
      { employeeId: ctx.employeeId, user: ctx.user },
      {
        action: 'leave.create',
        entity: 'employee_leave',
        entityId: row.id,
        meta: { employeeId: parsed.data.employeeId, startDate, endDate, type: parsed.data.type },
      }
    );
  } catch {
    /* ignore */
  }

  return NextResponse.json({ id: row.id }, { status: 201 });
}
