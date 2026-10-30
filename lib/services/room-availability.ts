import { isSlotStartInThePast, parseDateTime, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import {
  APPOINTMENT_POLICY_MESSAGES,
  isDateOnWeekend,
  isHolidayDate,
  type AppointmentPolicyViolation,
} from '@/lib/dg/scheduling-policy';
import type { WeekdayKey } from '@/lib/dg/platform-config';
import { timeToMinutes } from '@/lib/dg/schedule-capacity';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import {
  createReferentialItem,
  listActiveHolidays,
  listReferentialItems,
  normalizeScheduleSettings,
} from '@/lib/services/referentials-admin';
import {
  isReservableMeetingRoomName,
  meetingRoomFloor,
  RESERVABLE_MEETING_ROOM_NAMES,
} from '@/lib/dg/meeting-room-config';
import { isExcludedRoomBooking } from '@/lib/dg/room-conflict-exclude';

const WEEKDAY_FROM_DATE: Record<number, WeekdayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

const WEEKDAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export type MeetingRoom = {
  id: string;
  name: string;
};

export type RoomAvailabilityResult = {
  mode: 'room';
  date: string;
  room: MeetingRoom;
  schedule: {
    workDayStart: string;
    workDayEnd: string;
    durationMinutes: number;
    bufferMinutes: number;
  };
  daySummary: {
    isWorkingDay: boolean;
    isHoliday: boolean;
    policyBlock: AppointmentPolicyViolation | null;
    /** RÃ©servations de salle confirmÃ©es ce jour. */
    bookingsCount: number;
    /** Audiences DGA occupant la salle ce jour. */
    appointmentOccupancyCount: number;
    availableCount: number;
    busyCount: number;
    bufferCount: number;
  };
  slots: AvailabilitySlot[];
};

export type RoomAvailabilityDaySummary = {
  date: string;
  weekdayLabel: string;
  availableCount: number;
  busyCount: number;
  blockedCount: number;
  totalSlots: number;
  bookingsCount: number;
  policyBlock: AppointmentPolicyViolation | null;
  isWorkingDay: boolean;
};

function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function overlapsRange(startA: number, endA: number, startB: number, endB: number, bufferMs: number) {
  return startA < endB + bufferMs && endA > startB - bufferMs;
}

/** Chevauchement rÃ©el (sans tampon) â€” pour lâ€™affichage Â« rÃ©servÃ© Â». */
function directOverlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export function normalizeRoomLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function appointmentMatchesRoom(
  location: string | null | undefined,
  roomName: string
): boolean {
  if (!location?.trim()) return false;
  const loc = normalizeRoomLabel(location);
  const room = normalizeRoomLabel(roomName);
  return loc === room || loc.includes(room) || room.includes(loc);
}

export async function listMeetingRooms(): Promise<MeetingRoom[]> {
  const items = await listReferentialItems('lieux', { archived: false });
  const rooms: MeetingRoom[] = [];

  for (const expected of RESERVABLE_MEETING_ROOM_NAMES) {
    const floor = meetingRoomFloor(expected);
    const candidates = items.filter(
      (item) => isReservableMeetingRoomName(item.name) && meetingRoomFloor(item.name) === floor
    );
    const expectedKey = expected.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    let match =
      candidates.find(
        (item) => item.name.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') === expectedKey
      ) ?? candidates[0];

    if (!match) {
      const created = await createReferentialItem({
        categoryId: 'lieux',
        name: expected,
      });
      if (created.ok) match = created.item;
    }

    if (match) rooms.push({ id: match.id, name: match.name });
  }

  return rooms;
}

/**
 * Tous les lieux rÃ©servables (rÃ©fÃ©rentiel Â« lieux Â»), y compris archivÃ©s,
 * afin de rÃ©soudre n'importe quelle salle liÃ©e Ã  une rÃ©servation existante.
 */
async function listAllRoomLocations(): Promise<MeetingRoom[]> {
  const [active, archived] = await Promise.all([
    listReferentialItems('lieux', { archived: false }),
    listReferentialItems('lieux', { archived: true }),
  ]);
  const seen = new Set<string>();
  const rooms: MeetingRoom[] = [];
  for (const item of [...active, ...archived]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    rooms.push({ id: item.id, name: item.name });
  }
  return rooms;
}

export async function getMeetingRoom(roomId: string): Promise<MeetingRoom | null> {
  const rooms = await listAllRoomLocations();
  return rooms.find((r) => r.id === roomId) ?? null;
}

async function findRoomByName(roomName: string) {
  const rooms = await listAllRoomLocations();
  const normalized = normalizeRoomLabel(roomName);
  return (
    rooms.find((r) => normalizeRoomLabel(r.name) === normalized) ??
    rooms.find((r) => appointmentMatchesRoom(roomName, r.name)) ??
    null
  );
}

async function listRoomBookingsForDay(date: string, roomName: string) {
  const room = await findRoomByName(roomName);
  if (!room) return [];
  const { listRoomBookingsForDay: listMerged } = await import('@/lib/services/room-reservations');
  return listMerged(date, room);
}

export async function assertNoRoomConflict(
  roomName: string,
  startAt: Date,
  endAt: Date,
  options?: { excludeId?: string }
) {
  const trimmed = roomName.trim();
  if (!trimmed) return { ok: true as const };

  const date = startAt.toISOString().slice(0, 10);
  const bookings = await listRoomBookingsForDay(date, trimmed);
  const bufferMs = (await getPlatformSettings()).bufferMinutes * 60 * 1000;

  const conflict = bookings.find((row) => {
    if (options?.excludeId && row.id === options.excludeId) return false;
    return overlapsRange(
      startAt.getTime(),
      endAt.getTime(),
      row.startAt.getTime(),
      row.endAt.getTime(),
      bufferMs
    );
  });

  if (!conflict) return { ok: true as const };

  return {
    ok: false as const,
    error: 'ROOM_CONFLICT' as const,
    message: `La salle Â« ${trimmed} Â» est dÃ©jÃ  rÃ©servÃ©e (${conflict.title}).`,
    conflict: {
      id: conflict.id,
      title: conflict.title,
      startAt: conflict.startAt.toISOString(),
      endAt: conflict.endAt.toISOString(),
    },
  };
}

export async function getRoomAvailability(
  date: string,
  roomId: string,
  options?: {
    excludeReservationId?: string;
    excludeAppointmentId?: string;
    ignoreReferentialRules?: boolean;
  }
): Promise<RoomAvailabilityResult | null> {
  const room = await getMeetingRoom(roomId);
  if (!room || !isReservableMeetingRoomName(room.name)) return null;

  const config = await getPlatformSettings();
  const schedule = normalizeScheduleSettings(config);
  const holidays = await listActiveHolidays();
  const duration = schedule.defaultAppointmentDurationMinutes;
  const bufferMs = schedule.bufferMinutes * 60 * 1000;

  const bookings = await listRoomBookingsForDay(date, room.name);
  const weekday = WEEKDAY_FROM_DATE[new Date(`${date}T12:00:00`).getDay()];
  const isWorkingDay = schedule.workingDays.includes(weekday);
  const isHoliday = isHolidayDate(date, holidays);

  let policyBlock: AppointmentPolicyViolation | null = null;
  if (!isWorkingDay) policyBlock = 'OUTSIDE_HOURS';
  else if (isHoliday) policyBlock = 'HOLIDAY';
  else if (isDateOnWeekend(date) && !schedule.allowWeekendAppointments) policyBlock = 'WEEKEND_NOT_ALLOWED';

  const workStart = timeToMinutes(schedule.workDayStart);
  const workEnd = timeToMinutes(schedule.workDayEnd);

  const slots: AvailabilitySlot[] = [];

  for (let cursor = workStart; cursor + duration <= workEnd; cursor += duration) {
    const startTime = minutesToTime(cursor);
    const endTime = minutesToTime(cursor + duration);

    if (isSlotStartInThePast(date, startTime)) {
      slots.push({
        startTime,
        endTime,
        status: 'BLOCKED',
        reason: PAST_SLOT_MESSAGE,
      });
      continue;
    }

    if (options?.ignoreReferentialRules) {
      slots.push({ startTime, endTime, status: 'AVAILABLE' });
      continue;
    }

    if (policyBlock) {
      slots.push({
        startTime,
        endTime,
        status: 'BLOCKED',
        reason: APPOINTMENT_POLICY_MESSAGES[policyBlock],
      });
      continue;
    }

    const slotStartDate = parseDateTime(date, startTime);
    const slotEndDate = parseDateTime(date, endTime);
    const slotStartMs = slotStartDate.getTime();
    const slotEndMs = slotEndDate.getTime();

    const directBooking = bookings.find((row) => {
      if (isExcludedRoomBooking(row, options)) return false;
      return directOverlaps(slotStartMs, slotEndMs, row.startAt.getTime(), row.endAt.getTime());
    });

    if (directBooking) {
      const reason =
        directBooking.source === 'appointment'
          ? `Audience DGA â€” ${directBooking.title}`
          : `RÃ©servÃ©e â€” ${directBooking.title}`;
      slots.push({
        startTime,
        endTime,
        status: 'BUSY',
        label: directBooking.title,
        reason,
      });
      continue;
    }

    const bufferBooking = bookings.find((row) => {
      if (isExcludedRoomBooking(row, options)) return false;
      return overlapsRange(slotStartMs, slotEndMs, row.startAt.getTime(), row.endAt.getTime(), bufferMs);
    });

    if (bufferBooking) {
      slots.push({
        startTime,
        endTime,
        status: 'BUFFER',
        reason: `Tampon ${schedule.bufferMinutes} min (indisponible pour nouvelle rÃ©servation)`,
      });
      continue;
    }

    slots.push({ startTime, endTime, status: 'AVAILABLE' });
  }

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const busyCount = slots.filter((s) => s.status === 'BUSY').length;
  const bufferCount = slots.filter((s) => s.status === 'BUFFER').length;
  const reservationsCount = bookings.filter((b) => b.source === 'reservation').length;
  const appointmentOccupancyCount = bookings.filter((b) => b.source === 'appointment').length;

  return {
    mode: 'room',
    date,
    room,
    schedule: {
      workDayStart: schedule.workDayStart,
      workDayEnd: schedule.workDayEnd,
      durationMinutes: duration,
      bufferMinutes: schedule.bufferMinutes,
    },
    daySummary: {
      isWorkingDay,
      isHoliday,
      policyBlock: options?.ignoreReferentialRules ? null : policyBlock,
      bookingsCount: reservationsCount,
      appointmentOccupancyCount,
      availableCount,
      busyCount,
      bufferCount,
    },
    slots,
  };
}

function addDaysIso(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function getRoomAvailabilityWeekSummary(
  anchorDate: string,
  roomId: string,
  options?: { ignoreReferentialRules?: boolean }
) {
  const room = await getMeetingRoom(roomId);
  if (!room) return null;

  const days: RoomAvailabilityDaySummary[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(anchorDate, i);
    const result = await getRoomAvailability(date, roomId, options);
    if (!result) continue;
    const dow = new Date(`${date}T12:00:00`).getDay();
    const blockedCount = result.slots.filter((s) => s.status === 'BLOCKED').length;
    days.push({
      date,
      weekdayLabel: WEEKDAY_LABELS_FR[dow] ?? '',
      availableCount: result.daySummary.availableCount,
      busyCount: result.daySummary.busyCount,
      blockedCount,
      totalSlots: result.slots.length,
      bookingsCount: result.daySummary.bookingsCount,
      policyBlock: result.daySummary.policyBlock,
      isWorkingDay: result.daySummary.isWorkingDay,
    });
  }
  return { anchor: anchorDate, room, days };
}
