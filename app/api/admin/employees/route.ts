import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

const scheduleSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  workDays: z.array(z.number().int().min(1).max(7)).min(1),
});

const postSchema = z.object({
  nom: z.string().trim().min(1).max(191),
  prenom: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191),
  matricule: z.string().trim().min(1).max(191),
  service: z.string().trim().min(1).max(191),
  statut: z.enum(['actif', 'inactif']).optional().default('actif'),
  appRole: z.enum(['employee', 'hr_admin']),
  password: z.string().min(8).max(128),
  schedule: scheduleSchema.optional(),
});

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

  const { schedule: schedIn, password, ...empIn } = parsed.data;
  const schedule = schedIn ?? {
    startTime: '08:30',
    endTime: '17:30',
    workDays: [1, 2, 3, 4, 5],
  };

  const passwordHash = await hashPassword(password);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          nom: empIn.nom,
          prenom: empIn.prenom,
          email: empIn.email.toLowerCase(),
          matricule: empIn.matricule,
          service: empIn.service,
          statut: empIn.statut,
        },
      });
      await tx.employeeCredential.create({
        data: {
          employeeId: emp.id,
          passwordHash,
          appRole: empIn.appRole,
        },
      });
      await tx.schedule.create({
        data: {
          employeeId: emp.id,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          workDays: schedule.workDays,
        },
      });
      return emp;
    });

    try {
      await logAuditFromRequest(
        req,
        { employeeId: ctx.employeeId, user: ctx.user },
        {
          action: 'employee.create',
          entity: 'employee',
          entityId: created.id,
          meta: { email: empIn.email.toLowerCase(), appRole: empIn.appRole },
        }
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_EMAIL_OR_MATRICULE' }, { status: 409 });
    }
    throw e;
  }
}
