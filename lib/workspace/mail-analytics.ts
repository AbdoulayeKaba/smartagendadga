import { MAIL_PRIORITY_LABELS, MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import {
  formatMailAssignment,
  getMailWorkflowAdvanceAction,
  getMailWorkflowProgress,
  isMailDeadlineSoon,
  isMailOverdue,
  isMailPending,
  mailStatusesForDirection,
} from '@/lib/workspace/mail-utils';
import type { MailDirection, MailItem, MailPriority, MailWorkflowStatus } from '@/lib/workspace/types';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'] as const;

export type MailStatusChartPoint = {
  key: MailWorkflowStatus;
  label: string;
  value: number;
  fill: string;
};

export type MailMonthlyFlowPoint = {
  month: number;
  label: string;
  total: number;
  urgent: number;
};

export type MailTrackingItem = {
  id: string;
  reference: string;
  subject: string;
  counterpart: string;
  direction: MailDirection;
  workflowStatus: MailWorkflowStatus;
  priority: MailPriority;
  progressPercent: number;
  stepLabel: string;
  nextStatus: MailWorkflowStatus | null;
  advanceLabel: string | null;
  overdue: boolean;
  deadlineSoon: boolean;
  executionDeadline: string | null;
  followUp: string | null;
  assignmentLabel: string | null;
  mailDate: string;
  score: number;
};

export type MailAnalytics = {
  byStatus: MailStatusChartPoint[];
  byPriority: { key: MailPriority; label: string; value: number }[];
  byAttachment: { key: 'WITH' | 'WITHOUT'; label: string; value: number }[];
  monthlyFlow: MailMonthlyFlowPoint[];
  trackingQueue: MailTrackingItem[];
  statusTotal: number;
  activeCount: number;
  overdueCount: number;
};

const STATUS_COLORS: Record<MailWorkflowStatus, string> = {
  RECEIVED: 'oklch(0.58 0.1 240)',
  ASSIGNED: 'oklch(0.52 0.11 200)',
  IN_PROGRESS: 'oklch(0.62 0.12 155)',
  PROCESSED: 'oklch(0.48 0.11 155)',
  ARCHIVED: 'oklch(0.62 0.02 155)',
  SENT: 'oklch(0.55 0.1 280)',
};

function isActiveMail(item: MailItem): boolean {
  return item.workflowStatus !== 'ARCHIVED' && item.workflowStatus !== 'PROCESSED';
}

function trackingScore(item: MailItem): number {
  let score = 0;
  if (isMailOverdue(item)) score += 1000;
  else if (isMailDeadlineSoon(item)) score += 500;
  if (item.priority === 'URGENT') score += 200;
  if (isMailPending(item)) score += 100;
  if (item.workflowStatus === 'IN_PROGRESS') score += 50;
  const progress = getMailWorkflowProgress(item.workflowStatus, item.direction);
  score += 10 - progress.index;
  return score;
}

export function buildMailTrackingItem(item: MailItem): MailTrackingItem {
  const progress = getMailWorkflowProgress(item.workflowStatus, item.direction);
  const advance = getMailWorkflowAdvanceAction(item);
  return {
    id: item.id,
    reference: item.reference,
    subject: item.subject,
    counterpart: item.counterpart,
    direction: item.direction,
    workflowStatus: item.workflowStatus,
    priority: item.priority,
    progressPercent: progress.percent,
    stepLabel: progress.label,
    nextStatus: advance?.nextStatus ?? null,
    advanceLabel: advance?.label ?? null,
    overdue: isMailOverdue(item),
    deadlineSoon: isMailDeadlineSoon(item),
    executionDeadline: item.executionDeadline,
    followUp: item.followUp,
    assignmentLabel: formatMailAssignment(item),
    mailDate: item.mailDate,
    score: trackingScore(item),
  };
}

export function computeMailAnalytics(items: MailItem[], year: number): MailAnalytics {
  const statuses = new Set<MailWorkflowStatus>();
  for (const item of items) {
    statuses.add(item.workflowStatus);
    for (const s of mailStatusesForDirection(item.direction)) statuses.add(s);
  }

  const byStatus: MailStatusChartPoint[] = [...statuses]
    .map((key) => ({
      key,
      label: MAIL_STATUS_LABELS[key],
      value: items.filter((m) => m.workflowStatus === key).length,
      fill: STATUS_COLORS[key],
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const byPriority = (['URGENT', 'NORMAL'] as MailPriority[]).map((key) => ({
    key,
    label: MAIL_PRIORITY_LABELS[key],
    value: items.filter((m) => m.priority === key).length,
  }));

  const withAttachment = items.filter(
    (m) => m.attachmentCount > 0 || m.attachments.length > 0
  ).length;
  const byAttachment = [
    { key: 'WITH' as const, label: 'Avec PJ', value: withAttachment },
    { key: 'WITHOUT' as const, label: 'Sans PJ', value: items.length - withAttachment },
  ];

  const monthlyFlow: MailMonthlyFlowPoint[] = Array.from({ length: 12 }, (_, month) => {
    const inMonth = items.filter((m) => new Date(m.mailDate).getMonth() === month);
    return {
      month,
      label: MONTH_LABELS[month]!,
      total: inMonth.length,
      urgent: inMonth.filter((m) => m.priority === 'URGENT').length,
    };
  });

  const trackingQueue = items
    .filter(isActiveMail)
    .map(buildMailTrackingItem)
    .sort((a, b) => b.score - a.score);

  return {
    byStatus,
    byPriority,
    byAttachment,
    monthlyFlow,
    trackingQueue,
    statusTotal: items.length,
    activeCount: trackingQueue.length,
    overdueCount: items.filter(isMailOverdue).length,
  };
}
