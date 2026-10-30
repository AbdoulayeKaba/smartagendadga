import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';
import { hashPassword } from '@/lib/auth/password';

const createSchema = z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  email: z.string().email(),
  matricule: z.string().min(2),
  service: z.string().min(2),
  role: z.enum(['admin', 'rh', 'chef', 'employe']),
  password: z.string().min(8),
  managerId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      nom: string;
      prenom: string;
      email: string;
      matricule: string;
      service: string;
      managerId: string | null;
      role: string;
      appRole: string;
    }>
  >`SELECT e.id, e.nom, e.prenom, e.email, e.matricule, e.service, e.manager_id AS managerId, c.role, c.app_role AS appRole FROM employees e LEFT JOIN employee_credentials c ON c.employee_id = e.id ORDER BY e.created_at DESC`;

  return NextResponse.json({ items: rows });
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

  const passwordHash = await hashPassword(parsed.data.password);
  const appRoleMap: Record<string, string> = {
    admin: 'hr_admin',
    rh: 'hr_auditor',
    chef: 'employee',
    employe: 'employee',
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO employees (id, nom, prenom, email, matricule, service, manager_id, statut, created_at)
      VALUES (UUID(), ${parsed.data.nom}, ${parsed.data.prenom}, ${parsed.data.email.toLowerCase()}, ${parsed.data.matricule}, ${parsed.data.service}, ${parsed.data.managerId ?? null}, 'actif', NOW())
    `;
    const created = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM employees WHERE email = ${parsed.data.email.toLowerCase()} LIMIT 1`;
    const employeeId = created[0]?.id;
    if (!employeeId) throw new Error('EMPLOYEE_CREATE_FAILED');
    await tx.$executeRaw`
      INSERT INTO employee_credentials (id, employee_id, password_hash, app_role, role, created_at)
      VALUES (UUID(), ${employeeId}, ${passwordHash}, ${appRoleMap[parsed.data.role]}, ${parsed.data.role}, NOW())
    `;
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
