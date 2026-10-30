'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ProjectFormDialog,
  emptyProjectForm,
  parsePhasesText,
  type ProjectFormState,
} from '@/components/workspace/project-form-dialog';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrudWithDelete } from '@/components/workspace/workspace-crud-actions';
import { assigneeOptionId, resolveAssigneeFromOption } from '@/lib/workspace/assignee-utils';
import { PROJECT_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgProject, WorkspaceAssigneeOption } from '@/lib/workspace/types';

const API = '/api/workspace/projects';

function getStrategicFlag(project: DgProject): string {
  const dueAt = project.dueAt ? new Date(project.dueAt) : null;
  if (project.status === 'CANCELLED') return 'Rouge';
  if (project.status === 'ON_HOLD') return 'Orange';
  if (project.status === 'COMPLETED') return 'Vert';
  if (dueAt && dueAt.getTime() < Date.now()) return 'Rouge';
  return 'Vert';
}

function toProjectForm(row: DgProject, assignees: WorkspaceAssigneeOption[]): ProjectFormState {
  return {
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    ownerOptionId: assigneeOptionId({
      assigneeName: row.ownerName,
      assigneeUserId: row.ownerUserId,
    }),
    phasesText: row.phases.join(', '),
    startAt: row.startAt ? row.startAt.slice(0, 10) : '',
    dueAt: row.dueAt ? row.dueAt.slice(0, 10) : '',
  };
}

export function StrategicDossiersView() {
  const { refresh, create, patch, canManage, deleteDialog, rowActions } = useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState<WorkspaceAssigneeOption[]>([]);

  useEffect(() => {
    void fetch('/api/workspace/assignees')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.items) setAssignees(json.items as WorkspaceAssigneeOption[]);
      });
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyProjectForm);
    setOpen(true);
  };

  const openEdit = (row: DgProject) => {
    setEditId(row.id);
    setForm(toProjectForm(row, assignees));
    setOpen(true);
  };

  const canSave = useMemo(
    () => form.name.trim().length >= 2 && form.ownerOptionId.trim().length > 0 && !saving,
    [form.name, form.ownerOptionId, saving]
  );

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const owner = resolveAssigneeFromOption(form.ownerOptionId, assignees);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        ownerName: owner.assigneeName,
        ownerUserId: owner.assigneeUserId,
        phases: parsePhasesText(form.phasesText),
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      };
      const ok = editId ? await patch(editId, payload) : await create(payload);
      if (ok) setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <WorkspaceModuleList<DgProject>
        refreshTrigger={refresh}
        title="Dossiers stratégiques"
        description="Pilotage des sujets prioritaires DG avec responsables, jalons et échéances."
        apiPath={API}
        exportFilename="dossiers-strategiques.csv"
        onCreateClick={canManage ? openCreate : undefined}
        createLabel="Nouveau dossier"
        rowActions={(row) => rowActions(row, row.name, () => openEdit(row))}
        searchPlaceholder="Rechercher un dossier, responsable, jalon…"
        columns={[
          { key: 'name', header: 'Dossier', render: (r) => r.name },
          { key: 'owner', header: 'Responsable', render: (r) => r.ownerName },
          {
            key: 'milestones',
            header: 'Jalons',
            render: (r) => (r.phases.length ? r.phases.slice(0, 2).join(' · ') : '—'),
            exportValue: (r) => (r.phases.length ? r.phases.join(' | ') : '—'),
          },
          {
            key: 'due',
            header: 'Échéance',
            render: (r) => (r.dueAt ? format(new Date(r.dueAt), 'd MMM yyyy', { locale: fr }) : '—'),
          },
          { key: 'status', header: 'Statut', render: (r) => PROJECT_STATUS_LABELS[r.status] },
          { key: 'flag', header: 'Indicateur', render: (r) => getStrategicFlag(r) },
        ]}
      />
      {deleteDialog}
      <ProjectFormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? 'Modifier le dossier stratégique' : 'Créer un dossier stratégique'}
        form={form}
        onFormChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
        assignees={assignees}
        saving={saving}
        onSubmit={() => void save()}
        submitLabel={editId ? 'Enregistrer' : 'Créer'}
      />
    </>
  );
}
