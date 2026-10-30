'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, FolderKanban, ListTodo } from 'lucide-react';
import {
  groupTasksByProject,
  isTaskOverdue,
  taskProgressPercent,
} from '@/lib/workspace/task-utils';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgTask } from '@/lib/workspace/types';
import { TasksCharts } from '@/components/workspace/tasks-charts';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { TasksGantt, type ProjectRenamedPayload } from '@/components/workspace/tasks-gantt';

type Props = {
  tasks: DgTask[];
  onTaskClick?: (task: DgTask) => void;
  canManage?: boolean;
  onProjectRenamed?: (payload: ProjectRenamedPayload) => void;
};

export function TasksTracking({ tasks, onTaskClick, canManage, onProjectRenamed }: Props) {
  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'CANCELLED');
    const completed = tasks.filter((t) => t.status === 'COMPLETED');
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS');
    const overdue = tasks.filter((t) => isTaskOverdue(t));
    const totalHours = active.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const avgProgress =
      active.length === 0
        ? 0
        : Math.round(active.reduce((sum, t) => sum + taskProgressPercent(t.status), 0) / active.length);

    return { active: active.length, completed: completed.length, inProgress: inProgress.length, overdue: overdue.length, totalHours, avgProgress };
  }, [tasks]);

  const projects = useMemo(() => groupTasksByProject(tasks), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter((t) => isTaskOverdue(t)), [tasks]);

  return (
    <div className="tasks-tracking">
      <div className="tasks-tracking-kpis">
        <article className="tasks-tracking-kpi">
          <ListTodo className="h-4 w-4" />
          <div>
            <p className="tasks-tracking-kpi-value">{stats.active}</p>
            <p className="tasks-tracking-kpi-label">Tâches actives</p>
          </div>
        </article>
        <article className="tasks-tracking-kpi">
          <Clock className="h-4 w-4" />
          <div>
            <p className="tasks-tracking-kpi-value">{stats.inProgress}</p>
            <p className="tasks-tracking-kpi-label">En cours</p>
          </div>
        </article>
        <article className="tasks-tracking-kpi">
          <CheckCircle2 className="h-4 w-4" />
          <div>
            <p className="tasks-tracking-kpi-value">{stats.avgProgress}%</p>
            <p className="tasks-tracking-kpi-label">Avancement moyen</p>
          </div>
        </article>
        <article className="tasks-tracking-kpi" data-alert={stats.overdue > 0 ? 'true' : undefined}>
          <AlertTriangle className="h-4 w-4" />
          <div>
            <p className="tasks-tracking-kpi-value">{stats.overdue}</p>
            <p className="tasks-tracking-kpi-label">En retard</p>
          </div>
        </article>
        <article className="tasks-tracking-kpi">
          <FolderKanban className="h-4 w-4" />
          <div>
            <p className="tasks-tracking-kpi-value">{stats.totalHours} h</p>
            <p className="tasks-tracking-kpi-label">Charge estimée</p>
          </div>
        </article>
      </div>

      <TasksCharts tasks={tasks} />

      {overdueTasks.length > 0 ? (
        <section className="tasks-tracking-section">
          <h3 className="tasks-tracking-section-title">Alertes — échéances dépassées</h3>
          <ul className="tasks-tracking-alerts">
            {overdueTasks.map((task) => (
              <li key={task.id}>
                <button type="button" className="tasks-tracking-alert-item" onClick={() => onTaskClick?.(task)}>
                  <span className="font-medium">{task.title}</span>
                  <span>
                    {task.dueAt ? format(new Date(task.dueAt), 'd MMM yyyy', { locale: fr }) : '—'} —{' '}
                    {task.assigneeName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="tasks-tracking-section">
        <h3 className="tasks-tracking-section-title">Avancement par projet</h3>
        <div className="tasks-tracking-projects">
          {projects.map((project) => (
            <article key={project.name} className="tasks-tracking-project-card">
              <div className="tasks-tracking-project-head">
                <h4>{project.name}</h4>
                <span>{project.tasks.length} tâche(s)</span>
              </div>
              <div className="tasks-tracking-progress-track">
                <span className="tasks-tracking-progress-fill" style={{ width: `${project.progress}%` }} />
              </div>
              <div className="tasks-tracking-project-meta">
                <span>{project.progress}% complété</span>
                <span>{project.totalHours} h</span>
                {project.overdue > 0 ? <span className="tasks-tracking-overdue">{project.overdue} en retard</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tasks-tracking-section">
        <h3 className="tasks-tracking-section-title">Diagramme de Gantt — suivi temporel</h3>
        <TasksGantt
          tasks={tasks}
          onTaskClick={onTaskClick}
          canManage={canManage}
          onProjectRenamed={onProjectRenamed}
        />
      </section>

      <section className="tasks-tracking-section">
        <h3 className="tasks-tracking-section-title">Synthèse des tâches</h3>
        <div className="admin-appt-table-wrap">
          <table className="admin-appt-table tasks-tracking-table w-full">
            <thead>
              <tr>
                <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                <th>Tâche</th>
                <th>Projet</th>
                <th>Responsable</th>
                <th>Avancement</th>
                <th>Priorité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => {
                const progress = taskProgressPercent(task.status);
                return (
                  <tr key={task.id} className="tasks-tracking-table-row" onClick={() => onTaskClick?.(task)}>
                    <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                    <td className="font-medium">{task.title}</td>
                    <td>{task.projectName ?? '—'}</td>
                    <td>{task.assigneeName}</td>
                    <td>
                      <div className="tasks-tracking-row-progress">
                        <div className="tasks-tracking-progress-track tasks-tracking-progress-track--sm">
                          <span className="tasks-tracking-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span>{progress}%</span>
                      </div>
                    </td>
                    <td>{PRIORITY_LABELS[task.priority]}</td>
                    <td>{TASK_STATUS_LABELS[task.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
