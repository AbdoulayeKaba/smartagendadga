import type { RoomReservationStatus } from '@/lib/dg/room-reservation-review';

/** Palette badge `admin-appt-badge-auto-rejected` (statut Annulée). */
export const ROOM_RESERVATION_CANCELLED_BADGE = {
  background: '#ffedd5',
  text: '#9a3412',
  border: '#fdba74',
} as const;

/**
 * Couleurs des graphiques alignées sur les badges du tableau
 * (admin-appt-badge-pending, -approved, -rejected, -auto-rejected).
 */
export const ROOM_RESERVATION_STATUS_CHART_COLORS: Record<RoomReservationStatus, string> = {
  PENDING: 'oklch(0.42 0.11 155)',
  CONFIRMED: '#10b981',
  REJECTED: '#ef4444',
  CANCELLED: '#fb923c',
  COMPLETED: '#475569',
};

export const ROOM_RESERVATION_STATUS_FLOW_ORDER: RoomReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

export function roomReservationStatusChartColor(status: RoomReservationStatus): string {
  return ROOM_RESERVATION_STATUS_CHART_COLORS[status];
}
