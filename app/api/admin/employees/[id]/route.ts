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

const patchSchema = z.object({
  nom: z.string().trim().min(1).max(191).optional(),
  prenom: z.string().trim().min(1).max(191).optional(),
  email: z.string().trim().email().max(191).optional(),
  matricule: z.string().trim().min(1).max(191).optional(),
  service: z.string().trim().min(1).max(191).optional(),
  statut: z.enum(['actif', 'inactif']).optional(),
  appRole: z.enum(['employee', 'hr_admin', 'hr_auditor']).optional(),
  password: z.string().min(8).max(128).optional(),
  schedule: scheduleSchema.optional(),
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

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'EMPTY_UPDATE' }, { status: 422 });
  }

  const empUpdate: Record<string, unknown> = {};
  if (data.nom != null) empUpdate.nom = data.nom;
  if (data.prenom != null) empUpdate.prenom = data.prenom;
  if (data.email != null) empUpdate.email = data.email.toLowerCase();
  if (data.matricule != null) empUpdate.matricule = data.matricule;
  if (data.service != null) empUpdate.service = data.service;
  if (data.statut != null) empUpdate.statut = data.statut;

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(empUpdate).length > 0) {
        await tx.employee.update({ where: { id }, data: empUpdate as object });
      }
      if (data.password != null || data.appRole != null) {
        const cred = await tx.employeeCredential.findUnique({ where: { employeeId: id } });
        if (!cred) throw new Error('NO_CREDENTIAL');
        const credData: { passwordHash?: string; appRole?: string } = {};
        if (data.password != null) credData.passwordHash = await hashPassword(data.password);
        if (data.appRole != null) credData.appRole = data.appRole;
        if (Object.keys(credData).length > 0) {
          await tx.employeeCredential.update({ where: { employeeId: id }, data: credData });
        }
      }
      if (data.schedule != null) {
        await tx.schedule.upsert({
          where: { employeeId: id },
          create: {
            employeeId: id,
            startTime: data.schedule.startTime,
            endTime: data.schedule.endTime,
            workDays: data.schedule.workDays,
          },
          update: {
            startTime: data.schedule.startTime,
            endTime: data.schedule.endTime,
            workDays: data.schedule.workDays,
          },
        });
      }
    });

    try {
      await logAuditFromRequest(
        req,
        { employeeId: ctx.employeeId, user: ctx.user },
        { action: 'employee.update', entity: 'employee', entityId: id, meta: { fields: Object.keys(data) } }
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'NO_CREDENTIAL') {
      return NextResponse.json({ error: 'NO_CREDENTIAL' }, { status: 422 });
    }
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_EMAIL_OR_MATRICULE' }, { status: 409 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    throw e;
  }
}
