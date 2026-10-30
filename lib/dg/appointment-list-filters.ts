import type { AppointmentStatus } from '@prisma/client';

export type AppointmentListFilters = {
  status?: AppointmentStatus;
  from?: Date;
  to?: Date;
  /** Période choisie par l’utilisateur : uniquement le jour du créneau, pas la date de soumission. */
  slotOnly?: boolean;
  requestedById?: string;
  archived?: boolean;
  isOnlineMeeting?: boolean;
};
