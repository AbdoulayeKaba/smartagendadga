/** Créneaux de dépôt drag & drop sur le calendrier DG. */
export const CALENDAR_DROP_SLOTS = [
  {
    id: 'morning',
    label: 'Matin',
    hint: '08h – 12h',
    startHour: 9,
    startMinute: 0,
    endHour: 12,
  },
  {
    id: 'afternoon',
    label: 'Après-midi',
    hint: '14h – 18h',
    startHour: 14,
    startMinute: 0,
    endHour: 18,
  },
] as const;

export type CalendarSlotId = (typeof CALENDAR_DROP_SLOTS)[number]['id'];

export function slotStartTime(slotId: CalendarSlotId) {
  const slot = CALENDAR_DROP_SLOTS.find((s) => s.id === slotId);
  if (!slot) return { hour: 9, minute: 0 };
  return { hour: slot.startHour, minute: slot.startMinute };
}

export function appointmentInSlot(startAtIso: string, slotId: CalendarSlotId) {
  const h = new Date(startAtIso).getHours();
  if (slotId === 'morning') return h < 13;
  return h >= 13;
}
