import { format } from 'date-fns';
import type { PreContactChoice, UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import type {
  RoomEquipmentValue,
  RoomUsageType,
} from '@/lib/dg/room-reservation-form';
import {
  ROOM_EQUIPMENT_OPTIONS,
  ROOM_USAGE_OPTIONS,
  buildRoomReservationBody,
} from '@/lib/dg/room-reservation-form';

export const ONLINE_MEETING_LOCATION = 'En ligne (Teams)';

export function planningDurationLabel(startTime: string, endTime: string): string {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number);
  const [eh = 0, em = 0] = endTime.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (!startTime || !endTime || mins <= 0) return '';
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours && minutes) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  if (hours) return `${hours} h 00`;
  return `${minutes} min`;
}

export const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'INTERNAL', label: 'Interne' },
  { value: 'EXTERNAL', label: 'Externe' },
  { value: 'MINISTRY', label: 'Ministère' },
  { value: 'PERSONAL', label: 'Personnel' },
] as const;

export type AppointmentTypeValue = (typeof APPOINTMENT_TYPE_OPTIONS)[number]['value'];

export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Conakry', label: 'Conakry (GMT)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
  { value: 'Africa/Casablanca', label: 'Casablanca' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'UTC', label: 'UTC' },
] as const;

/** Valeur du select : '' = rappels standards (24h + 1h à l’approbation), '0' = aucun, sinon minutes avant le RDV. */
export const REMINDER_SELECT_OPTIONS = [
  { value: '', label: 'Rappels standards (24 h et 1 h avant)' },
  { value: '0', label: 'Aucun rappel par e-mail' },
  { value: '15', label: '15 minutes avant' },
  { value: '30', label: '30 minutes avant' },
  { value: '60', label: '1 heure avant' },
  { value: '120', label: '2 heures avant' },
  { value: '1440', label: '24 heures avant' },
] as const;

export type PlanningParticipant = {
  userId?: string;
  email: string;
  name: string;
};

export type AppointmentPlanningForm = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
  location: string;
  locationRef: string;
  motifRef: string;
  reminderSelect: string;
  priority: string;
  type: string;
  /** Participants internes (ids utilisateurs sélectionnés). */
  participantUserIds: string[];
  /** Participant externe (ex. contact stratégique hors annuaire). */
  externalParticipant: PlanningParticipant | null;
  /** Adresses mises en copie par l’assistante ou le DGA. */
  copyEmails: string[];
  urgentOverride: boolean;
  urgencyLevel: UrgencyLevel;
  justification: string;
  preContact: PreContactChoice[];
  appointmentTypeRef: string;
  strategicContactId: string;
  isOnlineMeeting: boolean;
  meetingFormat: 'PRESENTIEL' | 'ONLINE' | 'HYBRID';
  /** Option : créer aussi une demande de réservation de salle sur le même créneau. */
  reserveRoom: boolean;
  roomId: string;
  roomName: string;
  roomUsageType: RoomUsageType;
  roomOrganizerService: string;
  roomParticipantCount: string;
  roomEquipment: RoomEquipmentValue[];
  roomLogisticsNotes: string;
  /** Id réservation salle liée (édition / sync). */
  roomReservationId: string;
  /** Coordonnées du demandeur, saisies par l’assistante ou le DGA. */
  requesterContactEnabled: boolean;
  requesterFullName: string;
  requesterPhone: string;
  requesterEmail: string;
};

export type PlanningInitial = {
  editId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  description?: string;
  allDay?: boolean;
  timezone?: string;
  reminderSelect?: string;
  priority?: string;
  participantName?: string;
  participantEmail?: string;
  participantUserId?: string;
  participantUserIds?: string[];
  type?: string;
  strategicContactId?: string;
  location?: string;
  locationRef?: string;
  motifRef?: string;
  appointmentTypeRef?: string;
  urgencyLevel?: UrgencyLevel;
  justification?: string;
  preContact?: PreContactChoice[];
  urgentOverride?: boolean;
  isOnlineMeeting?: boolean;
  meetingFormat?: 'PRESENTIEL' | 'ONLINE' | 'HYBRID';
  reserveRoom?: boolean;
  roomId?: string;
  roomName?: string;
  roomUsageType?: RoomUsageType;
  roomEquipment?: RoomEquipmentValue[];
  roomLogisticsNotes?: string;
  roomReservationId?: string;
  requesterFullName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
  copyEmails?: string[];
};

