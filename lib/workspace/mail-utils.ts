import { MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import type {
  MailDirection,
  MailItem,
  MailPriority,
  MailViewMode,
  MailWorkflowStatus,
} from '@/lib/workspace/types';

export type MailStats = {
  total: number;
  pending: number;
  urgent: number;
  inProgress: number;
  processed: number;
  archived: number;
};

export const INCOMING_MAIL_STATUSES: MailWorkflowStatus[] = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PROCESSED',
  'ARCHIVED',
];

export const OUTGOING_MAIL_STATUSES: MailWorkflowStatus[] = [
  'SENT',
  'IN_PROGRESS',
  'PROCESSED',
  'ARCHIVED',
];

export function mailDirectionForView(view: MailViewMode): MailDirection | null {
  if (view === 'dga') return null;
  return view === 'depart' ? 'OUTGOING' : 'INCOMING';
}

/** Statuts disponibles dans le filtre selon la vue (mixte pour le tableau de board). */
export function mailStatusesForView(view: MailViewMode): MailWorkflowStatus[] {
  if (view === 'dga') {
    const seen = new Set<MailWorkflowStatus>();
    return [...INCOMING_MAIL_STATUSES, ...OUTGOING_MAIL_STATUSES].filter((status) => {
      if (seen.has(status)) return false;
      seen.add(status);
      return true;
    });
  }
  return mailStatusesForDirection(mailDirectionForView(view)!);
}

export function mailFormViewForItem(viewMode: MailViewMode, mail: Pick<MailItem, 'direction'>): MailViewMode {
  if (mail.direction === 'OUTGOING') return 'depart';
  if (viewMode === 'suivi') return 'suivi';
  return 'dga';
}

export function mailStatusesForDirection(direction: MailDirection): MailWorkflowStatus[] {
  return direction === 'INCOMING' ? INCOMING_MAIL_STATUSES : OUTGOING_MAIL_STATUSES;
}

export function isMailPending(item: MailItem): boolean {
  return item.workflowStatus === 'RECEIVED' || item.workflowStatus === 'ASSIGNED';
}

export function computeMailStats(items: MailItem[]): MailStats {
  return {
    total: items.length,
    pending: items.filter(isMailPending).length,
    urgent: items.filter((m) => m.priority === 'URGENT').length,
    inProgress: items.filter((m) => m.workflowStatus === 'IN_PROGRESS').length,
    processed: items.filter((m) => m.workflowStatus === 'PROCESSED').length,
    archived: items.filter((m) => m.workflowStatus === 'ARCHIVED').length,
  };
}

export function nextMailWorkflowStatus(
  current: MailWorkflowStatus,
  direction: MailDirection
): MailWorkflowStatus | null {
  const flow = mailStatusesForDirection(direction);
  const idx = flow.indexOf(current);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1] ?? null;
}

