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
import { DEADLINE_KIND_LABELS, DEADLINE_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DeadlineKind, DeadlineStatus, ImportantDeadline } from '@/lib/workspace/types';

const API = '/api/workspace/deadlines';

type FormState = {
  title: string;
  kind: DeadlineKind;
  dueAt: string;
  ownerName: string;
  description: string;
  alertDaysBefore: number;
  status: DeadlineStatus;
};

function toForm(row: ImportantDeadline): FormState {
  return {
    title: row.title,
    kind: row.kind,
    dueAt: row.dueAt.slice(0, 10),
    ownerName: row.ownerName,
    description: row.description ?? '',
    alertDaysBefore: row.alertDaysBefore,
    status: row.status,
  };
}

const emptyForm = (): FormState => ({
  title: '',
  kind: 'OTHER',
  dueAt: new Date().toISOString().slice(0, 10),
  ownerName: '',
  description: '',
  alertDaysBefore: 7,
  status: 'UPCOMING',
});

export function DeadlinesView() {
  const { refresh, create, patch, canManage, deleteDialog, rowActions } = useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const save = async () => {
    const payload = {
      title: form.title,
      kind: form.kind,
      dueAt: new Date(form.dueAt).toISOString(),
      ownerName: form.ownerName,
      description: form.description || undefined,
      alertDaysBefore: form.alertDaysBefore,
      ...(editId ? { status: form.status } : {}),
    };
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  return (
    <>
      <WorkspaceModuleList<ImportantDeadline>
        refreshTrigger={refresh}
        title="Échéances importantes"
        description="Contrats, renouvellements, rapports, audits — alertes automatiques."
        apiPath={API}
        exportFilename="echeances-importantes.csv"
        onCreateClick={canManage ? () => { setEditId(null); setForm(emptyForm()); setOpen(true); } : undefined}
        createLabel="Nouvelle échéance"
        rowActions={(row) => rowActions(row, row.title, () => { setEditId(row.id); setForm(toForm(row)); setOpen(true); })}
        columns={[
          { key: 'title', header: 'Libellé', render: (r) => r.title },
          { key: 'kind', header: 'Type', render: (r) => DEADLINE_KIND_LABELS[r.kind] },
          {
            key: 'due',
            header: 'Échéance',
            render: (r) => format(new Date(r.dueAt), 'd MMM yyyy', { locale: fr }),
          },
          { key: 'owner', header: 'Responsable', render: (r) => r.ownerName },
          { key: 'status', header: 'Statut', render: (r) => DEADLINE_STATUS_LABELS[r.status] },
        ]}
      />
      {deleteDialog}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier l\'échéance' : 'Nouvelle échéance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Libellé</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as DeadlineKind }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEADLINE_KIND_LABELS) as DeadlineKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{DEADLINE_KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date limite</Label>
                <FrenchDateField value={form.dueAt} onChange={(dueAt) => setForm((f) => ({ ...f, dueAt }))} />
              </div>
              <div>
                <Label>Alerte (jours avant)</Label>
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={form.alertDaysBefore}
                  onChange={(e) => setForm((f) => ({ ...f, alertDaysBefore: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
            </div>
            {editId ? (
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DeadlineStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DEADLINE_STATUS_LABELS) as DeadlineStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{DEADLINE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="admin-btn-primary" disabled={!form.title || !form.ownerName} onClick={() => void save()}>
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
