import { listAppointmentsForReview } from '@/lib/services/appointments-review';
import { listAppointments } from '@/lib/services/appointments';

export type DgSearchResult = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  priority: string;
  requestedByName: string;
  href: string;
};

export async function searchDgAppointments(q: string, limit = 12) {
  const needle = q.trim();
  if (needle.length < 2) return [] as DgSearchResult[];

  const { items } = await listAppointmentsForReview({ q: needle, status: 'ALL' });

  return items.slice(0, limit).map((a) => ({
    id: a.id,
    title: a.title,
    startAt: String(a.startAt),
    endAt: String(a.endAt),
    status: a.status,
    priority: a.priority,
    requestedByName: `${a.requestedBy.firstName} ${a.requestedBy.lastName}`,
    href: '/dg/appointments',
  }));
}

export async function searchMyAppointments(userId: string, q: string, limit = 12) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [] as DgSearchResult[];

  const rows = await listAppointments({ requestedById: userId });
  return rows
    .filter((a) => {
      const hay = [a.title, a.status, a.priority, a.requestedBy.firstName, a.requestedBy.lastName]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      priority: a.priority,
      requestedByName: `${a.requestedBy.firstName} ${a.requestedBy.lastName}`,
      href: '/appointments/mine',
    }));
}
