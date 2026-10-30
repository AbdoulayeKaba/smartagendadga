import { listAuditJournal } from '@/lib/services/audit-journal-admin';
import type { AuditJournalEntry } from '@/lib/dg/audit-journal';
import {
  resolveInvolvement,
  type AppointmentInvolvement,
} from '@/lib/dg/appointment-involvement';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockListAppointments } from '@/lib/mock/store';
import { prisma } from '@/lib/prisma';

export type DgActivityItem = AuditJournalEntry & {
  /** Présent pour un profil sans revue : demandeur ou invité. */
  involvement?: AppointmentInvolvement;
};

export type DgActivityFilters = {
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  /** Limite l'historique aux rendez-vous demandés ou auxquels l'utilisateur est invité. */
  ownUserId?: string;
  ownEmail?: string;
};

function isAppointmentActivity(row: AuditJournalEntry) {
  const code = row.actionCode.toLowerCase();
  const resource = row.resourceType.toLowerCase();
  return code.includes('appointment') || resource.includes('appointment') || resource === 'rdv';
}

async function involvementByAppointment(userId: string, email: string) {
  const map = new Map<string, AppointmentInvolvement>();
  if (isMockDataEnabled()) {
    const rows = [
      ...mockListAppointments({ archived: false }),
      ...mockListAppointments({ archived: true }),
    ];
    for (const row of rows) {
      const involvement = resolveInvolvement({
        userId,
        email,
        requestedById: row.requestedById,
        participants: row.participants,
      });
      if (involvement) map.set(row.id, involvement);
    }
    return map;
  }

  const emailKey = email.trim();
  const rows = await prisma.appointment.findMany({
    where: {
      OR: [
        { requestedById: userId },
        { participants: { some: { userId } } },
        ...(emailKey ? [{ participants: { some: { email: emailKey } } }] : []),
      ],
    },
    select: {
      id: true,
      requestedById: true,
      participants: { select: { userId: true, email: true } },
    },
  });
  for (const row of rows) {
    const involvement = resolveInvolvement({
      userId,
      email,
      requestedById: row.requestedById,
      participants: row.participants,
    });
    if (involvement) map.set(row.id, involvement);
  }
  return map;
}

export async function listDgAppointmentActivity(filters: DgActivityFilters = {}) {
  const journal = await listAuditJournal({
    q: filters.q,
    from: filters.from,
    to: filters.to,
    category: 'ALL',
  });

  let items: DgActivityItem[] = journal.items.filter(isAppointmentActivity);
  if (filters.ownUserId) {
    const owned = await involvementByAppointment(filters.ownUserId, filters.ownEmail ?? '');
    items = items.flatMap((row) => {
      if (!row.appointmentId) return [];
      const involvement = owned.get(row.appointmentId);
      if (!involvement) return [];
      return [{ ...row, involvement }];
    });
  }
  items = items.slice(0, filters.limit ?? 200);

  return {
    items,
    total: items.length,
    stats: {
      approvals: items.filter((i) => i.actionCode.includes('approve')).length,
      rejections: items.filter((i) => i.actionCode.includes('reject')).length,
      reschedules: items.filter((i) => i.actionCode.includes('reschedule')).length,
      requests: items.filter((i) => i.actionCode.includes('request')).length,
    },
  };
}
