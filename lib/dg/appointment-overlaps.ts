import { rangesConflict } from '@/lib/dg/scheduling';

export type AppointmentOverlapSource = {
  id: string;
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  status: string;
};

export type AppointmentOverlapIndex = {
  /** Rendez-vous en attente ou approuvés qui se croisent. */
  ids: Set<string>;
  peersById: Map<string, string[]>;
  pairCount: number;
};

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Repère les créneaux qui se chevauchent parmi les demandes en attente
 * et les rendez-vous approuvés. Les refus n’occupent pas l’agenda.
 */
export function indexAppointmentOverlaps(items: AppointmentOverlapSource[]): AppointmentOverlapIndex {
  const active = items
    .filter((item) => item.status === 'PENDING' || item.status === 'APPROVED')
    .map((item) => ({
      id: item.id,
      title: item.title.trim() || 'Rendez-vous',
      startAt: asDate(item.startAt),
      endAt: asDate(item.endAt),
    }))
    .filter((item) => item.endAt.getTime() > item.startAt.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const peersById = new Map<string, string[]>();
  let pairCount = 0;

  for (let i = 0; i < active.length; i++) {
    const left = active[i]!;
    for (let j = i + 1; j < active.length; j++) {
      const right = active[j]!;
      if (right.startAt.getTime() >= left.endAt.getTime()) break;
      if (!rangesConflict(left, right, 0)) continue;
      pairCount += 1;
      const leftPeers = peersById.get(left.id) ?? [];
      leftPeers.push(right.title);
      peersById.set(left.id, leftPeers);
      const rightPeers = peersById.get(right.id) ?? [];
      rightPeers.push(left.title);
      peersById.set(right.id, rightPeers);
    }
  }

  return {
    ids: new Set(peersById.keys()),
    peersById,
    pairCount,
  };
}

export function overlapPeerLabel(titles: string[]): string {
  if (titles.length === 0) return 'Chevauchement';
  if (titles.length === 1) return `Chevauche « ${titles[0]} »`;
  return `Chevauche ${titles.length} rendez-vous`;
}
