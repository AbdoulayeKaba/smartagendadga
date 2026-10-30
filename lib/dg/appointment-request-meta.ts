import type { PreContactChoice, UrgencyLevel } from '@/lib/dg/appointment-business-rules';

const META_PREFIX = '<!--APPT_META:';
const META_SUFFIX = '-->';

export type AppointmentRequestMeta = {
  urgencyLevel: UrgencyLevel;
  justification?: string;
  preContact: PreContactChoice[];
  appointmentTypeRef?: string;
  locationRef?: string;
  motifRef?: string;
  /** Présentiel, en ligne, ou les deux (salle + lien Teams). */
  meetingFormat?: 'PRESENTIEL' | 'ONLINE' | 'HYBRID';
  strategicProject?: boolean;
  businessScore?: number;
  workflowSteps?: string[];
  autoRejected?: boolean;
  autoRejectReason?: string;
  /** Marqué par l’assistante/DGA comme ultra urgent à traiter en priorité. */
  planningPriority?: boolean;
  /** Importé depuis un fichier Excel historique. */
  excelImport?: boolean;
  /** Demande de réservation de salle liée au RDV. */
  roomReserved?: boolean;
  roomId?: string;
  roomName?: string;
  roomReservationId?: string;
  roomUsageType?: string;
  roomEquipment?: string[];
  /** Créneau demandé à la création, conservé si le créneau est ensuite déplacé. */
  requestedStartAt?: string;
  requestedEndAt?: string;
  /** Heure de début du créneau juste avant la première reprogrammation. */
  preRescheduleStartAt?: string;
  preRescheduleEndAt?: string;
  /** Créneaux successifs quittés à chaque report, du plus ancien au plus récent. */
  slotHistory?: AppointmentSlotPoint[];
  /** Demandeur saisi par l’assistante ou le DGA (hors compte connecté). */
  requesterFullName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
};

export type AppointmentSlotPoint = { startAt: string; endAt: string };

export const DEFAULT_REQUEST_META: AppointmentRequestMeta = {
  urgencyLevel: 'NORMAL',
  preContact: [],
};

