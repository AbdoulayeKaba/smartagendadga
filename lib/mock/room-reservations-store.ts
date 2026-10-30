import type { RoomEquipmentValue, RoomUsageType } from '@/lib/dg/room-reservation-form';
import { ROOM_AUTO_EXPIRE_PENDING_REASON } from '@/lib/dg/room-reservation-expiry';

export type RoomReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';
export type RoomBookingOrigin = 'SLOT' | 'APPOINTMENT';

export type RoomReservationRow = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  usageType: RoomUsageType;
  organizerService: string;
  participantCount: number | null;
  equipment: RoomEquipmentValue[];
  logisticsNotes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  startAt: Date;
  endAt: Date;
  status: RoomReservationStatus;
  bookedById: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  assistantNote: string | null;
  bookingOrigin: RoomBookingOrigin;
  appointmentId: string | null;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bookedBy?: { id: string; firstName: string; lastName: string; email: string; phone?: string | null };
};

let reservations: RoomReservationRow[] = [];
let idSeq = 1;

function nextId() {
  return `mock-room-res-${idSeq++}`;
}

export function mockListRoomReservations(filters?: {
  from?: Date;
  to?: Date;
  roomId?: string;
  roomName?: string;
  status?: RoomReservationStatus | RoomReservationStatus[];
  bookedById?: string;
  archived?: boolean;
}) {
  const statuses = filters?.status
    ? Array.isArray(filters.status)
      ? filters.status
      : [filters.status]
    : null;
  const archived = filters?.archived ?? false;

  return reservations
    .filter((row) => {
    if (row.archived !== archived) return false;
    if (statuses && !statuses.includes(row.status)) return false;
    if (filters?.bookedById && row.bookedById !== filters.bookedById) return false;
    if (filters?.roomId && row.roomId !== filters.roomId) return false;
    if (filters?.roomName && row.roomName !== filters.roomName) return false;
    if (filters?.from && row.endAt < filters.from) return false;
    if (filters?.to && row.startAt > filters.to) return false;
    return true;
  })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function mockCreateRoomReservation(input: {
  roomId: string;
  roomName: string;
  title: string;
  usageType: RoomUsageType;
  organizerService: string;
  participantCount?: number;
  equipment: RoomEquipmentValue[];
  logisticsNotes?: string;
  contactPhone?: string;
  contactEmail?: string;
  startAt: Date;
  endAt: Date;
  bookedById: string;
  status?: RoomReservationStatus;
  bookingOrigin?: RoomBookingOrigin;
  appointmentId?: string | null;
}) {
  const now = new Date();
  const bookingOrigin =
    input.bookingOrigin ??
    (/rendez[\s-]?vous/i.test(input.organizerService) ? 'APPOINTMENT' : 'SLOT');
  const row: RoomReservationRow = {
    id: nextId(),
    roomId: input.roomId,
    roomName: input.roomName,
    title: input.title,
    usageType: input.usageType,
    organizerService: input.organizerService,
    participantCount: input.participantCount ?? null,
    equipment: input.equipment,
    logisticsNotes: input.logisticsNotes ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    status: input.status ?? 'PENDING',
    bookedById: input.bookedById,
    reviewedById: input.status === 'CONFIRMED' ? input.bookedById : null,
    reviewedAt: input.status === 'CONFIRMED' ? now : null,
    rejectionReason: null,
    assistantNote: null,
    bookingOrigin,
    appointmentId: input.appointmentId ?? null,
    archived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  reservations = [...reservations, row];
  return row;
}

export function mockUpdateRoomReservation(
  id: string,
  input: {
    roomId: string;
    roomName: string;
    title: string;
    usageType: RoomUsageType;
    organizerService: string;
    participantCount?: number;
    equipment: RoomEquipmentValue[];
    logisticsNotes?: string;
    contactPhone?: string;
    contactEmail?: string;
    startAt: Date;
    endAt: Date;
    status?: RoomReservationStatus;
    reviewedById?: string | null;
    reviewedAt?: Date | null;
    rejectionReason?: string | null;
    assistantNote?: string | null;
  }
) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.archived) return null;
  const now = new Date();
  const updated: RoomReservationRow = {
    ...row,
    roomId: input.roomId,
    roomName: input.roomName,
    title: input.title,
    usageType: input.usageType,
    organizerService: input.organizerService,
    participantCount: input.participantCount ?? null,
    equipment: input.equipment,
    logisticsNotes: input.logisticsNotes ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    status: input.status ?? row.status,
    reviewedById: input.reviewedById !== undefined ? input.reviewedById : row.reviewedById,
    reviewedAt: input.reviewedAt !== undefined ? input.reviewedAt : row.reviewedAt,
    rejectionReason:
      input.rejectionReason !== undefined ? input.rejectionReason : row.rejectionReason,
    assistantNote: input.assistantNote !== undefined ? input.assistantNote : row.assistantNote,
    updatedAt: now,
  };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockApproveRoomReservation(id: string, reviewerId: string) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.status !== 'PENDING' || row.archived) return null;
  const now = new Date();
  const updated: RoomReservationRow = {
    ...row,
    status: 'CONFIRMED',
    reviewedById: reviewerId,
    reviewedAt: now,
    assistantNote: null,
    updatedAt: now,
  };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockRejectRoomReservation(id: string, reviewerId: string, reason?: string) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.status !== 'PENDING' || row.archived) return null;
  if (!reason?.trim() || reason.trim().length < 3) return null;
  const now = new Date();
  const updated: RoomReservationRow = {
    ...row,
    status: 'REJECTED',
    reviewedById: reviewerId,
    reviewedAt: now,
    rejectionReason: reason ?? null,
    updatedAt: now,
  };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockProposeRoomReservationSlot(
  id: string,
  reviewerId: string,
  input: { startAt: Date; endAt: Date; note?: string }
) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.status !== 'PENDING' || row.archived) return null;
  const now = new Date();
  const updated: RoomReservationRow = {
    ...row,
    startAt: input.startAt,
    endAt: input.endAt,
    status: 'PENDING',
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    assistantNote: input.note?.trim() || null,
    updatedAt: now,
  };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockCancelRoomReservation(id: string, actorId: string, asReviewer: boolean) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.archived) return null;
  if (row.status !== 'PENDING' && row.status !== 'CONFIRMED') return null;
  if (!asReviewer && row.bookedById !== actorId) return null;
  const now = new Date();
  const updated: RoomReservationRow = {
    ...row,
    status: 'CANCELLED',
    reviewedById: asReviewer ? actorId : row.reviewedById,
    reviewedAt: now,
    updatedAt: now,
  };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

