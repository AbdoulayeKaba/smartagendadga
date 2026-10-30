import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';
import { hashPassword } from '@/lib/auth/password';

const patchSchema = z.object({
  nom: z.string().min(2).optional(),
  prenom: z.string().min(2).optional(),
  service: z.string().min(2).optional(),
  role: z.enum(['admin', 'rh', 'chef', 'employe']).optional(),
  managerId: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
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
    UPDATE employees
    SET nom = COALESCE(${d.nom ?? null}, nom),
        prenom = COALESCE(${d.prenom ?? null}, prenom),
        service = COALESCE(${d.service ?? null}, service),
        manager_id = COALESCE(${d.managerId ?? null}, manager_id)
    WHERE id = ${id}
  `;

  if (d.role) {
    const appRoleMap: Record<string, string> = {
      admin: 'hr_admin',
      rh: 'hr_auditor',
      chef: 'employee',
      employe: 'employee',
    };
    await prisma.$executeRaw`
      UPDATE employee_credentials
      SET role = ${d.role}, app_role = ${appRoleMap[d.role]}
      WHERE employee_id = ${id}
    `;
  }

  if (d.password) {
    const passwordHash = await hashPassword(d.password);
    await prisma.$executeRaw`UPDATE employee_credentials SET password_hash = ${passwordHash} WHERE employee_id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin'])) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM employee_credentials WHERE employee_id = ${id}`;
    await tx.$executeRaw`DELETE FROM employees WHERE id = ${id}`;
  });
  return NextResponse.json({ ok: true });
}
