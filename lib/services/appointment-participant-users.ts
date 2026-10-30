import { isMockDataEnabled } from '@/lib/mock/config';
import { mockListUsers } from '@/lib/mock/users-store';
import { prisma } from '@/lib/prisma';

export type AppointmentParticipantUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
};

function sortUsers(a: AppointmentParticipantUser, b: AppointmentParticipantUser) {
  return (
    a.lastName.localeCompare(b.lastName, 'fr') ||
    a.firstName.localeCompare(b.firstName, 'fr') ||
    a.email.localeCompare(b.email, 'fr')
  );
}

/** Utilisateurs actifs proposés comme participants à un rendez-vous. */
export async function listAppointmentParticipantUsers(): Promise<AppointmentParticipantUser[]> {
  if (isMockDataEnabled()) {
    return mockListUsers()
      .filter((u) => u.active && !u.archived)
      .map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        department: u.department ?? '',
      }))
      .sort(sortUsers);
  }

  const rows = await prisma.user.findMany({
    where: { active: true, archived: false },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      department: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return rows
    .map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      department: u.department ?? '',
    }))
    .sort(sortUsers);
}
