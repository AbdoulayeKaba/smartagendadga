import { differenceInCalendarDays } from 'date-fns';

/** Nombre de jours calendaires (départ et retour inclus). */
export function missionDurationDays(departAt: string, returnAt: string): number {
  const depart = new Date(departAt);
  const ret = new Date(returnAt);
  if (Number.isNaN(depart.getTime()) || Number.isNaN(ret.getTime())) return 0;
  return Math.max(1, differenceInCalendarDays(ret, depart) + 1);
}

export function missionDurationLabel(departAt: string, returnAt: string): string {
  const days = missionDurationDays(departAt, returnAt);
  return days === 1 ? '1 jour' : `${days} jours`;
}