/** Expire les PENDING (début passé) et termine les CONFIRMED (fin passée). */
export function mockAutoExpireRoomReservations(now: Date = new Date()) {
  const expiredIds: string[] = [];
  const completedIds: string[] = [];

  reservations = reservations.map((row) => {
    if (row.archived) return row;
    if (row.status === 'PENDING' && row.startAt.getTime() <= now.getTime()) {
      expiredIds.push(row.id);
      return {
        ...row,
        status: 'REJECTED' as const,
        rejectionReason: ROOM_AUTO_EXPIRE_PENDING_REASON,
        reviewedAt: now,
        updatedAt: now,
      };
    }
    if (row.status === 'CONFIRMED' && row.endAt.getTime() <= now.getTime()) {
      completedIds.push(row.id);
      return {
        ...row,
        status: 'COMPLETED' as const,
        reviewedAt: row.reviewedAt ?? now,
        updatedAt: now,
      };
    }
    return row;
  });

  return { expired: expiredIds.length, completed: completedIds.length, expiredIds, completedIds };
}

export function mockResetRoomReservations() {
  reservations = [];
  idSeq = 1;
}

export function mockArchiveRoomReservation(id: string) {
  const row = reservations.find((r) => r.id === id);
  if (!row || row.archived) return null;
  const now = new Date();
  const updated: RoomReservationRow = { ...row, archived: true, archivedAt: now, updatedAt: now };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockRestoreRoomReservation(id: string) {
  const row = reservations.find((r) => r.id === id);
  if (!row || !row.archived) return null;
  const now = new Date();
  const updated: RoomReservationRow = { ...row, archived: false, archivedAt: null, updatedAt: now };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return updated;
}

export function mockDeleteRoomReservationPermanent(id: string) {
  const row = reservations.find((r) => r.id === id);
  if (!row || !row.archived) return false;
  reservations = reservations.filter((r) => r.id !== id);
  return true;
}

export function mockEmptyRoomReservationsTrash() {
  const before = reservations.length;
  reservations = reservations.filter((r) => !r.archived);
  return before - reservations.length;
}

export function mockCountArchivedRoomReservations() {
  return reservations.filter((r) => r.archived).length;
}
