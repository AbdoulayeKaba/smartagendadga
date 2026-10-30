export const HOTEL_ROOM_TYPE_OPTIONS = [
  'Simple',
  'Double',
  'Lits jumeaux',
  'Triple',
  'Suite',
  'Suite junior',
  'Chambre familiale',
  'Studio',
  'Appartement',
] as const;

export type HotelRoomType = (typeof HOTEL_ROOM_TYPE_OPTIONS)[number];

export function isKnownHotelRoomType(value: string): value is HotelRoomType {
  return (HOTEL_ROOM_TYPE_OPTIONS as readonly string[]).includes(value);
}

/** Options affichées : liste standard + valeur legacy éventuelle. */
export function hotelRoomTypeSelectOptions(current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed || isKnownHotelRoomType(trimmed)) {
    return [...HOTEL_ROOM_TYPE_OPTIONS];
  }
  return [...HOTEL_ROOM_TYPE_OPTIONS, trimmed];
}
