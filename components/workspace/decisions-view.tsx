'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrudWithDelete } from '@/components/workspace/workspace-crud-actions';
import { DECISION_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/workspace/labels';
import type { DgDecision, DgDecisionStatus } from '@/lib/workspace/types';

const API = '/api/workspace/decisions';

type FormState = {
  title: string;
  context: string;
  decisionText: string;
  ownerName: string;
  dueAt: string;
  status: DgDecisionStatus;
};

const emptyForm = (): FormState => ({
  title: '',
  context: '',
  decisionText: '',
  ownerName: '',
  dueAt: '',
  status: 'NOT_STARTED',
});

function toForm(row: DgDecision): FormState {
  return {
    title: row.title,
    context: row.context ?? '',
    decisionText: row.decisionText,
    ownerName: row.ownerName,
    dueAt: row.dueAt ? row.dueAt.slice(0, 10) : '',
    status: row.status,
  };
}

export function DecisionsView() {
  const { refresh, create, patch, canManage, deleteDialog, rowActions } = useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: DgDecision) => {
    setEditId(row.id);
    setForm(toForm(row));
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      title: form.title,
      context: form.context || undefined,
      decisionText: form.decisionText,
      ownerName: form.ownerName,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      ...(editId ? { status: form.status } : {}),
    };
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  return (
    <>
      <WorkspaceModuleList<DgDecision>
        refreshTrigger={refresh}
        title="Décisions et suivi des actions"
        description="Enregistrement post-réunion, responsables, échéances et suivi des retards."
        apiPath={API}
        exportFilename="decisions-dg.csv"
        onCreateClick={canManage ? openCreate : undefined}
        createLabel="Nouvelle décision"
        rowActions={(row) => rowActions(row, row.title, () => openEdit(row))}
        columns={[
          { key: 'title', header: 'Décision', render: (r) => r.title },
          { key: 'owner', header: 'Responsable', render: (r) => r.ownerName },
          {
            key: 'due',
            header: 'Échéance',
            render: (r) => (r.dueAt ? format(new Date(r.dueAt), 'd MMM yyyy', { locale: fr }) : '—'),
          },
          { key: 'priority', header: 'Priorité', render: (r) => PRIORITY_LABELS[r.priority] },
          { key: 'status', header: 'Statut', render: (r) => DECISION_STATUS_LABELS[r.status] },
        ]}
      />
      {deleteDialog}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier la décision' : 'Enregistrer une décision'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Contexte</Label>
              <Textarea value={form.context} onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))} />
            </div>
            <div>
              <Label>Décision prise</Label>
              <Textarea
                value={form.decisionText}
                onChange={(e) => setForm((f) => ({ ...f, decisionText: e.target.value }))}
              />
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Échéance</Label>
                <FrenchDateField
                  value={form.dueAt}
                  onChange={(dueAt) => setForm((f) => ({ ...f, dueAt }))}
                />
              </div>
              {editId ? (
                <div>
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DgDecisionStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DECISION_STATUS_LABELS) as DgDecisionStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {DECISION_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              className="admin-btn-primary"
              disabled={!form.title || !form.decisionText || !form.ownerName}
              onClick={() => void save()}
            >
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
