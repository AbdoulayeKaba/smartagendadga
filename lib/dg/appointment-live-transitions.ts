import type { AppointmentStatus } from '@prisma/client';
import type { AppointmentStatusView } from '@/lib/dg/appointments-review';

type TransitionItem = {
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
};

function toMs(value: string) {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Une demande PENDING dont le début du créneau est passé doit apparaître en rejet automatique. */
export function isPendingAutoRejectDue(
  item: { status: AppointmentStatus; startAt: string },
  now: Date = new Date()
) {
  if (item.status !== 'PENDING') return false;
  const startMs = toMs(item.startAt);
  if (startMs === null) return false;
  return now.getTime() >= startMs;
}

/** Vue statut affichée côté client (aperçu immédiat avant synchro serveur). */
export function resolveLiveAppointmentStatusView(
  item: AppointmentStatusView & { startAt?: string; status: AppointmentStatus },
  now: Date = new Date()
): AppointmentStatusView {
  if (!isPendingAutoRejectDue(
    { status: item.status, startAt: item.startAt ?? '' },
    now
  )) {
    return item;
  }
  return { status: 'REJECTED', autoRejected: true };
}

/** Prochains instants où l'interface doit se resynchroniser (début/fin de créneau). */
export function collectAppointmentTransitionTimes(
  items: TransitionItem[],
  now: Date = new Date(),
  { horizonMs = 6 * 60 * 60_000 }: { horizonMs?: number } = {}
): number[] {
  const nowMs = now.getTime();
  const limit = nowMs + horizonMs;
  const times = new Set<number>();

  for (const item of items) {
    const startMs = toMs(item.startAt);
    const endMs = toMs(item.endAt);
    if (startMs === null) continue;

    if (item.status === 'PENDING') {
      if (startMs <= nowMs) {
        times.add(nowMs + 150);
      } else if (startMs <= limit) {
        times.add(startMs);
      }
      continue;
    }

    if (item.status === 'APPROVED') {
      if (startMs > nowMs && startMs <= limit) times.add(startMs);
      if (endMs !== null && endMs > nowMs && endMs <= limit) times.add(endMs);
    }
  }

  return [...times].sort((a, b) => a - b);
}

const LIVE_CLOCK_URGENT_MS = 5 * 60_000;

/** 1 s près d'une transition, sinon 30 s pour limiter les re-renders. */
export function resolveLiveClockIntervalMs(
  items: TransitionItem[],
  now: Date = new Date()
): number {
  const nowMs = now.getTime();
  for (const item of items) {
    const startMs = toMs(item.startAt);
    const endMs = toMs(item.endAt);
    if (startMs !== null && Math.abs(startMs - nowMs) <= LIVE_CLOCK_URGENT_MS) return 1000;
    if (endMs !== null && Math.abs(endMs - nowMs) <= LIVE_CLOCK_URGENT_MS) return 1000;
  }
  return 30_000;
}
