'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, CalendarPlus, History, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import {
  AdminEmptyTrashButton,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import '@/components/workspace/contacts-view.css';
import '@/components/workspace/mail-enregistrement.css';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import { useApp } from '@/lib/app-context';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canReviewAppointments } from '@/lib/dg/rbac';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { ContactAppointmentDialog } from '@/components/workspace/contact-appointment-dialog';
import { ContactAppointmentsSheet } from '@/components/workspace/contact-appointments-sheet';
import { CONTACT_CATEGORY_LABELS } from '@/lib/workspace/labels';
import {
  downloadContactsExcel,
  printContactsPdf,
} from '@/lib/workspace/contacts-export-utils';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { toast } from '@/hooks/use-toast';
import type { ContactCategory, StrategicContact } from '@/lib/workspace/types';

const API = '/api/workspace/contacts';

const COMPACT_SELECT_TRIGGER = 'workspace-crud-compact-select-trigger admin-field w-full';
const COMPACT_SELECT_CONTENT = 'workspace-crud-compact-select-content';

type ContactTab = 'active' | 'trash';

type FormState = {
  category: ContactCategory;
  fullName: string;
  jobTitle: string;
  organization: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  category: 'INSTITUTION',
  fullName: '',
  jobTitle: '',
  organization: '',
  phone: '',
  email: '',
  notes: '',
});

function toForm(row: StrategicContact): FormState {
  return {
    category: row.category,
    fullName: row.fullName,
    jobTitle: row.jobTitle ?? '',
    organization: row.organization,
    phone: row.phone ?? '',
    email: row.email ?? '',
    notes: row.notes ?? '',
  };
}

function formatContactDate(value: string | null | undefined) {
  if (!value) return '—';
  return format(new Date(value), 'd MMM yyyy', { locale: fr });
}

