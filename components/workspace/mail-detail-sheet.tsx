'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  Clock,
  FileText,
  GitBranch,
  Hash,
  Inbox,
  Paperclip,
  Pencil,
  User,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MAIL_DIRECTION_LABELS, MAIL_PRIORITY_LABELS, MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import {
  formatMailAssignment,
  formatMailDate,
  formatMailDateTime,
  formatMailFollowUpNote,
  getMailDeadlineState,
  getMailWorkflowAdvanceAction,
  getMailWorkflowProgress,
  getMailWorkflowStepIndex,
  isMailPending,
  mailNeedsAssignmentDetails,
  mailStatusesForDirection,
} from '@/lib/workspace/mail-utils';
import { MailAssignDialog, type MailAssignmentPayload } from '@/components/workspace/mail-assign-dialog';
import { MailWorkflowAdvanceButton } from '@/components/workspace/mail-workflow-advance-button';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { cn } from '@/lib/utils';
import type { MailItem, MailStatusTraceEntry, MailWorkflowStatus } from '@/lib/workspace/types';

type Props = {
  mail: MailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onEdit: (mail: MailItem) => void;
  onStatusChange: (mailId: string, status: MailWorkflowStatus, patch?: Record<string, unknown>) => Promise<void>;
  statusLoading?: boolean;
  loadingMailId?: string | null;
  statusAdvanceError?: string | null;
};

function SectionCard({
  title,
  icon,
  children,
  variant,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  variant?: 'instruction' | 'muted';
}) {
  return (
    <section
      className={cn(
        'mail-detail-card',
        variant === 'instruction' && 'mail-detail-card--instruction',
        variant === 'muted' && 'mail-detail-card--muted'
      )}
    >
      <h3 className="mail-detail-card-title">
        <span className="mail-detail-card-title-icon" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mail-detail-info-card">
      <div className="mail-detail-info-card-icon">{icon}</div>
      <div className="mail-detail-info-card-body">
        <span className="mail-detail-info-card-label">{label}</span>
        <span className="mail-detail-info-card-value">{value}</span>
      </div>
    </div>
  );
}