function parseRoomUsageType(value?: string | null): RoomUsageType {
  return ROOM_USAGE_OPTIONS.some((o) => o.value === value)
    ? (value as RoomUsageType)
    : 'REUNION';
}

function parseRoomEquipment(values?: string[] | null): RoomEquipmentValue[] {
  if (!Array.isArray(values)) return [];
  return values.filter((v): v is RoomEquipmentValue =>
    ROOM_EQUIPMENT_OPTIONS.some((o) => o.value === v)
  );
}

function externalParticipantFromInitial(initial?: PlanningInitial): PlanningParticipant | null {
  if (!initial?.participantEmail?.trim()) return null;
  if (initial.participantUserId || (initial.participantUserIds?.length ?? 0) > 0) return null;
  if ((initial.copyEmails?.length ?? 0) > 0) return null;
  return {
    email: initial.participantEmail.trim(),
    name: initial.participantName?.trim() || initial.participantEmail.trim().split('@')[0] || 'Invité',
  };
}

export function buildSubmitParticipants(
  participantUserIds: string[],
  directoryUsers: { id: string; email: string; firstName: string; lastName: string }[],
  externalParticipant?: PlanningParticipant | null,
  copyEmails: string[] = []
): { email: string; name: string; userId?: string; isExternal?: boolean }[] {
  const fromDirectory = participantUserIds
    .map((userId) => {
      const u = directoryUsers.find((x) => x.id === userId);
      if (!u) return null;
      return {
        email: u.email,
        name: `${u.firstName} ${u.lastName}`.trim(),
        userId: u.id,
        isExternal: false as const,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const external =
    externalParticipant?.email.trim()
      ? [
          {
            email: externalParticipant.email.trim(),
            name:
              externalParticipant.name.trim() ||
              externalParticipant.email.trim().split('@')[0] ||
              'Invité',
            isExternal: true as const,
          },
        ]
      : [];

  const copied = copyEmails
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({
      email,
      name: email.split('@')[0] || 'Invité',
      isExternal: true as const,
    }));

  const seen = new Set<string>();
  const merged: { email: string; name: string; userId?: string; isExternal?: boolean }[] = [];
  for (const p of [...fromDirectory, ...external, ...copied]) {
    const key = p.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  return merged;
}

export function emptyPlanningForm(initial?: PlanningInitial): AppointmentPlanningForm {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    date: initial?.date ?? format(new Date(), 'yyyy-MM-dd'),
    startTime: initial?.startTime ?? '09:00',
    endTime: initial?.endTime ?? '10:00',
    allDay: false,
    timezone: initial?.timezone ?? 'Africa/Conakry',
    location: initial?.location ?? '',
    locationRef: initial?.locationRef ?? '',
    motifRef: initial?.motifRef ?? '',
    reminderSelect: initial?.reminderSelect ?? '',
    priority: initial?.priority ?? 'MEDIUM',
    type: initial?.type ?? 'INTERNAL',
    participantUserIds:
      initial?.participantUserIds ??
      (initial?.participantUserId ? [initial.participantUserId] : []),
    externalParticipant: externalParticipantFromInitial(initial),
    copyEmails: initial?.copyEmails ?? [],
    urgentOverride: initial?.urgentOverride ?? false,
    meetingFormat:
      initial?.meetingFormat ?? (initial?.isOnlineMeeting ? 'ONLINE' : 'PRESENTIEL'),
    urgencyLevel: initial?.urgencyLevel ?? 'NORMAL',
    justification: initial?.justification ?? '',
    preContact: initial?.preContact ?? [],
    appointmentTypeRef: initial?.appointmentTypeRef ?? '',
    strategicContactId: initial?.strategicContactId ?? '',
    isOnlineMeeting: initial?.isOnlineMeeting ?? false,
    reserveRoom: initial?.reserveRoom ?? false,
    roomId: initial?.roomId ?? '',
    roomName: initial?.roomName ?? '',
    roomUsageType: parseRoomUsageType(initial?.roomUsageType),
    roomOrganizerService: '',
    roomParticipantCount: '',
    roomEquipment: parseRoomEquipment(initial?.roomEquipment),
    roomLogisticsNotes: initial?.roomLogisticsNotes ?? '',
    roomReservationId: initial?.roomReservationId ?? '',
    requesterContactEnabled: Boolean(
      initial?.requesterFullName?.trim() ||
        initial?.requesterPhone?.trim() ||
        initial?.requesterEmail?.trim()
    ),
    requesterFullName: initial?.requesterFullName ?? '',
    requesterPhone: initial?.requesterPhone ?? '',
    requesterEmail: initial?.requesterEmail ?? '',
  };
}

const REQUESTER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Coordonnées du demandeur, contrôlées seulement si la case est cochée. */
export function requesterContactError(input: {
  fullName: string;
  phone: string;
  email: string;
}): string | null {
  const name = input.fullName.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || !name.includes(' ')) {
    return 'Indiquez le nom complet du demandeur.';
  }
  const digits = input.phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return 'Indiquez un numéro de téléphone valide pour le demandeur.';
  }
  if (!REQUESTER_EMAIL.test(input.email.trim())) {
    return 'Indiquez une adresse e-mail valide pour le demandeur.';
  }
  return null;
}

