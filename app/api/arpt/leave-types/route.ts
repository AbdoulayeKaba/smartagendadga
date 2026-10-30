import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';

const createSchema = z.object({
  code: z.string().trim().min(2).max(64),
  label: z.string().trim().min(2).max(191),
  description: z.string().trim().max(500).optional().nullable(),
  maxDaysPerYear: z.number().int().positive().max(365),
  requiresProof: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      maxDaysPerYear: number;
      requiresProof: number;
      isActive: number;
    }>
  >`SELECT id, code, label, description, max_days_per_year AS maxDaysPerYear, requires_proof AS requiresProof, is_active AS isActive FROM leave_type_configs ORDER BY label ASC`;

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      requiresProof: Boolean(r.requiresProof),
      isActive: Boolean(r.isActive),
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin', 'rh'])) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });

  await prisma.$executeRaw`
    INSERT INTO leave_type_configs (id, code, label, description, max_days_per_year, requires_proof, is_active, created_at)
    VALUES (UUID(), ${parsed.data.code}, ${parsed.data.label}, ${parsed.data.description ?? null}, ${parsed.data.maxDaysPerYear}, ${parsed.data.requiresProof ?? false}, ${parsed.data.isActive ?? true}, NOW())
  `;

  return NextResponse.json({ ok: true }, { status: 201 });
}
