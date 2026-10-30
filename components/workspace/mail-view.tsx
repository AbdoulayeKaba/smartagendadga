'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, EyeOff, Loader2, MailPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { useTemporalQueryParams, useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { ExportFormatMenuContent } from '@/components/ui/export-format-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MailDetailSheet } from '@/components/workspace/mail-detail-sheet';
import '@/components/workspace/mail-enregistrement.css';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import {
  MailFormFields,
  emptyMailForm,
  formToMailPayload,
  mailCreateButtonLabel,
  mailCreateDialogTitle,
  mailToForm,
} from '@/components/workspace/mail-form-fields';
import { WorkspaceCrudDialog } from '@/components/workspace/workspace-crud-dialog';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import { WorkspaceTrashRowActions } from '@/components/workspace/workspace-trash-row-actions';
import {
  downloadMailExcel,
  printMailPdf,
} from '@/lib/workspace/mail-export-utils';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { MAIL_STATUS_LABELS, MAIL_VIEW_LABELS } from '@/lib/workspace/labels';
import { MailAssignDialog, type MailAssignmentPayload } from '@/components/workspace/mail-assign-dialog';
import { MailChartsPanel } from '@/components/workspace/mail-charts-panel';
import { computeMailAnalytics } from '@/lib/workspace/mail-analytics';
import {
  filterMailItems,
  formatMailDate,
  mailStatusesForView,
  type MailQuickFilter,
} from '@/lib/workspace/mail-utils';
import type { MailItem, MailViewMode } from '@/lib/workspace/types';

const API = '/api/workspace/mail';

type MailListTab = 'active' | 'trash';

type MailConfirmAction =
  | { type: 'archive'; mail: MailItem }
  | { type: 'delete'; mail: MailItem }
  | { type: 'emptyTrash' };

const CHARTS_VISIBILITY_KEY = 'workspace.mail.charts.panel.visible';
/** Module verrouillé sur les courriers départ (sortants). */
const VIEW_MODE: MailViewMode = 'depart';

