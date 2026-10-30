import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';

const patchSchema = z.object({
  label: z.string().min(2).max(191).optional(),
  description: z.string().max(500).optional().nullable(),
  maxDaysPerYear: z.number().int().positive().max(365).optional(),
  requiresProof: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin', 'rh'])) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  const d = parsed.data;

  await prisma.$executeRaw`
    UPDATE leave_type_configs
    SET label = COALESCE(${d.label ?? null}, label),
        description = COALESCE(${d.description ?? null}, description),
        max_days_per_year = COALESCE(${d.maxDaysPerYear ?? null}, max_days_per_year),
        requires_proof = COALESCE(${d.requiresProof ?? null}, requires_proof),
        is_active = COALESCE(${d.isActive ?? null}, is_active)
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin', 'rh'])) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  await prisma.$executeRaw`DELETE FROM leave_type_configs WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
