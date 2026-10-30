'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, History, Loader2, MessageSquare, Pencil } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  daysUntilDue,
  formatTaskHistoryAction,
  isTaskOverdue,
  taskProgressPercent,
} from '@/lib/workspace/task-utils';
import { PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/workspace/labels';
import type { DgTask, DgTaskComment, DgTaskHistoryEntry, DgTaskStatus } from '@/lib/workspace/types';

type TaskDetail = {
  task: DgTask;
  comments: DgTaskComment[];
  history: DgTaskHistoryEntry[];
};

type Props = {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onEdit: (task: DgTask) => void;
  onUpdated: () => void;
};

export function TaskDetailSheet({ taskId, open, onOpenChange, canManage, onEdit, onUpdated }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}`);
      if (res.ok) {
        setDetail((await res.json()) as TaskDetail);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      setComment('');
      void loadDetail();
    } else if (!open) {
      setDetail(null);
    }
  }, [open, taskId, loadDetail]);

  const sendComment = async () => {
    if (!taskId || !comment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      if (res.ok) {
        setComment('');
        await loadDetail();
        onUpdated();
      }
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: DgTaskStatus) => {
    if (!taskId || !detail || detail.task.status === status) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadDetail();
        onUpdated();
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const task = detail?.task;
  const progress = task ? taskProgressPercent(task.status) : 0;
  const overdue = task ? isTaskOverdue(task) : false;
  const dueIn = task ? daysUntilDue(task) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="task-detail-sheet">
        {loading && !task ? (
          <>
            <SheetTitle className="sr-only">Détail de la tâche</SheetTitle>
            <div className="task-detail-loading">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </>
        ) : task ? (
          <>
            <SheetHeader className="task-detail-sheet-header">
              <SheetTitle className="task-detail-title">{task.title}</SheetTitle>
              <SheetDescription className="sr-only">Détail de la tâche</SheetDescription>
              {overdue ? (
                <p className="task-detail-overdue-badge">
                  <AlertTriangle className="h-3 w-3" />
                  Échéance dépassée
                </p>
              ) : dueIn != null && dueIn <= 3 && dueIn >= 0 ? (
                <p className="task-detail-due-soon-badge">Échéance dans {dueIn} jour(s)</p>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  className="task-detail-edit-btn"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(task);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Modifier
                </button>
              ) : null}
            </SheetHeader>

            <div className="task-detail-body">
              <div className="task-detail-progress-block">
                <div className="task-detail-progress-head">
                  <span>Avancement</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="tasks-tracking-progress-track">
                  <span className="tasks-tracking-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                {canManage ? (
                  <Select
                    value={task.status}
                    onValueChange={(v) => void changeStatus(v as DgTaskStatus)}
                    disabled={statusLoading}
                  >
                    <SelectTrigger className="task-detail-status-select admin-field w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="task-detail-status">{TASK_STATUS_LABELS[task.status]}</p>
                )}
              </div>

              <dl className="task-detail-meta">
                <div>
                  <dt>Projet</dt>
                  <dd>
                    {task.projectName ?? '—'}
                    {task.projectPhase ? ` (${task.projectPhase})` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{task.assigneeName}</dd>
                </div>
                <div>
                  <dt>Priorité</dt>
                  <dd>
                    <span className="workspace-priority-badge" data-priority={task.priority}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Début</dt>
                  <dd>
                    {task.startAt ? format(new Date(task.startAt), 'd MMM yyyy', { locale: fr }) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Échéance</dt>
                  <dd>
                    {task.dueAt ? format(new Date(task.dueAt), 'd MMM yyyy', { locale: fr }) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Charge</dt>
                  <dd>{task.estimatedHours ? `${task.estimatedHours} h` : '—'}</dd>
                </div>
              </dl>

              {task.description ? (
                <section className="task-detail-section">
                  <h3>Description</h3>
                  <p className="task-detail-description">{task.description}</p>
                </section>
              ) : null}

              <section className="task-detail-section">
                <h3>
                  <MessageSquare className="inline h-3.5 w-3.5" /> Commentaires ({detail?.comments.length ?? 0})
                </h3>
                <ul className="task-detail-comments">
                  {(detail?.comments ?? []).length === 0 ? (
                    <li className="task-detail-empty">Aucun commentaire.</li>
                  ) : (
                    detail?.comments.map((c) => (
                      <li key={c.id} className="task-detail-comment">
                        <p className="task-detail-comment-meta">
                          <strong>{c.authorName}</strong> —{' '}
                          {format(new Date(c.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                        </p>
                        <p>{c.body}</p>
                      </li>
                    ))
                  )}
                </ul>
                {canManage ? (
                  <div className="task-detail-comment-form">
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ajouter un commentaire…"
                      className="admin-field workspace-crud-textarea min-h-[2.75rem] resize-y"
                    />
                    <button
                      type="button"
                      className="admin-btn-create"
                      disabled={!comment.trim() || sending}
                      onClick={() => void sendComment()}
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Publier'}
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="task-detail-section">
                <h3>
                  <History className="inline h-3.5 w-3.5" /> Historique ({detail?.history.length ?? 0})
                </h3>
                <ul className="task-detail-history">
                  {(detail?.history ?? []).length === 0 ? (
                    <li className="task-detail-empty">Aucun événement.</li>
                  ) : (
                    [...(detail?.history ?? [])].reverse().map((h) => (
                      <li key={h.id} className="task-detail-history-item">
                        <span className="task-detail-history-date">
                          {format(new Date(h.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                        </span>
                        <span className="task-detail-history-action">
                          {formatTaskHistoryAction(h.action, h.detail)}
                        </span>
                        <span className="task-detail-history-user">{h.userName}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          </>
        ) : (
          <SheetTitle className="sr-only">Détail de la tâche</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
