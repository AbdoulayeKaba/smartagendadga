'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Hotel, Trash2 } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import {
  AdminEmptyTrashButton,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { toast } from '@/hooks/use-toast';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { WorkspaceTrashRowActions } from '@/components/workspace/workspace-trash-row-actions';
import { InlineFieldError, inlineFieldErrorClass } from '@/components/ui/inline-field-error';
import { Checkbox } from '@/components/ui/checkbox';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CountryMultiSelect } from '@/components/workspace/country-multi-select';
import { MissionTypeSelect } from '@/components/workspace/mission-type-select';
import { MissionCancelDialog } from '@/components/workspace/mission-cancel-dialog';
import {
  MissionExtendDialog,
  type MissionAdjustReturnMode,
} from '@/components/workspace/mission-extend-dialog';
import { MissionReopenDialog } from '@/components/workspace/mission-reopen-dialog';
import { MissionOperationalBadge } from '@/components/workspace/mission-operational-badge';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { MissionDetailSheet } from '@/components/workspace/mission-detail-sheet';
import { MissionOngoingArchiveAlert } from '@/components/workspace/mission-ongoing-archive-alert';
import { MissionHotelReservationsDialog } from '@/components/workspace/mission-hotel-reservations-dialog';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import { LIVE_TOPICS, emitLiveRefresh } from '@/lib/dg/live-refresh';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { useApp } from '@/lib/app-context';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { MissionVisualBadge } from '@/lib/workspace/mission-status-ui';
import { MissionAlertsBanner } from '@/components/workspace/mission-alerts-banner';
import { MissionFiltersBar } from '@/components/workspace/mission-filters-bar';
import { MissionImportDialog } from '@/components/workspace/mission-import-dialog';
import { MissionDocumentsField } from '@/components/workspace/mission-documents-field';
import {
  createMissionDraftOwnerId,
  type MissionDocumentDraft,
} from '@/lib/workspace/mission-document-form-state';
import {
  canArchiveMission,
  canEditMissionFields,
  canEditMissionObservations,
  MISSION_STATUS_ERROR_LABELS,
  type MissionCancelReason,
} from '@/lib/workspace/mission-status-workflow';
import {
  MISSION_VISUAL_LABELS,
  missionVisualRowClassName,
  resolveMissionVisualState,
} from '@/lib/workspace/mission-visual-state';
import { parseLegacyDestination } from '@/lib/workspace/mission-countries';
import { missionDurationDays, missionDurationLabel } from '@/lib/workspace/mission-duration';
import { findMissionDuplicate, missionDuplicateMessage } from '@/lib/workspace/mission-duplicate';
import {
  collectMissionFilterOptions,
  EMPTY_MISSION_FILTERS,
  matchesMissionFilters,
  matchesMissionSearch,
  type MissionListFilters,
} from '@/lib/workspace/mission-filters';
import {
  canManageMissionHotel,
  isMissionHotelLocked,
  missionHotelColumnLabel,
} from '@/lib/workspace/mission-hotel-status';
import {
  MISSION_TYPE_OTHER_VALUE,
  resolveMissionType,
  splitMissionType,
} from '@/lib/workspace/mission-types';
import {
  downloadMissionsExcel,
  printMissionsPdf,
} from '@/lib/workspace/missions-export-utils';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { isMissionImportedFromExcel } from '@/lib/workspace/mission-import-meta';
import { cn } from '@/lib/utils';
import type { DgMission, DgMissionDocument, DgMissionHistoryEntry } from '@/lib/workspace/types';

const API = '/api/workspace/missions';

type MissionTab = 'active' | 'trash';

function formatMissionDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

type FormState = {
  subject: string;
  missionTypeSelect: string;
  missionTypeOther: string;
  destinations: string[];
  details: string;
  departAt: string;
  returnAt: string;
  hasParticipants: boolean;
  participants: string;
};

function missionDestinations(row: DgMission): string[] {
  if (Array.isArray(row.destinations) && row.destinations.length > 0) {
    return row.destinations;
  }
  return parseLegacyDestination(row.destination);
}

