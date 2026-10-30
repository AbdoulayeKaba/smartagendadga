'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileUp,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import '@/components/workspace/mail-enregistrement.css';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { WorkspaceTrashRowActions } from '@/components/workspace/workspace-trash-row-actions';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import { useTemporalQueryParams } from '@/components/temporal/temporal-navigation-context';
import { useDepartmentsReferential } from '@/hooks/use-departments-referential';
import { toast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { MAIL_STATUS_LABELS } from '@/lib/workspace/labels';
import { formatMailDate } from '@/lib/workspace/mail-utils';
import {
  mailAttachmentsToInput,
  newMailAttachmentKey,
  newMailDraftOwnerId,
  type MailAttachmentDraft,
} from '@/lib/workspace/mail-attachment-form-state';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import { cn } from '@/lib/utils';
import type { MailItem } from '@/lib/workspace/types';

const API = '/api/workspace/mail-enregistrement';
const UPLOAD_API = '/api/workspace/mail/attachments/upload';
const FILE_API = '/api/workspace/mail/attachments';

type ListTab = 'active' | 'trash';
type ConfirmAction =
  | { type: 'delete'; mail: MailItem }
  | { type: 'emptyTrash' }
  | null;

function subjectFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type RegisterForm = {
  assignedService: string;
  subject: string;
  reference: string;
  counterpart: string;
  mailDate: string;
  action: string;
  courierName: string;
  notes: string;
  mailOwnerId: string;
  attachments: MailAttachmentDraft[];
};

function emptyRegisterForm(): RegisterForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    assignedService: '',
    subject: '',
    reference: '',
    counterpart: '',
    mailDate: today,
    action: '',
    courierName: '',
    notes: '',
    mailOwnerId: newMailDraftOwnerId(),
    attachments: [],
  };
}

