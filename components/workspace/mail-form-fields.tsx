'use client';

import { CalendarClock } from 'lucide-react';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { MailAttachmentsField } from '@/components/workspace/mail-attachments-field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  mailAttachmentsToInput,
  newMailDraftOwnerId,
  type MailAttachmentDraft,
} from '@/lib/workspace/mail-attachment-form-state';
import { MAIL_PRIORITY_LABELS, MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import {
  computeMailExecutionDeadline,
  formatMailDate,
  mailStatusesForDirection,
  MAIL_EXECUTION_DELAY_WORKING_DAYS,
  nextMailRegistrationNumberForDate,
} from '@/lib/workspace/mail-utils';
import type {
  MailDirection,
  MailItem,
  MailPriority,
  MailViewMode,
  MailWorkflowStatus,
} from '@/lib/workspace/types';

export type MailFormState = {
  registrationNumber: string;
  reference: string;
  counterpart: string;
  subject: string;
  mailDate: string;
  priority: MailPriority;
  dgaInstruction: string;
  executor: string;
  action: string;
  scSentAt: string;
  executionDeadline: string;
  followUp: string;
  courierName: string;
  assignedService: string;
  workflowStatus: MailWorkflowStatus;
  hasAttachment: boolean;
  mailOwnerId: string;
  attachments: MailAttachmentDraft[];
};

type Props = {
  viewMode: MailViewMode;
  direction: MailDirection;
  editId: string | null;
  form: MailFormState;
  setForm: React.Dispatch<React.SetStateAction<MailFormState>>;
  canManage?: boolean;
  /** Courriers existants pour prévisualiser le prochain N° selon la date. */
  existingMails?: Array<{ registrationNumber?: number | null; mailDate: string }>;
};

function StatusField({
  direction,
  form,
  setForm,
}: {
  direction: MailDirection;
  form: MailFormState;
  setForm: React.Dispatch<React.SetStateAction<MailFormState>>;
}) {
  return (
    <WorkspaceCrudField id="mail-status" label="Statut">
      <Select
        value={form.workflowStatus}
        onValueChange={(v) => setForm((f) => ({ ...f, workflowStatus: v as MailWorkflowStatus }))}
      >
        <SelectTrigger id="mail-status" className="admin-field w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mailStatusesForDirection(direction).map((s) => (
            <SelectItem key={s} value={s}>
              {MAIL_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </WorkspaceCrudField>
  );
}

function DeadlineHint({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} className="mail-form-deadline-hint">
      <CalendarClock aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function mailCreateDialogTitle(_viewMode: MailViewMode, editId: string | null): string {
  return editId ? 'Modifier le courrier départ' : 'Nouveau courrier départ';
}

export function mailCreateButtonLabel(_viewMode?: MailViewMode): string {
  return 'Nouveau courrier départ';
}

export function MailFormFields({
  viewMode,
  direction,
  editId,
  form,
  setForm,
  canManage = true,
  existingMails = [],
}: Props) {
  const isIncoming = direction === 'INCOMING';

  const deadlineHint = editId
    ? 'Échéance modifiable dans « Suivi entrant »'
    : `Calcul automatique · ${MAIL_EXECUTION_DELAY_WORKING_DAYS[form.priority]} jours ouvrés`;

  /** N° d'enregistrement et délai d'exécution sont dérivés de la date à la création. */
  const syncDerivedFields = (mailDate: string, priority: MailPriority) => {
    if (editId || !isIncoming) return {};
    return {
      registrationNumber: String(nextMailRegistrationNumberForDate(existingMails, mailDate)),
      executionDeadline: computeMailExecutionDeadline(mailDate, priority) ?? '',
    };
  };

  return (
    <div className="workspace-crud-form-grid workspace-crud-form-grid--mail workspace-crud-form-compact mail-form-fields">
      {viewMode === 'dga' ? (
        <>
          <WorkspaceCrudField id="mail-number" label="N° enreg.">
            <Input
              id="mail-number"
              type="text"
              inputMode="numeric"
              value={form.registrationNumber}
              readOnly
              tabIndex={-1}
              className="admin-field mail-form-field--auto"
              placeholder={editId ? '—' : 'Automatique'}
              title="Numéro attribué automatiquement selon la date d’enregistrement"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-reference" label="Référence">
            <Input
              id="mail-reference"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-date" label="Date d'enreg.">
            <FrenchDateField
              id="mail-date"
              value={form.mailDate}
              onChange={(mailDate) =>
                setForm((f) => ({
                  ...f,
                  mailDate,
                  ...syncDerivedFields(mailDate, f.priority),
                }))
              }
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-priority" label="Priorité">
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  priority: v as MailPriority,
                  ...syncDerivedFields(f.mailDate, v as MailPriority),
                }))
              }
            >
              <SelectTrigger id="mail-priority" className="admin-field w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MAIL_PRIORITY_LABELS) as MailPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {MAIL_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-deadline-preview" label="Échéance d'exécution">
            <Input
              id="mail-deadline-preview"
              value={formatMailDate(form.executionDeadline || null)}
              readOnly
              tabIndex={-1}
              className="admin-field mail-form-field--auto"
              placeholder="Automatique"
              title={deadlineHint}
              aria-describedby="mail-deadline-preview-hint"
            />
            <DeadlineHint id="mail-deadline-preview-hint" text={deadlineHint} />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-counterpart" label="Expéditeur">
            <Input
              id="mail-counterpart"
              value={form.counterpart}
              onChange={(e) => setForm((f) => ({ ...f, counterpart: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-subject" label="Objet" className="workspace-crud-span-2">
            <Input
              id="mail-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField
            id="mail-dga-instruction"
            label="Instruction DGA"
            className={editId ? undefined : 'workspace-crud-span-2'}
          >
            <Input
              id="mail-dga-instruction"
              value={form.dgaInstruction}
              onChange={(e) => setForm((f) => ({ ...f, dgaInstruction: e.target.value }))}
              className="admin-field"
              placeholder="DTRI, EN ATTENTE…"
            />
          </WorkspaceCrudField>

          {editId ? <StatusField direction={direction} form={form} setForm={setForm} /> : null}
        </>
      ) : null}

      {viewMode === 'suivi' ? (
        <>
          <WorkspaceCrudField id="mail-number" label="N° enreg.">
            <Input
              id="mail-number"
              type="text"
              inputMode="numeric"
              value={form.registrationNumber}
              readOnly
              tabIndex={-1}
              className="admin-field mail-form-field--auto"
              placeholder={editId ? '—' : 'Automatique'}
              title="Numéro attribué automatiquement selon la date d’enregistrement"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-date" label="Date d'enreg.">
            <FrenchDateField
              id="mail-date"
              value={form.mailDate}
              onChange={(mailDate) =>
                setForm((f) => ({
                  ...f,
                  mailDate,
                  ...syncDerivedFields(mailDate, f.priority),
                }))
              }
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-reference" label="Référence">
            <Input
              id="mail-reference"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-counterpart" label="Expéditeur">
            <Input
              id="mail-counterpart"
              value={form.counterpart}
              onChange={(e) => setForm((f) => ({ ...f, counterpart: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-subject" label="Objet" className="workspace-crud-span-2">
            <Input
              id="mail-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-executor" label="Exécutant">
            <Input
              id="mail-executor"
              value={form.executor}
              onChange={(e) => setForm((f) => ({ ...f, executor: e.target.value }))}
              className="admin-field"
              placeholder="DRM/DTRI"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-action" label="Action">
            <Input
              id="mail-action"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              className="admin-field"
              placeholder="TRANSMIS AU SC"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-sc-sent" label="Date envoi SC">
            <FrenchDateField
              id="mail-sc-sent"
              value={form.scSentAt}
              onChange={(scSentAt) => setForm((f) => ({ ...f, scSentAt }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-deadline" label="Échéance d'exécution">
            <FrenchDateField
              id="mail-deadline"
              value={form.executionDeadline}
              onChange={(executionDeadline) => setForm((f) => ({ ...f, executionDeadline }))}
              className="admin-field"
              ariaDescribedBy={editId ? undefined : 'mail-deadline-hint'}
            />
            {editId ? null : <DeadlineHint id="mail-deadline-hint" text={deadlineHint} />}
          </WorkspaceCrudField>

          {editId ? <StatusField direction={direction} form={form} setForm={setForm} /> : null}

          <WorkspaceCrudField id="mail-follow-up" label="Suivi" className="workspace-crud-span-2">
            <Textarea
              id="mail-follow-up"
              rows={1}
              value={form.followUp}
              onChange={(e) => setForm((f) => ({ ...f, followUp: e.target.value }))}
              className="admin-field workspace-crud-textarea workspace-crud-textarea--compact mail-form-textarea resize-none"
              placeholder="Notes de suivi…"
            />
          </WorkspaceCrudField>
        </>
      ) : null}

      {viewMode === 'depart' ? (
        <>
          <WorkspaceCrudField id="mail-reference" label="Référence">
            <Input
              id="mail-reference"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className="admin-field"
              placeholder="Réf. courrier"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-date" label="Date du courrier">
            <FrenchDateField
              id="mail-date"
              value={form.mailDate}
              onChange={(mailDate) => setForm((f) => ({ ...f, mailDate }))}
              className="admin-field"
              variant="compact"
              popoverClassName="mail-form-date-popover"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-counterpart" label="Destinataire">
            <Input
              id="mail-counterpart"
              value={form.counterpart}
              onChange={(e) => setForm((f) => ({ ...f, counterpart: e.target.value }))}
              className="admin-field"
              placeholder="Nom du destinataire"
            />
          </WorkspaceCrudField>

          {editId ? (
            <StatusField direction={direction} form={form} setForm={setForm} />
          ) : (
            <WorkspaceCrudField id="mail-action" label="Niveau exécution">
              <Input
                id="mail-action"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="admin-field"
                placeholder="TRANSMIS AU SC"
              />
            </WorkspaceCrudField>
          )}

          {editId ? (
            <WorkspaceCrudField id="mail-action" label="Niveau exécution">
              <Input
                id="mail-action"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="admin-field"
                placeholder="TRANSMIS AU SC"
              />
            </WorkspaceCrudField>
          ) : null}

          <WorkspaceCrudField id="mail-courier" label="Coursier">
            <Input
              id="mail-courier"
              value={form.courierName}
              onChange={(e) => setForm((f) => ({ ...f, courierName: e.target.value }))}
              className="admin-field"
              placeholder="DINAH"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-sc-sent" label="Date envoi SC">
            <FrenchDateField
              id="mail-sc-sent"
              value={form.scSentAt}
              onChange={(scSentAt) => setForm((f) => ({ ...f, scSentAt }))}
              className="admin-field"
              variant="compact"
              popoverClassName="mail-form-date-popover"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-subject" label="Objet" className="workspace-crud-span-2">
            <Input
              id="mail-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="admin-field"
              placeholder="Objet du courrier"
            />
          </WorkspaceCrudField>
        </>
      ) : null}

      <div className="workspace-crud-checkbox-row workspace-crud-span-2 mail-form-attachment-toggle">
        <Checkbox
          id="mail-has-attachment"
          checked={form.hasAttachment}
          onCheckedChange={(checked) =>
            setForm((f) => ({
              ...f,
              hasAttachment: checked === true,
              attachments: checked === true ? f.attachments : [],
            }))
          }
        />
        <label htmlFor="mail-has-attachment">Pièce jointe disponible</label>
      </div>

      {form.hasAttachment ? (
        <MailAttachmentsField
          mailOwnerId={editId ?? form.mailOwnerId}
          attachments={form.attachments}
          setAttachments={(next) =>
            setForm((f) => ({
              ...f,
              attachments: typeof next === 'function' ? next(f.attachments) : next,
            }))
          }
          canManage={canManage}
        />
      ) : null}
    </div>
  );
}

export function emptyMailForm(direction: MailDirection, workflowStatus?: MailWorkflowStatus): MailFormState {
  const mailDate = new Date().toISOString().slice(0, 10);
  const priority: MailPriority = 'NORMAL';

  return {
    registrationNumber: '',
    reference: '',
    counterpart: '',
    subject: '',
    mailDate,
    priority,
    dgaInstruction: direction === 'INCOMING' ? 'EN ATTENTE' : '',
    executor: '',
    action: '',
    scSentAt: '',
    executionDeadline:
      direction === 'INCOMING' ? (computeMailExecutionDeadline(mailDate, priority) ?? '') : '',
    followUp: '',
    courierName: '',
    assignedService: '',
    workflowStatus: workflowStatus ?? (direction === 'OUTGOING' ? 'SENT' : 'RECEIVED'),
    hasAttachment: false,
    mailOwnerId: newMailDraftOwnerId(),
    attachments: [],
  };
}

export function mailToForm(row: MailItem): MailFormState {
  return {
    registrationNumber: row.registrationNumber ? String(row.registrationNumber) : '',
    reference: row.reference,
    counterpart: row.counterpart,
    subject: row.subject,
    mailDate: row.mailDate.slice(0, 10),
    priority: row.priority,
    dgaInstruction: row.dgaInstruction ?? '',
    executor: row.executor ?? '',
    action: row.action ?? '',
    scSentAt: row.scSentAt ? row.scSentAt.slice(0, 10) : '',
    executionDeadline: row.executionDeadline ? row.executionDeadline.slice(0, 10) : '',
    followUp: row.followUp ?? '',
    courierName: row.courierName ?? '',
    assignedService: row.assignedService ?? '',
    workflowStatus: row.workflowStatus,
    hasAttachment: row.attachmentCount > 0 || row.attachments.length > 0,
    mailOwnerId: row.id,
    attachments: row.attachments.map((a) => ({
      key: a.id,
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
    })),
  };
}

export function formToMailPayload(
  form: MailFormState,
  direction: MailDirection,
  editId: string | null,
  viewMode: MailViewMode
) {
  const base = {
    direction,
    reference: form.reference,
    counterpart: form.counterpart,
    subject: form.subject,
    mailDate: form.mailDate,
    hasAttachment: form.hasAttachment,
    attachments: form.hasAttachment ? mailAttachmentsToInput(form.attachments) : [],
    ...(editId ? { workflowStatus: form.workflowStatus } : {}),
  };

  if (direction === 'OUTGOING' || viewMode === 'depart') {
    return {
      ...base,
      mailKind: 'DEPARTURE' as const,
      priority: 'NORMAL' as const,
      dgaInstruction: null,
      executor: null,
      assignedService: null,
      executionDeadline: null,
      followUp: null,
      action: form.action || null,
      scSentAt: form.scSentAt || null,
      courierName: form.courierName || null,
    };
  }

  if (viewMode === 'dga') {
    return {
      ...base,
      priority: form.priority,
      dgaInstruction: form.dgaInstruction || null,
      // Préserver les champs suivi en édition (absents du formulaire DGA).
      ...(editId
        ? {
            executor: form.executor || null,
            assignedService: form.assignedService || null,
            action: form.action || null,
            scSentAt: form.scSentAt || null,
            executionDeadline: form.executionDeadline || null,
            followUp: form.followUp || null,
            courierName: form.courierName || null,
          }
        : {
            executor: null,
            assignedService: null,
            action: null,
            scSentAt: null,
            executionDeadline:
              form.executionDeadline || computeMailExecutionDeadline(form.mailDate, form.priority),
            followUp: null,
            courierName: null,
          }),
    };
  }

  // Suivi entrant
  return {
    ...base,
    priority: form.priority,
    dgaInstruction: editId ? form.dgaInstruction || null : form.dgaInstruction || 'EN ATTENTE',
    executor: form.executor || null,
    assignedService: form.assignedService || null,
    action: form.action || null,
    scSentAt: form.scSentAt || null,
    executionDeadline: editId
      ? form.executionDeadline || null
      : form.executionDeadline || computeMailExecutionDeadline(form.mailDate, form.priority),
    followUp: form.followUp || null,
    courierName: null,
  };
}