function toForm(row: DgMission): FormState {
  const { select, other } = splitMissionType(row.missionType);
  const participantsText = row.participants?.trim() ?? '';
  return {
    subject: row.subject,
    missionTypeSelect: select,
    missionTypeOther: other,
    destinations: missionDestinations(row),
    details: row.details ?? '',
    departAt: row.departAt.slice(0, 10),
    returnAt: row.returnAt.slice(0, 10),
    hasParticipants: participantsText.length > 0,
    participants: participantsText,
  };
}

const emptyForm = (): FormState => ({
  subject: '',
  missionTypeSelect: '',
  missionTypeOther: '',
  destinations: [],
  details: '',
  departAt: new Date().toISOString().slice(0, 10),
  returnAt: new Date().toISOString().slice(0, 10),
  hasParticipants: false,
  participants: '',
});

function resolvedType(form: FormState): string {
  return resolveMissionType(form.missionTypeSelect, form.missionTypeOther);
}

export function MissionsView() {
  const role = useDgRole();
  const { permissions } = useApp();
  const canManageRole = canManageWorkspace(role);
  const canCreate = permissions['action.missions.create'] === true;
  const canEdit = permissions['action.missions.edit'] === true;
  const canArchivePerm = permissions['action.missions.archive'] === true;
  const canRestore = permissions['action.missions.restore'] === true;
  const canDelete = permissions['action.missions.delete'] === true;
  const canImport = permissions['action.missions.import'] === true;
  const canHotel = permissions['action.missions.hotel'] === true;
  const hasRowActions = canEdit || canArchivePerm || canRestore || canDelete;
  const canManage =
    canManageRole ||
    canCreate ||
    canEdit ||
    canArchivePerm ||
    canRestore ||
    canDelete ||
    canImport ||
    canHotel;
  const { refresh, reload } = useWorkspaceCrud(API);
  const [tab, setTab] = useState<MissionTab>('active');
  const [counts, setCounts] = useState({ active: 0, trash: 0 });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editingMission, setEditingMission] = useState<DgMission | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [hotelMission, setHotelMission] = useState<DgMission | null>(null);
  const [hotelOpen, setHotelOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'archive'; mission: DgMission }
    | { type: 'delete'; mission: DgMission }
    | { type: 'emptyTrash' }
    | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlightRef = useRef(false);
  const [detailMission, setDetailMission] = useState<DgMission | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [missionHistory, setMissionHistory] = useState<DgMissionHistoryEntry[]>([]);
  const [cancelMission, setCancelMission] = useState<DgMission | null>(null);
  const [listedMissions, setListedMissions] = useState<DgMission[]>([]);
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MissionDocumentDraft[]>([]);
  const [ongoingArchiveAlertOpen, setOngoingArchiveAlertOpen] = useState(false);
  const [adjustReturn, setAdjustReturn] = useState<{
    mission: DgMission;
    mode: MissionAdjustReturnMode;
  } | null>(null);
  const [reopenMission, setReopenMission] = useState<DgMission | null>(null);
  const [listFilters, setListFilters] = useState<MissionListFilters>(EMPTY_MISSION_FILTERS);
  const [allLoadedMissions, setAllLoadedMissions] = useState<DgMission[]>([]);
  const [subjectIndex, setSubjectIndex] = useState<DgMission[]>([]);
  const [subjectServerError, setSubjectServerError] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${API}?archived=false`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { items?: DgMission[] } | null) => {
        if (!cancelled && json?.items) setSubjectIndex(json.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, refresh]);

  const handleMeta = useCallback((meta: { counts?: { active: number; trash: number } }) => {
    if (!meta.counts) return;
    setCounts((prev) =>
      prev.active === meta.counts!.active && prev.trash === meta.counts!.trash ? prev : meta.counts!
    );
  }, []);

  const { year } = useTemporalNavigation();
  const queryParams = useMemo(
    () => ({ archived: tab === 'trash' ? 'true' : 'false', year: String(year) }),
    [tab, year]
  );

  const filterOptions = useMemo(
    () => collectMissionFilterOptions(allLoadedMissions),
    [allLoadedMissions]
  );

  const filterRow = useCallback(
    (mission: DgMission) => matchesMissionFilters(mission, listFilters),
    [listFilters]
  );

  const clientSearch = useCallback(
    (mission: DgMission, query: string) => matchesMissionSearch(mission, query),
    []
  );

  useEffect(() => {
    setListFilters(EMPTY_MISSION_FILTERS);
  }, [tab]);

  const destinationCodes = Array.isArray(form.destinations) ? form.destinations : [];
  const typeSelect = form.missionTypeSelect?.trim() ?? '';
  const typeValid =
    typeSelect.length > 0 &&
    (typeSelect !== MISSION_TYPE_OTHER_VALUE || form.missionTypeOther.trim().length >= 2);

  const participantsValid =
    !form.hasParticipants || form.participants.trim().length >= 2;

  const subjectValid = form.subject.trim().length >= 3;
  const datesValid =
    form.departAt.length > 0 &&
    form.returnAt.length > 0 &&
    form.returnAt >= form.departAt;

  const documentsValid =
    !documents.some((d) => d.uploading) &&
    !documents.some((d) => d.uploadError) &&
    documents.every((d) => d.storageKey || d.id);

  const fieldsLocked =
    editingMission !== null && !canEditMissionFields(editingMission, role);

  const trimmedSubject = form.subject.trim();
  const subjectConflict = useMemo(() => {
    if (fieldsLocked || trimmedSubject.length < 3) return undefined;
    return findMissionDuplicate({ subject: trimmedSubject }, subjectIndex, {
      excludeId: editId ?? undefined,
    });
  }, [fieldsLocked, trimmedSubject, subjectIndex, editId]);

  const subjectDuplicate = !fieldsLocked && (Boolean(subjectConflict) || subjectServerError);
  const subjectErrorMessage = subjectConflict
    ? missionDuplicateMessage(subjectConflict)
    : subjectServerError
      ? 'Une mission avec le même objet existe déjà.'
      : null;

  const canSave = fieldsLocked
    ? documentsValid
    : subjectValid &&
    !subjectDuplicate &&
    typeValid &&
    destinationCodes.length > 0 &&
    datesValid &&
      participantsValid &&
      documentsValid;

  const documentsPayload = () =>
    documents
      .filter((d) => (d.storageKey || d.id) && !d.uploading && !d.uploadError)
      .map((d) => ({
        ...(d.id ? { id: d.id } : {}),
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        storageKey: d.storageKey,
      }));

  const openCreateDialog = () => {
    setEditId(null);
    setEditingMission(null);
    setForm(emptyForm());
    setSubjectServerError(false);
    setDraftOwnerId(createMissionDraftOwnerId());
    setDocuments([]);
    setOpen(true);
  };

  const openEditDialog = async (mission: DgMission) => {
    setEditId(mission.id);
    setEditingMission(mission);
    setForm(toForm(mission));
    setSubjectServerError(false);
    setDraftOwnerId(mission.id);
    setDocuments([]);
    setOpen(true);
    try {
      const res = await fetch(`${API}/${mission.id}/documents`);
      if (res.ok) {
        const json = (await res.json()) as { items: DgMissionDocument[] };
        setDocuments(
          (json.items ?? []).map((d) => ({
            key: d.id,
            id: d.id,
            fileName: d.fileName,
            fileSize: d.fileSize,
            mimeType: d.mimeType,
            storageKey: d.storageKey,
          }))
        );
      }
    } catch {
      /* liste documents optionnelle */
    }
  };

  const missionErrorMessage = (error: string) => {
    if (error === 'TIMEOUT' || error === 'NETWORK') {
      return 'Le serveur ne répond pas. Rechargez la page (F5), puis réessayez.';
    }
    if (MISSION_STATUS_ERROR_LABELS[error]) return MISSION_STATUS_ERROR_LABELS[error];
    if (error === 'FORBIDDEN') return 'Vous n’avez pas les droits pour cette action.';
    if (error === 'VALIDATION_ERROR') return 'Données invalides.';
    if (error === 'NOT_FOUND') return 'Mission introuvable.';
    if (error === 'SERVER_ERROR' || error === '500') {
      return 'Erreur serveur. Redémarrez le serveur (npm run dev) puis réessayez.';
    }
    return error || 'Échec de l’opération.';
  };

  useEffect(() => {
    if (!detailMission?.id || !detailOpen) {
      setMissionHistory([]);
      return;
    }
    void fetchJson<{ items: DgMissionHistoryEntry[] }>(`${API}/${detailMission.id}/history`).then(
      (res) => {
        if (res.ok) setMissionHistory(res.data.items ?? []);
      }
    );
  }, [detailMission?.id, detailOpen, refresh]);

  const adjustReturnRequest = async (
    missionId: string,
    mode: MissionAdjustReturnMode,
    payload: { returnAt: string; reason: string; comment: string }
  ) => {
    setStatusLoading(true);
    try {
      const result = await fetchJson<{ mission: DgMission }>(`${API}/${missionId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: mode === 'extend' ? 'Prolongation impossible' : 'Écourcissement impossible',
          description: missionErrorMessage(result.error),
        });
        return false;
      }
      toast({
        title: mode === 'extend' ? 'Mission prolongée' : 'Mission écourtée',
      });
      setDetailMission((prev) => (prev?.id === missionId ? result.data.mission : prev));
      reload();
      return true;
    } finally {
      setStatusLoading(false);
    }
  };

  const runStatusAction = async (missionId: string, body: Record<string, unknown>) => {
    setStatusLoading(true);
    try {
      const result = await fetchJson<{ mission: DgMission }>(`${API}/${missionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Action impossible',
          description: missionErrorMessage(result.error),
        });
        return false;
      }
      toast({
        title:
          body.action === 'start'
            ? 'Mission démarrée'
            : body.action === 'reopen'
              ? 'Mission rouverte'
              : 'Mission annulée',
      });
      setDetailMission((prev) =>
        prev?.id === missionId ? result.data.mission : prev
      );
      reload();
      return true;
    } finally {
      setStatusLoading(false);
    }
  };

  const missionRequest = async (
    path: string,
    init: RequestInit,
    options?: { successTitle?: string; onDuplicate?: () => void }
  ): Promise<boolean> => {
    const result = await fetchJson(path, init);
    if (!result.ok) {
      if (result.error === 'MISSION_DUPLICATE') {
        options?.onDuplicate?.();
        return false;
      }
      toast({
        variant: 'destructive',
        title: 'Action impossible',
        description: missionErrorMessage(result.error),
      });
      return false;
    }
    if (options?.successTitle) toast({ title: options.successTitle });
    reload();
    emitLiveRefresh(LIVE_TOPICS.appointments);
    return true;
  };

  const requestArchiveMission = (mission: DgMission) => {
    if (!canArchiveMission(mission)) {
      setOngoingArchiveAlertOpen(true);
      return;
    }
    setConfirmAction({ type: 'archive', mission });
  };

  const archiveMission = (mission: DgMission) =>
    missionRequest(
      `${API}/${mission.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      },
      { successTitle: 'Mission déplacée dans la corbeille' }
    );

  const restoreMission = (mission: DgMission) =>
    missionRequest(
      `${API}/${mission.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      },
      { successTitle: 'Mission restaurée' }
    );

  const deleteMissionPermanent = (mission: DgMission) =>
    missionRequest(`${API}/${mission.id}`, { method: 'DELETE' }, {
      successTitle: 'Mission supprimée définitivement',
    });

  const emptyTrash = () =>
    missionRequest(`${API}/trash`, { method: 'POST' }, { successTitle: 'Corbeille vidée' });

  const confirmActionHandler = async () => {
    if (!confirmAction || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'archive') {
        ok = await archiveMission(confirmAction.mission);
      } else if (confirmAction.type === 'delete') {
        ok = await deleteMissionPermanent(confirmAction.mission);
      } else if (confirmAction.type === 'emptyTrash') {
        ok = await emptyTrash();
      }
      if (ok) {
        if (confirmAction.type === 'archive' || confirmAction.type === 'delete') {
          if (detailMission?.id === confirmAction.mission.id) {
            setDetailOpen(false);
            setDetailMission(null);
          }
        }
        setConfirmAction(null);
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const openDetail = useCallback((mission: DgMission) => {
    setDetailMission(mission);
    setDetailOpen(true);
  }, []);

  const save = async () => {
    const missionType = resolvedType(form);
    if (!missionType) return;

    const payload = {
      subject: form.subject.trim(),
      missionType,
      destinations: destinationCodes,
      details: form.details.trim() || null,
      departAt: new Date(form.departAt).toISOString(),
      returnAt: new Date(form.returnAt).toISOString(),
      participants: form.hasParticipants ? form.participants.trim() : '',
      documents: documentsPayload(),
    };

    if (!fieldsLocked && subjectConflict) return;

    const ok = editId
      ? await missionRequest(
          `${API}/${editId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              fieldsLocked ? { documents: payload.documents } : payload
            ),
          },
          {
            successTitle: fieldsLocked ? 'Documents enregistrés' : 'Mission mise à jour',
            onDuplicate: () => setSubjectServerError(true),
          }
        )
      : await missionRequest(
          API,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          {
            successTitle: 'Mission créée',
            onDuplicate: () => setSubjectServerError(true),
          }
        );
    if (ok) setOpen(false);
  };

  return (
    <>
      <WorkspaceModuleList<DgMission>
        refreshTrigger={refresh}
        title="Missions du DGA"
        description="Planification, calendrier des missions et documents associés."
        apiPath={API}
        queryParams={queryParams}
        exportFilename="missions-dg.csv"
        exportHandlers={{
          itemLabel: 'mission',
          onExportExcel: async (items) => {
            try {
              await downloadMissionsExcel(items);
              toast({
                variant: 'success',
                title: 'Export Excel généré',
                description: `${items.length} mission${items.length > 1 ? 's' : ''} exportée${items.length > 1 ? 's' : ''}.`,
              });
            } catch {
              toast({
                variant: 'destructive',
                title: 'Export impossible',
                description: 'La génération du fichier Excel a échoué.',
              });
            }
          },
          onExportPdf: (items) => printMissionsPdf(items),
        }}
        emptyLabel={tab === 'trash' ? 'Aucune mission dans la corbeille.' : 'Aucune mission active.'}
        isTrash={tab === 'trash'}
        emptyContent={
          tab === 'trash' ? (
            <AdminTrashEmptyState
              description="Les missions mises en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
              onBackToActive={() => setTab('active')}
              backLabel="Retour aux actives"
            />
          ) : undefined
        }
        onMeta={handleMeta}
        onRowClick={openDetail}
        selectedRowId={detailOpen ? detailMission?.id : null}
        onItems={(items) => {
          setAllLoadedMissions(items);
          if (tab === 'active') setListedMissions(items);
        }}
        clientSearch={clientSearch}
        filterRow={filterRow}
        filterBar={
          <MissionFiltersBar
            filters={listFilters}
            onChange={setListFilters}
            typeOptions={filterOptions.types}
            destinationOptions={filterOptions.destinations}
            showImport={canImport && tab === 'active'}
            onImportClick={() => setImportOpen(true)}
          />
        }
        searchPlaceholder="Rechercher…"
        rowClassName={
          tab === 'active'
            ? (row) => missionVisualRowClassName(resolveMissionVisualState(row))
            : undefined
        }
        eyebrow="Espace de travail"
        filters={
          <div className="workspace-missions-toolbar">
            {tab === 'active' ? (
              <MissionAlertsBanner
                missions={listedMissions}
                onStartMission={(m) => void runStatusAction(m.id, { action: 'start' })}
              />
            ) : null}
            <div className="workspace-missions-toolbar-actions">
              <AdminTrashScopeTabs
                value={tab}
                onChange={setTab}
                activeLabel="Actives"
                activeCount={counts.active}
                trashCount={counts.trash}
              />
              {tab === 'trash' && counts.trash > 0 && canDelete ? (
                <AdminEmptyTrashButton
                  onClick={() => setConfirmAction({ type: 'emptyTrash' })}
                />
              ) : null}
            </div>
          </div>
        }
        onCreateClick={
          canCreate && tab === 'active'
            ? openCreateDialog
            : undefined
        }
        createLabel="Nouvelle mission"
        rowActions={
          hasRowActions
            ? (row) => (
                <WorkspaceTrashRowActions
                  variant={tab}
                  onEdit={
                    tab === 'active' && canEdit
                      ? () => void openEditDialog(row)
                      : undefined
                  }
                  onArchive={
                    tab === 'active' && canArchivePerm
                      ? () => requestArchiveMission(row)
                      : undefined
                  }
                  archiveBlocked={!canArchiveMission(row)}
                  archiveTitle={
                    !canArchiveMission(row)
                      ? 'Mission en cours — archivage indisponible'
                      : 'Mettre dans la corbeille'
                  }
                  onRestore={
                    tab === 'trash' && canRestore
                      ? () => void restoreMission(row)
                      : undefined
                  }
                  onDeletePermanent={
                    tab === 'trash' && canDelete
                      ? () => setConfirmAction({ type: 'delete', mission: row })
                      : undefined
                  }
                />
              )
            : undefined
        }
        columns={[
          {
            key: 'subject',
            header: 'Objet',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>{r.subject}</span>
                {isMissionImportedFromExcel(r.details) ? (
                  <span
                    className="admin-appt-badge admin-appt-badge--muted text-[10px]"
                    title="Importé depuis un fichier Excel"
                  >
                    Excel
                  </span>
                ) : null}
              </div>
            ),
            exportValue: (r) => r.subject,
          },
          { key: 'type', header: 'Type', render: (r) => r.missionType ?? '—' },
          { key: 'dest', header: 'Destination', render: (r) => r.destination },
          {
            key: 'depart',
            header: 'Départ',
            render: (r) => format(new Date(r.departAt), 'd MMM yyyy', { locale: fr }),
          },
          {
            key: 'return',
            header: 'Retour',
            render: (r) => format(new Date(r.returnAt), 'd MMM yyyy', { locale: fr }),
          },
          {
            key: 'days',
            header: 'Jours',
            render: (r) => (
              <span className="workspace-mission-days" title={missionDurationLabel(r.departAt, r.returnAt)}>
                {missionDurationDays(r.departAt, r.returnAt)}
              </span>
            ),
            exportValue: (r) => String(missionDurationDays(r.departAt, r.returnAt)),
          },
          ...(tab === 'trash'
            ? [
                {
                  key: 'archivedAt',
                  header: 'Mise en corbeille',
                  render: (r: DgMission) => formatMissionDate(r.archivedAt),
                },
              ]
            : []),
          {
            key: 'status',
            header: 'Statut',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-1">
                <MissionVisualBadge mission={r} />
                <MissionOperationalBadge mission={r} />
              </div>
            ),
            exportValue: (r) => MISSION_VISUAL_LABELS[resolveMissionVisualState(r)],
          },
          { key: 'docs', header: 'Docs', render: (r) => String(r.documentCount) },
          {
            key: 'hotel',
            header: 'Hôtel',
            thClassName: 'workspace-module-th-hotel',
            tdClassName: 'workspace-module-td-hotel',
            render: (r) => {
              const locked = isMissionHotelLocked(r);
              const label = missionHotelColumnLabel(r.hotelStatus, r);
              const reserved = !locked && label === 'Déjà réservé';
              const hotelDisabled = !canHotel || !canManageMissionHotel(r);
              const title = locked
                ? 'Mission terminée — rouvrez la mission pour gérer l’hôtel'
                : `Réservations hôtel — ${label}`;
              if (reserved) {
                return (
                  <button
                    type="button"
                    className="workspace-mission-hotel-cell"
                    title={title}
                    aria-label={`Réservations hôtel — ${r.subject} — ${label}`}
                    disabled={hotelDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hotelDisabled) return;
                      setHotelMission(r);
                      setHotelOpen(true);
                    }}
                  >
                    <span className="workspace-mission-hotel-status" data-reserved="true">
                      {label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  className={cn(
                    'workspace-row-action-btn',
                    locked
                      ? 'workspace-row-action-btn--archive-blocked'
                      : 'workspace-row-action-btn--hotel'
                  )}
                  title={title}
                  aria-label={`Réservations hôtel — ${r.subject} — ${label}`}
                  disabled={hotelDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hotelDisabled) return;
                    setHotelMission(r);
                    setHotelOpen(true);
                  }}
                >
                  <Hotel className="h-2.5 w-2.5" aria-hidden />
                  <span className="sr-only">{label}</span>
                </button>
              );
            },
            exportValue: (r) => missionHotelColumnLabel(r.hotelStatus, r),
          },
        ]}
      />
      <MissionDetailSheet
        mission={detailMission}
        variant={tab}
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setDetailMission(null);
        }}
        canManage={canManage}
        canEditFields={detailMission ? canEdit && canEditMissionFields(detailMission, role) : false}
        canEditObservations={
          detailMission ? canEdit && canEditMissionObservations(detailMission, role) : false
        }
        history={missionHistory}
        onEdit={
          canEdit
            ? (mission) => {
                if (!canEditMissionFields(mission, role)) return;
                void openEditDialog(mission);
              }
            : undefined
        }
        onHotel={
          canHotel
            ? (mission) => {
                setHotelMission(mission);
                setHotelOpen(true);
              }
            : undefined
        }
        onArchive={canArchivePerm ? requestArchiveMission : undefined}
        onRestore={canRestore ? (mission) => void restoreMission(mission) : undefined}
        onDeletePermanent={
          canDelete
            ? (mission) => setConfirmAction({ type: 'delete', mission })
            : undefined
        }
        onStart={(mission) => void runStatusAction(mission.id, { action: 'start' })}
        onCancel={(mission) => setCancelMission(mission)}
        onExtend={(mission) => setAdjustReturn({ mission, mode: 'extend' })}
        onShorten={(mission) => setAdjustReturn({ mission, mode: 'shorten' })}
        onReopen={(mission) => setReopenMission(mission)}
        role={role}
        onSaveObservations={async (missionId, observations) => {
          const ok = await missionRequest(
            `${API}/${missionId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ observations }),
            },
            { successTitle: 'Observations enregistrées' }
          );
          if (ok) {
            setDetailMission((prev) => (prev?.id === missionId ? { ...prev, observations } : prev));
          }
        }}
        statusLoading={statusLoading}
      />
      <MissionCancelDialog
        mission={cancelMission}
        open={!!cancelMission}
        onOpenChange={(next) => !next && setCancelMission(null)}
        loading={statusLoading}
        onConfirm={async (reason, detail) => {
          if (!cancelMission) return;
          const ok = await runStatusAction(cancelMission.id, {
            action: 'cancel',
            cancelReason: reason,
            cancelReasonDetail: detail || null,
          });
          if (ok) {
            setCancelMission(null);
            setDetailOpen(false);
            setDetailMission(null);
          }
        }}
      />
      <MissionExtendDialog
        mission={adjustReturn?.mission ?? null}
        mode={adjustReturn?.mode ?? 'extend'}
        open={!!adjustReturn}
        onOpenChange={(next) => !next && setAdjustReturn(null)}
        loading={statusLoading}
        onConfirm={async (payload) => {
          if (!adjustReturn) return;
          const ok = await adjustReturnRequest(adjustReturn.mission.id, adjustReturn.mode, payload);
          if (ok) setAdjustReturn(null);
        }}
      />
      <MissionReopenDialog
        mission={reopenMission}
        open={!!reopenMission}
        onOpenChange={(next) => !next && setReopenMission(null)}
        loading={statusLoading}
        onConfirm={async (payload) => {
          if (!reopenMission) return;
          const ok = await runStatusAction(reopenMission.id, { action: 'reopen', ...payload });
          if (ok) {
            setReopenMission(null);
          }
        }}
      />
      <MissionOngoingArchiveAlert
        open={ongoingArchiveAlertOpen}
        onOpenChange={setOngoingArchiveAlertOpen}
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
            <>Toutes les missions archivées seront supprimées définitivement.</>
          ) : confirmAction?.type === 'delete' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.mission.subject}</span> sera
              supprimée définitivement.
            </>
          ) : confirmAction?.type === 'archive' ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.mission.subject}</span> sera
              déplacée dans la corbeille. Vous pourrez la restaurer ou la supprimer plus tard.
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
      <MissionHotelReservationsDialog
        mission={hotelMission}
        open={hotelOpen}
        onOpenChange={(next) => {
          setHotelOpen(next);
          if (!next) setHotelMission(null);
        }}
        onReservationsChange={reload}
      />
      <WorkspaceCrudDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditingMission(null);
        }}
        className="workspace-crud-dialog--wide"
        title={editId ? 'Modifier la mission' : 'Nouvelle mission'}
        onSubmit={() => void save()}
        footer={
          <>
            <button type="button" className="admin-btn-cancel" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="admin-btn-create" disabled={!canSave}>
              {editId ? (fieldsLocked ? 'Enregistrer les documents' : 'Enregistrer') : 'Créer'}
            </button>
          </>
        }
      >
        {fieldsLocked ? (
          <p className="mission-edit-locked-hint">
            Cette mission est {editingMission?.status === 'ONGOING' ? 'en cours' : editingMission?.status === 'COMPLETED' ? 'terminée' : 'annulée'} — seuls les
            documents peuvent être modifiés ici.
          </p>
        ) : null}
        <div className="workspace-crud-form-grid">
          <WorkspaceCrudField id="mission-type" label="Type de mission *">
            <MissionTypeSelect
              id="mission-type"
              value={typeSelect}
              disabled={fieldsLocked}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  missionTypeSelect: v,
                  missionTypeOther: v === MISSION_TYPE_OTHER_VALUE ? f.missionTypeOther : '',
                }))
              }
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="mission-destinations" label="Destination(s) *">
            <CountryMultiSelect
              value={destinationCodes}
              disabled={fieldsLocked}
              onChange={(destinations) => setForm((f) => ({ ...f, destinations }))}
            />
          </WorkspaceCrudField>
          {form.missionTypeSelect === MISSION_TYPE_OTHER_VALUE ? (
            <div className="workspace-crud-nested workspace-crud-span-2">
              <WorkspaceCrudField id="mission-type-other" label="Préciser le type">
                <Input
                  id="mission-type-other"
                  className="admin-field"
                  placeholder="Type de mission"
                  value={form.missionTypeOther}
                  disabled={fieldsLocked}
                  onChange={(e) => setForm((f) => ({ ...f, missionTypeOther: e.target.value }))}
                />
              </WorkspaceCrudField>
            </div>
          ) : null}
          <WorkspaceCrudField id="mission-subject" label="Objet *" className="workspace-crud-span-2">
            <Input
              id="mission-subject"
              maxLength={300}
              className={inlineFieldErrorClass(subjectDuplicate, 'admin-field')}
              placeholder="Objet de la mission"
              value={form.subject}
              disabled={fieldsLocked}
              aria-invalid={subjectDuplicate || undefined}
              aria-describedby={subjectErrorMessage ? 'mission-subject-error' : undefined}
              onChange={(e) => {
                setSubjectServerError(false);
                setForm((f) => ({ ...f, subject: e.target.value }));
              }}
            />
            <InlineFieldError id="mission-subject-error" message={subjectErrorMessage} />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="mission-details" label="Détails (optionnel)" className="workspace-crud-span-2">
            <Textarea
              id="mission-details"
              maxLength={2000}
              className="admin-field workspace-crud-textarea min-h-[2.75rem] resize-y"
              placeholder="Ville, hôtel, contacts, notes logistiques…"
              value={form.details}
              disabled={fieldsLocked}
              onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="mission-depart" label="Départ *">
            <FrenchDateField
              id="mission-depart"
              className="admin-field"
              value={form.departAt}
              disabled={fieldsLocked}
              onChange={(departAt) => setForm((f) => ({ ...f, departAt }))}
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="mission-return" label="Retour *">
            <FrenchDateField
              id="mission-return"
              className="admin-field"
              min={form.departAt}
              value={form.returnAt}
              disabled={fieldsLocked}
              onChange={(returnAt) => setForm((f) => ({ ...f, returnAt }))}
            />
          </WorkspaceCrudField>
          <div className="workspace-crud-checkbox-row">
            <Checkbox
              id="mission-has-participants"
              checked={form.hasParticipants}
              disabled={fieldsLocked}
              onCheckedChange={(checked) =>
                setForm((f) => ({
                  ...f,
                  hasParticipants: checked === true,
                  participants: checked === true ? f.participants : '',
                }))
              }
            />
            <label htmlFor="mission-has-participants">Cette mission comporte des participants</label>
          </div>
          {form.hasParticipants ? (
            <div className="workspace-crud-nested workspace-crud-span-2">
              <WorkspaceCrudField id="mission-participants" label="Liste des participants">
                <Textarea
                  id="mission-participants"
                  className="admin-field workspace-crud-textarea min-h-[2.75rem] resize-y"
                  placeholder="Noms, fonctions, services…"
                  value={form.participants}
                  disabled={fieldsLocked}
                  onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
                />
              </WorkspaceCrudField>
            </div>
          ) : null}
          <MissionDocumentsField
            ownerId={draftOwnerId}
            documents={documents}
            setDocuments={setDocuments}
            canManage={canManage}
            disabled={false}
          />
        </div>
      </WorkspaceCrudDialog>

      <MissionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={reload}
      />
    </>
  );
}