export function MailEnregistrementView() {
  const temporalParams = useTemporalQueryParams();
  const role = useDgRole();
  const canManage = canManageWorkspace(role);
  const { departments, loading: departmentsLoading } = useDepartmentsReferential();
  const { refresh, reload } = useWorkspaceCrud(API);

  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listTab, setListTab] = useState<ListTab>('active');
  const [counts, setCounts] = useState({ active: 0, trash: 0 });
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyRegisterForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        archived: listTab === 'trash' ? 'true' : 'false',
        ...temporalParams,
      });
      const res = await fetch(`${API}?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const code = json.error ?? `HTTP_${res.status}`;
        setLoadError(
          code === 'UNAUTHORIZED'
            ? 'Session expirée — reconnectez-vous.'
            : code === 'FORBIDDEN'
              ? 'Accès refusé au coffre-fort.'
              : 'Impossible de charger les courriers.'
        );
        setItems([]);
        return;
      }
      const json = (await res.json()) as {
        items?: MailItem[];
        counts?: { active: number; trash: number };
      };
      setItems(json.items ?? []);
      if (json.counts) {
        setCounts((prev) =>
          prev.active === json.counts!.active && prev.trash === json.counts!.trash
            ? prev
            : json.counts!
        );
      }
    } catch {
      setLoadError('Erreur réseau lors du chargement.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listTab, temporalParams, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (folderFilter !== 'ALL' && (m.assignedService ?? '') !== folderFilter) return false;
      if (!q) return true;
      return (
        m.subject.toLowerCase().includes(q) ||
        m.counterpart.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q) ||
        (m.assignedService ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, search, folderFilter]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyRegisterForm());
    setOpen(true);
  };

  const openEdit = (row: MailItem) => {
    setEditId(row.id);
    setForm({
      assignedService: row.assignedService ?? '',
      subject: row.subject,
      reference: row.reference,
      counterpart: row.counterpart,
      mailDate: row.mailDate.slice(0, 10),
      action: row.action ?? '',
      courierName: row.courierName ?? '',
      notes: row.notes ?? '',
      mailOwnerId: row.id,
      attachments: (row.attachments ?? []).map((a) => ({
        key: a.id,
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        storageKey: a.storageKey,
      })),
    });
    setOpen(true);
  };

  const uploadPrimaryFile = async (file: File) => {
    const draftKey = newMailAttachmentKey();
    const autoSubject = subjectFromFileName(file.name);

    setForm((f) => ({
      ...f,
      subject: f.subject.trim() ? f.subject : autoSubject,
      attachments: [
        {
          key: draftKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageKey: '',
          uploading: true,
        },
      ],
    }));

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('mailOwnerId', form.mailOwnerId);
      const res = await fetch(UPLOAD_API, { method: 'POST', body });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        attachment?: {
          fileName: string;
          fileSize: number;
          mimeType: string;
          storageKey: string;
        };
      };
      if (!res.ok || !json.attachment) {
        throw new Error(
          json.error === 'FILE_TOO_LARGE'
            ? 'Fichier trop volumineux (max 50 Mo).'
            : json.error === 'UNSUPPORTED_FILE_TYPE'
              ? 'Type de fichier non pris en charge.'
              : 'Échec du téléversement.'
        );
      }
      const uploaded = json.attachment;
      setForm((f) => ({
        ...f,
        subject: f.subject.trim() || subjectFromFileName(uploaded.fileName),
        attachments: [
          {
            key: draftKey,
            fileName: uploaded.fileName,
            fileSize: uploaded.fileSize,
            mimeType: uploaded.mimeType,
            storageKey: uploaded.storageKey,
            uploading: false,
          },
        ],
      }));
    } catch (error) {
      setForm((f) => ({
        ...f,
        attachments: f.attachments.map((a) =>
          a.key === draftKey
            ? {
                ...a,
                uploading: false,
                uploadError: error instanceof Error ? error.message : 'Échec du téléversement.',
              }
            : a
        ),
      }));
      toast({
        variant: 'destructive',
        title: 'Téléversement impossible',
        description: error instanceof Error ? error.message : 'Réessayez.',
      });
    }
  };

  const removePrimaryFile = async () => {
    const current = form.attachments[0];
    if (current?.storageKey?.includes('/pending/')) {
      await fetch(`${UPLOAD_API}?storageKey=${encodeURIComponent(current.storageKey)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
    setForm((f) => ({ ...f, attachments: [] }));
  };

  const canSave =
    Boolean(form.assignedService.trim()) &&
    Boolean(form.subject.trim()) &&
    Boolean(form.counterpart.trim()) &&
    Boolean(form.reference.trim()) &&
    !form.attachments.some((a) => a.uploading) &&
    form.attachments.some((a) => a.storageKey && !a.uploadError);

  const save = async () => {
    if (!canSave || saving) return;
    const wasEdit = Boolean(editId);
    setSaving(true);
    try {
      const payload = {
        direction: 'OUTGOING' as const,
        mailKind: 'VAULT' as const,
        reference: form.reference.trim(),
        counterpart: form.counterpart.trim(),
        subject: form.subject.trim(),
        mailDate: form.mailDate,
        priority: 'NORMAL' as const,
        hasAttachment: form.attachments.some((a) => a.storageKey && !a.uploadError),
        attachments: mailAttachmentsToInput(form.attachments),
        assignedService: form.assignedService.trim(),
        action: form.action.trim() || null,
        courierName: form.courierName.trim() || null,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : { notes: null }),
      };
      const result = await fetchJson(editId ? `${API}/${editId}` : API, {
        method: editId ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: editId ? 'Modification impossible' : 'Enregistrement impossible',
          description:
            result.status === 422
              ? 'Données invalides — vérifiez les champs obligatoires et le fichier.'
              : result.status === 403
                ? 'Accès refusé.'
                : 'Réessayez dans un instant.',
        });
        return;
      }
      setOpen(false);
      setEditId(null);
      reload();
      toast({
        title: wasEdit ? 'Courrier modifié' : 'Courrier enregistré',
        description: `Dossier : ${form.assignedService}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const mailRequest = async (
    path: string,
    init: RequestInit,
    successTitle: string
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
    toast({ title: successTitle });
    reload();
    return true;
  };

  const archiveMail = (mail: MailItem) =>
    mailRequest(
      `${API}/${mail.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      },
      'Courrier déplacé dans la corbeille'
    );

  const restoreMail = (mail: MailItem) =>
    mailRequest(
      `${API}/${mail.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      },
      'Courrier restauré'
    );

  const deleteMailPermanent = (mail: MailItem) =>
    mailRequest(`${API}/${mail.id}`, { method: 'DELETE' }, 'Courrier supprimé définitivement');

  const emptyTrash = () => {
    const params = new URLSearchParams({ ...temporalParams });
    return mailRequest(`${API}/trash?${params.toString()}`, { method: 'POST' }, 'Corbeille vidée');
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'delete') {
        ok = await deleteMailPermanent(confirmAction.mail);
      } else {
        ok = await emptyTrash();
      }
      if (ok) setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const primaryAttachment = (row: MailItem) => row.attachments?.[0] ?? null;

  const primary = form.attachments[0];

  return (
    <div className="workspace-module-list mail-view mail-enregistrement-view">
      <div className="workspace-module-header">
        <AdminPageHeader
          variant="flat"
          eyebrow="Espace de travail"
          title="Coffre-fort"
          description="Classez chaque courrier dans un dossier département, avec pièce jointe et objet automatique."
          actions={
            canManage ? (
              <button
                type="button"
                className="admin-appt-header-btn admin-appt-header-btn--primary"
                onClick={openCreate}
              >
                <Plus className="h-3 w-3" aria-hidden />
                Enregistrer un courrier
              </button>
            ) : null
          }
        />
      </div>

      <section
        className={cn(
          'admin-appt-toolbar workspace-module-toolbar mail-toolbar',
          listTab === 'trash' && 'admin-trash-toolbar'
        )}
      >
        {listTab === 'trash' ? (
          <AdminTrashBanner
            count={counts.trash}
            emptyHint="Aucun courrier — espace prêt pour les éléments archivés"
            filledHint={`${counts.trash} courrier${counts.trash > 1 ? 's' : ''} — restaurables avant suppression définitive`}
          />
        ) : null}
        <AdminTrashScopeTabs
          value={listTab}
          onChange={setListTab}
          activeCount={counts.active}
          trashCount={counts.trash}
        />
        <div className="mail-toolbar-row mail-toolbar-row--search">
          <div className="admin-appt-search mail-toolbar-search">
            <Search className="admin-appt-search-icon" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                listTab === 'trash'
                  ? 'Rechercher dans la corbeille…'
                  : 'Objet, destinataire, référence, dossier…'
              }
              className="admin-appt-search-input mail-search-input"
            />
          </div>
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="mail-status-filter admin-field">
              <SelectValue placeholder="Tous les dossiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les dossiers</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {listTab === 'trash' && counts.trash > 0 && canManage ? (
            <AdminEmptyTrashButton onClick={() => setConfirmAction({ type: 'emptyTrash' })} />
          ) : null}
        </div>
      </section>

      {loadError ? (
        <div className="mail-load-error" role="alert">
          {loadError}
        </div>
      ) : null}

      <div
        className={cn(
          'admin-appt-table-wrap workspace-module-table-wrap mail-table-wrap overflow-x-auto',
          listTab === 'trash' && 'admin-trash-table-wrap'
        )}
      >
        {loading ? (
          <div className="workspace-module-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <table className="admin-appt-table workspace-module-table mail-table w-full min-w-[760px]">
            <thead>
              <tr>
                <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                <th>Dossier</th>
                <th>Date</th>
                <th>Objet</th>
                <th>Destinataire</th>
                <th>Référence</th>
                <th>Statut</th>
                <th>Fichier</th>
                {listTab === 'trash' ? <th>Mise en corbeille</th> : null}
                {canManage ? <th className="workspace-module-th-actions">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={(canManage ? 9 : 8) + (listTab === 'trash' ? 1 : 0)} className="workspace-module-empty">
                    {listTab === 'trash' && !search.trim() ? (
                      <AdminTrashEmptyState
                        description="Les courriers archivés apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
                        onBackToActive={() => setListTab('active')}
                      />
                    ) : listTab === 'trash' ? (
                      'Aucun courrier dans la corbeille.'
                    ) : (
                      'Aucun courrier enregistré.'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => {
                  const attachment = primaryAttachment(row);
                  return (
                  <tr key={row.id} className="mail-table-row">
                    <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                    <td>
                      {row.assignedService ? (
                        <span className="mail-dossier-badge inline-flex items-center gap-1 rounded-md border border-yellow-400 bg-yellow-100 px-1.5 py-0.5 text-[0.7rem] font-bold text-yellow-800">
                          <FolderOpen className="h-3 w-3 shrink-0 text-yellow-600" aria-hidden />
                          {row.assignedService}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>{formatMailDate(row.mailDate)}</td>
                    <td>
                      <span className="mail-subject-cell">{row.subject}</span>
                    </td>
                    <td>{row.counterpart}</td>
                    <td>
                      <span className="mail-ref">{row.reference}</span>
                    </td>
                    <td>
                      <span className="mail-status-badge" data-status={row.workflowStatus}>
                        {MAIL_STATUS_LABELS[row.workflowStatus]}
                      </span>
                    </td>
                    <td>
                      {attachment ? (
                        <a
                          href={`${FILE_API}/${attachment.id}/file`}
                          className="mail-file-link text-xs font-medium text-[var(--admin-primary)] hover:underline"
                          download={attachment.fileName}
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </a>
                      ) : row.attachmentCount > 0 ? (
                        `${row.attachmentCount} fichier(s)`
                      ) : (
                        '—'
                      )}
                    </td>
                    {listTab === 'trash' ? (
                      <td className="tabular-nums text-muted-foreground">
                        {row.archivedAt ? formatMailDate(row.archivedAt) : '—'}
                      </td>
                    ) : null}
                    {canManage ? (
                      <td className="workspace-module-td-actions">
                        <WorkspaceTrashRowActions
                          variant={listTab}
                          onEdit={listTab === 'active' ? () => openEdit(row) : undefined}
                          onArchive={
                            listTab === 'active' ? () => void archiveMail(row) : undefined
                          }
                          onRestore={listTab === 'trash' ? () => void restoreMail(row) : undefined}
                          onDeletePermanent={
                            listTab === 'trash'
                              ? () => setConfirmAction({ type: 'delete', mail: row })
                              : undefined
                          }
                        />
                      </td>
                    ) : null}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="workspace-module-footer">
        {filtered.length} élément{filtered.length > 1 ? 's' : ''}
        {listTab === 'trash' ? ' · Corbeille' : ' · Actifs'}
      </p>

      <AdminConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille ?'
            : 'Supprimer définitivement ?'
        }
        message={
          confirmAction?.type === 'emptyTrash' ? (
            <>Tous les courriers archivés seront supprimés définitivement. Action irréversible.</>
          ) : confirmAction?.type === 'delete' ? (
            <>
              Le courrier <strong>{confirmAction.mail.reference}</strong> sera supprimé de la base.
              Action irréversible.
            </>
          ) : null
        }
        confirmLabel={
          confirmAction?.type === 'emptyTrash' ? 'Vider la corbeille' : 'Supprimer définitivement'
        }
        intent={confirmAction?.type === 'emptyTrash' ? 'archive' : 'archive'}
        onConfirm={() => void runConfirmAction()}
        loading={actionLoading}
      />

      <WorkspaceCrudDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditId(null);
        }}
        className={
          editId
            ? 'workspace-crud-dialog--mail mail-edit-dialog'
            : 'workspace-crud-dialog--mail'
        }
        description={editId ? 'Modifier le courrier' : 'Enregistrer un courrier'}
        title={
          editId ? (
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <Pencil className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Modification</span>
                <span className="mail-edit-dialog-heading">Courrier enregistré</span>
              </span>
            </span>
          ) : (
            'Enregistrer un courrier'
          )
        }
        onSubmit={() => void save()}
        footer={
          <>
            <button
              type="button"
              className="admin-btn-cancel"
              onClick={() => {
                setOpen(false);
                setEditId(null);
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={editId ? 'mail-edit-dialog-submit' : 'admin-btn-create'}
              disabled={!canSave || saving}
            >
              {saving
                ? 'Enregistrement…'
                : editId
                  ? 'Mettre à jour'
                  : 'Enregistrer'}
            </button>
          </>
        }
      >
        <div
          className={
            editId
              ? 'workspace-crud-form-compact mail-edit-form grid gap-3'
              : 'workspace-crud-form-compact grid gap-3'
          }
        >
          <WorkspaceCrudField
            id="mail-reg-folder"
            label="Dossier (département)"
            className="mail-dossier-field"
          >
            <Select
              value={form.assignedService || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, assignedService: v }))}
              disabled={departmentsLoading}
            >
              <SelectTrigger
                id="mail-reg-folder"
                className="admin-field mail-dossier-trigger"
              >
                <span className="mail-dossier-trigger-inner">
                  <FolderOpen className="mail-dossier-trigger-icon" aria-hidden />
                  <SelectValue
                    placeholder={departmentsLoading ? 'Chargement…' : 'Choisir un département'}
                  />
                </span>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-reg-file" label="Fichier du courrier">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void uploadPrimaryFile(file);
              }}
            />
            {!primary ? (
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[color-mix(in_oklch,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_oklch,var(--admin-primary)_4%,white)] px-3 py-5 text-center transition-colors hover:bg-[color-mix(in_oklch,var(--admin-primary)_8%,white)]"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden />
                <span className="text-[0.78rem] font-semibold text-[var(--admin-foreground)]">
                  Charger le courrier
                </span>
                <span className="text-[0.62rem] text-muted-foreground">
                  PDF, Word, Excel ou image — max 50 Mo
                </span>
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-white px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.78rem] font-semibold text-[var(--admin-foreground)]">
                    {primary.fileName}
                  </p>
                  <p className="text-[0.62rem] text-muted-foreground">
                    {primary.uploading
                      ? 'Téléversement…'
                      : primary.uploadError
                        ? primary.uploadError
                        : formatWorkspaceFileSize(primary.fileSize)}
                  </p>
                </div>
                {primary.uploading ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-[var(--admin-primary)]" />
                ) : (
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void removePrimaryFile()}
                    aria-label="Retirer le fichier"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </WorkspaceCrudField>

          <WorkspaceCrudField id="mail-reg-subject" label="Objet">
            <Input
              id="mail-reg-subject"
              className="admin-field"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Renseigné automatiquement depuis le fichier"
            />
          </WorkspaceCrudField>

          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceCrudField id="mail-reg-ref" label="Référence">
              <Input
                id="mail-reg-ref"
                className="admin-field"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </WorkspaceCrudField>
            <WorkspaceCrudField id="mail-reg-date" label="Date du courrier">
              <FrenchDateField
                id="mail-reg-date"
                value={form.mailDate}
                onChange={(v) => setForm((f) => ({ ...f, mailDate: v }))}
              />
            </WorkspaceCrudField>
          </div>

          <WorkspaceCrudField id="mail-reg-dest" label="Destinataire">
            <Input
              id="mail-reg-dest"
              className="admin-field"
              value={form.counterpart}
              onChange={(e) => setForm((f) => ({ ...f, counterpart: e.target.value }))}
            />
          </WorkspaceCrudField>

          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceCrudField id="mail-reg-action" label="Niveau d’exécution">
              <Input
                id="mail-reg-action"
                className="admin-field"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                placeholder="Ex. TRANSMIS AU SC"
              />
            </WorkspaceCrudField>
            <WorkspaceCrudField id="mail-reg-courier" label="Coursier">
              <Input
                id="mail-reg-courier"
                className="admin-field"
                value={form.courierName}
                onChange={(e) => setForm((f) => ({ ...f, courierName: e.target.value }))}
              />
            </WorkspaceCrudField>
          </div>

          <WorkspaceCrudField id="mail-reg-notes" label="Notes">
            <Textarea
              id="mail-reg-notes"
              className="admin-field min-h-[4.5rem]"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </WorkspaceCrudField>
        </div>
      </WorkspaceCrudDialog>
    </div>
  );
}