function MailWorkflowVerticalStepper({
  mail,
  canManage,
  statusLoading,
  onStatusChange,
  onRequestAssign,
  statusTrace,
}: {
  mail: MailItem;
  canManage: boolean;
  statusLoading: boolean;
  onStatusChange: (status: MailWorkflowStatus) => void;
  onRequestAssign: () => void;
  statusTrace: Partial<Record<MailWorkflowStatus, MailStatusTraceEntry>>;
}) {
  const steps = mailStatusesForDirection(mail.direction);
  const currentIdx = getMailWorkflowStepIndex(mail.workflowStatus, mail.direction);
  const assignmentLabel = formatMailAssignment(mail);
  const assignmentMissing = mailNeedsAssignmentDetails(mail);

  return (
    <div className="mail-workflow-v" role="list" aria-label="Circuit de traitement">
      {steps.map((step, index) => {
        const isDone = currentIdx > index;
        const isCurrent = currentIdx === index;
        const isLast = index === steps.length - 1;
        const isAssignStep = step === 'ASSIGNED';
        const showAssignment = isAssignStep && (isDone || isCurrent || Boolean(assignmentLabel));
        const isClickable =
          canManage &&
          !statusLoading &&
          (index !== currentIdx || (isAssignStep && isCurrent && assignmentMissing));

        return (
          <div
            key={step}
            role="listitem"
            className={cn(
              'mail-workflow-v-step',
              isDone && 'mail-workflow-v-step--done',
              isCurrent && 'mail-workflow-v-step--current'
            )}
          >
            <div className="mail-workflow-v-rail" aria-hidden>
              <span className="mail-workflow-v-dot">
                {isDone ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                ) : (
                  <span className="mail-workflow-v-num">{index + 1}</span>
                )}
              </span>
              {!isLast ? <span className="mail-workflow-v-line" /> : null}
            </div>
            <button
              type="button"
              className="mail-workflow-v-content"
              disabled={!isClickable}
              onClick={() => {
                if (!isClickable) return;
                if (isAssignStep) {
                  onRequestAssign();
                  return;
                }
                onStatusChange(step);
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="mail-workflow-v-label">{MAIL_STATUS_LABELS[step]}</span>
              {isCurrent ? <span className="mail-workflow-v-now">Étape en cours</span> : null}
              {statusTrace[step] ? (
                <span
                  className={cn(
                    'mail-workflow-v-date',
                    statusTrace[step]?.inferred && 'mail-workflow-v-date--inferred'
                  )}
                  title={
                    statusTrace[step]?.inferred
                      ? 'Date estimée à partir du dossier'
                      : 'Date du changement de statut'
                  }
                >
                  {statusTrace[step]?.inferred ? 'vers le ' : 'le '}
                  {formatMailDateTime(statusTrace[step]!.at)}
                </span>
              ) : isDone || isCurrent ? (
                <span className="mail-workflow-v-date mail-workflow-v-date--unknown">
                  Date non tracée
                </span>
              ) : null}
              {showAssignment ? (
                assignmentLabel ? (
                  <>
                    <span className="mail-workflow-v-meta" title={assignmentLabel}>
                      <Building2 className="h-2.5 w-2.5 shrink-0" aria-hidden />
                      {assignmentLabel}
                    </span>
                    {mail.assignedAt ? (
                      <span className="mail-workflow-v-meta mail-workflow-v-meta--muted">
                        Affecté le {formatMailDate(mail.assignedAt)}
                      </span>
                    ) : null}
                  </>
                ) : isCurrent ? (
                  <span className="mail-workflow-v-meta mail-workflow-v-meta--warn">
                    Affectation à préciser
                  </span>
                ) : null
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function MailDetailSheet({
  mail,
  open,
  onOpenChange,
  canManage,
  onEdit,
  onStatusChange,
  statusLoading = false,
  loadingMailId = null,
  statusAdvanceError = null,
}: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusTrace, setStatusTrace] = useState<
    Partial<Record<MailWorkflowStatus, MailStatusTraceEntry>>
  >({});

  useEffect(() => {
    if (!open || !mail) {
      setStatusTrace({});
      return;
    }
    let cancelled = false;
    void fetchJson<{ items: MailStatusTraceEntry[] }>(
      `/api/workspace/mail/${mail.id}/history`
    ).then((res) => {
      if (cancelled || !res.ok) return;
      const next: Partial<Record<MailWorkflowStatus, MailStatusTraceEntry>> = {};
      for (const entry of res.data.items ?? []) {
        next[entry.status] = entry;
      }
      setStatusTrace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mail?.id, mail?.workflowStatus, mail?.updatedAt]);
  const isIncoming = mail?.direction === 'INCOMING';
  const advanceAction = mail ? getMailWorkflowAdvanceAction(mail) : null;
  const isAdvanceLoading = statusLoading && !!mail && loadingMailId === mail.id;
  const hasExecutionSection = !!(
    mail &&
    (mail.executor || mail.action || mail.scSentAt || mail.executionDeadline || mail.courierName)
  );
  const deadlineState = mail
    ? getMailDeadlineState(mail)
    : { status: 'NONE' as const, days: null };
  const overdue = deadlineState.status === 'OVERDUE';
  const followUpNote = formatMailFollowUpNote(mail?.followUp);
  const workflowProgress = mail
    ? getMailWorkflowProgress(mail.workflowStatus, mail.direction)
    : null;

  const requestAssign = () => setAssignOpen(true);

  const handleStatusOrAssign = async (
    mailId: string,
    status: MailWorkflowStatus,
    patch: Record<string, unknown> = {}
  ) => {
    if (status === 'ASSIGNED') {
      setAssignOpen(true);
      return;
    }
    await onStatusChange(mailId, status, patch);
  };

  const confirmAssign = async (payload: MailAssignmentPayload) => {
    if (!mail) return;
    await onStatusChange(mail.id, 'ASSIGNED', {
      assignedService: payload.assignedService,
      executor: payload.executor,
      assignedAt: payload.assignedAt,
    });
    setAssignOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="admin-theme mail-detail-sheet">
        {!mail ? (
          <SheetTitle className="sr-only">Détail du courrier</SheetTitle>
        ) : (
          <div className="mail-detail-layout">
            <SheetHeader className="mail-detail-sheet-header">
              <div className="mail-detail-header-top">
                <div className="mail-detail-head-main">
                  <div className="mail-detail-head-icon" aria-hidden>
                    <Inbox className="h-4 w-4" />
                  </div>
                  <span className="mail-detail-ref-badge">{mail.reference}</span>
                </div>
                <div className="mail-detail-badges">
                  <span className="mail-direction-badge" data-direction={mail.direction}>
                    {MAIL_DIRECTION_LABELS[mail.direction]}
                  </span>
                  {isIncoming ? (
                    <span className="mail-priority-badge" data-priority={mail.priority}>
                      {MAIL_PRIORITY_LABELS[mail.priority]}
                    </span>
                  ) : null}
                  <span className="mail-status-badge" data-status={mail.workflowStatus}>
                    {MAIL_STATUS_LABELS[mail.workflowStatus]}
                  </span>
                  {isMailPending(mail) ? (
                    <span className="mail-detail-pending-badge">À traiter</span>
                  ) : null}
                </div>
              </div>
              <SheetTitle className="mail-detail-title">{mail.subject}</SheetTitle>
              <SheetDescription asChild>
                <div className="mail-detail-meta">
                  <span className="mail-detail-meta-item">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    {isIncoming ? 'Reçu le' : 'Daté du'} {formatMailDate(mail.mailDate)}
                  </span>
                  {mail.registrationNumber ? (
                    <>
                      <span className="mail-detail-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span className="mail-detail-meta-item mail-detail-meta-item--muted">
                        <Hash className="h-3 w-3 shrink-0" aria-hidden />
                        N° enreg. {mail.registrationNumber}
                      </span>
                    </>
                  ) : null}
                </div>
              </SheetDescription>
              {workflowProgress ? (
                <div className="mail-detail-progress-wrap">
                  <div className="mail-detail-progress-head">
                    <span className="mail-detail-progress-label">{workflowProgress.label}</span>
                    <span className="mail-detail-progress-pct">{workflowProgress.percent}%</span>
                  </div>
                  <div
                    className="mail-detail-progress"
                    role="progressbar"
                    aria-valuenow={workflowProgress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={workflowProgress.label}
                  >
                    <div
                      className="mail-detail-progress-fill"
                      style={{ width: `${workflowProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </SheetHeader>

            <div className="mail-detail-body">
              {mail.executionDeadline && deadlineState.status === 'OVERDUE' ? (
                <div className="mail-detail-alert mail-detail-alert--danger" role="status">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Délai dépassé de {deadlineState.days} jour
                    {deadlineState.days > 1 ? 's' : ''} · Échéance le{' '}
                    {formatMailDate(mail.executionDeadline)}
                  </span>
                </div>
              ) : mail.executionDeadline && deadlineState.status === 'TODAY' ? (
                <div className="mail-detail-alert mail-detail-alert--warning" role="status">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>Échéance aujourd&apos;hui · {formatMailDate(mail.executionDeadline)}</span>
                </div>
              ) : mail.executionDeadline && deadlineState.status === 'DUE_SOON' ? (
                <div className="mail-detail-alert mail-detail-alert--warning" role="status">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Échéance dans {deadlineState.days} jour
                    {deadlineState.days > 1 ? 's' : ''} · {formatMailDate(mail.executionDeadline)}
                  </span>
                </div>
              ) : null}

              {isIncoming ? (
                <SectionCard title="Instruction DGA" icon={<FileText className="h-3 w-3" />} variant="instruction">
                  <p
                    className={cn(
                      'mail-detail-instruction-text',
                      !mail.dgaInstruction?.trim() && 'mail-detail-instruction-empty'
                    )}
                  >
                    {mail.dgaInstruction?.trim() || 'En attente d’instruction'}
                  </p>
                </SectionCard>
              ) : null}

              <SectionCard title="Circuit de traitement" icon={<GitBranch className="h-3 w-3" />}>
                <MailWorkflowVerticalStepper
                  mail={mail}
                  canManage={canManage}
                  statusLoading={statusLoading}
                  onStatusChange={(status) => void handleStatusOrAssign(mail.id, status)}
                  onRequestAssign={requestAssign}
                  statusTrace={statusTrace}
                />
              </SectionCard>

              <SectionCard title="Identification" icon={<Building2 className="h-3 w-3" />}>
                <div className="mail-detail-info-grid">
                  <InfoRow
                    label={isIncoming ? 'Expéditeur' : 'Destinataire'}
                    value={mail.counterpart}
                    icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <InfoRow
                    label={isIncoming ? "Date d'enreg." : 'Date du courrier'}
                    value={formatMailDate(mail.mailDate)}
                    icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <InfoRow
                    label="Service affecté"
                    value={mail.assignedService?.trim() || 'Non renseigné'}
                    icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}
                  />
                  {mail.executor?.trim() ? (
                    <InfoRow
                      label="Affecté à"
                      value={mail.executor}
                      icon={<User className="h-3.5 w-3.5" aria-hidden />}
                    />
                  ) : null}
                  <InfoRow
                    label="Date d’affectation"
                    value={mail.assignedAt ? formatMailDate(mail.assignedAt) : '—'}
                    icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
                  />
                </div>
                {canManage && isIncoming && mailNeedsAssignmentDetails(mail) ? (
                  <button
                    type="button"
                    className="mail-detail-assign-cta"
                    onClick={requestAssign}
                    disabled={statusLoading}
                  >
                    Préciser l’affectation
                  </button>
                ) : null}
              </SectionCard>

              {hasExecutionSection ? (
                <SectionCard title="Exécution" icon={<User className="h-3 w-3" />}>
                  <div className="mail-detail-info-grid">
                    {mail.executor ? (
                      <InfoRow
                        label="Exécutant"
                        value={mail.executor}
                        icon={<User className="h-3.5 w-3.5" aria-hidden />}
                      />
                    ) : null}
                    {mail.action ? (
                      <InfoRow
                        label={isIncoming ? 'Action' : 'Niveau exécution'}
                        value={mail.action}
                        icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
                      />
                    ) : null}
                    {mail.scSentAt ? (
                      <InfoRow
                        label="Date envoi SC"
                        value={formatMailDate(mail.scSentAt)}
                        icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
                      />
                    ) : null}
                    {mail.executionDeadline ? (
                      <InfoRow
                        label="Délai d'exécution"
                        value={
                          <span
                            className={cn(
                              overdue && 'mail-detail-overdue-text',
                              (deadlineState.status === 'TODAY' ||
                                deadlineState.status === 'DUE_SOON') &&
                                'mail-detail-due-soon-text'
                            )}
                          >
                            {formatMailDate(mail.executionDeadline)}
                          </span>
                        }
                        icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                      />
                    ) : null}
                    {mail.courierName ? (
                      <InfoRow
                        label="Coursier"
                        value={mail.courierName}
                        icon={<User className="h-3.5 w-3.5" aria-hidden />}
                      />
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}

              {followUpNote ? (
                <SectionCard title="Note de suivi" icon={<FileText className="h-3 w-3" />} variant="muted">
                  <p className="mail-detail-notes-text">{followUpNote}</p>
                </SectionCard>
              ) : null}

              {mail.attachmentCount > 0 || mail.attachments.length > 0 ? (
                <SectionCard title="Pièces jointes" icon={<Paperclip className="h-3 w-3" />} variant="muted">
                  {mail.attachments.length > 0 ? (
                    <ul className="mail-detail-attachments-list">
                      {mail.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a
                            href={`/api/workspace/mail/attachments/${attachment.id}/file`}
                            className="mail-detail-attachment-link"
                            download={attachment.fileName}
                          >
                            <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                            {attachment.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mail-detail-notes-text">Pièce jointe signalée (fichier non téléversé).</p>
                  )}
                </SectionCard>
              ) : null}

              <div className="mail-detail-footer-meta">
                {mail.attachmentCount > 0 ? (
                  <span className="mail-detail-pj">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    Pièce jointe disponible
                  </span>
                ) : (
                  <span className="mail-detail-footer-hint">Aucune pièce jointe</span>
                )}
                <span className="mail-detail-updated">
                  Mis à jour le {formatMailDateTime(mail.updatedAt)}
                </span>
              </div>
            </div>

            {canManage ? (
              <footer className="mail-detail-footer mail-detail-footer--stacked">
                {statusAdvanceError ? (
                  <p className="mail-detail-advance-error mail-detail-advance-error--footer" role="alert">
                    {statusAdvanceError}
                  </p>
                ) : null}
                {advanceAction ? (
                  <MailWorkflowAdvanceButton
                    mail={mail}
                    loading={isAdvanceLoading}
                    onAdvance={handleStatusOrAssign}
                    variant="detail"
                  />
                ) : null}
                <button
                  type="button"
                  className="mail-detail-footer-btn mail-detail-footer-btn--secondary"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(mail);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Modifier
                </button>
              </footer>
            ) : null}
          </div>
        )}
      </SheetContent>

      <MailAssignDialog
        mail={mail}
        open={assignOpen}
        loading={isAdvanceLoading}
        onOpenChange={setAssignOpen}
        onConfirm={(payload) => void confirmAssign(payload)}
      />
    </Sheet>
  );
}
