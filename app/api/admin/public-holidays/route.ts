import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { hasPermission, permissionDeniedResponse } from '@/lib/auth/permissions';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const postSchema = z.object({
  date: ymd,
  name: z.string().trim().min(1).max(191),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'holidays.read')) return permissionDeniedResponse();

  const items = await prisma.publicHoliday.findMany({
    orderBy: { date: 'asc' },
  });
  return NextResponse.json({ items });
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

  try {
    const row = await prisma.publicHoliday.create({
      data: { date: parsed.data.date, name: parsed.data.name },
    });
    try {
      await logAuditFromRequest(
        req,
        { employeeId: ctx.employeeId, user: ctx.user },
        {
          action: 'holiday.create',
          entity: 'public_holiday',
          entityId: row.id,
          meta: { date: row.date, name: row.name },
        }
      );
    } catch {
      /* ignore */
    }
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'DATE_ALREADY_EXISTS' }, { status: 409 });
    }
    throw e;
  }
}
