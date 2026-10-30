import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';

export const ROOM_USAGE_OPTIONS = [
  { value: 'REUNION', label: 'Réunion de travail' },
  { value: 'COMITE', label: 'Comité / instance' },
  { value: 'FORMATION', label: 'Formation / atelier' },
  { value: 'ENTRETIEN', label: 'Entretien' },
  { value: 'AUTRE', label: 'Autre usage' },
] as const;

export type RoomUsageType = (typeof ROOM_USAGE_OPTIONS)[number]['value'];

export const ROOM_EQUIPMENT_OPTIONS = [
  { value: 'videoprojecteur', label: 'Vidéoprojecteur' },
  { value: 'micro', label: 'Micro / sonorisation' },
  { value: 'ecran', label: 'Écran' },
] as const;

export type RoomEquipmentValue = (typeof ROOM_EQUIPMENT_OPTIONS)[number]['value'];

export type RoomReservationInitial = {
  roomId?: string;
  roomName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export type RoomReservationForm = {
  title: string;
  usageType: RoomUsageType;
  organizerService: string;
  participantCount: string;
  equipment: RoomEquipmentValue[];
  logisticsNotes: string;
  contactPhone: string;
  contactEmail: string;
  date: string;
  startTime: string;
  endTime: string;
};

export function emptyRoomReservationForm(initial?: RoomReservationInitial): RoomReservationForm {
  return {
    title: '',
    usageType: 'REUNION',
    organizerService: '',
    participantCount: '',
    equipment: [],
    logisticsNotes: '',
    contactPhone: '',
    contactEmail: '',
    date: initial?.date ?? '',
    startTime: initial?.startTime ?? '',
    endTime: initial?.endTime ?? '',
  };
}

export function buildRoomReservationBody(
  form: RoomReservationForm,
  room: { id: string; name: string }
) {
  const participantCount = form.participantCount.trim()
    ? Number.parseInt(form.participantCount, 10)
    : undefined;

  return {
    roomId: room.id,
    roomName: room.name,
    title: form.title.trim(),
    usageType: form.usageType,
    organizerService: form.organizerService.trim() || 'Non précisé',
    participantCount: Number.isFinite(participantCount) ? participantCount : undefined,
    equipment: form.equipment,
    logisticsNotes: form.logisticsNotes.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    contactEmail: form.contactEmail.trim() || undefined,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    bookingOrigin: 'SLOT' as const,
  };
}

export function roomReservationFormFromItem(item: {
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
}): RoomReservationForm {
  return {
    title: item.title,
    usageType: item.usageType,
    organizerService: item.organizerService,
    participantCount: item.participantCount != null ? String(item.participantCount) : '',
    equipment: item.equipment.filter((v): v is RoomEquipmentValue =>
      ROOM_EQUIPMENT_OPTIONS.some((o) => o.value === v)
    ),
    logisticsNotes: item.logisticsNotes ?? '',
    contactPhone: item.contactPhone ?? '',
    contactEmail: item.contactEmail ?? '',
    date: formatIsoDateInAppTz(item.startAt),
    startTime: formatTimeInAppTz(item.startAt),
    endTime: formatTimeInAppTz(item.endAt),
  };
}

export function canEditRoomReservation(
  item: {
    source?: string;
    status: string;
    archived?: boolean;
    bookedById: string;
  },
  options: { canReview: boolean; userId: string }
): boolean {
  if (item.source === 'appointment') return false;
  if (item.archived) return false;
  if (item.status === 'REJECTED' || item.status === 'CANCELLED') return false;
  if (options.canReview) {
    return item.status === 'PENDING' || item.status === 'CONFIRMED';
  }
  return item.status === 'PENDING' && item.bookedById === options.userId;
}
