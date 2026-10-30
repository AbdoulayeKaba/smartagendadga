'use client';

import { useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  buildGanttRange,
  ganttBarPosition,
  groupTasksByProject,
  isTaskOverdue,
  isTaskSchedulable,
  sortTasksForPlanning,
  taskProgressPercent,
  todayGanttPosition,
  type ProjectSummary,
} from '@/lib/workspace/task-utils';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgTask } from '@/lib/workspace/types';

export type ProjectRenamedPayload = {
  taskIds: string[];
  oldName: string;
  newName: string;
};

type Props = {
  tasks: DgTask[];
  onTaskClick?: (task: DgTask) => void;
  canManage?: boolean;
  onProjectRenamed?: (payload: ProjectRenamedPayload) => void;
};

type GroupHeadProps = {
  project: ProjectSummary;
  canManage: boolean;
  onRenamed: (payload: ProjectRenamedPayload) => void;
};

function projectGroupKey(project: ProjectSummary) {
  return project.tasks
    .map((t) => t.id)
    .sort()
    .join('-');
}

function stopEditPointerEvent(e: PointerEvent | MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function GanttEditableProjectHead({ project, canManage, onRenamed }: GroupHeadProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setValue(project.name);
  }, [project.name, editing]);

  const startEdit = () => {
    setValue(project.name);
    setEditing(true);
  };

  const cancelEdit = () => {
    setValue(project.name);
    setEditing(false);
  };

  const saveEdit = async () => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      cancelEdit();
      return;
    }
    if (trimmed === project.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const linkedProjectId = project.tasks.find((t) => t.projectId)?.projectId;
      if (linkedProjectId) {
        const res = await fetch(`/api/workspace/projects/${linkedProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (res.ok) {
          onRenamed({
            taskIds: project.tasks.map((t) => t.id),
            oldName: project.name,
            newName: trimmed,
          });
          setEditing(false);
        } else {
          cancelEdit();
        }
        return;
      }

      const results = await Promise.all(
        project.tasks.map((task) =>
          fetch(`/api/workspace/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName: trimmed }),
          })
        )
      );
      if (results.every((r) => r.ok)) {
        onRenamed({
          taskIds: project.tasks.map((t) => t.id),
          oldName: project.name,
          newName: trimmed,
        });
        setEditing(false);
      } else {
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tasks-gantt-group-head">
      {editing ? (
        <div
          className="tasks-gantt-group-edit"
          onPointerDown={stopEditPointerEvent}
          onClick={stopEditPointerEvent}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="admin-field tasks-gantt-group-input"
            disabled={saving}
            autoFocus
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="tasks-gantt-group-edit-btn tasks-gantt-group-edit-btn--save"
            disabled={saving || value.trim().length < 2}
            onPointerDown={stopEditPointerEvent}
            onClick={(e) => {
              stopEditPointerEvent(e);
              void saveEdit();
            }}
            title="Enregistrer"
          >
            {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
          </button>
          <button
            type="button"
            className="tasks-gantt-group-edit-btn"
            disabled={saving}
            onPointerDown={stopEditPointerEvent}
            onClick={(e) => {
              stopEditPointerEvent(e);
              cancelEdit();
            }}
            title="Annuler"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <>
          {canManage ? (
            <button type="button" className="tasks-gantt-group-name-btn" onClick={startEdit}>
              <span>{project.name}</span>
              <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
            </button>
          ) : (
            <span className="tasks-gantt-group-name">{project.name}</span>
          )}
          <span className="tasks-gantt-group-meta">
            {project.tasks.length} tâche(s) · {project.progress}%
          </span>
        </>
      )}
    </div>
  );
}

