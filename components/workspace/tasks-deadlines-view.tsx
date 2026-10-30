'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import {
  isTaskOverdue,
  taskProgressPercent,
} from '@/lib/workspace/task-utils';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgTask } from '@/lib/workspace/types';

type Props = {
  tasks: DgTask[];
  onTaskClick?: (task: DgTask) => void;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function TasksDeadlinesView({ tasks, onTaskClick }: Props) {
  const [mode, setMode] = useState<'list' | 'calendar'>('calendar');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const withDue = useMemo(
    () => [...tasks].filter((t) => t.dueAt).sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')),
    [tasks]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, DgTask[]>();
    for (const task of withDue) {
      const key = format(new Date(task.dueAt!), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [withDue]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className="tasks-deadlines">
      <div className="tasks-deadlines-toolbar">
        <div className="tasks-deadlines-mode">
          <button
            type="button"
            className="tasks-deadlines-mode-btn"
            data-active={mode === 'calendar' ? 'true' : undefined}
            onClick={() => setMode('calendar')}
          >
            <CalendarDays className="h-3 w-3" />
            Calendrier
          </button>
          <button
            type="button"
            className="tasks-deadlines-mode-btn"
            data-active={mode === 'list' ? 'true' : undefined}
            onClick={() => setMode('list')}
          >
            <List className="h-3 w-3" />
            Liste
          </button>
        </div>
        {mode === 'calendar' ? (
          <div className="tasks-deadlines-nav">
            <button type="button" className="tasks-deadlines-nav-btn" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="tasks-deadlines-month">{format(month, 'MMMM yyyy', { locale: fr })}</span>
            <button type="button" className="tasks-deadlines-nav-btn" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="tasks-deadlines-count">{withDue.length} échéance(s)</span>
        )}
      </div>

      {mode === 'calendar' ? (
        <div className="tasks-calendar">
          <div className="tasks-calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="tasks-calendar-grid">
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              return (
                <div
                  key={key}
                  className="tasks-calendar-cell"
                  data-today={isToday(day) ? 'true' : undefined}
                  data-outside={!inMonth ? 'true' : undefined}
                >
                  <span className="tasks-calendar-day-num">{format(day, 'd')}</span>
                  <ul className="tasks-calendar-events">
                    {dayTasks.slice(0, 3).map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className="tasks-calendar-event"
                          data-priority={task.priority}
                          data-overdue={isTaskOverdue(task) ? 'true' : undefined}
                          onClick={() => onTaskClick?.(task)}
                          title={task.title}
                        >
                          {task.title}
                        </button>
                      </li>
                    ))}
                    {dayTasks.length > 3 ? (
                      <li className="tasks-calendar-more">+{dayTasks.length - 3} autre(s)</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="admin-appt-table-wrap dg-tasks-calendar-wrap">
          <table className="admin-appt-table dg-tasks-calendar-table w-full">
            <thead>
              <tr>
                <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                <th>Tâche</th>
                <th>Projet</th>
                <th>Responsable</th>
                <th>Période</th>
                <th>Charge</th>
                <th>Avancement</th>
                <th>Priorité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {withDue.length === 0 ? (
                <tr>
                  <td colSpan={9} className="dg-tasks-calendar-empty">
                    Aucune échéance planifiée.
                  </td>
                </tr>
              ) : (
                withDue.map((t, index) => {
                  const progress = taskProgressPercent(t.status);
                  return (
                    <tr
                      key={t.id}
                      className="tasks-tracking-table-row"
                      data-overdue={isTaskOverdue(t) ? 'true' : undefined}
                      onClick={() => onTaskClick?.(t)}
                    >
                      <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                      <td className="font-medium">{t.title}</td>
                      <td>{t.projectName ? `${t.projectName}${t.projectPhase ? ` (${t.projectPhase})` : ''}` : '—'}</td>
                      <td>{t.assigneeName}</td>
                      <td>
                        {t.startAt ? format(new Date(t.startAt), 'd MMM yyyy', { locale: fr }) : '—'}
                        {' → '}
                        {t.dueAt ? format(new Date(t.dueAt), 'd MMM yyyy', { locale: fr }) : '—'}
                      </td>
                      <td>{t.estimatedHours ? `${t.estimatedHours} h` : '—'}</td>
                      <td>{progress}%</td>
                      <td>{PRIORITY_LABELS[t.priority]}</td>
                      <td>{TASK_STATUS_LABELS[t.status]}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
