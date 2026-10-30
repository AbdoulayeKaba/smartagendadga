'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Eye,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  Pencil,
  PenLine,
  PenSquare,
  Trash2,
  Upload,
} from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import {
  AdminEmptyTrashButton,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { Input } from '@/components/ui/input';
import '@/components/workspace/mail-enregistrement.css';
import { ReportFileField, type ReportFileDraft } from '@/components/workspace/report-file-field';
import { ReportPreviewSheet } from '@/components/workspace/report-preview-sheet';
import {
  ReportRichTextEditor,
  type ReportRichTextEditorHandle,
} from '@/components/workspace/report-rich-text-editor';
import { WorkspaceCompactDateField } from '@/components/workspace/workspace-compact-date-field';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { WorkspaceTrashRowActions } from '@/components/workspace/workspace-trash-row-actions';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import { useApp } from '@/lib/app-context';
import { toast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { InlineFieldError, inlineFieldErrorClass } from '@/components/ui/inline-field-error';
import {
  findReportTitleConflict,
  hasReportWrittenContent,
  INLINE_REPORT_FILE_NAME,
  INLINE_REPORT_STORAGE_KEY,
  reportContentPreview,
  reportHasAttachment,
} from '@/lib/workspace/report-content';
import {
  reportContentKind,
  reportContentKindLabel,
  type ReportContentKind,
} from '@/lib/workspace/report-file';
import {
  downloadDocumentsExcel,
  printDocumentsPdf,
} from '@/lib/workspace/documents-export-utils';
import type { VaultDocument } from '@/lib/workspace/types';
import { cn } from '@/lib/utils';

const API = '/api/workspace/documents';

type ReportTab = 'active' | 'trash';

type ConfirmAction =
  | { type: 'archive'; document: VaultDocument }
  | { type: 'delete'; document: VaultDocument }
  | { type: 'emptyTrash' };

type ReportMode = 'write' | 'upload';

type FormState = {
  title: string;
  reportDate: string;
  mode: ReportMode;
  bodyHtml: string;
  file: ReportFileDraft | null;
};

function resolveMode(row: VaultDocument): ReportMode {
  if (hasReportWrittenContent(row.bodyHtml)) return 'write';
  if (reportHasAttachment(row)) return 'upload';
  return 'write';
}

function toForm(row: VaultDocument): FormState {
  const mode = resolveMode(row);
  return {
    title: row.title,
    reportDate: row.reportDate.slice(0, 10),
    mode,
    bodyHtml: row.bodyHtml ?? '',
    file:
      mode === 'upload' && reportHasAttachment(row)
        ? {
            fileName: row.fileName,
            fileSize: row.fileSize,
            storageKey: row.storageKey,
          }
        : null,
  };
}

const emptyForm = (): FormState => ({
  title: '',
  reportDate: new Date().toISOString().slice(0, 10),
  mode: 'write',
  bodyHtml: '',
  file: null,
});

function ReportKindIcon({ kind }: { kind: ReportContentKind }) {
  const className = 'h-3 w-3 shrink-0';
  switch (kind) {
    case 'pdf':
      return <FileType className={className} aria-hidden />;
    case 'word':
      return <FileText className={className} aria-hidden />;
    case 'image':
      return <ImageIcon className={className} aria-hidden />;
    case 'spreadsheet':
      return <FileSpreadsheet className={className} aria-hidden />;
    case 'written':
      return <PenSquare className={className} aria-hidden />;
    default:
      return <FileText className={className} aria-hidden />;
  }
}

function formatArchivedAt(value: string | null | undefined) {
  if (!value) return '—';
  return format(new Date(value), 'd MMM yyyy', { locale: fr });
}

export function DocumentsView() {
  const { refresh, reload, patch, create } = useWorkspaceCrud(API);
  const { permissions } = useApp();
  const canView = permissions['action.documents.view'] === true;
  const canCreate = permissions['action.documents.create'] === true;
  const canEdit = permissions['action.documents.edit'] === true;
  const canArchive = permissions['action.documents.archive'] === true;
  const canRestore = permissions['action.documents.restore'] === true;
  const canDelete = permissions['action.documents.delete'] === true;
  const canExport = permissions['action.documents.export'] === true;
  const hasTrashActions = canEdit || canArchive || canRestore || canDelete;
  const [tab, setTab] = useState<ReportTab>('active');
  const [counts, setCounts] = useState({ active: 0, trash: 0 });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlightRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [titleIndex, setTitleIndex] = useState<VaultDocument[]>([]);
  const [titleServerError, setTitleServerError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const savingRef = useRef(false);
  const editorRef = useRef<ReportRichTextEditorHandle>(null);

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

  useEffect(() => {
    setPreviewDoc(null);
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${API}?archived=false`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { items?: VaultDocument[] } | null) => {
        if (!cancelled && json?.items) setTitleIndex(json.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, refresh]);

  const trimmedTitle = form.title.trim();
  const titleConflict = useMemo(() => {
    if (trimmedTitle.length < 2) return undefined;
    return findReportTitleConflict(titleIndex, { title: trimmedTitle }, editId ?? undefined);
  }, [titleIndex, trimmedTitle, editId]);

  const titleDuplicate = Boolean(titleConflict) || titleServerError;
  const titleErrorMessage = titleConflict
    ? `Un compte rendu « ${titleConflict.title} » existe déjà.`
    : titleServerError
      ? 'Un compte rendu avec ce titre existe déjà.'
      : null;

  const fileReady =
    Boolean(form.file?.fileName) &&
    Boolean(form.file?.storageKey) &&
    !form.file?.uploading &&
    !form.file?.uploadError;

  const writtenReady = form.mode === 'write' && hasReportWrittenContent(form.bodyHtml);
  const uploadReady = form.mode === 'upload' && fileReady;

  const canSave =
    !saving &&
    !titleDuplicate &&
    trimmedTitle.length >= 2 &&
    form.reportDate.length > 0 &&
    (writtenReady || uploadReady);

  const openEdit = (row: VaultDocument) => {
    setEditId(row.id);
    setForm(toForm(row));
    setTitleServerError(false);
    setOpen(true);
  };

  const documentRequest = async (
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

  const archiveDocument = (document: VaultDocument) =>
    documentRequest(
      `${API}/${document.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      },
      { successTitle: 'Compte rendu déplacé dans la corbeille' }
    );

  const restoreDocument = (document: VaultDocument) =>
    documentRequest(
      `${API}/${document.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      },
      { successTitle: 'Compte rendu restauré' }
    );

  const deleteDocumentPermanent = (document: VaultDocument) =>
    documentRequest(`${API}/${document.id}`, { method: 'DELETE' }, {
      successTitle: 'Compte rendu supprimé définitivement',
    });

  const emptyTrash = () =>
    documentRequest(`${API}/trash`, { method: 'POST' }, { successTitle: 'Corbeille vidée' });

  const confirmActionHandler = async () => {
    if (!confirmAction || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'archive') {
        ok = await archiveDocument(confirmAction.document);
      } else if (confirmAction.type === 'delete') {
        ok = await deleteDocumentPermanent(confirmAction.document);
      } else if (confirmAction.type === 'emptyTrash') {
        ok = await emptyTrash();
      }
      if (ok) {
        if (
          (confirmAction.type === 'archive' || confirmAction.type === 'delete') &&
          previewDoc?.id === confirmAction.document.id
        ) {
          setPreviewDoc(null);
        }
        if (confirmAction.type === 'emptyTrash') {
          setPreviewDoc(null);
        }
        setConfirmAction(null);
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

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

  const save = async () => {
    if (savingRef.current) return;

    const bodyHtml = form.mode === 'write' ? editorRef.current?.getHtml() ?? form.bodyHtml : form.bodyHtml;

    if (form.mode === 'write' && !hasReportWrittenContent(bodyHtml)) {
      toast({
        variant: 'destructive',
        title: 'Contenu requis',
        description: 'Rédigez le compte rendu ou basculez sur le mode Fichier.',
      });
      return;
    }

    if (form.mode === 'upload' && !fileReady) {
      toast({
        variant: 'destructive',
        title: 'Fichier requis',
        description: 'Joignez un fichier ou attendez la fin du téléversement.',
      });
      return;
    }

    const title = trimmedTitle;
    if (titleConflict) return;

    const payload =
      form.mode === 'write'
        ? {
            title,
            reportDate: form.reportDate,
            bodyHtml,
            fileName: INLINE_REPORT_FILE_NAME,
            fileSize: new TextEncoder().encode(bodyHtml).length,
            storageKey: INLINE_REPORT_STORAGE_KEY,
          }
        : {
            title,
            reportDate: form.reportDate,
            bodyHtml: null,
            fileName: form.file!.fileName,
            fileSize: form.file!.fileSize,
            storageKey: form.file!.storageKey,
          };

    setSaving(true);
    savingRef.current = true;
    try {
      const result = editId
        ? await fetchJson(`${API}/${editId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetchJson(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (result.ok) {
        toast({
          title: editId ? 'Compte rendu mis à jour' : 'Compte rendu créé',
        });
        setTitleServerError(false);
        setOpen(false);
        reload();
        return;
      }

      if (result.error === 'DUPLICATE_TITLE') {
        setTitleServerError(true);
        return;
      }

      const description =
        result.error === 'VALIDATION_ERROR'
          ? 'Certains champs sont invalides.'
          : result.error === 'FORBIDDEN'
            ? 'Vous n’avez pas les droits pour enregistrer.'
            : result.status === 500
              ? 'Erreur serveur. Redémarrez l’application si le problème persiste.'
              : 'Vérifiez les champs ou réessayez dans quelques instants.';

      toast({
        variant: 'destructive',
        title: 'Enregistrement impossible',
        description,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <WorkspaceModuleList<VaultDocument>
        className="workspace-reports-view"
        refreshTrigger={refresh}
        title="Compte rendu"
        description="Rédaction enrichie ou dépôt de fichier — visualisez PDF et Word en un clic."
        apiPath={API}
        queryParams={queryParams}
        exportFilename="comptes-rendus.csv"
        exportHandlers={
          canExport
            ? {
                itemLabel: 'compte rendu',
                onExportExcel: async (items) => {
                  try {
                    await downloadDocumentsExcel(items);
                    toast({
                      variant: 'success',
                      title: 'Export Excel généré',
                      description: `${items.length} compte${items.length > 1 ? 's' : ''} rendu${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''}.`,
                    });
                  } catch {
                    toast({
                      variant: 'destructive',
                      title: 'Export impossible',
                      description: 'La génération du fichier Excel a échoué.',
                    });
                  }
                },
                onExportPdf: (items) => printDocumentsPdf(items),
              }
            : undefined
        }
        searchPlaceholder="Titre, contenu…"
        emptyLabel={tab === 'trash' ? 'Aucun compte rendu dans la corbeille.' : 'Aucun compte rendu actif.'}
        isTrash={tab === 'trash'}
        emptyContent={
          tab === 'trash' ? (
            <AdminTrashEmptyState
              description="Les comptes rendus mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
              onBackToActive={() => setTab('active')}
            />
          ) : undefined
        }
        onMeta={handleMeta}
        filterBar={statusToolbar}
        onCreateClick={
          canCreate && tab === 'active'
            ? () => {
                setEditId(null);
                setForm(emptyForm());
                setTitleServerError(false);
                setOpen(true);
              }
            : undefined
        }
        createLabel="Nouveau compte rendu"
        onRowClick={canView ? (row) => setPreviewDoc(row) : undefined}
        selectedRowId={previewDoc?.id ?? null}
        rowActions={
          canView || hasTrashActions
            ? (row) => (
                <div className="workspace-row-actions report-row-actions">
                  {canView ? (
                    <button
                      type="button"
                      className="workspace-row-action-btn workspace-row-action-btn--view"
                      onClick={() => setPreviewDoc(row)}
                      title="Visualiser"
                      aria-label="Visualiser le compte rendu"
                    >
                      <Eye className="h-2.5 w-2.5" />
                    </button>
                  ) : null}
                  {hasTrashActions ? (
                    <WorkspaceTrashRowActions
                      variant={tab}
                      onEdit={
                        tab === 'active' && canEdit ? () => openEdit(row) : undefined
                      }
                      onArchive={
                        tab === 'active' && canArchive
                          ? () => setConfirmAction({ type: 'archive', document: row })
                          : undefined
                      }
                      onRestore={
                        tab === 'trash' && canRestore
                          ? () => void restoreDocument(row)
                          : undefined
                      }
                      onDeletePermanent={
                        tab === 'trash' && canDelete
                          ? () => setConfirmAction({ type: 'delete', document: row })
                          : undefined
                      }
                      archiveTitle="Mettre dans la corbeille"
                    />
                  ) : null}
                </div>
              )
            : undefined
        }
        columns={[
          {
            key: 'title',
            header: 'Titre',
            render: (r) => <span className="report-list-title">{r.title}</span>,
          },
          {
            key: 'date',
            header: 'Date',
            tdClassName: 'report-list-date-cell',
            render: (r) => format(new Date(r.reportDate), 'd MMM yyyy', { locale: fr }),
          },
          ...(tab === 'trash'
            ? [
                {
                  key: 'archivedAt',
                  header: 'Archivé le',
                  tdClassName: 'report-list-date-cell',
                  render: (r: VaultDocument) => formatArchivedAt(r.archivedAt),
                  exportValue: (r: VaultDocument) => formatArchivedAt(r.archivedAt),
                },
              ]
            : []),
          {
            key: 'type',
            header: 'Type',
            tdClassName: 'report-list-type-cell',
            render: (r) => {
              const kind = reportContentKind(r);
              return (
                <span className="report-list-type-badge" data-kind={kind}>
                  <ReportKindIcon kind={kind} />
                  {reportContentKindLabel(kind)}
                </span>
              );
            },
            exportValue: (r) => reportContentKindLabel(reportContentKind(r)),
          },
          {
            key: 'content',
            header: 'Contenu',
            tdClassName: 'workspace-report-content-cell',
            render: (r) => {
              const preview = reportContentPreview(r);
              const kind = reportContentKind(r);
              return (
                <span className="report-list-content" title={preview}>
                  <ReportKindIcon kind={kind} />
                  <span className="workspace-report-content-preview">{preview}</span>
                </span>
              );
            },
            exportValue: (r) => reportContentPreview(r, 500),
          },
        ]}
      />

      <ReportPreviewSheet
        document={previewDoc}
        open={!!previewDoc}
        onOpenChange={(next) => !next && setPreviewDoc(null)}
        canManage={canEdit && tab === 'active' && !previewDoc?.archived}
        onEdit={canEdit ? openEdit : undefined}
      />

      <AdminConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille ?'
            : confirmAction?.type === 'delete'
              ? 'Supprimer définitivement ?'
              : 'Mettre dans la corbeille ?'
        }
        message={
          confirmAction?.type === 'emptyTrash' ? (
            <>Tous les comptes rendus de la corbeille seront supprimés définitivement.</>
          ) : confirmAction?.type === 'delete' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.document.title}</span>{' '}
              sera supprimé définitivement.
            </>
          ) : confirmAction?.type === 'archive' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.document.title}</span>{' '}
              sera déplacé dans la corbeille.
            </>
          ) : null
        }
        confirmLabel={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille'
            : confirmAction?.type === 'delete'
              ? 'Supprimer'
              : 'Mettre à la corbeille'
        }
        intent={confirmAction?.type === 'archive' ? 'archive' : 'destructive'}
        loading={actionLoading}
        onConfirm={() => void confirmActionHandler()}
      />

      <WorkspaceCrudDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setTitleServerError(false);
            setEditId(null);
          }
          setOpen(next);
        }}
        className={
          editId
            ? 'workspace-crud-dialog--wide mail-edit-dialog'
            : 'workspace-crud-dialog--wide'
        }
        description={editId ? 'Modifier le compte rendu' : 'Nouveau compte rendu'}
        title={
          editId ? (
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <Pencil className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Modification</span>
                <span className="mail-edit-dialog-heading">Compte rendu</span>
              </span>
            </span>
          ) : (
            'Nouveau compte rendu'
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
              {saving ? 'Enregistrement…' : editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </>
        }
      >
        <div className={editId ? 'workspace-crud-form-grid mail-edit-form' : 'workspace-crud-form-grid'}>
          <WorkspaceCrudField id="report-title" label="Titre *" className="workspace-crud-span-2">
            <Input
              id="report-title"
              value={form.title}
              onChange={(e) => {
                setTitleServerError(false);
                setForm((f) => ({ ...f, title: e.target.value }));
              }}
              className={inlineFieldErrorClass(titleDuplicate, 'admin-field')}
              placeholder="Intitulé du compte rendu"
              aria-invalid={titleDuplicate || undefined}
              aria-describedby={titleErrorMessage ? 'report-title-error' : undefined}
            />
            <InlineFieldError id="report-title-error" message={titleErrorMessage} />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="report-date" label="Date *" className="workspace-crud-span-2">
            <WorkspaceCompactDateField
              id="report-date"
              value={form.reportDate}
              onChange={(reportDate) => setForm((f) => ({ ...f, reportDate }))}
            />
          </WorkspaceCrudField>

          <div className="workspace-crud-span-2">
            <div className="report-form-mode-tabs" role="tablist" aria-label="Mode compte rendu">
              <button
                type="button"
                role="tab"
                aria-selected={form.mode === 'write'}
                className="report-form-mode-tab"
                data-active={form.mode === 'write' ? 'true' : undefined}
                onClick={() => setForm((f) => ({ ...f, mode: 'write' }))}
              >
                <PenLine className="h-3 w-3" aria-hidden />
                Rédiger
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={form.mode === 'upload'}
                className="report-form-mode-tab"
                data-active={form.mode === 'upload' ? 'true' : undefined}
                onClick={() => setForm((f) => ({ ...f, mode: 'upload' }))}
              >
                <Upload className="h-3 w-3" aria-hidden />
                Fichier
              </button>
            </div>
          </div>

          {form.mode === 'write' ? (
            <WorkspaceCrudField
              id="report-body"
              label="Contenu *"
              className="workspace-crud-span-2"
            >
              <ReportRichTextEditor
                key={editId ?? 'new'}
                ref={editorRef}
                value={form.bodyHtml}
                onChange={(bodyHtml) => setForm((f) => ({ ...f, bodyHtml }))}
                disabled={!(editId ? canEdit : canCreate)}
              />
            </WorkspaceCrudField>
          ) : (
            <WorkspaceCrudField id="report-file" label="Fichier *" className="workspace-crud-span-2">
              <ReportFileField
                value={form.file}
                onChange={(file) => setForm((f) => ({ ...f, file }))}
                disabled={!(editId ? canEdit : canCreate)}
              />
            </WorkspaceCrudField>
          )}

          {editId && form.mode === 'write' && hasReportWrittenContent(form.bodyHtml) ? (
            <div className={cn('workspace-crud-span-2', 'report-rich-preview-note')}>
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Le contenu saisi remplace tout fichier joint précédent.</span>
            </div>
          ) : null}

          {!canSave && trimmedTitle.length >= 2 && form.reportDate && !titleDuplicate ? (
            <p className="workspace-crud-span-2 workspace-crud-field-hint">
              {form.mode === 'write'
                ? 'Ajoutez du contenu dans l’éditeur pour activer l’enregistrement.'
                : 'Joignez un fichier pour activer l’enregistrement.'}
            </p>
          ) : null}
        </div>
      </WorkspaceCrudDialog>
    </>
  );
}