export function TasksGantt({ tasks, onTaskClick, canManage = false, onProjectRenamed }: Props) {
  const [groupByProject, setGroupByProject] = useState(false);

  const schedulable = useMemo(() => sortTasksForPlanning(tasks.filter(isTaskSchedulable)), [tasks]);
  const range = useMemo(() => buildGanttRange(schedulable), [schedulable]);
  const todayPct = range ? todayGanttPosition(range) : null;
  const projects = useMemo(() => groupTasksByProject(schedulable), [schedulable]);

  const ticks = useMemo(() => {
    if (!range) return [];
    const count = Math.min(12, Math.max(4, Math.ceil(range.totalDays / 7)));
    const step = Math.max(1, Math.floor(range.totalDays / count));
    const items: { label: string; leftPct: number }[] = [];
    for (let i = 0; i <= range.totalDays; i += step) {
      const date = addDays(range.start, i);
      items.push({
        label: format(date, 'd MMM', { locale: fr }),
        leftPct: (i / range.totalDays) * 100,
      });
    }
    return items;
  }, [range]);

  const renderRow = (task: DgTask, rowIndex: number) => {
    if (!range) return null;
    const bar = ganttBarPosition(task, range);
    const progress = taskProgressPercent(task.status);
    const overdue = isTaskOverdue(task);
    const tooltip = [
      task.title,
      task.startAt ? `Début : ${format(new Date(task.startAt), 'd MMM yyyy', { locale: fr })}` : null,
      task.dueAt ? `Fin : ${format(new Date(task.dueAt), 'd MMM yyyy', { locale: fr })}` : null,
      `${TASK_STATUS_LABELS[task.status]} · ${PRIORITY_LABELS[task.priority]}`,
    ]
      .filter(Boolean)
      .join('\n');

    const rowClass = rowIndex % 2 === 1 ? 'tasks-gantt-row tasks-gantt-row--alt' : 'tasks-gantt-row';

    return (
      <div key={task.id} className={rowClass}>
        <button type="button" className="tasks-gantt-sidebar-cell" onClick={() => onTaskClick?.(task)}>
          <span className="tasks-gantt-row-title">{task.title}</span>
          <span className="tasks-gantt-row-meta">
            {task.projectName ?? '—'} · {task.assigneeName}
          </span>
        </button>
        <div className="tasks-gantt-timeline-cell">
          {todayPct != null ? (
            <span className="tasks-gantt-today-line" style={{ left: `${todayPct}%` }} />
          ) : null}
          {bar ? (
            <button
              type="button"
              className="tasks-gantt-bar"
              data-status={task.status}
              data-priority={task.priority}
              data-overdue={overdue ? 'true' : undefined}
              style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
              title={tooltip}
              onClick={() => onTaskClick?.(task)}
            >
              <span className="tasks-gantt-bar-progress" style={{ width: `${progress}%` }} />
              <span className="tasks-gantt-bar-label">{progress}%</span>
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  if (!range || schedulable.length === 0) {
    return (
      <div className="tasks-gantt-empty">
        <p>Aucune tâche planifiée avec dates de début ou d&apos;échéance.</p>
        <p className="tasks-gantt-empty-hint">Ajoutez des dates pour afficher le diagramme de Gantt.</p>
      </div>
    );
  }

  return (
    <div className="tasks-gantt">
      <div className="tasks-gantt-toolbar">
        <span>
          Période : {format(range.start, 'd MMM yyyy', { locale: fr })} →{' '}
          {format(range.end, 'd MMM yyyy', { locale: fr })}
        </span>
        <div className="tasks-gantt-toolbar-actions">
          <button
            type="button"
            className="tasks-gantt-toggle"
            data-active={groupByProject ? 'true' : undefined}
            onClick={() => setGroupByProject((v) => !v)}
          >
            Grouper par projet
          </button>
          <span>{schedulable.length} tâche(s)</span>
        </div>
      </div>

      <div className="tasks-gantt-scroll">
        <div className="tasks-gantt-grid">
          <div className="tasks-gantt-sidebar-head">Tâche</div>
          <div className="tasks-gantt-timeline-head">
            {ticks.map((tick) => (
              <span
                key={tick.label + tick.leftPct}
                className="tasks-gantt-tick"
                style={{ left: `${tick.leftPct}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          {groupByProject
            ? (() => {
                let rowIndex = 0;
                return projects.flatMap((project) => [
                  <GanttEditableProjectHead
                    key={`${projectGroupKey(project)}-head`}
                    project={project}
                    canManage={canManage}
                    onRenamed={onProjectRenamed ?? (() => undefined)}
                  />,
                  ...sortTasksForPlanning(project.tasks.filter(isTaskSchedulable)).map((task) =>
                    renderRow(task, rowIndex++)
                  ),
                ]);
              })()
            : schedulable.map((task, index) => renderRow(task, index))}
        </div>
      </div>

      {groupByProject && canManage ? (
        <p className="tasks-gantt-edit-hint">Cliquez sur le nom d&apos;un projet pour le renommer.</p>
      ) : null}

      <div className="tasks-gantt-legend">
        <span>
          <i className="tasks-gantt-legend-dot" data-status="PENDING" /> En attente
        </span>
        <span>
          <i className="tasks-gantt-legend-dot" data-status="IN_PROGRESS" /> En cours
        </span>
        <span>
          <i className="tasks-gantt-legend-dot" data-status="COMPLETED" /> Terminée
        </span>
        <span className="tasks-gantt-legend-today">| Aujourd&apos;hui</span>
      </div>
    </div>
  );
}
