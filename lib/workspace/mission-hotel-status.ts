import { HOTEL_RESERVATION_STATUS_LABELS, HOTEL_RESERVATION_STATUS_ORDER } from '@/lib/workspace/labels';
import type { DgMission, HotelReservationStatus } from '@/lib/workspace/types';

export const MISSION_HOTEL_LOCKED_ERROR = 'MISSION_HOTEL_LOCKED';

type MissionHotelContext = Pick<DgMission, 'status' | 'archived'>;

export function isMissionHotelLocked(mission: MissionHotelContext): boolean {
  if (mission.archived) return true;
  return mission.status === 'COMPLETED' || mission.status === 'CANCELLED';
}

export function canManageMissionHotel(mission: MissionHotelContext): boolean {
  return !isMissionHotelLocked(mission);
}

export function resolveMissionHotelStatus(
  statuses: HotelReservationStatus[]
): HotelReservationStatus | null {
  if (statuses.length === 0) return null;
  const active = statuses.filter((s) => s !== 'CANCELLED');
  const pool = active.length > 0 ? active : statuses;
  return pool.reduce((worst, status) => {
    const worstIndex = HOTEL_RESERVATION_STATUS_ORDER.indexOf(worst);
    const statusIndex = HOTEL_RESERVATION_STATUS_ORDER.indexOf(status);
    return statusIndex < worstIndex ? status : worst;
  });
}

export function missionHotelStatusLabel(status: HotelReservationStatus | null | undefined): string {
  return HOTEL_RESERVATION_STATUS_LABELS[status ?? 'TO_BOOK'];
}

/** Libellé simplifié pour la colonne tableau missions. */
export function missionHotelColumnLabel(
  status: HotelReservationStatus | null | undefined,
  mission?: MissionHotelContext
): string {
  if (mission && isMissionHotelLocked(mission)) return 'À réserver';
  if (!status || status === 'TO_BOOK' || status === 'CANCELLED') return 'À réserver';
  return 'Déjà réservé';
}

export function isMissionHotelReserved(status: HotelReservationStatus | null | undefined): boolean {
  return missionHotelColumnLabel(status) === 'Déjà réservé';
}

export function attachHotelStatusToMissions<T extends { id: string }>(
  missions: T[],
  reservations: Array<{ missionId: string; status: HotelReservationStatus }>
): Array<T & { hotelStatus: HotelReservationStatus | null }> {
  const byMission = new Map<string, HotelReservationStatus[]>();
  for (const reservation of reservations) {
    const list = byMission.get(reservation.missionId) ?? [];
    list.push(reservation.status);
    byMission.set(reservation.missionId, list);
  }
  return missions.map((mission) => ({
    ...mission,
    hotelStatus: resolveMissionHotelStatus(byMission.get(mission.id) ?? []),
  }));
}
