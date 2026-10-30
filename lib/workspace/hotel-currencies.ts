/** Devises disponibles pour les réservations hôtel (ordre d’affichage). */
export const HOTEL_CURRENCY_OPTIONS = [
  { code: 'GNF', label: 'GNF', menuLabel: 'GNF' },
  { code: 'EUR', label: 'Euro', menuLabel: 'Euro' },
  { code: 'USD', label: 'Dollar', menuLabel: 'Dollar' },
  { code: 'XOF', label: 'CFA', menuLabel: 'CFA' },
] as const;

export type HotelCurrencyCode = (typeof HOTEL_CURRENCY_OPTIONS)[number]['code'];

export const DEFAULT_HOTEL_CURRENCY: HotelCurrencyCode = 'GNF';

export const HOTEL_CURRENCY_CODES = HOTEL_CURRENCY_OPTIONS.map((c) => c.code);

export function hotelCurrencyLabel(code: string): string {
  return HOTEL_CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}