export function ContactsView() {
  const role = useDgRole();
  const { permissions } = useApp();
  const canReview = canReviewAppointments(role);
  const canManageRole = canManageWorkspace(role);
  const canHistory = permissions['action.contacts.history'] === true;
  const canPlan = permissions['action.contacts.plan'] === true;
  const canCreate = permissions['action.contacts.create'] === true;
  const canEdit = permissions['action.contacts.edit'] === true;
  const canArchive = permissions['action.contacts.archive'] === true;
  const canRestore = permissions['action.contacts.restore'] === true;
  const canDelete = permissions['action.contacts.delete'] === true;
  const hasRowActions =
    canHistory || canPlan || canEdit || canArchive || canRestore || canDelete;
  const canManage = canManageRole || canCreate || canEdit || canArchive || canRestore || canDelete;
  const { refresh, reload, create, patch } = useWorkspaceCrud(API);
  const [tab, setTab] = useState<ContactTab>('active');
  const [counts, setCounts] = useState({ active: 0, trash: 0 });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [rdvContact, setRdvContact] = useState<StrategicContact | null>(null);
  const [rdvDialogOpen, setRdvDialogOpen] = useState(false);
  const [rdvSheetOpen, setRdvSheetOpen] = useState(false);
  const [rdvRefreshKey, setRdvRefreshKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlightRef = useRef(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'archive'; contact: StrategicContact }
    | { type: 'delete'; contact: StrategicContact }
    | { type: 'emptyTrash' }
    | null
  >(null);

  const queryParams = useMemo(
    () => ({ archived: tab === 'trash' ? 'true' : 'false' }),
    [tab]
  );

  const handleMeta = useCallback((meta: { counts?: { active: number; trash: number } }) => {
    if (!meta.counts) return;
    setCounts((prev) =>
      prev.active === meta.counts!.active && prev.trash === meta.counts!.trash ? prev : meta.counts!
    );
  }, []);

  const openHistory = (row: StrategicContact) => {
    setRdvContact(row);
    setRdvSheetOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      jobTitle: form.jobTitle || undefined,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
    };
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  const contactRequest = async (
    path: string,
    init: RequestInit,
    options?: { successTitle?: string }
  ): Promise<boolean> => {
    const result = await fetchJson(path, init);
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Action impossible',
        description: 'Réessayez ou contactez l’administrateur.',
      });
      return false;
    }
    if (options?.successTitle) toast({ title: options.successTitle });
    reload();
    return true;
  };

  const archiveContact = (contact: StrategicContact) =>
    contactRequest(
      `${API}/${contact.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      },
      { successTitle: 'Contact déplacé dans la corbeille' }
    );

  const restoreContact = (contact: StrategicContact) =>
    contactRequest(
      `${API}/${contact.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      },
      { successTitle: 'Contact restauré' }
    );

  const deleteContactPermanent = (contact: StrategicContact) =>
    contactRequest(`${API}/${contact.id}`, { method: 'DELETE' }, {
      successTitle: 'Contact supprimé définitivement',
    });

  const emptyTrash = () =>
    contactRequest(`${API}/trash`, { method: 'POST' }, { successTitle: 'Corbeille vidée' });

  const confirmActionHandler = async () => {
    if (!confirmAction || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'archive') {
        ok = await archiveContact(confirmAction.contact);
      } else if (confirmAction.type === 'delete') {
        ok = await deleteContactPermanent(confirmAction.contact);
      } else if (confirmAction.type === 'emptyTrash') {
        ok = await emptyTrash();
      }
      if (ok) {
        if (
          (confirmAction.type === 'archive' || confirmAction.type === 'delete') &&
          rdvContact?.id === confirmAction.contact.id
        ) {
          setRdvSheetOpen(false);
          setRdvDialogOpen(false);
          setRdvContact(null);
        }
        setConfirmAction(null);
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const emailOk = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSave =
    form.fullName.trim().length >= 2 &&
    form.organization.trim().length >= 2 &&
    emailOk;

  const statusToolbar = (
    <div className="workspace-contacts-toolbar-end">
      <AdminTrashScopeTabs
        value={tab}
        onChange={setTab}
        activeCount={counts.active}
        trashCount={counts.trash}
      />
      {tab === 'trash' && counts.trash > 0 && canDelete ? (
        <AdminEmptyTrashButton
          label="Vider"
          onClick={() => setConfirmAction({ type: 'emptyTrash' })}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <WorkspaceModuleList<StrategicContact>
        className="workspace-contacts-page"
        refreshTrigger={refresh}
        title="Contacts stratégiques"
        description="Annuaire institutionnel et suivi des rendez-vous."
        apiPath={API}
        queryParams={queryParams}
        exportFilename="contacts-strategiques.csv"
        exportHandlers={{
          itemLabel: 'contact',
          onExportExcel: async (items) => {
            try {
              await downloadContactsExcel(items);
              toast({
                variant: 'success',
                title: 'Export Excel généré',
                description: `${items.length} contact${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''}.`,
              });
            } catch {
              toast({
                variant: 'destructive',
                title: 'Export impossible',
                description: 'La génération du fichier Excel a échoué.',
              });
            }
          },
          onExportPdf: (items) => printContactsPdf(items),
        }}
        searchPlaceholder="Nom, organisation, téléphone…"
        emptyLabel={tab === 'trash' ? 'Aucun contact dans la corbeille.' : 'Aucun contact actif.'}
        isTrash={tab === 'trash'}
        emptyContent={
          tab === 'trash' ? (
            <AdminTrashEmptyState
              description="Les contacts mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
              onBackToActive={() => setTab('active')}
            />
          ) : undefined
        }
        onMeta={handleMeta}
        onCreateClick={
          canCreate && tab === 'active'
            ? () => {
                setEditId(null);
                setForm(emptyForm());
                setOpen(true);
              }
            : undefined
        }
        createLabel="Nouveau contact"
        filterBar={statusToolbar}
        rowActions={
          hasRowActions
            ? (row) => {
                const activeItems =
                  tab === 'active'
                    ? [
                        canHistory ? (
                          <DropdownMenuItem key="history" onSelect={() => openHistory(row)}>
                            <History />
                            Historique RDV
                          </DropdownMenuItem>
                        ) : null,
                        canPlan ? (
                          <DropdownMenuItem
                            key="plan"
                            onSelect={() => {
                              setRdvContact(row);
                              setRdvDialogOpen(true);
                            }}
                          >
                            <CalendarPlus />
                            Planifier un RDV
                          </DropdownMenuItem>
                        ) : null,
                        canEdit || canArchive ? <DropdownMenuSeparator key="sep" /> : null,
                        canEdit ? (
                          <DropdownMenuItem
                            key="edit"
                            onSelect={() => {
                              setEditId(row.id);
                              setForm(toForm(row));
                              setOpen(true);
                            }}
                          >
                            <Pencil />
                            Modifier
                          </DropdownMenuItem>
                        ) : null,
                        canArchive ? (
                          <DropdownMenuItem
                            key="archive"
                            variant="destructive"
                            onSelect={() => setConfirmAction({ type: 'archive', contact: row })}
                          >
                            <Trash2 />
                            Mettre en corbeille
                          </DropdownMenuItem>
                        ) : null,
                      ].filter(Boolean)
                    : [
                        canRestore ? (
                          <DropdownMenuItem key="restore" onSelect={() => void restoreContact(row)}>
                            <RotateCcw />
                            Restaurer
                          </DropdownMenuItem>
                        ) : null,
                        canDelete ? (
                          <DropdownMenuItem
                            key="delete"
                            variant="destructive"
                            onSelect={() => setConfirmAction({ type: 'delete', contact: row })}
                          >
                            <Trash2 />
                            Supprimer définitivement
                          </DropdownMenuItem>
                        ) : null,
                      ].filter(Boolean);

                if (activeItems.length === 0) return null;

                return (
                  <div className="workspace-contacts-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="workspace-contacts-actions-trigger"
                          aria-label={`Actions pour ${row.fullName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="workspace-contacts-actions-menu"
                      >
                        {activeItems}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              }
            : undefined
        }
        onRowClick={(row) => {
          setRdvContact(row);
          setRdvSheetOpen(true);
        }}
        selectedRowId={rdvSheetOpen && rdvContact ? rdvContact.id : null}
        columns={[
          {
            key: 'name',
            header: 'Nom',
            render: (r) => (
              <div className="workspace-contacts-cell-name">
                <span className="workspace-contacts-cell-name-main">{r.fullName}</span>
                {r.jobTitle ? (
                  <span className="workspace-contacts-cell-name-sub">{r.jobTitle}</span>
                ) : null}
              </div>
            ),
            exportValue: (r) => r.fullName,
          },
          {
            key: 'org',
            header: 'Organisation',
            thClassName: 'workspace-module-col--org',
            tdClassName: 'workspace-module-col--org',
            render: (r) => r.organization,
          },
          {
            key: 'cat',
            header: 'Catégorie',
            thClassName: 'workspace-module-col--category',
            tdClassName: 'workspace-module-col--category',
            render: (r) => (
              <span
                className="mail-status-badge workspace-contacts-cat-badge"
                data-category={r.category.toLowerCase()}
              >
                {CONTACT_CATEGORY_LABELS[r.category]}
              </span>
            ),
          },
          {
            key: 'phone',
            header: 'Téléphone',
            thClassName: 'workspace-module-col--phone',
            tdClassName: 'workspace-module-col--phone',
            render: (r) => r.phone ?? '—',
          },
          {
            key: 'email',
            header: 'Email',
            thClassName: 'workspace-module-col--email',
            tdClassName: 'workspace-module-col--email',
            render: (r) => r.email ?? '—',
          },
          ...(tab === 'trash'
            ? [
                {
                  key: 'archivedAt',
                  header: 'Mise en corbeille',
                  render: (r: StrategicContact) => formatContactDate(r.archivedAt),
                },
              ]
            : []),
          {
            key: 'rdv',
            header: 'RDV',
            exportValue: (r) => String(r.appointmentCount),
            render: (r) => {
              const count = r.appointmentCount;
              const active = count > 0;
              const label = `${count} rendez-vous`;
              const content = (
                <>
                  <CalendarDays className="workspace-contact-rdv-count-icon" aria-hidden />
                  <span className="workspace-contact-rdv-count-num">{count}</span>
                </>
              );
              if (canHistory) {
                return (
                  <button
                    type="button"
                    className="workspace-contact-rdv-count"
                    data-active={active ? 'true' : undefined}
                    onClick={() => openHistory(r)}
                    title={label}
                    aria-label={label}
                  >
                    {content}
                  </button>
                );
              }
              return (
                <span
                  className="workspace-contact-rdv-count"
                  data-active={active ? 'true' : undefined}
                  title={label}
                >
                  {content}
                </span>
              );
            },
          },
        ]}
      />
      <AdminConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille ?'
            : confirmAction?.type === 'delete'
              ? 'Supprimer définitivement ?'
              : 'Mettre dans la corbeille ?'
        }
        message={
          confirmAction?.type === 'emptyTrash' ? (
            <>Tous les contacts archivés seront supprimés définitivement.</>
          ) : confirmAction?.type === 'delete' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.contact.fullName}</span>{' '}
              sera supprimé définitivement.
            </>
          ) : confirmAction?.type === 'archive' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.contact.fullName}</span>{' '}
              sera déplacé dans la corbeille. Vous pourrez le restaurer ou le supprimer plus tard.
            </>
          ) : null
        }
        confirmLabel={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille'
            : confirmAction?.type === 'delete'
              ? 'Supprimer'
              : 'Mettre en corbeille'
        }
        intent={confirmAction?.type === 'archive' ? 'archive' : 'destructive'}
        loading={actionLoading}
        onConfirm={() => void confirmActionHandler()}
      />
      <ContactAppointmentDialog
        contact={rdvContact}
        open={rdvDialogOpen}
        onOpenChange={(o) => {
          setRdvDialogOpen(o);
          if (!o) setRdvContact(null);
        }}
        onSuccess={() => {
          setRdvDialogOpen(false);
          reload();
          setRdvRefreshKey((k) => k + 1);
        }}
      />
      <ContactAppointmentsSheet
        contact={rdvContact}
        open={rdvSheetOpen}
        onOpenChange={(o) => {
          setRdvSheetOpen(o);
          if (!o) setRdvContact(null);
        }}
        refreshTrigger={rdvRefreshKey}
        canReview={canReview}
        canEdit={canEdit && tab === 'active'}
        canDelete={canArchive && tab === 'active'}
        onContactsRefresh={() => reload()}
        onEdit={
          canEdit && rdvContact
            ? () => {
                setEditId(rdvContact.id);
                setForm(toForm(rdvContact));
                setOpen(true);
              }
            : undefined
        }
        onDelete={
          canArchive && rdvContact
            ? () => setConfirmAction({ type: 'archive', contact: rdvContact })
            : undefined
        }
        onPlanClick={
          canManage && tab === 'active'
            ? () => {
                setRdvSheetOpen(false);
                setRdvDialogOpen(true);
              }
            : undefined
        }
      />
      <WorkspaceCrudDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditId(null);
        }}
        className={editId ? 'mail-edit-dialog' : undefined}
        description={editId ? 'Modifier le contact' : 'Nouveau contact'}
        title={
          editId ? (
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <Pencil className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Modification</span>
                <span className="mail-edit-dialog-heading">Contact stratégique</span>
              </span>
            </span>
          ) : (
            'Nouveau contact'
          )
        }
        onSubmit={() => void save()}
        footer={
          <>
            <button type="button" className="admin-btn-cancel" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button
              type="submit"
              className={editId ? 'mail-edit-dialog-submit' : 'admin-btn-create'}
              disabled={!canSave}
            >
              {editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </>
        }
      >
        <div
          className={
            editId
              ? 'workspace-crud-form-grid workspace-crud-form-compact mail-edit-form'
              : 'workspace-crud-form-grid workspace-crud-form-compact'
          }
        >
          <WorkspaceCrudField id="contact-fullName" label="Nom complet *" className="workspace-crud-span-2">
            <Input
              id="contact-fullName"
              autoComplete="name"
              placeholder="Prénom et nom"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="admin-field"
              required
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-jobTitle" label="Fonction">
            <Input
              id="contact-jobTitle"
              autoComplete="organization-title"
              placeholder="Directeur, conseiller…"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-category" label="Catégorie *">
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as ContactCategory }))}
            >
              <SelectTrigger id="contact-category" className={COMPACT_SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={COMPACT_SELECT_CONTENT}>
                {(Object.keys(CONTACT_CATEGORY_LABELS) as ContactCategory[]).map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {CONTACT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-organization" label="Organisation *" className="workspace-crud-span-2">
            <Input
              id="contact-organization"
              autoComplete="organization"
              placeholder="Ministère, ambassade, entreprise…"
              value={form.organization}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              className="admin-field"
              required
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-phone" label="Téléphone">
            <Input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+224 6XX XX XX XX"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="admin-field"
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-email" label="E-mail">
            <Input
              id="contact-email"
              type="email"
              autoComplete="email"
              placeholder="nom@organisation.gov"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="admin-field"
              aria-invalid={!emailOk}
            />
          </WorkspaceCrudField>

          <WorkspaceCrudField id="contact-notes" label="Notes" className="workspace-crud-span-2">
            <Textarea
              id="contact-notes"
              placeholder="Contexte, préférences de contact, historique…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="admin-field workspace-crud-textarea workspace-crud-textarea--compact resize-y"
              rows={2}
            />
          </WorkspaceCrudField>

          {!emailOk ? (
            <p className="workspace-crud-span-2 workspace-crud-field-hint workspace-crud-field-hint--error">
              Adresse e-mail invalide.
            </p>
          ) : null}
        </div>
      </WorkspaceCrudDialog>
    </>
  );
}