export type MailWorkflowAdvanceAction = {
  nextStatus: MailWorkflowStatus;
  label: string;
  targetLabel: string;
  patch: Record<string, unknown>;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildWorkflowAdvancePatch(mail: MailItem, nextStatus: MailWorkflowStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (
    nextStatus === 'IN_PROGRESS' &&
    !mail.scSentAt &&
    mail.action?.toUpperCase().includes('TRANSMIS')
  ) {
    patch.scSentAt = todayIsoDate();
  }

  if (nextStatus === 'PROCESSED' && mail.direction === 'INCOMING' && !mail.action?.trim()) {
    patch.action = 'TRAITÉ';
  }

  return patch;
}

function workflowAdvanceLabel(
  current: MailWorkflowStatus,
  nextStatus: MailWorkflowStatus,
  mail: MailItem
): string {
  if (nextStatus === 'ASSIGNED') return 'Affecter au service';
  if (nextStatus === 'IN_PROGRESS') {
    if (current === 'ASSIGNED' || current === 'SENT') return 'Démarrer le traitement';
    return 'Passer en traitement';
  }
  if (nextStatus === 'PROCESSED') {
    if (mail.action?.toUpperCase().includes('TRANSMIS')) return 'Confirmer le traitement';
    return 'Marquer comme traité';
  }
  if (nextStatus === 'ARCHIVED') return 'Archiver le courrier';
  return `Passer à ${MAIL_STATUS_LABELS[nextStatus]}`;
}

export function getMailWorkflowAdvanceAction(mail: MailItem): MailWorkflowAdvanceAction | null {
  const nextStatus = nextMailWorkflowStatus(mail.workflowStatus, mail.direction);
  if (!nextStatus) return null;

  return {
    nextStatus,
    label: workflowAdvanceLabel(mail.workflowStatus, nextStatus, mail),
    targetLabel: MAIL_STATUS_LABELS[nextStatus],
    patch: buildWorkflowAdvancePatch(mail, nextStatus),
  };
}

export function formatMailAssignment(mail: {
  assignedService?: string | null;
  executor?: string | null;
}): string | null {
  const service = mail.assignedService?.trim() || '';
  const executor = mail.executor?.trim() || '';
  if (service && executor && service.toLowerCase() !== executor.toLowerCase()) {
    return `${service} · ${executor}`;
  }
  return service || executor || null;
}

export function mailNeedsAssignmentDetails(mail: {
  assignedService?: string | null;
  executor?: string | null;
}): boolean {
  return !formatMailAssignment(mail);
}

export function mailRegistrationYear(mailDateIso: string): number {
  const year = Number(String(mailDateIso).slice(0, 4));
  return Number.isFinite(year) && year >= 2000 ? year : new Date().getFullYear();
}

/** Prochain N° d'enregistrement pour l'année de la date d'enregistrement. */
export function nextMailRegistrationNumberForDate(
  items: Array<{ registrationNumber?: number | null; mailDate: string }>,
  mailDateIso: string
): number {
  const year = mailRegistrationYear(mailDateIso);
  const max = items.reduce((acc, item) => {
    if (item.registrationNumber == null) return acc;
    if (mailRegistrationYear(item.mailDate) !== year) return acc;
    return Math.max(acc, item.registrationNumber);
  }, 0);
  return max + 1;
}

export function formatMailDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

export function formatMailDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

export type MailQuickFilter =
  | 'ALL'
  | 'PENDING'
  | 'URGENT'
  | 'IN_PROGRESS'
  | 'PROCESSED'
  | 'ARCHIVED'
  | 'OVERDUE'
  | 'DUE_SOON';

export function getMailWorkflowStepIndex(
  status: MailWorkflowStatus,
  direction: MailDirection
): number {
  return mailStatusesForDirection(direction).indexOf(status);
}

/** Dates de statut déduites du dossier quand l’historique n’est pas encore complet. */
export function inferMailStatusTimestamps(
  mail: Pick<
    MailItem,
    | 'direction'
    | 'workflowStatus'
    | 'createdAt'
    | 'updatedAt'
    | 'assignedAt'
    | 'archivedAt'
  >
): Partial<Record<MailWorkflowStatus, string>> {
  const first: MailWorkflowStatus = mail.direction === 'OUTGOING' ? 'SENT' : 'RECEIVED';
  const out: Partial<Record<MailWorkflowStatus, string>> = {
    [first]: mail.createdAt,
  };
  if (mail.assignedAt) out.ASSIGNED = mail.assignedAt;
  if (mail.archivedAt) out.ARCHIVED = mail.archivedAt;
  const current = mail.workflowStatus;
  if (current !== first && !out[current]) {
    out[current] = mail.updatedAt;
  }
  return out;
}

export function getMailWorkflowProgress(
  status: MailWorkflowStatus,
  direction: MailDirection
): { index: number; total: number; percent: number; label: string } {
  const steps = mailStatusesForDirection(direction);
  const index = Math.max(0, getMailWorkflowStepIndex(status, direction));
  const total = steps.length;
  const percent = total <= 1 ? 100 : Math.round((index / (total - 1)) * 100);
  return {
    index,
    total,
    percent,
    label: `Étape ${index + 1} sur ${total}`,
  };
}

export type MailDeadlineState =
  | { status: 'NONE' | 'CLOSED'; days: null }
  | { status: 'OVERDUE'; days: number }
  | { status: 'TODAY'; days: 0 }
  | { status: 'DUE_SOON' | 'ON_TRACK'; days: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fenêtre d'alerte « échéance proche », en jours calendaires. */
export const MAIL_DEADLINE_SOON_DAYS = 3;

/** Délai d'exécution accordé à l'enregistrement, en jours ouvrés (lundi-vendredi). */
export const MAIL_EXECUTION_DELAY_WORKING_DAYS: Record<MailPriority, number> = {
  URGENT: 3,
  NORMAL: 7,
};

function toUtcCalendarDay(value: string | Date): number | null {
  if (typeof value === 'string') {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (isoDate) {
      return Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoCalendarDay(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10);
}

/**
 * Délai d'exécution calculé automatiquement depuis la date d'enregistrement.
 * Les week-ends sont ignorés, conformément aux jours ouvrables du cabinet.
 */
export function computeMailExecutionDeadline(
  mailDateIso: string,
  priority: MailPriority = 'NORMAL'
): string | null {
  const startDay = toUtcCalendarDay(mailDateIso);
  if (startDay === null) return null;

  const workingDays =
    MAIL_EXECUTION_DELAY_WORKING_DAYS[priority] ?? MAIL_EXECUTION_DELAY_WORKING_DAYS.NORMAL;

  const cursor = new Date(startDay);
  let remaining = Math.max(0, workingDays);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }

  return toIsoCalendarDay(cursor.getTime());
}

/**
 * État métier unique du délai courrier.
 * `days` est positif avant l'échéance et représente le retard pour OVERDUE.
 */
export function getMailDeadlineState(
  item: Pick<MailItem, 'executionDeadline' | 'workflowStatus'>,
  withinDays = MAIL_DEADLINE_SOON_DAYS,
  now = new Date()
): MailDeadlineState {
  if (!item.executionDeadline) return { status: 'NONE', days: null };
  if (item.workflowStatus === 'ARCHIVED' || item.workflowStatus === 'PROCESSED') {
    return { status: 'CLOSED', days: null };
  }

  const dueDay = toUtcCalendarDay(item.executionDeadline);
  const today = toUtcCalendarDay(now);
  if (dueDay === null || today === null) return { status: 'NONE', days: null };

  const difference = Math.round((dueDay - today) / DAY_MS);
  if (difference < 0) return { status: 'OVERDUE', days: Math.abs(difference) };
  if (difference === 0) return { status: 'TODAY', days: 0 };
  if (difference <= withinDays) return { status: 'DUE_SOON', days: difference };
  return { status: 'ON_TRACK', days: difference };
}

export function isMailOverdue(item: MailItem): boolean {
  return getMailDeadlineState(item).status === 'OVERDUE';
}

export function isMailDeadlineSoon(item: MailItem, withinDays = MAIL_DEADLINE_SOON_DAYS): boolean {
  const status = getMailDeadlineState(item, withinDays).status;
  return status === 'TODAY' || status === 'DUE_SOON';
}

/** Retire les anciens préfixes automatiques stockés à tort dans la note libre. */
export function formatMailFollowUpNote(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/^(?:échéance proche|délai d['’]exécution dépassé|délai dépassé)\s*[—:–-]\s*/i, '')
    .trim();
}

export function filterMailItems(
  items: MailItem[],
  filters: { query?: string; status?: string; priority?: string; quickFilter?: MailQuickFilter }
): MailItem[] {
  const q = filters.query?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (filters.quickFilter && filters.quickFilter !== 'ALL') {
      if (filters.quickFilter === 'PENDING' && !isMailPending(item)) return false;
      if (filters.quickFilter === 'URGENT' && item.priority !== 'URGENT') return false;
      if (filters.quickFilter === 'IN_PROGRESS' && item.workflowStatus !== 'IN_PROGRESS') return false;
      if (filters.quickFilter === 'PROCESSED' && item.workflowStatus !== 'PROCESSED') return false;
      if (filters.quickFilter === 'ARCHIVED' && item.workflowStatus !== 'ARCHIVED') return false;
      if (filters.quickFilter === 'OVERDUE' && !isMailOverdue(item)) return false;
      if (filters.quickFilter === 'DUE_SOON' && !isMailDeadlineSoon(item)) return false;
    }
    if (filters.status && filters.status !== 'ALL' && item.workflowStatus !== filters.status) {
      return false;
    }
    if (filters.priority && filters.priority !== 'ALL' && item.priority !== filters.priority) {
      return false;
    }
    if (!q) return true;
    return (
      item.reference.toLowerCase().includes(q) ||
      item.counterpart.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      (item.origin?.toLowerCase().includes(q) ?? false) ||
      (item.dgaInstruction?.toLowerCase().includes(q) ?? false) ||
      (item.executor?.toLowerCase().includes(q) ?? false) ||
      (item.action?.toLowerCase().includes(q) ?? false) ||
      (item.assignedService?.toLowerCase().includes(q) ?? false) ||
      (item.courierName?.toLowerCase().includes(q) ?? false) ||
      String(item.registrationNumber ?? '').includes(q)
    );
  });
}
