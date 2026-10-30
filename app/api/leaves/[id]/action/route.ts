import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { hasPermission, permissionDeniedResponse } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  action: z.enum(['cancel']),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasPermission(ctx, 'leaves.submit')) return permissionDeniedResponse();

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const leave = await prisma.employeeLeave.findUnique({ where: { id } });
  if (!leave || leave.employeeId !== ctx.employeeId) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  await prisma.employeeLeave.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
