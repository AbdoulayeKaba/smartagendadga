import { resolveReminderOffsets, reminderKindForOffset, shouldDispatchScheduledAppointmentMail } from '@/lib/dg/appointment-reminder-schedule';
import type { AppointmentStatus } from '@prisma/client';

export type AppointmentMailProofStatus = 'sent' | 'scheduled' | 'skipped';

export type AppointmentMailProofLine = {
  kind: string;
  label: string;
  status: AppointmentMailProofStatus;
  at: string | null;
  detail: string;
};

export type AppointmentMailProofNotification = {
  kind: string;
  emailSent: boolean;
  scheduledFor: Date | null;
  sentAt: Date | null;
};

const KIND_LABELS: Record<string, string> = {
  APPROVED: 'Confirmation',
  REQUEST_CREATED: 'Demande enregistrée',
  REMINDER_24H: 'Rappel 24 heures',
  REMINDER_1H: 'Rappel 1 heure',
  MEETING_STARTED: 'Réunion en cours',
  MEETING_ENDED: 'Réunion terminée',
  REJECTED: 'Refus',
  RESCHEDULED: 'Report',
};

function pickBest(
  rows: AppointmentMailProofNotification[]
): AppointmentMailProofNotification | null {
  if (rows.length === 0) return null;
  const sent = rows.filter((r) => r.emailSent);
  if (sent.length > 0) {
    return sent.sort(
      (a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0)
    )[0]!;
  }
  return rows.sort(
    (a, b) => (b.scheduledFor?.getTime() ?? 0) - (a.scheduledFor?.getTime() ?? 0)
  )[0]!;
}

function fromRow(
  kind: string,
  row: AppointmentMailProofNotification,
  appointment: { startAt: Date; endAt: Date },
  now: Date
): AppointmentMailProofLine {
  const label = KIND_LABELS[kind] ?? kind;
  if (row.emailSent) {
    return {
      kind,
      label,
      status: 'sent',
      at: row.sentAt?.toISOString() ?? null,
      detail: 'E-mail envoyé',
    };
  }

  const stillRelevant = shouldDispatchScheduledAppointmentMail({
    kind,
    now,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
  });

  if (stillRelevant && row.scheduledFor && row.scheduledFor.getTime() > now.getTime()) {
    return {
      kind,
      label,
      status: 'scheduled',
      at: row.scheduledFor.toISOString(),
      detail: `Prévu le`,
    };
  }

  if (kind === 'REMINDER_24H' || kind === 'REMINDER_1H') {
    return {
      kind,
      label,
      status: 'skipped',
      at: row.scheduledFor?.toISOString() ?? appointment.startAt.toISOString(),
      detail: 'Non envoyé car le créneau est passé',
    };
  }

  if (kind === 'MEETING_STARTED') {
    return {
      kind,
      label,
      status: 'skipped',
      at: null,
      detail: 'Non envoyé — la réunion n’est plus en cours',
    };
  }

  return {
    kind,
    label,
    status: 'skipped',
    at: null,
    detail: 'Notification non envoyée',
  };
}

export function buildAppointmentMailProof(input: {
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  now?: Date;
  reminderMinutesBefore?: number | null;
  notifications: AppointmentMailProofNotification[];
}): AppointmentMailProofLine[] {
  const now = input.now ?? new Date();
  const byKind = new Map<string, AppointmentMailProofNotification[]>();
  for (const n of input.notifications) {
    const list = byKind.get(n.kind) ?? [];
    list.push(n);
    byKind.set(n.kind, list);
  }

  const lines: AppointmentMailProofLine[] = [];
  const order =
    input.status === 'REJECTED'
      ? ['REJECTED']
      : input.status === 'APPROVED'
        ? ['APPROVED', 'REMINDER_24H', 'REMINDER_1H', 'MEETING_STARTED', 'MEETING_ENDED']
        : ['REQUEST_CREATED'];

  for (const kind of order) {
    const row = pickBest(byKind.get(kind) ?? []);
    if (row) {
      lines.push(fromRow(kind, row, input, now));
      continue;
    }

    if (kind === 'APPROVED' && input.status === 'APPROVED') {
      lines.push({
        kind,
        label: KIND_LABELS.APPROVED,
        status: 'skipped',
        at: null,
        detail: 'Confirmation non retracée dans le journal d’envoi',
      });
      continue;
    }

    if ((kind === 'REMINDER_24H' || kind === 'REMINDER_1H') && input.status === 'APPROVED') {
      const expected = new Set(
        resolveReminderOffsets(input.reminderMinutesBefore).map(reminderKindForOffset)
      );
      if (!expected.has(kind as 'REMINDER_24H' | 'REMINDER_1H')) continue;
      if (now.getTime() >= input.startAt.getTime()) {
        lines.push({
          kind,
          label: KIND_LABELS[kind]!,
          status: 'skipped',
          at: null,
          detail: 'Non envoyé car le créneau est passé',
        });
      }
    }
  }

  return lines;
}
