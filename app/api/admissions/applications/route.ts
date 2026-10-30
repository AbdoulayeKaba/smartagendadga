import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockApplications } from '@/lib/mock-data';

const postSchema = z.object({
  type: z.enum(['student', 'professor']),
  firstName: z.string().trim().min(1).max(191),
  lastName: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191),
  phone: z.string().trim().max(32).optional().nullable(),
  targetProgram: z.string().trim().max(191).optional().nullable(),
  specialty: z.string().trim().max(191).optional().nullable(),
  coverLetter: z.string().trim().max(2000).optional().nullable(),
  academicYear: z.string().trim().min(4).max(32),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockApplications });

  const items = await prisma.application.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      reviewedBy: { select: { id: true, nom: true, prenom: true, email: true } },
      documents: { select: { id: true } },
    },
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      type: r.type,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      targetProgram: r.targetProgram,
      specialty: r.specialty,
      coverLetter: r.coverLetter,
      academicYear: r.academicYear,
      status: r.status,
      reviewComment: r.reviewComment,
      submittedAt: r.submittedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewedBy: r.reviewedBy
        ? {
            id: r.reviewedBy.id,
            name: `${r.reviewedBy.prenom} ${r.reviewedBy.nom}`.trim(),
            email: r.reviewedBy.email,
          }
        : null,
      documentsCount: r.documents.length,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();

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

  const created = await prisma.application.create({
    data: {
      type: parsed.data.type,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      targetProgram: parsed.data.targetProgram || null,
      specialty: parsed.data.specialty || null,
      coverLetter: parsed.data.coverLetter || null,
      academicYear: parsed.data.academicYear,
      status: 'submitted',
    },
  });

  if (ctx) {
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'admission.application.submit',
        entity: 'application',
        entityId: created.id,
        meta: { email: created.email, type: created.type },
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
