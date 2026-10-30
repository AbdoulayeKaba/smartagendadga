import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockPreRegistrations } from '@/lib/mock-data';

const postSchema = z.object({
  firstName: z.string().trim().min(1).max(191),
  lastName: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(191),
  phone: z.string().trim().max(32).optional().nullable(),
  program: z.string().trim().min(2).max(191),
  academicYear: z.string().trim().min(4).max(32),
  motivation: z.string().trim().max(1500).optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockPreRegistrations });

  const items = await prisma.preRegistration.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      reviewedBy: { select: { id: true, nom: true, prenom: true, email: true } },
      documents: { select: { id: true } },
    },
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      program: r.program,
      academicYear: r.academicYear,
      status: r.status,
      motivation: r.motivation,
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

  const created = await prisma.preRegistration.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      program: parsed.data.program,
      academicYear: parsed.data.academicYear,
      motivation: parsed.data.motivation || null,
      status: 'submitted',
    },
  });

  if (ctx) {
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'admission.preregistration.submit',
        entity: 'pre_registration',
        entityId: created.id,
        meta: { email: created.email, program: created.program },
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