export function serializeAppointmentMeta(meta: AppointmentRequestMeta): string {
  return `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
}

export function parseAppointmentMeta(description: string | null | undefined): {
  meta: AppointmentRequestMeta;
  userText: string;
} {
  if (!description?.trim()) {
    return { meta: { ...DEFAULT_REQUEST_META }, userText: '' };
  }
  const start = description.indexOf(META_PREFIX);
  if (start === -1) {
    return { meta: { ...DEFAULT_REQUEST_META }, userText: description.trim() };
  }
  const end = description.indexOf(META_SUFFIX, start);
  if (end === -1) {
    return { meta: { ...DEFAULT_REQUEST_META }, userText: description.trim() };
  }
  const jsonSlice = description.slice(start + META_PREFIX.length, end);
  let meta = { ...DEFAULT_REQUEST_META };
  try {
    const parsed = JSON.parse(jsonSlice) as Partial<AppointmentRequestMeta>;
    meta = {
      ...DEFAULT_REQUEST_META,
      ...parsed,
      preContact: Array.isArray(parsed.preContact) ? parsed.preContact : [],
      roomEquipment: Array.isArray(parsed.roomEquipment)
        ? parsed.roomEquipment.filter((v): v is string => typeof v === 'string')
        : undefined,
      meetingFormat:
        parsed.meetingFormat === 'PRESENTIEL' ||
        parsed.meetingFormat === 'ONLINE' ||
        parsed.meetingFormat === 'HYBRID'
          ? parsed.meetingFormat
          : undefined,
      slotHistory: sanitizeSlotHistory(parsed.slotHistory),
    };
  } catch {
    /* ignore */
  }
  const userText = (description.slice(0, start) + description.slice(end + META_SUFFIX.length))
    .trim();
  return { meta, userText };
}

export function readRequestedSlot(meta: AppointmentRequestMeta): { startAt: Date; endAt: Date } | null {
  if (!meta.requestedStartAt || !meta.requestedEndAt) return null;
  const startAt = new Date(meta.requestedStartAt);
  const endAt = new Date(meta.requestedEndAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return { startAt, endAt };
}

export function isRequestedSlotDifferent(
  currentStart: Date | string,
  currentEnd: Date | string,
  meta: AppointmentRequestMeta
): boolean {
  const requested = readRequestedSlot(meta);
  if (!requested) return false;
  return (
    requested.startAt.getTime() !== new Date(currentStart).getTime() ||
    requested.endAt.getTime() !== new Date(currentEnd).getTime()
  );
}

/** Garde le créneau d’origine. S’il n’est pas encore mémorisé, `fallback` devient ce créneau. */
export function ensureRequestedSlot(
  description: string | null | undefined,
  fallback: { startAt: Date; endAt: Date }
): string {
  const { meta, userText } = parseAppointmentMeta(description);
  if (meta.requestedStartAt && meta.requestedEndAt) {
    return embedDescriptionWithMeta(userText, meta);
  }
  return embedDescriptionWithMeta(userText, {
    ...meta,
    requestedStartAt: fallback.startAt.toISOString(),
    requestedEndAt: fallback.endAt.toISOString(),
  });
}

function asSlotPoint(startAt?: string | null, endAt?: string | null): AppointmentSlotPoint | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function sameSlot(a: AppointmentSlotPoint, b: AppointmentSlotPoint) {
  return a.startAt === b.startAt && a.endAt === b.endAt;
}

export function sanitizeSlotHistory(value: unknown): AppointmentSlotPoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points: AppointmentSlotPoint[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { startAt?: unknown; endAt?: unknown };
    const point = asSlotPoint(
      typeof row.startAt === 'string' ? row.startAt : null,
      typeof row.endAt === 'string' ? row.endAt : null
    );
    if (!point) continue;
    const last = points[points.length - 1];
    if (last && sameSlot(last, point)) continue;
    points.push(point);
  }
  return points.length > 0 ? points : undefined;
}

/** Mémorise chaque créneau quitté, sans écraser le premier report. */
export function traceSlotBeforeReschedule(
  description: string | null | undefined,
  slot: { startAt: Date; endAt: Date }
): string {
  const { meta, userText } = parseAppointmentMeta(description);
  const point = asSlotPoint(slot.startAt.toISOString(), slot.endAt.toISOString());
  const history = [...(meta.slotHistory ?? [])];
  if (point) {
    const last = history[history.length - 1];
    if (!last || !sameSlot(last, point)) history.push(point);
  }
  return embedDescriptionWithMeta(userText, {
    ...meta,
    ...(history.length > 0 ? { slotHistory: history } : {}),
    ...(meta.preRescheduleStartAt && meta.preRescheduleEndAt
      ? {}
      : point
        ? { preRescheduleStartAt: point.startAt, preRescheduleEndAt: point.endAt }
        : {}),
  });
}

/**
 * Suite complète des créneaux : demandé, reports, puis créneau en place.
 * `recorded` ajoute les créneaux issus de l’historique d’audit.
 */
export function buildSlotTimeline(input: {
  description: string | null | undefined;
  currentStart: Date | string;
  currentEnd: Date | string;
  recorded?: AppointmentSlotPoint[];
}): AppointmentSlotPoint[] {
  const { meta } = parseAppointmentMeta(input.description);
  const chain: AppointmentSlotPoint[] = [];
  const push = (point: AppointmentSlotPoint | null | undefined) => {
    if (!point) return;
    const last = chain[chain.length - 1];
    if (last && sameSlot(last, point)) return;
    chain.push(point);
  };

  push(asSlotPoint(meta.requestedStartAt, meta.requestedEndAt));
  push(asSlotPoint(meta.preRescheduleStartAt, meta.preRescheduleEndAt));
  for (const point of meta.slotHistory ?? []) push(point);
  for (const point of input.recorded ?? []) push(asSlotPoint(point.startAt, point.endAt));
  push(
    asSlotPoint(
      input.currentStart instanceof Date ? input.currentStart.toISOString() : input.currentStart,
      input.currentEnd instanceof Date ? input.currentEnd.toISOString() : input.currentEnd
    )
  );
  return chain;
}

export function readPreRescheduleSlot(
  meta: AppointmentRequestMeta
): { startAt: Date; endAt: Date } | null {
  if (!meta.preRescheduleStartAt || !meta.preRescheduleEndAt) return null;
  const startAt = new Date(meta.preRescheduleStartAt);
  const endAt = new Date(meta.preRescheduleEndAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return { startAt, endAt };
}

/** Réinjecte le créneau tracé lorsqu’une mise à jour reconstruit la description. */
export function preserveTracedSlot(
  nextDescription: string | null | undefined,
  previousDescription: string | null | undefined
): string {
  const previous = parseAppointmentMeta(previousDescription).meta;
  const { meta, userText } = parseAppointmentMeta(nextDescription);
  return embedDescriptionWithMeta(userText, {
    ...meta,
    ...(previous.requestedStartAt && previous.requestedEndAt
      ? {
          requestedStartAt: previous.requestedStartAt,
          requestedEndAt: previous.requestedEndAt,
        }
      : {}),
    ...(previous.preRescheduleStartAt && previous.preRescheduleEndAt
      ? {
          preRescheduleStartAt: previous.preRescheduleStartAt,
          preRescheduleEndAt: previous.preRescheduleEndAt,
        }
      : {}),
    ...((meta.slotHistory && meta.slotHistory.length > 0) ||
    (previous.slotHistory && previous.slotHistory.length > 0)
      ? {
          slotHistory:
            meta.slotHistory && meta.slotHistory.length > 0
              ? meta.slotHistory
              : previous.slotHistory,
        }
      : {}),
  });
}

export function embedDescriptionWithMeta(userText: string, meta: AppointmentRequestMeta): string {
  const clean = userText.trim();
  const block = serializeAppointmentMeta(meta);
  return clean ? `${block}\n${clean}` : block;
}

export function buildImportedAppointmentDescription(
  description: string | null | undefined
): string | null {
  const { meta, userText } = parseAppointmentMeta(description);
  const embedded = embedDescriptionWithMeta(userText, {
    ...DEFAULT_REQUEST_META,
    ...meta,
    excelImport: true,
  });
  return embedded || null;
}
