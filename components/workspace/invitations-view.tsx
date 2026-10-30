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
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
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
import { INVITATION_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/workspace/labels';
import type { InvitationStatus, OfficialInvitation, WorkspacePriority } from '@/lib/workspace/types';

const API = '/api/workspace/invitations';

type FormState = {
  organizer: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  location: string;
  importance: WorkspacePriority;
  status: InvitationStatus;
  delegateName: string;
  notes: string;
};

function toForm(row: OfficialInvitation): FormState {
  const d = new Date(row.eventDate);
  return {
    organizer: row.organizer,
    eventTitle: row.eventTitle,
    eventDate: row.eventDate.slice(0, 10),
    eventTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    location: row.location ?? '',
    importance: row.importance,
    status: row.status,
    delegateName: row.delegateName ?? '',
    notes: row.notes ?? '',
  };
}

const emptyForm = (): FormState => ({
  organizer: '',
  eventTitle: '',
  eventDate: new Date().toISOString().slice(0, 10),
  eventTime: '10:00',
  location: '',
  importance: 'MEDIUM',
  status: 'RECEIVED',
  delegateName: '',
  notes: '',
});

export function InvitationsView() {
  const { refresh, create, patch, canManage, deleteDialog, rowActions } = useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const save = async () => {
    const payload = {
      organizer: form.organizer,
      eventTitle: form.eventTitle,
      eventDate: new Date(`${form.eventDate}T${form.eventTime}`).toISOString(),
      location: form.location || undefined,
      importance: form.importance,
      notes: form.notes || undefined,
      ...(editId
        ? {
            status: form.status,
            delegateName: form.delegateName || null,
          }
        : {}),
    };
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  return (
    <>
      <WorkspaceModuleList<OfficialInvitation>
        refreshTrigger={refresh}
        title="Invitations officielles"
        description="Réception, acceptation, refus ou délégation des invitations reçues."
        apiPath={API}
        exportFilename="invitations-officielles.csv"
        onCreateClick={canManage ? () => { setEditId(null); setForm(emptyForm()); setOpen(true); } : undefined}
        createLabel="Nouvelle invitation"
        rowActions={(row) => rowActions(row, row.eventTitle, () => { setEditId(row.id); setForm(toForm(row)); setOpen(true); })}
        columns={[
          { key: 'event', header: 'Événement', render: (r) => r.eventTitle },
          { key: 'org', header: 'Organisateur', render: (r) => r.organizer },
          {
            key: 'date',
            header: 'Date',
            render: (r) => format(new Date(r.eventDate), 'd MMM yyyy', { locale: fr }),
          },
          { key: 'loc', header: 'Lieu', render: (r) => r.location ?? '—' },
          { key: 'imp', header: 'Importance', render: (r) => PRIORITY_LABELS[r.importance] },
          { key: 'status', header: 'Statut', render: (r) => INVITATION_STATUS_LABELS[r.status] },
        ]}
      />
      {deleteDialog}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier l\'invitation' : 'Nouvelle invitation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Organisateur</Label>
              <Input value={form.organizer} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))} />
            </div>
            <div>
              <Label>Événement</Label>
              <Input value={form.eventTitle} onChange={(e) => setForm((f) => ({ ...f, eventTitle: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <FrenchDateField value={form.eventDate} onChange={(eventDate) => setForm((f) => ({ ...f, eventDate }))} />
              </div>
              <div>
                <Label>Heure</Label>
                <FrenchTimeField value={form.eventTime} onChange={(eventTime) => setForm((f) => ({ ...f, eventTime }))} />
              </div>
            </div>
            <div>
              <Label>Lieu</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            {editId ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Statut</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as InvitationStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(INVITATION_STATUS_LABELS) as InvitationStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{INVITATION_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Délégué à</Label>
                    <Input value={form.delegateName} onChange={(e) => setForm((f) => ({ ...f, delegateName: e.target.value }))} />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label>Importance</Label>
                <Select value={form.importance} onValueChange={(v) => setForm((f) => ({ ...f, importance: v as WorkspacePriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">Haute</SelectItem>
                    <SelectItem value="MEDIUM">Moyenne</SelectItem>
                    <SelectItem value="LOW">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="admin-btn-primary" disabled={!form.organizer || !form.eventTitle} onClick={() => void save()}>
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
