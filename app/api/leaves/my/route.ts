import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { hasPermission, permissionDeniedResponse } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const leaveType = z.enum(['conge_annuel', 'conge_maladie', 'sans_solde', 'autre']);
const postSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: leaveType,
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'leaves.submit')) return permissionDeniedResponse();

  const items = await prisma.employeeLeave.findMany({
    where: { employeeId: ctx.employeeId },
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json({
    items: items.map((x) => ({
      id: x.id,
      startDate: x.startDate,
      endDate: x.endDate,
      type: x.type,
      note: x.note,
      status: 'submitted',
      submittedAt: x.createdAt?.toISOString?.() ?? null,
      approvedAt: null,
      rejectionReason: null,
      approvedBy: null,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'leaves.submit')) return permissionDeniedResponse();

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
  if (parsed.data.startDate > parsed.data.endDate) {
    return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 422 });
  }

  const row = await prisma.employeeLeave.create({
    data: {
      employeeId: ctx.employeeId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
