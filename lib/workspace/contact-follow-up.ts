import type { ContactAppointment, ContactAppointmentStats } from '@/lib/workspace/types';

type AppointmentLike = Pick<ContactAppointment, 'status' | 'startAt' | 'endAt'> & {
  archived?: boolean;
};

export function isContactVisit(appointment: AppointmentLike, now = new Date()): boolean {
  if (appointment.status !== 'APPROVED' || appointment.archived) return false;
  return new Date(appointment.endAt).getTime() < now.getTime();
}

export function isUpcomingContactAppointment(appointment: AppointmentLike, now = new Date()): boolean {
  if (appointment.status !== 'APPROVED' || appointment.archived) return false;
  return new Date(appointment.startAt).getTime() >= now.getTime();
}

export function computeContactAppointmentStats(
  items: AppointmentLike[],
  now = new Date()
): ContactAppointmentStats {
  let visits = 0;
  let upcoming = 0;
  let pending = 0;
  let rejected = 0;

  for (const item of items) {
    if (item.archived) continue;
    if (isContactVisit(item, now)) visits += 1;
    else if (isUpcomingContactAppointment(item, now)) upcoming += 1;
    else if (item.status === 'PENDING') pending += 1;
    else if (item.status === 'REJECTED') rejected += 1;
  }

  return {
    visits,
    upcoming,
    pending,
    rejected,
    total: visits + upcoming + pending + rejected,
  };
}

export type ContactAppointmentTab = 'all' | 'upcoming' | 'pending';

export function filterContactAppointmentsByTab<T extends AppointmentLike>(
  items: T[],
  tab: ContactAppointmentTab,
  now = new Date()
): T[] {
  if (tab === 'all') return items.filter((item) => !item.archived);
  if (tab === 'pending') return items.filter((item) => !item.archived && item.status === 'PENDING');
  return items.filter((item) => isUpcomingContactAppointment(item, now));
}

export function enrichContactAppointment<T extends ContactAppointment>(
  appointment: T,
  now = new Date()
): T & { visited: boolean; upcoming: boolean } {
  return {
    ...appointment,
    visited: isContactVisit(appointment, now),
    upcoming: isUpcomingContactAppointment(appointment, now),
  };
}
