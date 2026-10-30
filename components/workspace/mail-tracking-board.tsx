'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { MAIL_PRIORITY_LABELS, MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import { formatMailDate, formatMailFollowUpNote } from '@/lib/workspace/mail-utils';
import { MailWorkflowAdvanceButton } from '@/components/workspace/mail-workflow-advance-button';
import type { MailTrackingItem } from '@/lib/workspace/mail-analytics';
import type { MailItem, MailWorkflowStatus } from '@/lib/workspace/types';

type Props = {
  items: MailTrackingItem[];
  canManage: boolean;
  statusLoading: boolean;
  loadingMailId: string | null;
  onOpen: (mailId: string) => void;
  onAdvance: (
    mailId: string,
    status: MailWorkflowStatus,
    patch?: Record<string, unknown>
  ) => void | Promise<void>;
  mailById: Map<string, MailItem>;
};

export function MailTrackingBoard({
  items,
  canManage,
  statusLoading,
  loadingMailId,
  onOpen,
  onAdvance,
  mailById,
}: Props) {
  if (items.length === 0) {
    return (
      <section className="mail-tracking-board mail-tracking-board--empty" aria-label="Suivi dynamique">
        <header className="mail-tracking-board-head">
          <h3 className="mail-tracking-board-title">Suivi dynamique</h3>
          <p className="mail-tracking-board-sub">Aucun courrier actif à suivre.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="mail-tracking-board" aria-label="Suivi dynamique">
      <header className="mail-tracking-board-head">
        <h3 className="mail-tracking-board-title">
          Suivi dynamique
          <span className="mail-tracking-board-sub">
            {items.length} en cours · urgence et échéance
          </span>
        </h3>
      </header>

      <div className="mail-tracking-board-scroll">
        {items.map((item) => {
          const mail = mailById.get(item.id);
          const isLoading = statusLoading && loadingMailId === item.id;

          return (
            <article
              key={item.id}
              className="mail-tracking-card"
              data-overdue={item.overdue ? 'true' : undefined}
              data-urgent={item.priority === 'URGENT' ? 'true' : undefined}
            >
              <button type="button" className="mail-tracking-card-main" onClick={() => onOpen(item.id)}>
                <div className="mail-tracking-card-top">
                  <span className="mail-tracking-ref">{item.reference}</span>
                  <span className="mail-priority-badge" data-priority={item.priority}>
                    {MAIL_PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
                <p className="mail-tracking-subject">{item.subject}</p>
                <p className="mail-tracking-meta">{item.counterpart}</p>
                {item.assignmentLabel ? (
                  <p className="mail-tracking-assign">Affecté · {item.assignmentLabel}</p>
                ) : item.workflowStatus === 'ASSIGNED' ? (
                  <p className="mail-tracking-assign mail-tracking-assign--warn">Affectation à préciser</p>
                ) : null}

                <div className="mail-tracking-progress-wrap">
                  <div className="mail-tracking-progress-bar" aria-hidden>
                    <span
                      className="mail-tracking-progress-fill"
                      style={{ width: `${item.progressPercent}%` }}
                      data-status={item.workflowStatus}
                    />
                  </div>
                  <div className="mail-tracking-progress-row">
                    <span className="mail-tracking-progress-label">
                      {MAIL_STATUS_LABELS[item.workflowStatus]} · {item.stepLabel}
                    </span>
                    {item.overdue ? (
                      <span className="mail-tracking-badge mail-tracking-badge--danger mail-tracking-badge--inline">
                        <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                        Dépassée
                      </span>
                    ) : item.deadlineSoon ? (
                      <span className="mail-tracking-badge mail-tracking-badge--warn mail-tracking-badge--inline">
                        <Clock className="h-2.5 w-2.5" aria-hidden />
                        Proche · {formatMailDate(item.executionDeadline)}
                      </span>
                    ) : item.executionDeadline ? (
                      <span className="mail-tracking-badge mail-tracking-badge--inline">
                        {formatMailDate(item.executionDeadline)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {formatMailFollowUpNote(item.followUp) && (item.overdue || item.deadlineSoon) ? (
                  <p className="mail-tracking-followup">
                    {formatMailFollowUpNote(item.followUp)}
                  </p>
                ) : null}
              </button>

              {canManage && item.nextStatus && mail ? (
                <MailWorkflowAdvanceButton
                  mail={mail}
                  loading={isLoading}
                  variant="tracking"
                  onClick={(event) => event.stopPropagation()}
                  onAdvance={onAdvance}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
