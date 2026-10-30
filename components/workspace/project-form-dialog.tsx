'use client';

import { Loader2 } from 'lucide-react';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { PROJECT_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgProject, WorkspaceAssigneeOption } from '@/lib/workspace/types';

export type ProjectFormState = {
  name: string;
  description: string;
  status: DgProject['status'];
  ownerOptionId: string;
  phasesText: string;
  startAt: string;
  dueAt: string;
};

export const emptyProjectForm: ProjectFormState = {
  name: '',
  description: '',
  status: 'ACTIVE',
  ownerOptionId: '',
  phasesText: '',
  startAt: '',
  dueAt: '',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: ProjectFormState;
  onFormChange: (patch: Partial<ProjectFormState>) => void;
  assignees: WorkspaceAssigneeOption[];
  saving: boolean;
  onSubmit: () => void;
  submitLabel?: string;
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  title,
  form,
  onFormChange,
  assignees,
  saving,
  onSubmit,
  submitLabel = 'Créer',
}: Props) {
  const canSave = Boolean(form.name.trim().length >= 2 && form.ownerOptionId) && !saving;

  return (
    <WorkspaceCrudDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="admin-btn-create" disabled={!canSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitLabel}
          </button>
        </>
      }
    >
      <div className="workspace-crud-form-grid">
        <WorkspaceCrudField id="project-name" label="Nom du projet" className="workspace-crud-span-2">
          <Input
            id="project-name"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            placeholder="Ex : Conseil ARPT T2"
            className="admin-field"
          />
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-status" label="Statut">
          <Select value={form.status} onValueChange={(v) => onFormChange({ status: v as ProjectFormState['status'] })}>
            <SelectTrigger id="project-status" className="admin-field w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-owner" label="Responsable projet">
          <Select value={form.ownerOptionId || undefined} onValueChange={(v) => onFormChange({ ownerOptionId: v })}>
            <SelectTrigger id="project-owner" className="admin-field w-full">
              <SelectValue placeholder="Choisir un responsable" />
            </SelectTrigger>
            <SelectContent>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                  {a.department ? ` — ${a.department}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-phases" label="Phases (séparées par des virgules)" className="workspace-crud-span-2">
          <Input
            id="project-phases"
            value={form.phasesText}
            onChange={(e) => onFormChange({ phasesText: e.target.value })}
            placeholder="Ex : Cadrage, Exécution, Validation DGA"
            className="admin-field"
          />
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-start" label="Date de début">
          <FrenchDateField
            id="project-start"
            value={form.startAt}
            onChange={(startAt) => onFormChange({ startAt })}
            className="admin-field"
          />
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-due" label="Échéance">
          <FrenchDateField
            id="project-due"
            value={form.dueAt}
            onChange={(dueAt) => onFormChange({ dueAt })}
            className="admin-field"
          />
        </WorkspaceCrudField>
        <WorkspaceCrudField id="project-description" label="Description" className="workspace-crud-span-2">
          <Textarea
            id="project-description"
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
            className="admin-field workspace-crud-textarea min-h-[2.75rem] resize-y"
          />
        </WorkspaceCrudField>
      </div>
    </WorkspaceCrudDialog>
  );
}

export function parsePhasesText(phasesText: string): string[] {
  return phasesText
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}
