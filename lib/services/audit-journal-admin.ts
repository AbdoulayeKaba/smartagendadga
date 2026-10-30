import {
  computeAuditStats,
  filterAuditEntries,
  normalizeDgAuditRow,
  type AuditJournalEntry,
  type AuditJournalFilters,
} from '@/lib/dg/audit-journal';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockAuditJournalUsers, mockListAuditJournal } from '@/lib/mock/audit-journal-store';
import { prisma } from '@/lib/prisma';
import type { DgRole } from '@/lib/dg/rbac';
import { dgRoleLabel } from '@/lib/dg/role-labels';

export async function listAuditJournal(filters: AuditJournalFilters = {}) {
  const all: AuditJournalEntry[] = isMockDataEnabled()
    ? mockListAuditJournal(500)
    : (
        await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true },
            },
          },
        })
      ).map((row) =>
        normalizeDgAuditRow({
          id: row.id,
          createdAt: row.createdAt,
          userId: row.userId,
          action: row.action,
          meta: row.meta,
          appointmentId: row.appointmentId,
          user: {
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            email: row.user.email,
            role: row.user.role as DgRole,
          },
        })
      );

  const filtered = filterAuditEntries(all, filters);
  const { stats, dominant } = computeAuditStats(all, filtered);
  const users = isMockDataEnabled()
    ? mockAuditJournalUsers()
    : (
        await prisma.user.findMany({
          where: { archived: false },
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
          orderBy: { email: 'asc' },
        })
      ).map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role as DgRole,
        roleLabel: dgRoleLabel(u.role as DgRole),
      }));

  return {
    items: filtered,
    stats,
    dominant,
    users,
    total: filtered.length,
  };
}
