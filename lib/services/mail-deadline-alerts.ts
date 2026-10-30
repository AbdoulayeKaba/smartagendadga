import type { NotificationKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { notifyUser } from '@/lib/services/appointments';
import {
  formatMailDate,
  getMailDeadlineState,
} from '@/lib/workspace/mail-utils';
import type { MailItem } from '@/lib/workspace/types';

async function notifyAssistantsOnceToday(input: {
  kind: Extract<NotificationKind, 'MAIL_DEADLINE_SOON' | 'MAIL_OVERDUE'>;
  title: string;
  message: string;
  dedupeKey: string;
}) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const assistants = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true, archived: false },
    select: { id: true },
  });

  for (const assistant of assistants) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: assistant.id,
        kind: input.kind,
        message: { contains: input.dedupeKey },
        createdAt: { gte: dayStart },
      },
    });
    if (existing) continue;

    await notifyUser({
      userId: assistant.id,
      kind: input.kind,
      title: input.title,
      message: input.message,
    }).catch(() => undefined);
  }
}

/**
 * Notifie les assistants (cloche) pour les courriers dont le délai est proche ou dépassé.
 * Déduplication : une alerte max par courrier / type / jour.
 */
export async function runMailDeadlineAlerts(): Promise<{
  overdueAlerts: number;
  soonAlerts: number;
}> {
  if (isMockDataEnabled()) {
    return { overdueAlerts: 0, soonAlerts: 0 };
  }

  let rows: Array<{
    id: string;
    reference: string;
    subject: string;
    executionDeadline: Date | null;
    workflowStatus: MailItem['workflowStatus'];
  }>;

  try {
    rows = await prisma.mailRecord.findMany({
      where: {
        archived: false,
        executionDeadline: { not: null },
        workflowStatus: { notIn: ['PROCESSED', 'ARCHIVED'] },
      },
      select: {
        id: true,
        reference: true,
        subject: true,
        executionDeadline: true,
        workflowStatus: true,
      },
    });
  } catch {
    const rawRows = await prisma.$queryRaw<
      Array<{
        id: string;
        reference: string;
        subject: string;
        executionDeadline: Date | null;
        workflowStatus: MailItem['workflowStatus'];
      }>
    >`
      SELECT
        id,
        reference,
        subject,
        execution_deadline AS executionDeadline,
        workflow_status AS workflowStatus
      FROM dg_mail_records
      WHERE COALESCE(archived, false) = false
        AND execution_deadline IS NOT NULL
        AND workflow_status NOT IN ('PROCESSED', 'ARCHIVED')
    `;
    rows = rawRows;
  }

  let overdueAlerts = 0;
  let soonAlerts = 0;

  for (const row of rows) {
    const item = {
      executionDeadline: row.executionDeadline
        ? new Date(row.executionDeadline).toISOString()
        : null,
      workflowStatus: row.workflowStatus,
    } as Pick<MailItem, 'executionDeadline' | 'workflowStatus'>;

    const deadlineLabel = formatMailDate(item.executionDeadline);
    const label = row.reference || row.subject;

    const deadlineState = getMailDeadlineState(item);

    if (deadlineState.status === 'OVERDUE') {
      await notifyAssistantsOnceToday({
        kind: 'MAIL_OVERDUE',
        title: 'Délai d’exécution dépassé',
        message: `« ${label} » — Retard de ${deadlineState.days} jour${deadlineState.days > 1 ? 's' : ''}, échéance le ${deadlineLabel}. [${row.id}]`,
        dedupeKey: row.id,
      });
      overdueAlerts += 1;
      continue;
    }

    if (deadlineState.status === 'TODAY' || deadlineState.status === 'DUE_SOON') {
      const timing =
        deadlineState.status === 'TODAY'
          ? 'aujourd’hui'
          : `dans ${deadlineState.days} jour${deadlineState.days > 1 ? 's' : ''}`;
      await notifyAssistantsOnceToday({
        kind: 'MAIL_DEADLINE_SOON',
        title: deadlineState.status === 'TODAY' ? 'Échéance aujourd’hui' : 'Échéance proche',
        message: `« ${label} » — Échéance ${timing} (${deadlineLabel}). [${row.id}]`,
        dedupeKey: row.id,
      });
      soonAlerts += 1;
    }
  }

  return { overdueAlerts, soonAlerts };
}
