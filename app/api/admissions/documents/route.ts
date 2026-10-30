import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { logAuditFromRequest } from '@/lib/audit/write-audit';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled, mockAdmissionDocuments } from '@/lib/mock-data';

const postSchema = z.object({
  fileName: z.string().trim().min(2).max(191),
  fileUrl: z.string().trim().url().max(191),
  contentType: z.string().trim().max(120).optional().nullable(),
  fileSize: z.number().int().positive().optional().nullable(),
  preRegistrationId: z.string().trim().optional().nullable(),
  applicationId: z.string().trim().optional().nullable(),
});

export async function GET(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (isMockDataEnabled()) return NextResponse.json({ items: mockAdmissionDocuments });

  const url = new URL(req.url);
  const preRegistrationId = url.searchParams.get('preRegistrationId')?.trim();
  const applicationId = url.searchParams.get('applicationId')?.trim();

  const where = preRegistrationId
    ? { preRegistrationId }
    : applicationId
      ? { applicationId }
      : undefined;

  const items = await prisma.admissionDocument.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
  });

  return NextResponse.json({
    items: items.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      contentType: d.contentType,
      fileSize: d.fileSize,
      preRegistrationId: d.preRegistrationId,
      applicationId: d.applicationId,
      uploadedAt: d.uploadedAt.toISOString(),
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

  const created = await prisma.admissionDocument.create({
    data: {
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      contentType: parsed.data.contentType || null,
      fileSize: parsed.data.fileSize ?? null,
      preRegistrationId: parsed.data.preRegistrationId || null,
      applicationId: parsed.data.applicationId || null,
    },
  });

  if (ctx) {
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'admission.document.upload',
        entity: 'admission_document',
        entityId: created.id,
        meta: {
          preRegistrationId: created.preRegistrationId,
          applicationId: created.applicationId,
          fileName: created.fileName,
        },
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
