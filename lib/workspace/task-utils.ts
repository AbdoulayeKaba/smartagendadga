import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/workspace/labels';
import type { DgTask, DgTaskStatus } from '@/lib/workspace/types';

export type TaskFilters = {
  query: string;
  project: string;
  status: string;
  priority: string;
};

export function taskProgressPercent(status: DgTaskStatus): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'IN_PROGRESS':
      return 55;
    case 'SUSPENDED':
      return 30;
    case 'COMPLETED':
      return 100;
    case 'CANCELLED':
      return 0;
    default:
      return 0;
  }
}

export function isTaskOverdue(task: DgTask, now = new Date()): boolean {
  if (!task.dueAt) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return isBefore(endOfDay(new Date(task.dueAt)), startOfDay(now));
}

export function taskEffectiveStart(task: DgTask): Date | null {
  if (task.startAt) return startOfDay(new Date(task.startAt));
  if (task.dueAt) return startOfDay(new Date(task.dueAt));
  return null;
}

export function taskEffectiveEnd(task: DgTask): Date | null {
  if (task.dueAt) return endOfDay(new Date(task.dueAt));
  if (task.startAt) return endOfDay(new Date(task.startAt));
  return null;
}

export function isTaskSchedulable(task: DgTask): boolean {
  return Boolean(task.startAt || task.dueAt);
}

export type GanttRange = {
  start: Date;
  end: Date;
  totalDays: number;
};

export function buildGanttRange(tasks: DgTask[], paddingDays = 3): GanttRange | null {
  const schedulable = tasks.filter(isTaskSchedulable);
  if (schedulable.length === 0) return null;

  let min = startOfDay(new Date());
  let max = startOfDay(new Date());

  for (const task of schedulable) {
    const start = taskEffectiveStart(task);
    const end = taskEffectiveEnd(task);
    if (start && start < min) min = start;
    if (end && startOfDay(end) > max) max = startOfDay(end);
    if (start && start > max) max = start;
  }

  const start = addDays(min, -paddingDays);
  const end = addDays(max, paddingDays);
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  return { start, end, totalDays };
}

export function ganttBarPosition(
  task: DgTask,
  range: GanttRange
): { leftPct: number; widthPct: number } | null {
  const barStart = taskEffectiveStart(task);
  const barEnd = taskEffectiveEnd(task);
  if (!barStart || !barEnd) return null;

  const startOffset = differenceInCalendarDays(barStart, range.start);
  const duration = Math.max(1, differenceInCalendarDays(startOfDay(barEnd), barStart) + 1);

  const leftPct = (startOffset / range.totalDays) * 100;
  const widthPct = (duration / range.totalDays) * 100;

  return {
    leftPct: Math.max(0, Math.min(100, leftPct)),
    widthPct: Math.max(1.5, Math.min(100 - leftPct, widthPct)),
  };
}

export function todayGanttPosition(range: GanttRange, now = new Date()): number | null {
  const offset = differenceInCalendarDays(startOfDay(now), range.start);
  if (offset < 0 || offset > range.totalDays) return null;
  return (offset / range.totalDays) * 100;
}

export const SANS_PROJET_LABEL = 'Sans projet';

export function projectGroupLabel(task: DgTask): string {
  return task.projectName?.trim() || SANS_PROJET_LABEL;
}

export type ProjectSummary = {
  name: string;
  tasks: DgTask[];
  totalHours: number;
  progress: number;
  overdue: number;
};

export function groupTasksByProject(tasks: DgTask[]): ProjectSummary[] {
  const map = new Map<string, DgTask[]>();
  for (const task of tasks) {
    const key = projectGroupLabel(task);
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([name, projectTasks]) => {
      const active = projectTasks.filter((t) => t.status !== 'CANCELLED');
      const progress =
        active.length === 0
          ? 0
          : Math.round(
              active.reduce((sum, t) => sum + taskProgressPercent(t.status), 0) / active.length
            );
      return {
        name,
        tasks: projectTasks,
        totalHours: projectTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0),
        progress,
        overdue: projectTasks.filter((t) => isTaskOverdue(t)).length,
      };
    })
    .sort((a, b) => b.tasks.length - a.tasks.length);
}

export function filterTasks(tasks: DgTask[], filters: TaskFilters): DgTask[] {
  const q = filters.query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (filters.project && filters.project !== 'ALL') {
      const project = projectGroupLabel(t);
      if (project !== filters.project) return false;
    }
    if (filters.status && filters.status !== 'ALL' && t.status !== filters.status) return false;
    if (filters.priority && filters.priority !== 'ALL' && t.priority !== filters.priority) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.assigneeName.toLowerCase().includes(q) ||
      (t.projectName?.toLowerCase().includes(q) ?? false) ||
      (t.projectPhase?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function sortTasksForPlanning(tasks: DgTask[]): DgTask[] {
  return [...tasks].sort((a, b) => {
    const aStart = a.startAt ?? a.dueAt ?? '';
    const bStart = b.startAt ?? b.dueAt ?? '';
    if (aStart && bStart) return aStart.localeCompare(bStart);
    if (aStart) return -1;
    if (bStart) return 1;
    return a.title.localeCompare(b.title, 'fr');
  });
}

export function computeTaskDashboardStats(tasks: DgTask[]) {
  const active = tasks.filter((t) => t.status !== 'CANCELLED');
  const overdue = tasks.filter((t) => isTaskOverdue(t));
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const avgProgress =
    active.length === 0
      ? 0
      : Math.round(active.reduce((sum, t) => sum + taskProgressPercent(t.status), 0) / active.length);

  return {
    total: tasks.length,
    active: active.length,
    inProgress: inProgress.length,
    completed: completed.length,
    overdue: overdue.length,
    avgProgress,
    totalHours: active.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0),
  };
}

export function countTasksByStatus(tasks: DgTask[]): { status: DgTaskStatus; count: number; label: string }[] {
  const map = new Map<DgTaskStatus, number>();
  for (const t of tasks) map.set(t.status, (map.get(t.status) ?? 0) + 1);
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    count: map.get(status) ?? 0,
    label: TASK_STATUS_LABELS[status],
  }));
}

export function workloadByAssignee(tasks: DgTask[]): { name: string; hours: number; count: number }[] {
  const map = new Map<string, { hours: number; count: number }>();
  for (const t of tasks) {
    if (t.status === 'CANCELLED' || t.status === 'COMPLETED') continue;
    const cur = map.get(t.assigneeName) ?? { hours: 0, count: 0 };
    cur.hours += t.estimatedHours ?? 0;
    cur.count += 1;
    map.set(t.assigneeName, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count);
}

export function formatTaskHistoryAction(action: string, detail: string | null): string {
  if (action === 'task.create') return 'Tâche créée';
  if (action === 'status.change' && detail) {
    const [from, to] = detail.split(' → ').map((s) => s.trim());
    const fromLabel = TASK_STATUS_LABELS[from as DgTaskStatus] ?? from;
    const toLabel = TASK_STATUS_LABELS[to as DgTaskStatus] ?? to;
    return `Statut : ${fromLabel} → ${toLabel}`;
  }
  if (action === 'comment.add') return 'Commentaire ajouté';
  return action.replace(/\./g, ' ');
}

export function daysUntilDue(task: DgTask, now = new Date()): number | null {
  if (!task.dueAt) return null;
  return differenceInCalendarDays(startOfDay(new Date(task.dueAt)), startOfDay(now));
}

export function uniqueProjectNames(tasks: DgTask[]): string[] {
  const names = new Set<string>();
  for (const t of tasks) {
    names.add(projectGroupLabel(t));
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}