export type AppointmentFormSource = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date | string;
  endAt: Date | string;
  priority: string;
  type: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  reminderMinutesBefore: number | null;
  strategicContactId: string | null;
  urgentOverride: boolean;
  isOnlineMeeting?: boolean;
  requestedById?: string;
  participants: {
    userId: string | null;
    email: string;
    name: string;
    isExternal: boolean;
  }[];
};

export function appointmentToPlanningInitial(row: AppointmentFormSource): PlanningInitial {
  const { meta, userText } = parseAppointmentMeta(row.description);
  const start = new Date(row.startAt);
  const end = new Date(row.endAt);
  const participantUserIds = row.participants
    .map((p) => p.userId)
    .filter((id): id is string => Boolean(id) && id !== row.requestedById);
  const copyEmails = row.participants
    .filter((p) => p.isExternal && !p.userId)
    .map((p) => p.email.trim())
    .filter(Boolean);

  let reminderSelect = '';
  if (row.reminderMinutesBefore === 0) reminderSelect = '0';
  else if (row.reminderMinutesBefore != null) reminderSelect = String(row.reminderMinutesBefore);

  return {
    editId: row.id,
    title: row.title,
    description: userText,
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
    allDay: row.allDay,
    timezone: row.timezone,
    location: row.location ?? '',
    locationRef: meta.locationRef ?? '',
    motifRef: meta.motifRef ?? '',
    appointmentTypeRef: meta.appointmentTypeRef ?? '',
    reminderSelect,
    priority: row.priority,
    type: row.type,
    participantUserIds,
    copyEmails,
    ...(copyEmails[0]
      ? { participantEmail: copyEmails[0], participantName: copyEmails[0].split('@')[0] || 'Invité' }
      : {}),
    urgencyLevel: meta.urgencyLevel ?? 'NORMAL',
    justification: meta.justification ?? '',
    preContact: meta.preContact ?? [],
    urgentOverride: row.urgentOverride,
    requesterFullName: meta.requesterFullName ?? '',
    requesterPhone: meta.requesterPhone ?? '',
    requesterEmail: meta.requesterEmail ?? '',
    strategicContactId: row.strategicContactId ?? '',
    isOnlineMeeting: row.isOnlineMeeting ?? false,
    meetingFormat:
      meta.meetingFormat ?? ((row.isOnlineMeeting ?? false) ? 'ONLINE' : 'PRESENTIEL'),
    ...(meta.roomReserved
      ? {
          reserveRoom: true as const,
          roomId: meta.roomId ?? '',
          roomName: meta.roomName?.trim() || row.location?.trim() || '',
          roomUsageType: parseRoomUsageType(meta.roomUsageType),
          roomEquipment: parseRoomEquipment(meta.roomEquipment),
          roomReservationId: meta.roomReservationId ?? '',
        }
      : {}),
  };
}

export function resolvePlanningTimes(form: AppointmentPlanningForm): {
  startTime: string;
  endTime: string;
} {
  if (form.allDay) {
    return { startTime: '00:00', endTime: '23:59' };
  }
  return { startTime: form.startTime, endTime: form.endTime };
}

export function planningSlotSignature(input: {
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
}): string {
  const { startTime, endTime } = resolvePlanningTimes(input);
  return `${input.date}|${startTime}|${endTime}|${input.allDay}`;
}

export function initialPlanningSlotSignature(initial?: PlanningInitial): string | null {
  if (!initial?.date) return null;
  return planningSlotSignature(emptyPlanningForm(initial));
}

