/** Seules ces salles de réunion acceptent une réservation. */
export const RESERVABLE_MEETING_ROOM_NAMES = [
  'Salle de réunion 12ème étage',
  'Salle de réunion 11ème étage',
] as const;

/** Salle affichée par défaut dans les créneaux. */
export const PRIMARY_MEETING_ROOM_NAME = RESERVABLE_MEETING_ROOM_NAMES[0];

export const ROOM_RESERVATION_SCOPE_MESSAGE =
  'La réservation est limitée aux salles de réunion du 11ème et du 12ème étage.';

/** Libellés partagés — une seule source pour éviter les écarts SSR / client. */
export const DG_ROOM_SLOTS_LABEL = 'Créneaux salles';
export const DG_ROOM_RESERVATIONS_LIST_LABEL = 'Liste des réservations salles';
export const DG_ROOM_RESERVATIONS_LINK_LABEL = 'Liste des réservations';
export const DG_ROOM_MY_RESERVATIONS_LINK_LABEL = 'Mes réservations';
export const DG_ROOM_AVAILABILITY_HREF = '/dg/availability';
export const DG_ROOM_RESERVATIONS_HREF = '/dg/availability/reservations';
export const DG_ROOM_MY_RESERVATIONS_HREF = '/dg/availability/reservations/mine';

export function normalizeMeetingRoomName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

export function isPrimaryMeetingRoomName(name: string): boolean {
  return normalizeMeetingRoomName(name) === normalizeMeetingRoomName(PRIMARY_MEETING_ROOM_NAME);
}

export function meetingRoomFloor(name: string): '11' | '12' | null {
  const match = normalizeMeetingRoomName(name).match(/(?:^|\D)(11|12)(?!\d)/);
  if (match?.[1] === '11' || match?.[1] === '12') return match[1];
  return null;
}

/** Salle de réunion du 11ème ou du 12ème étage, y compris une variante d’écriture. */
export function isReservableMeetingRoomName(name: string): boolean {
  const normalized = normalizeMeetingRoomName(name);
  if (!normalized.includes('reunion') || !normalized.includes('etage')) return false;
  return meetingRoomFloor(normalized) != null;
}
