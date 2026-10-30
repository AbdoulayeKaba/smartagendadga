'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrudWithDelete } from '@/components/workspace/workspace-crud-actions';
import { printTableHtml } from '@/lib/workspace/export';
import type { AudienceRecord } from '@/lib/workspace/types';

const API = '/api/workspace/audiences';

type FormState = {
  heldAt: string;
  heldTime: string;
  participants: string;
  subject: string;
  outcome: string;
  minutes: string;
  archived: boolean;
};

function toForm(row: AudienceRecord): FormState {
  const d = new Date(row.heldAt);
  return {
    heldAt: row.heldAt.slice(0, 10),
    heldTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    participants: row.participants,
    subject: row.subject,
    outcome: row.outcome ?? '',
    minutes: row.minutes ?? '',
    archived: row.archived,
  };
}

const emptyForm = (): FormState => ({
  heldAt: new Date().toISOString().slice(0, 10),
  heldTime: '10:00',
  participants: '',
  subject: '',
  outcome: '',
  minutes: '',
  archived: false,
});

export function AudiencesView() {
  const { refresh, create, patch, canManage, deleteDialog, rowActions } = useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const heldAtIso = () => new Date(`${form.heldAt}T${form.heldTime}`).toISOString();

  const save = async () => {
    const payload = {
      heldAt: heldAtIso(),
      participants: form.participants,
      subject: form.subject,
      outcome: form.outcome || undefined,
      minutes: form.minutes || undefined,
      ...(editId ? { archived: form.archived } : {}),
    };
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  return (
    <>
      <WorkspaceModuleList<AudienceRecord>
        refreshTrigger={refresh}
        title="Carnet d'audiences"
        description="Historique des rendez-vous réalisés, comptes rendus et archivage."
        apiPath={API}
        exportFilename="carnet-audiences.csv"
        searchPlaceholder="Objet, participants…"
        onCreateClick={canManage ? () => { setEditId(null); setForm(emptyForm()); setOpen(true); } : undefined}
        createLabel="Nouvelle audience"
        rowActions={(row) => rowActions(row, row.subject, () => { setEditId(row.id); setForm(toForm(row)); setOpen(true); })}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="admin-appt-filter-btn"
            onClick={() => {
              printTableHtml('Carnet d\'audiences DGA', '<p>Export PDF — utilisez Imprimer puis Enregistrer en PDF.</p>');
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        }
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (r) => format(new Date(r.heldAt), 'd MMM yyyy HH:mm', { locale: fr }),
          },
          { key: 'subject', header: 'Objet', render: (r) => r.subject },
          { key: 'participants', header: 'Participants', render: (r) => r.participants },
          { key: 'outcome', header: 'Résultat', render: (r) => r.outcome ?? '—' },
          { key: 'archived', header: 'Archivé', render: (r) => (r.archived ? 'Oui' : 'Non') },
        ]}
      />
      {deleteDialog}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier l\'audience' : 'Nouvelle audience'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <FrenchDateField value={form.heldAt} onChange={(heldAt) => setForm((f) => ({ ...f, heldAt }))} />
              </div>
              <div>
                <Label>Heure</Label>
                <FrenchTimeField value={form.heldTime} onChange={(heldTime) => setForm((f) => ({ ...f, heldTime }))} />
              </div>
            </div>
            <div>
              <Label>Objet</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label>Participants</Label>
              <Textarea value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} />
            </div>
            <div>
              <Label>Résultat</Label>
              <Textarea value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} />
            </div>
            <div>
              <Label>Compte rendu</Label>
              <Textarea rows={4} value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} />
            </div>
            {editId ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.archived}
                  onChange={(e) => setForm((f) => ({ ...f, archived: e.target.checked }))}
                />
                Archivé
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="admin-btn-primary" disabled={!form.subject || !form.participants} onClick={() => void save()}>
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
