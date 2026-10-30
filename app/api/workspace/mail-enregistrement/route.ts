import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createMailSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import {
  countWorkspaceMail,
  createWorkspaceMail,
  listWorkspaceMail,
} from '@/lib/services/workspace-service';

/** Coffre-fort / enregistrement — registre VAULT, distinct des courriers départ. */
export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const mailKind = 'VAULT' as const;
  const year = parseYearFromRequest(url);
  const archived = url.searchParams.get('archived') === 'true';
  const [items, counts] = await Promise.all([
    listWorkspaceMail({
      mailKind,
      q: url.searchParams.get('q') ?? undefined,
      year,
      archived,
    }),
    countWorkspaceMail({ mailKind, year }),
  ]);
  return NextResponse.json({ items, counts });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createMailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const d = parsed.data;
  if (!d.assignedService?.trim()) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', field: 'assignedService' }, { status: 422 });
  }
  if (!d.attachments?.length && !d.hasAttachment) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', field: 'attachments' }, { status: 422 });
  }

  const mail = await createWorkspaceMail(
    {
      direction: 'OUTGOING',
      mailKind: 'VAULT',
      registrationNumber: null,
      reference: d.reference,
      counterpart: d.counterpart,
      subject: d.subject,
      mailDate: d.mailDate,
      priority: d.priority ?? 'NORMAL',
      origin: d.origin ?? null,
      dgaInstruction: null,
      executor: d.executor ?? null,
      action: d.action ?? null,
      scSentAt: d.scSentAt ?? null,
      executionDeadline: null,
      followUp: d.followUp ?? null,
      courierName: d.courierName ?? null,
      assignedService: d.assignedService.trim(),
      assignedAt: null,
      notes: d.notes ?? null,
      hasAttachment: true,
      attachments: d.attachments,
      archived: false,
      archivedAt: null,
      attachmentCount: 0,
    },
    session.userId
  );
  return NextResponse.json({ mail }, { status: 201 });
}
