import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireArptAuth } from '@/lib/auth/arpt-auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireArptAuth();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      approverId: string;
      approverName: string;
      approverRole: string;
      decision: string;
      comment: string | null;
      decidedAt: Date;
      levelOrder: number;
    }>
  >`
    SELECT h.id,
           h.approver_id AS approverId,
           CONCAT(e.prenom, ' ', e.nom) AS approverName,
           h.approver_role AS approverRole,
           h.decision,
           h.comment,
           h.decided_at AS decidedAt,
           h.level_order AS levelOrder
    FROM leave_approval_history h
    INNER JOIN employees e ON e.id = h.approver_id
    WHERE h.leave_id = ${id}
    ORDER BY h.decided_at ASC
  `;

  return NextResponse.json({ items: rows });
}
