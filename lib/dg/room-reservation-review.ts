import type { RoomUsageType } from '@/lib/dg/room-reservation-form';

export type RoomReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

/** Origine métier de la réservation de salle. */
export type RoomBookingOrigin = 'SLOT' | 'APPOINTMENT';

export type RoomListItemSource = 'reservation' | 'appointment';

export type RoomReservationReviewItem = {
  id: string;
  /** Réservation de salle ou audience DGA occupant la salle (agenda). */
  source?: RoomListItemSource;
  /**
   * Créneau salles (`SLOT`) vs demande de rendez-vous (`APPOINTMENT`).
   * Absent / ignoré pour les audiences agenda synthétiques.
   */
  bookingOrigin?: RoomBookingOrigin;
  /** Identifiant audience si source === 'appointment', ou RDV lié si bookingOrigin === APPOINTMENT. */
  appointmentId?: string;
  roomId: string;
  roomName: string;
  title: string;
  usageType: RoomUsageType;
  organizerService: string;
  participantCount: number | null;
  equipment: string[];
  logisticsNotes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  startAt: string;
  endAt: string;
  status: RoomReservationStatus;
  bookedById: string;
  bookedByName: string;
  bookedByEmail: string;
  bookedByPhone: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  assistantNote: string | null;
  archived?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function roomReservationWasModified(item: { createdAt: string; updatedAt: string }) {
  return new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 3000;
}

export const ROOM_USAGE_LABELS: Record<RoomUsageType, string> = {
  REUNION: 'Réunion',
  COMITE: 'Comité',
  FORMATION: 'Formation',
  ENTRETIEN: 'Entretien',
  AUTRE: 'Autre',
};

export const ROOM_RESERVATION_STATUS_LABELS: Record<RoomReservationStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
};

export const ROOM_RESERVATION_AUTO_EXPIRED_LABEL = 'Expirée';

export const ROOM_BOOKING_ORIGIN_LABELS: Record<RoomBookingOrigin, string> = {
  SLOT: 'Créneau',
  APPOINTMENT: 'Demande RDV',
};