function readChartsVisible(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(CHARTS_VISIBILITY_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

export function MailView() {
  const temporalParams = useTemporalQueryParams();
  const { year } = useTemporalNavigation();
  const viewMode = VIEW_MODE;
  const direction = 'OUTGOING' as const;
  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter] = useState<MailQuickFilter>('ALL');
  const [detailMail, setDetailMail] = useState<MailItem | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loadingMailId, setLoadingMailId] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusAdvanceError, setStatusAdvanceError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [assignMail, setAssignMail] = useState<MailItem | null>(null);
  const [listTab, setListTab] = useState<MailListTab>('active');
  const [counts, setCounts] = useState({ active: 0, trash: 0 });
  const [confirmAction, setConfirmAction] = useState<MailConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    setChartsVisible(readChartsVisible());
  }, []);

  const toggleChartsVisible = () => {
    setChartsVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CHARTS_VISIBILITY_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const role = useDgRole();
  const canManage = canManageWorkspace(role);
  const { refresh, reload, create, patch } = useWorkspaceCrud(API);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formViewMode] = useState<MailViewMode>(VIEW_MODE);
  const [formDirection] = useState<'OUTGOING'>('OUTGOING');
  const [form, setForm] = useState(emptyMailForm('OUTGOING'));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        archived: listTab === 'trash' ? 'true' : 'false',
        ...temporalParams,
      });
      if (direction) params.set('direction', direction);
      const res = await fetch(`${API}?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const code = json.error ?? `HTTP_${res.status}`;
        setLoadError(
          code === 'UNAUTHORIZED'
            ? 'Session expirée — reconnectez-vous.'
            : code === 'FORBIDDEN'
              ? 'Accès refusé à la liste des courriers.'
              : 'Impossible de charger les courriers.'
        );
        setItems([]);
        return;
      }
      const json = (await res.json()) as {
        items: MailItem[];
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
      setExportedAt(
        new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date())
      );
    } catch {
      setLoadError('Erreur réseau lors du chargement des courriers.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [direction, listTab, refresh, temporalParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDetailMail((current) => {
      if (!current) return null;
      return items.find((i) => i.id === current.id) ?? null;
    });
  }, [items]);

  const mailRequest = async (
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
    if (options?.successTitle) {
      toast({ variant: 'warning', title: options.successTitle });
    }
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
      { successTitle: 'Courrier déplacé dans la corbeille' }
    );

  const restoreMail = (mail: MailItem) =>
    mailRequest(
      `${API}/${mail.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      },
      { successTitle: 'Courrier restauré' }
    );

  const deleteMailPermanent = (mail: MailItem) =>
    mailRequest(`${API}/${mail.id}`, { method: 'DELETE' }, {
      successTitle: 'Courrier supprimé définitivement',
    });

  const emptyTrash = () => {
    const params = new URLSearchParams({ ...temporalParams });
    if (direction) params.set('direction', direction);
    return mailRequest(`${API}/trash?${params.toString()}`, { method: 'POST' }, {
      successTitle: 'Corbeille vidée',
    });
  };

  const confirmActionHandler = async () => {
    if (!confirmAction || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'archive') {
        ok = await archiveMail(confirmAction.mail);
      } else if (confirmAction.type === 'delete') {
        ok = await deleteMailPermanent(confirmAction.mail);
      } else if (confirmAction.type === 'emptyTrash') {
        ok = await emptyTrash();
      }
      if (ok) {
        if (
          (confirmAction.type === 'archive' || confirmAction.type === 'delete') &&
          detailMail?.id === confirmAction.mail.id
        ) {
          setDetailMail(null);
        }
        setConfirmAction(null);
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const filteredItems = useMemo(
    () =>
      filterMailItems(items, {
        query: search,
        status: statusFilter,
        priority: 'ALL',
        quickFilter,
      }),
    [items, search, statusFilter, quickFilter]
  );
  const analytics = useMemo(() => computeMailAnalytics(items, year), [items, year]);
  const mailById = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);
  const canSave =
    Boolean(form.reference && form.counterpart && form.subject) &&
    !form.attachments.some((a) => a.uploading);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyMailForm('OUTGOING'));
    setOpen(true);
  };

  const openEdit = (row: MailItem) => {
    setEditId(row.id);
    setForm(mailToForm(row));
    setOpen(true);
  };

  const save = async () => {
    const payload = formToMailPayload(form, formDirection, editId, formViewMode);
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  const changeStatus = async (
    mailId: string,
    status: MailItem['workflowStatus'],
    advancePatch: Record<string, unknown> = {}
  ) => {
    if (status === 'ASSIGNED') {
      const service =
        typeof advancePatch.assignedService === 'string' ? advancePatch.assignedService.trim() : '';
      const executor =
        typeof advancePatch.executor === 'string' ? advancePatch.executor.trim() : '';
      if (!service && !executor) {
        const target = mailById.get(mailId) ?? items.find((m) => m.id === mailId) ?? null;
        if (target) {
          setAssignMail(target);
          return;
        }
      }
    }

    setStatusLoading(true);
    setLoadingMailId(mailId);
    setStatusAdvanceError(null);
    try {
      const result = await fetchJson<{ mail: MailItem }>(`${API}/${mailId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowStatus: status, ...advancePatch }),
      });

      if (!result.ok || !result.data.mail) {
        setStatusAdvanceError(
          result.error === 'FORBIDDEN'
            ? 'Action non autorisée pour votre profil.'
            : result.error === 'VALIDATION_ERROR'
              ? 'Transition de statut refusée.'
              : result.error === 'UNAUTHORIZED'
                ? 'Session expirée — reconnectez-vous.'
                : 'Impossible de mettre à jour le statut du courrier.'
        );
        return;
      }

      const updated = result.data.mail;
      setItems((prev) => prev.map((m) => (m.id === mailId ? updated : m)));
      setDetailMail((current) => (current?.id === mailId ? updated : current));
    } catch {
      setStatusAdvanceError('Erreur réseau lors de la mise à jour du statut.');
    } finally {
      setStatusLoading(false);
      setLoadingMailId(null);
    }
  };

  const confirmMailAssignment = async (payload: MailAssignmentPayload) => {
    if (!assignMail) return;
    const mailId = assignMail.id;
    setAssignMail(null);
    await changeStatus(mailId, 'ASSIGNED', {
      assignedService: payload.assignedService,
      executor: payload.executor,
      assignedAt: payload.assignedAt,
    });
  };

  const openMailDetail = (mailId: string) => {
    const mail = mailById.get(mailId);
    if (mail) setDetailMail(mail);
  };

  const handleExportExcel = async () => {
    if (!filteredItems.length || exportBusy) return;
    setExportBusy(true);
    try {
      await downloadMailExcel(filteredItems, viewMode);
      toast({
        variant: 'success',
        title: 'Export Excel généré',
        description: `${filteredItems.length} courrier${filteredItems.length > 1 ? 's' : ''} exporté${filteredItems.length > 1 ? 's' : ''}.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export impossible',
        description: 'La génération du fichier Excel a échoué.',
      });
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPdf = () => {
    if (!filteredItems.length) return;
    printMailPdf(filteredItems, viewMode);
  };

  const renderStatus = (row: MailItem) => (
    <span className="mail-status-cell">
      <span className="mail-status-badge" data-status={row.workflowStatus}>
        {MAIL_STATUS_LABELS[row.workflowStatus]}
      </span>
    </span>
  );

  const renderTableHead = () => {
    const trashCol =
      listTab === 'trash' ? <th>Mise en corbeille</th> : null;
    return (
      <tr>
        <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
        <th>Date du courrier</th>
        <th>Objet</th>
        <th>Destinataire</th>
        <th>Statut</th>
        <th>Niveau exécution</th>
        <th>Date envoi SC</th>
        <th>Coursier</th>
        {trashCol}
        {canManage ? <th className="workspace-module-th-actions">Actions</th> : null}
      </tr>
    );
  };

  const colSpan = 8 + (listTab === 'trash' ? 1 : 0);
  const actionCol = canManage ? 1 : 0;

  const renderRowActions = (row: MailItem) =>
    canManage ? (
      <td className="workspace-module-td-actions" onClick={(e) => e.stopPropagation()}>
        <WorkspaceTrashRowActions
          variant={listTab === 'trash' ? 'trash' : 'active'}
          onEdit={listTab === 'active' ? () => openEdit(row) : undefined}
          onArchive={
            listTab === 'active' ? () => setConfirmAction({ type: 'archive', mail: row }) : undefined
          }
          onRestore={listTab === 'trash' ? () => void restoreMail(row) : undefined}
          onDeletePermanent={
            listTab === 'trash' ? () => setConfirmAction({ type: 'delete', mail: row }) : undefined
          }
        />
      </td>
    ) : null;

  const renderArchivedAtCell = (row: MailItem) =>
    listTab === 'trash' ? <td>{formatMailDate(row.archivedAt)}</td> : null;

  const renderTableRow = (row: MailItem, index: number) => {
    const actions = renderRowActions(row);
    return (
      <tr
        key={row.id}
        className="mail-table-row"
        data-selected={detailMail?.id === row.id ? 'true' : undefined}
        onClick={() => setDetailMail(row)}
      >
        <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
        <td>{formatMailDate(row.mailDate)}</td>
        <td>
          <span className="mail-subject-cell">{row.subject}</span>
        </td>
        <td>{row.counterpart}</td>
        <td>{renderStatus(row)}</td>
        <td>{row.action ?? '—'}</td>
        <td>{formatMailDate(row.scSentAt)}</td>
        <td>{row.courierName ?? '—'}</td>
        {renderArchivedAtCell(row)}
        {actions}
      </tr>
    );
  };

  return (
    <div className="workspace-module-list mail-view">
      <div className="workspace-module-header">
        <AdminPageHeader
          variant="flat"
          eyebrow="Espace de travail"
          title="Courriers départ"
          description="Suivi des courriers sortants : destinataires, envoi SC et coursiers."
          actions={
            <div className="admin-appt-header-actions">
              {!loading && items.length > 0 ? (
                <button
                  type="button"
                  className="admin-appt-filter-btn admin-appt-header-btn"
                  onClick={toggleChartsVisible}
                  aria-pressed={chartsVisible}
                  aria-label={chartsVisible ? 'Masquer les graphiques' : 'Afficher les graphiques'}
                  title={chartsVisible ? 'Masquer les graphiques' : 'Afficher les graphiques'}
                >
                  {chartsVisible ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {chartsVisible ? 'Masquer' : 'Afficher'}
                </button>
              ) : null}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="admin-appt-filter-btn admin-appt-header-btn"
                    disabled={!filteredItems.length || exportBusy}
                    aria-label="Exporter la liste des courriers"
                    title="Exporter la liste des courriers"
                  >
                    {exportBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Exporter
                  </button>
                </PopoverTrigger>
                <ExportFormatMenuContent
                  count={filteredItems.length}
                  summary={
                    <>
                      courrier{filteredItems.length > 1 ? 's' : ''} · {MAIL_VIEW_LABELS[viewMode]}
                    </>
                  }
                  busy={exportBusy}
                  onExcel={() => void handleExportExcel()}
                  onPdf={handleExportPdf}
                />
              </Popover>
              {canManage && listTab === 'active' ? (
                <button
                  type="button"
                  className="admin-appt-header-btn admin-appt-header-btn--primary"
                  onClick={openCreate}
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  {mailCreateButtonLabel(viewMode)}
                </button>
              ) : null}
            </div>
          }
        />
      </div>

      {loadError ? (
        <div className="mail-load-error" role="alert">
          {loadError}
        </div>
      ) : null}

      {statusAdvanceError ? (
        <div className="mail-load-error" role="alert">
          {statusAdvanceError}
        </div>
      ) : null}

      <section
        className={cn(
          'admin-appt-toolbar workspace-module-toolbar mail-toolbar',
          listTab === 'trash' && 'admin-trash-toolbar'
        )}
      >
        <div className="mail-toolbar-row mail-toolbar-row--search">
          {listTab === 'trash' ? (
            <AdminTrashBanner
              count={counts.trash}
              emptyHint="Aucun élément — espace prêt pour les courriers archivés"
              filledHint={`${counts.trash} courrier${counts.trash > 1 ? 's' : ''} — restaurables avant suppression définitive`}
            />
          ) : null}
          <div className="admin-appt-search mail-toolbar-search">
            <Search className="admin-appt-search-icon" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                listTab === 'trash'
                  ? 'Rechercher dans la corbeille…'
                  : 'Référence, destinataire, objet…'
              }
              className="admin-appt-search-input mail-search-input"
            />
          </div>
          {listTab === 'active' ? (
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="mail-status-filter admin-field">
                <SelectValue placeholder="Tous statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous statuts</SelectItem>
                {mailStatusesForView(viewMode).map((s) => (
                  <SelectItem key={s} value={s}>
                    {MAIL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="workspace-contacts-toolbar-end">
            <AdminTrashScopeTabs
              value={listTab}
              onChange={setListTab}
              activeCount={counts.active}
              trashCount={counts.trash}
            />
            {listTab === 'trash' && counts.trash > 0 && canManage ? (
              <AdminEmptyTrashButton
                label="Vider"
                onClick={() => setConfirmAction({ type: 'emptyTrash' })}
              />
            ) : null}
          </div>
        </div>
      </section>

      {!loading && listTab === 'active' && items.length > 0 ? (
        <>
          <MailChartsPanel
            analytics={analytics}
            year={year}
            visible={chartsVisible}
            onToggleVisible={toggleChartsVisible}
            direction={direction}
          />
        </>
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
        ) : filteredItems.length === 0 && listTab === 'trash' && !search.trim() ? (
          <AdminTrashEmptyState
            description="Les courriers mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
            onBackToActive={() => setListTab('active')}
          />
        ) : (
          <table className="admin-appt-table workspace-module-table mail-table w-full min-w-[860px]">
            <thead>{renderTableHead()}</thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan + actionCol} className="workspace-module-empty">
                    {listTab === 'trash'
                      ? 'Aucun courrier dans la corbeille.'
                      : 'Aucun courrier trouvé.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((row, index) => renderTableRow(row, index))
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="workspace-module-footer" suppressHydrationWarning>
        {filteredItems.length} élément{filteredItems.length > 1 ? 's' : ''}
        {exportedAt ? ` — mis à jour le ${exportedAt}` : ''}
      </p>

      <MailDetailSheet
        mail={detailMail}
        open={!!detailMail}
        onOpenChange={(o) => !o && setDetailMail(null)}
        canManage={canManage && listTab === 'active'}
        onEdit={openEdit}
        onStatusChange={changeStatus}
        statusLoading={statusLoading}
        loadingMailId={loadingMailId}
        statusAdvanceError={statusAdvanceError}
      />

      <MailAssignDialog
        mail={assignMail}
        open={!!assignMail}
        loading={statusLoading && !!assignMail && loadingMailId === assignMail.id}
        onOpenChange={(o) => {
          if (!o) setAssignMail(null);
        }}
        onConfirm={(payload) => void confirmMailAssignment(payload)}
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
            <>Tous les courriers archivés de cette vue seront supprimés définitivement.</>
          ) : confirmAction?.type === 'delete' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.mail.reference}</span>{' '}
              sera supprimé définitivement.
            </>
          ) : confirmAction?.type === 'archive' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.mail.reference}</span>{' '}
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

      <WorkspaceCrudDialog
        open={open}
        onOpenChange={setOpen}
        className={
          editId
            ? 'workspace-crud-dialog--mail mail-edit-dialog'
            : 'workspace-crud-dialog--mail mail-edit-dialog mail-edit-dialog--green'
        }
        description={mailCreateDialogTitle(formViewMode, editId)}
        title={
          editId ? (
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <Pencil className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Modification</span>
                <span className="mail-edit-dialog-heading">Courrier départ</span>
              </span>
            </span>
          ) : (
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <MailPlus className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Création</span>
                <span className="mail-edit-dialog-heading">Courrier départ</span>
              </span>
            </span>
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
              className="mail-edit-dialog-submit"
              disabled={!canSave}
            >
              {editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="mail-edit-form">
          <MailFormFields
            viewMode={formViewMode}
            direction={formDirection}
            editId={editId}
            form={form}
            setForm={setForm}
            canManage={canManage}
            existingMails={items}
          />
        </div>
      </WorkspaceCrudDialog>
    </div>
  );
}