/** null = rappels standards à l’approbation ; 0 = aucun ; >0 = un seul rappel. */
export function parseReminderMinutes(reminderSelect: string): number | null | undefined {
  if (reminderSelect === '') return undefined;
  if (reminderSelect === '0') return 0;
  const n = Number(reminderSelect);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function buildAppointmentRequestBody(
  form: AppointmentPlanningForm,
  options: { urgentOverride: boolean; participants: { email: string; name: string; isExternal?: boolean }[] }
) {
  const { startTime, endTime } = resolvePlanningTimes(form);
  const reminderMinutesBefore = parseReminderMinutes(form.reminderSelect);
  const location = form.isOnlineMeeting
    ? ONLINE_MEETING_LOCATION
    : form.location.trim() || null;

  return {
    title: form.title,
    description: form.description || null,
    date: form.date,
    startTime,
    endTime,
    allDay: false,
    timezone: form.timezone,
    location,
    ...(reminderMinutesBefore !== undefined ? { reminderMinutesBefore } : {}),
    priority: form.priority,
    type: form.type,
    participants: options.participants,
    urgentOverride: options.urgentOverride,
    urgencyLevel: form.urgencyLevel,
    justification: form.justification.trim() || undefined,
    preContact: form.preContact,
    appointmentTypeRef: form.appointmentTypeRef || undefined,
    locationRef: form.isOnlineMeeting ? undefined : form.locationRef || undefined,
    motifRef: form.motifRef || undefined,
    meetingFormat: form.meetingFormat,
    ...(form.strategicContactId ? { strategicContactId: form.strategicContactId } : {}),
    isOnlineMeeting: form.isOnlineMeeting,
    requesterFullName: form.requesterFullName.trim().replace(/\s+/g, ' '),
    requesterPhone: form.requesterPhone.trim(),
    requesterEmail: form.requesterEmail.trim(),
  };
}

export function validatePlanningRoomBooking(form: AppointmentPlanningForm): string | null {
  if (form.isOnlineMeeting && form.meetingFormat !== 'HYBRID') return null;
  if (!form.reserveRoom) return null;
  if (form.allDay) {
    return 'La réservation de salle n’est pas disponible pour un rendez-vous « toute la journée ».';
  }
  if (!form.date || !form.startTime || !form.endTime) {
    return 'Indiquez la date et l’horaire du rendez-vous : la salle utilise le même créneau.';
  }
  const [sh = 0, sm = 0] = form.startTime.split(':').map(Number);
  const [eh = 0, em = 0] = form.endTime.split(':').map(Number);
  if (eh * 60 + em <= sh * 60 + sm) {
    return 'L’heure de fin du rendez-vous doit être après l’heure de début (créneau salle identique).';
  }
  if (!form.roomId.trim() || !form.roomName.trim()) {
    return 'Sélectionnez une salle à réserver.';
  }
  return null;
}

/** Corps POST/PATCH /api/dg/room-reservations — créneau strictement identique au RDV. */
export function buildPlanningRoomReservationBody(
  form: AppointmentPlanningForm,
  options?: { excludeAppointmentId?: string }
) {
  // Même date / début / fin que le rendez-vous (pas de créneau salle distinct).
  const startTime = form.startTime;
  const endTime = form.endTime;
  return {
    ...buildRoomReservationBody(
      {
        title: form.title.trim(),
        usageType: form.roomUsageType,
        organizerService: form.roomOrganizerService.trim() || 'Rendez-vous',
        participantCount: form.roomParticipantCount,
        equipment: form.roomEquipment,
        logisticsNotes: form.roomLogisticsNotes,
        contactPhone: '',
        contactEmail: '',
        date: form.date,
        startTime,
        endTime,
      },
      { id: form.roomId, name: form.roomName }
    ),
    bookingOrigin: 'APPOINTMENT' as const,
    ...(options?.excludeAppointmentId?.trim()
      ? {
          excludeAppointmentId: options.excludeAppointmentId.trim(),
          appointmentId: options.excludeAppointmentId.trim(),
        }
      : {}),
  };
}

export function buildConflictCheckBody(
  form: AppointmentPlanningForm,
  urgentOverride: boolean,
  excludeId?: string
) {
  const { startTime, endTime } = resolvePlanningTimes(form);
  return {
    date: form.date,
    startTime,
    endTime,
    allDay: false,
    urgentOverride,
    ...(excludeId ? { excludeId } : {}),
    title: form.title,
    description: form.description || undefined,
    urgencyLevel: form.urgencyLevel,
    justification: form.justification || undefined,
    preContact: form.preContact,
    appointmentTypeRef: form.appointmentTypeRef || undefined,
    locationRef: form.locationRef || undefined,
    motifRef: form.motifRef || undefined,
    location: form.location.trim() || undefined,
    isOnlineMeeting: form.isOnlineMeeting,
  };
}
