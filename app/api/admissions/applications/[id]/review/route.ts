import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';

const reviewSchema = z.object({
  decision: z.enum(['validated', 'rejected', 'revision_required']),
  reviewComment: z.string().trim().max(1500).optional().nullable(),
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

  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const row = await prisma.application.update({
      where: { id },
      data: {
        status: parsed.data.decision,
        reviewComment: parsed.data.reviewComment ?? null,
        reviewedById: ctx.employeeId,
        reviewedAt: new Date(),
      },
    });

    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: `admission.application.${parsed.data.decision}`,
        entity: 'application',
        entityId: id,
        meta: { reviewComment: parsed.data.reviewComment ?? null },
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      id: row.id,
      status: row.status,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewComment: row.reviewComment,
    });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}

