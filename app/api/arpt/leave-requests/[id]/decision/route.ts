import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasArptRole, requireArptAuth } from '@/lib/auth/arpt-auth';
import { createArptNotification } from '@/lib/arpt/notifications';

const schema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().trim().max(500).optional().nullable(),
  levelOrder: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasArptRole(session.user.role, ['admin', 'rh', 'chef'])) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });

  const leave = await prisma.$queryRaw<
    Array<{ employeeId: string; workingDays: number; leaveTypeId: string | null; status: string }>
  >`SELECT employee_id AS employeeId, working_days AS workingDays, leave_type_id AS leaveTypeId, status FROM employee_leaves WHERE id = ${id} LIMIT 1`;
  if (!leave[0]) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  if (!['submitted', 'draft'].includes(leave[0].status)) {
    return NextResponse.json({ error: 'INVALID_STATE' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO leave_approval_history (id, leave_id, approver_id, approver_role, decision, comment, level_order, decided_at)
      VALUES (UUID(), ${id}, ${session.user.id}, ${session.user.role}, ${parsed.data.decision}, ${parsed.data.comment ?? null}, ${parsed.data.levelOrder ?? 1}, NOW())
    `;

    if (parsed.data.decision === 'approved') {
      await tx.$executeRaw`
        UPDATE employee_leaves
        SET status = 'approved', approved_at = NOW(), approved_by_employee_id = ${session.user.id}, rejection_reason = NULL
        WHERE id = ${id}
      `;

      const year = new Date().getFullYear();
      if (leave[0].leaveTypeId) {
        await tx.$executeRaw`
          INSERT INTO leave_balances (id, employee_id, leave_type_id, year, opening_days, earned_days, used_days, pending_days, updated_at, created_at)
          VALUES (UUID(), ${leave[0].employeeId}, ${leave[0].leaveTypeId}, ${year}, 0, 0, ${leave[0].workingDays}, 0, NOW(), NOW())
          ON DUPLICATE KEY UPDATE used_days = used_days + ${leave[0].workingDays}, updated_at = NOW()
        `;
      }
    } else {
      await tx.$executeRaw`
        UPDATE employee_leaves
        SET status = 'rejected', approved_at = NULL, approved_by_employee_id = ${session.user.id}, rejection_reason = ${parsed.data.comment ?? 'Demande rejetee'}
        WHERE id = ${id}
      `;
    }
  });

  await createArptNotification({
    employeeId: leave[0].employeeId,
    leaveId: id,
    type: parsed.data.decision === 'approved' ? 'leave_approved' : 'leave_rejected',
    title: parsed.data.decision === 'approved' ? 'Demande approuvee' : 'Demande rejetee',
    message:
      parsed.data.decision === 'approved'
        ? 'Votre demande de conge a ete approuvee.'
        : `Votre demande de conge a ete rejetee.${parsed.data.comment ? ` Motif: ${parsed.data.comment}` : ''}`,
  });

  return NextResponse.json({ ok: true });
}
