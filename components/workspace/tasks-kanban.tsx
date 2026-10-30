'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart3,
  Calendar,
  Columns3,
  Download,
  FolderKanban,
  GanttChart,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { downloadCsv } from '@/lib/workspace/export';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { useTemporalQueryParams } from '@/components/temporal/temporal-navigation-context';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { TaskDetailSheet } from '@/components/workspace/task-detail-sheet';
import { TasksDeadlinesView } from '@/components/workspace/tasks-deadlines-view';
import { TasksGantt, type ProjectRenamedPayload } from '@/components/workspace/tasks-gantt';
import { TasksTracking } from '@/components/workspace/tasks-tracking';
import {
  emptyProjectForm,
  parsePhasesText,
  ProjectFormDialog,
  type ProjectFormState,
} from '@/components/workspace/project-form-dialog';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { assigneeOptionId, resolveAssigneeFromOption } from '@/lib/workspace/assignee-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  computeTaskDashboardStats,
  filterTasks,
  isTaskOverdue,
  taskProgressPercent,
  uniqueProjectNames,
} from '@/lib/workspace/task-utils';
import { PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/workspace/labels';
import type { DgProject, DgTask, DgTaskStatus, WorkspaceAssigneeOption } from '@/lib/workspace/types';

type ViewMode = 'kanban' | 'gantt' | 'deadlines' | 'tracking';

const emptyForm = {
  title: '',
  description: '',
  priority: 'MEDIUM' as const,
  projectId: '',
  projectPhase: '',
  assigneeOptionId: '',
  startAt: '',
  dueAt: '',
  estimatedHours: '',
};

export function TasksKanbanView() {
  const temporalParams = useTemporalQueryParams();
  const role = useDgRole();
  const canManage = canManageWorkspace(role);
  const [tasks, setTasks] = useState<DgTask[]>([]);
  const [projects, setProjects] = useState<DgProject[]>([]);
  const [assignees, setAssignees] = useState<WorkspaceAssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [projectSaving, setProjectSaving] = useState(false);
  const [editTask, setEditTask] = useState<DgTask | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [deleteTask, setDeleteTask] = useState<DgTask | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<DgTaskStatus | null>(null);

  const taskQuery = useMemo(() => new URLSearchParams(temporalParams).toString(), [temporalParams]);

  const loadMeta = useCallback(async () => {
    const [projectsRes, assigneesRes] = await Promise.all([
      fetch(`/api/workspace/projects?${taskQuery}`),
      fetch('/api/workspace/assignees'),
    ]);
    if (projectsRes.ok) {
      const json = (await projectsRes.json()) as { items: DgProject[] };
      setProjects(json.items ?? []);
    }
    if (assigneesRes.ok) {
      const json = (await assigneesRes.json()) as { items: WorkspaceAssigneeOption[] };
      setAssignees(json.items ?? []);
    }
  }, [taskQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes] = await Promise.all([
        fetch(`/api/workspace/tasks?${taskQuery}`),
        loadMeta(),
      ]);
      if (tasksRes.ok) {
        const json = (await tasksRes.json()) as { items: DgTask[] };
        setTasks(json.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [loadMeta, taskQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTasks = useMemo(
    () =>
      filterTasks(tasks, {
        query: search,
        project: projectFilter,
        status: statusFilter,
        priority: priorityFilter,
      }),
    [tasks, search, projectFilter, statusFilter, priorityFilter]
  );

  const stats = useMemo(() => computeTaskDashboardStats(filteredTasks), [filteredTasks]);
  const projectOptions = useMemo(() => {
    const fromRegistry = projects.map((p) => p.name);
    const fromTasks = uniqueProjectNames(tasks).filter((name) => name !== 'Sans projet');
    return [...new Set([...fromRegistry, ...fromTasks])].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projects, tasks]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId) ?? null,
    [projects, form.projectId]
  );

  const phaseOptions = useMemo(() => {
    const phases = selectedProject?.phases ?? [];
    if (form.projectPhase && !phases.includes(form.projectPhase)) {
      return [...phases, form.projectPhase];
    }
    return phases;
  }, [selectedProject, form.projectPhase]);

  const byStatus = useMemo(() => {
    const map = new Map<DgTaskStatus, DgTask[]>();
    for (const s of TASK_STATUS_ORDER) map.set(s, []);
    for (const t of filteredTasks) {
      const list = map.get(t.status) ?? [];
      list.push(t);
      map.set(t.status, list);
    }
    return map;
  }, [filteredTasks]);

  const moveTask = async (taskId: string, status: DgTaskStatus) => {
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/workspace/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setTasks(prev);
    else void load();
  };

  const exportTasks = () => {
    downloadCsv(
      'taches-dg.csv',
      ['Titre', 'Projet', 'Phase', 'Responsable', 'Début', 'Échéance', 'Charge (h)', 'Priorité', 'Statut', 'Avancement %'],
      filteredTasks.map((t) => [
        t.title,
        t.projectName ?? '',
        t.projectPhase ?? '',
        t.assigneeName,
        t.startAt ? format(new Date(t.startAt), 'yyyy-MM-dd') : '',
        t.dueAt ? format(new Date(t.dueAt), 'yyyy-MM-dd') : '',
        t.estimatedHours ? String(t.estimatedHours) : '',
        PRIORITY_LABELS[t.priority],
        TASK_STATUS_LABELS[t.status],
        String(taskProgressPercent(t.status)),
      ])
    );
  };

  const openCreate = (presetProjectId?: string) => {
    setEditTask(null);
    setForm({ ...emptyForm, projectId: presetProjectId ?? '' });
    setCreateOpen(true);
  };

  const openCreateProject = () => {
    setProjectForm(emptyProjectForm);
    setProjectOpen(true);
  };

  const openEdit = (task: DgTask) => {
    setCreateOpen(false);
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      projectId: task.projectId ?? projects.find((p) => p.name === task.projectName)?.id ?? '',
      projectPhase: task.projectPhase ?? '',
      assigneeOptionId: assigneeOptionId(task),
      startAt: task.startAt ? task.startAt.slice(0, 10) : '',
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
      estimatedHours: task.estimatedHours ? String(task.estimatedHours) : '',
    });
  };

  const openDetail = (task: DgTask) => {
    setDetailTaskId(task.id);
  };

  const handleProjectRenamed = useCallback(({ taskIds, oldName, newName }: ProjectRenamedPayload) => {
    const idSet = new Set(taskIds);
    setTasks((prev) =>
      prev.map((t) => (idSet.has(t.id) ? { ...t, projectName: newName } : t))
    );
    setProjectFilter((current) => (current === oldName ? newName : current));
  }, []);

  const saveProject = async () => {
    setProjectSaving(true);
    try {
      const owner = resolveAssigneeFromOption(projectForm.ownerOptionId, assignees);
      const payload = {
        name: projectForm.name.trim(),
        description: projectForm.description || null,
        status: projectForm.status,
        ownerName: owner.assigneeName,
        ownerUserId: owner.assigneeUserId,
        phases: parsePhasesText(projectForm.phasesText),
        startAt: projectForm.startAt ? new Date(projectForm.startAt).toISOString() : null,
        dueAt: projectForm.dueAt ? new Date(projectForm.dueAt).toISOString() : null,
      };
      const res = await fetch('/api/workspace/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = (await res.json()) as { project: DgProject };
        setProjectOpen(false);
        setProjectForm(emptyProjectForm);
        await loadMeta();
        openCreate(json.project.id);
      }
    } finally {
      setProjectSaving(false);
    }
  };

  const saveTask = async () => {
    setSaving(true);
    try {
      const assignee = resolveAssigneeFromOption(form.assigneeOptionId, assignees);
      const payload = {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        projectId: form.projectId || null,
        projectPhase: form.projectPhase || null,
        assigneeName: assignee.assigneeName,
        assigneeUserId: assignee.assigneeUserId,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      };

      const endpoint = editTask ? `/api/workspace/tasks/${editTask.id}` : '/api/workspace/tasks';
      const method = editTask ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setCreateOpen(false);
        setEditTask(null);
        setForm(emptyForm);
        void load();
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTask) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${deleteTask.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTask(null);
        void load();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const taskDialogOpen = createOpen || !!editTask;
  const canSave = Boolean(form.title.trim() && form.assigneeOptionId) && !saving;

  const closeTaskDialog = () => {
    setCreateOpen(false);
    setEditTask(null);
  };

  const handleDrop = (status: DgTaskStatus) => {
    if (!dragTaskId || !canManage) return;
    const task = tasks.find((t) => t.id === dragTaskId);
    if (task && task.status !== status) void moveTask(dragTaskId, status);
    setDragTaskId(null);
    setDragOverStatus(null);
  };

  const renderKanbanCard = (task: DgTask) => {
    const progress = taskProgressPercent(task.status);
    const overdue = isTaskOverdue(task);

    return (
      <article
        key={task.id}
        className="workspace-kanban-card"
        data-overdue={overdue ? 'true' : undefined}
        draggable={canManage}
        data-dragging={dragTaskId === task.id ? 'true' : undefined}
        onDragStart={() => setDragTaskId(task.id)}
        onDragEnd={() => {
          setDragTaskId(null);
          setDragOverStatus(null);
        }}
      >
        <button type="button" className="workspace-kanban-card-open" onClick={() => openDetail(task)}>
          <div className="workspace-kanban-card-title-row">
            <p className="workspace-kanban-card-title">{task.title}</p>
            {overdue ? <span className="workspace-kanban-overdue-pill">Retard</span> : null}
          </div>
          {task.projectName ? (
            <p className="workspace-kanban-card-project">
              Projet : {task.projectName}
              {task.projectPhase ? ` — ${task.projectPhase}` : ''}
            </p>
          ) : null}
          <p className="workspace-kanban-card-meta">{task.assigneeName}</p>
          {task.startAt || task.dueAt ? (
            <p className="workspace-kanban-card-meta">
              {task.startAt ? `Début ${format(new Date(task.startAt), 'd MMM yyyy', { locale: fr })}` : ''}
              {task.startAt && task.dueAt ? ' — ' : ''}
              {task.dueAt ? `Échéance ${format(new Date(task.dueAt), 'd MMM yyyy', { locale: fr })}` : ''}
            </p>
          ) : null}
          <div className="workspace-kanban-card-progress">
            <div className="tasks-tracking-progress-track tasks-tracking-progress-track--sm">
              <span className="tasks-tracking-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
        </button>
        <div className="workspace-kanban-card-foot">
          <span className="workspace-priority-badge" data-priority={task.priority}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {canManage ? (
            <div className="workspace-kanban-card-actions">
              <button type="button" className="workspace-kanban-icon-btn" onClick={() => openEdit(task)} aria-label="Modifier">
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                className="workspace-kanban-icon-btn workspace-kanban-icon-btn--danger"
                onClick={() => setDeleteTask(task)}
                aria-label="Supprimer"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="workspace-kanban-card-status">
          <Select
            value={task.status}
            onValueChange={(v) => void moveTask(task.id, v as DgTaskStatus)}
            disabled={!canManage}
          >
            <SelectTrigger className="workspace-kanban-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </article>
    );
  };

  return (
    <div className="dg-tasks-kanban space-y-2">
      <AdminPageHeader
        variant="flat"
        eyebrow="Espace de travail"
        title="Gestion des tâches"
        description="Kanban, diagramme de Gantt, échéances et tableau de suivi projet."
        actions={
          <div className="admin-appt-header-actions">
            <button
              type="button"
              className="admin-appt-filter-btn admin-appt-header-btn"
              data-active={view === 'kanban' ? 'true' : undefined}
              onClick={() => setView('kanban')}
            >
              <Columns3 className="h-3 w-3" aria-hidden />
              Kanban
            </button>
            <button
              type="button"
              className="admin-appt-filter-btn admin-appt-header-btn"
              data-active={view === 'gantt' ? 'true' : undefined}
              onClick={() => setView('gantt')}
            >
              <GanttChart className="h-3 w-3" aria-hidden />
              Gantt
            </button>
            <button
              type="button"
              className="admin-appt-filter-btn admin-appt-header-btn"
              data-active={view === 'deadlines' ? 'true' : undefined}
              onClick={() => setView('deadlines')}
            >
              <Calendar className="h-3 w-3" aria-hidden />
              Échéances
            </button>
            <button
              type="button"
              className="admin-appt-filter-btn admin-appt-header-btn"
              data-active={view === 'tracking' ? 'true' : undefined}
              onClick={() => setView('tracking')}
            >
              <BarChart3 className="h-3 w-3" aria-hidden />
              Suivi
            </button>
            {canManage ? (
              <>
                <button type="button" className="admin-appt-header-btn admin-appt-header-btn" onClick={openCreateProject}>
                  <FolderKanban className="h-3 w-3" aria-hidden />
                  Nouveau projet
                </button>
                <button type="button" className="admin-appt-header-btn admin-appt-header-btn--primary" onClick={() => openCreate()}>
                  <Plus className="h-3 w-3" aria-hidden />
                  Nouvelle tâche
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="tasks-toolbar">
        <div className="tasks-toolbar-search">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher tâche, projet, responsable…"
            className="admin-field tasks-search-input"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="tasks-project-filter admin-field">
            <SelectValue placeholder="Tous les projets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les projets</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="tasks-project-filter admin-field">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous statuts</SelectItem>
            {TASK_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="tasks-project-filter admin-field">
            <SelectValue placeholder="Toutes priorités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes priorités</SelectItem>
            <SelectItem value="HIGH">Haute</SelectItem>
            <SelectItem value="MEDIUM">Moyenne</SelectItem>
            <SelectItem value="LOW">Basse</SelectItem>
          </SelectContent>
        </Select>
        <button type="button" className="tasks-export-btn" onClick={exportTasks}>
          <Download className="h-3 w-3" />
          Excel
        </button>
      </div>

      {!loading && projects.length > 0 ? (
        <div className="tasks-projects-strip">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="tasks-project-chip"
              data-active={projectFilter === project.name ? 'true' : undefined}
              onClick={() => setProjectFilter((current) => (current === project.name ? 'ALL' : project.name))}
            >
              <span className="tasks-project-chip-name">{project.name}</span>
              <span className="tasks-project-chip-meta">
                {project.taskCount} tâche{project.taskCount > 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!loading ? (
        <div className="tasks-stats-strip">
          <span>
            <strong>{stats.active}</strong> actives
          </span>
          <span>
            <strong>{stats.inProgress}</strong> en cours
          </span>
          <span>
            <strong>{stats.avgProgress}%</strong> avancement
          </span>
          <span data-alert={stats.overdue > 0 ? 'true' : undefined}>
            <strong>{stats.overdue}</strong> en retard
          </span>
          <span>
            <strong>{stats.totalHours} h</strong> charge
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="dg-tasks-kanban-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <div className="workspace-kanban workspace-kanban--compact">
          {TASK_STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="workspace-kanban-col"
              data-drop-target={dragTaskId ? 'true' : undefined}
              data-drag-over={dragOverStatus === status ? 'true' : undefined}
              onDragOver={(e) => {
                if (canManage) {
                  e.preventDefault();
                  setDragOverStatus(status);
                }
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
              onDrop={() => handleDrop(status)}
            >
              <div className="workspace-kanban-col-head">
                <span>{TASK_STATUS_LABELS[status]}</span>
                <span className="workspace-kanban-count">{(byStatus.get(status) ?? []).length}</span>
              </div>
              <div className="workspace-kanban-col-body">
                {(byStatus.get(status) ?? []).map((task) => renderKanbanCard(task))}
              </div>
            </div>
          ))}
        </div>
      ) : view === 'gantt' ? (
        <TasksGantt
          tasks={filteredTasks}
          onTaskClick={openDetail}
          canManage={canManage}
          onProjectRenamed={handleProjectRenamed}
        />
      ) : view === 'tracking' ? (
        <TasksTracking
          tasks={filteredTasks}
          onTaskClick={openDetail}
          canManage={canManage}
          onProjectRenamed={handleProjectRenamed}
        />
      ) : (
        <TasksDeadlinesView tasks={filteredTasks} onTaskClick={openDetail} />
      )}

      <TaskDetailSheet
        taskId={detailTaskId}
        open={!!detailTaskId}
        onOpenChange={(o) => !o && setDetailTaskId(null)}
        canManage={canManage}
        onEdit={openEdit}
        onUpdated={() => void load()}
      />

      <WorkspaceCrudDialog
        open={taskDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeTaskDialog();
        }}
        title={editTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        onSubmit={() => void saveTask()}
        footer={
          <>
            <button type="button" className="admin-btn-cancel" onClick={closeTaskDialog} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="admin-btn-create" disabled={!canSave}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editTask ? 'Enregistrer' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="workspace-crud-form-grid">
          <WorkspaceCrudField id="task-title" label="Titre" className="workspace-crud-span-2">
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-project" label="Projet">
            <Select
              value={form.projectId || 'NONE'}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  projectId: v === 'NONE' ? '' : v,
                  projectPhase: v === 'NONE' ? '' : f.projectPhase,
                }))
              }
            >
              <SelectTrigger id="task-project" className="admin-field w-full">
                <SelectValue placeholder="Sélectionner un projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sans projet</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-phase" label="Phase">
            {phaseOptions.length > 0 ? (
              <Select
                value={form.projectPhase || 'NONE'}
                onValueChange={(v) => setForm((f) => ({ ...f, projectPhase: v === 'NONE' ? '' : v }))}
              >
                <SelectTrigger id="task-phase" className="admin-field w-full">
                  <SelectValue placeholder="Choisir une phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Aucune phase</SelectItem>
                  {phaseOptions.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="task-phase"
                placeholder="Ex : Cadrage, exécution"
                value={form.projectPhase}
                onChange={(e) => setForm((f) => ({ ...f, projectPhase: e.target.value }))}
                className="admin-field"
              />
            )}
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-assignee" label="Responsable" className="workspace-crud-span-2">
            <Select
              value={form.assigneeOptionId || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, assigneeOptionId: v }))}
            >
              <SelectTrigger id="task-assignee" className="admin-field w-full">
                <SelectValue placeholder="Choisir un responsable" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                    {a.department ? ` — ${a.department}` : a.kind === 'service' ? ' (service)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-priority" label="Priorité">
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as typeof f.priority }))}
            >
              <SelectTrigger id="task-priority" className="admin-field w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">Haute</SelectItem>
                <SelectItem value="MEDIUM">Moyenne</SelectItem>
                <SelectItem value="LOW">Basse</SelectItem>
              </SelectContent>
            </Select>
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-hours" label="Charge estimée (h)">
            <Input
              id="task-hours"
              type="number"
              min={1}
              max={500}
              value={form.estimatedHours}
              onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-start" label="Date de début">
            <FrenchDateField
              id="task-start"
              value={form.startAt}
              onChange={(startAt) => setForm((f) => ({ ...f, startAt }))}
              className="admin-field"
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-due" label="Échéance">
            <FrenchDateField
              id="task-due"
              value={form.dueAt}
              onChange={(dueAt) => setForm((f) => ({ ...f, dueAt }))}
              className="admin-field"
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="task-description" label="Description" className="workspace-crud-span-2">
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="admin-field workspace-crud-textarea min-h-[2.75rem] resize-y"
            />
          </WorkspaceCrudField>
        </div>
      </WorkspaceCrudDialog>

      <ProjectFormDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        title="Nouveau projet"
        form={projectForm}
        onFormChange={(patch) => setProjectForm((f) => ({ ...f, ...patch }))}
        assignees={assignees}
        saving={projectSaving}
        onSubmit={() => void saveProject()}
      />

      <AdminConfirmDialog
        open={!!deleteTask}
        onOpenChange={(o) => !o && setDeleteTask(null)}
        title="Supprimer cette tâche ?"
        message={
          deleteTask ? (
            <>
              <span className="font-medium text-foreground">{deleteTask.title}</span> sera définitivement supprimée.
            </>
          ) : null
        }
        confirmLabel="Supprimer"
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
