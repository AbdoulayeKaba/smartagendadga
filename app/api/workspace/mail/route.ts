import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createMailSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { runMailDeadlineAlerts } from '@/lib/services/mail-deadline-alerts';
import {
  countWorkspaceMail,
  createWorkspaceMail,
  listWorkspaceMail,
} from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  /** Module verrouillé : uniquement les courriers départ (sortants, registre DEPARTURE). */
  const direction = 'OUTGOING';
  const mailKind = 'DEPARTURE';
  const year = parseYearFromRequest(url);
  const archived = url.searchParams.get('archived') === 'true';
  const [items, counts] = await Promise.all([
    listWorkspaceMail({
      direction,
      mailKind,
      q: url.searchParams.get('q') ?? undefined,
      year,
      archived,
    }),
    countWorkspaceMail({ direction, mailKind, year }),
  ]);

  // Alerte dynamique assistants (dédupliquée 1×/jour/courrier) à l’ouverture de la liste.
  if (session?.role === 'ASSISTANT' && archived !== true) {
    void runMailDeadlineAlerts().catch(() => undefined);
  }

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
  const mail = await createWorkspaceMail(
    {
      direction: 'OUTGOING',
      mailKind: 'DEPARTURE',
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
      assignedService: d.assignedService ?? null,
      assignedAt: null,
      notes: d.notes ?? null,
      hasAttachment: d.hasAttachment,
      attachments: d.attachments,
      archived: false,
      archivedAt: null,
      attachmentCount: 0,
    },
    session.userId
  );
  return NextResponse.json({ mail }, { status: 201 });
}
