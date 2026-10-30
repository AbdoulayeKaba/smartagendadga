'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Ban,
  FileText,
  Hotel,
  MapPin,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  CalendarClock,
  CalendarMinus,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { missionDurationLabel } from '@/lib/workspace/mission-duration';
import { MissionOperationalBadge } from '@/components/workspace/mission-operational-badge';
import { MissionVisualBadge } from '@/lib/workspace/mission-status-ui';
import {
  canArchiveMission,
  canAdjustMissionReturn,
  canReopenMission,
  getManualStatusActions,
  isMissionDepartingToday,
  isMissionReadOnly,
  startOfDay,
} from '@/lib/workspace/mission-status-workflow';
import { MISSION_CANCEL_REASON_LABELS, type MissionCancelReason } from '@/lib/workspace/mission-status-workflow';
import { canManageMissionHotel } from '@/lib/workspace/mission-hotel-status';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import { cn } from '@/lib/utils';
import {
  missionHistoryActionLabel,
  missionHistoryDetail,
} from '@/lib/workspace/mission-history-labels';
import type { DgMission, DgMissionDocument, DgMissionHistoryEntry } from '@/lib/workspace/types';

type Props = {
  mission: DgMission | null;
  variant: 'active' | 'trash';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  canEditFields: boolean;
  canEditObservations: boolean;
  history?: DgMissionHistoryEntry[];
  onEdit?: (mission: DgMission) => void;
  onHotel?: (mission: DgMission) => void;
  onArchive?: (mission: DgMission) => void;
  onRestore?: (mission: DgMission) => void;
  onDeletePermanent?: (mission: DgMission) => void;
  onStart?: (mission: DgMission) => void;
  onCancel?: (mission: DgMission) => void;
  onExtend?: (mission: DgMission) => void;
  onShorten?: (mission: DgMission) => void;
  onReopen?: (mission: DgMission) => void;
  onSaveObservations?: (missionId: string, observations: string) => Promise<void>;
  statusLoading?: boolean;
  role?: import('@/lib/dg/rbac').DgRole;
};

function formatShortDate(value: string): string {
  return format(new Date(value), 'd MMM yyyy', { locale: fr });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy · HH:mm', { locale: fr });
}

function InfoRow({
  label,
  value,
  icon,
  inline = true,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={`mission-detail-info-row${inline ? ' mission-detail-info-row--inline' : ''}`}>
      <div className="mission-detail-info-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mission-detail-info-value">{value}</div>
    </div>
  );
}

export function MissionDetailSheet({
  mission,
  variant,
  open,
  onOpenChange,
  canManage,
  canEditFields,
  canEditObservations,
  history = [],
  onEdit,
  onHotel,
  onArchive,
  onRestore,
  onDeletePermanent,
  onStart,
  onCancel,
  onExtend,
  onShorten,
  onReopen,
  onSaveObservations,
  statusLoading = false,
  role = 'ASSISTANT',
}: Props) {
  const actions = mission ? getManualStatusActions(mission) : [];
  const readOnly = mission ? isMissionReadOnly(mission) : true;
  const archiveAllowed = mission ? canArchiveMission(mission) : false;
  const canStart = actions.includes('start');
  const canCancelMission = actions.includes('cancel');
  const canAdjustReturn = mission ? canAdjustMissionReturn(mission, role) : false;
  const canManageHotel = mission ? canManageMissionHotel(mission) : false;
  const canReopen = mission ? canReopenMission(mission, role) : false;
  const showActiveFooter = Boolean(onEdit || onHotel || onArchive);
  const showTrashFooter = Boolean(onRestore || onDeletePermanent);
  const showInitialReturn =
    mission &&
    mission.initialReturnAt &&
    startOfDay(mission.initialReturnAt).getTime() !== startOfDay(mission.returnAt).getTime();
  const [missionDocuments, setMissionDocuments] = useState<DgMissionDocument[]>([]);
  const generalDocuments = missionDocuments.filter((d) => d.documentType !== 'REPORT');

  useEffect(() => {
    if (!mission?.id || !open) {
      setMissionDocuments([]);
      return;
    }
    void fetch(`/api/workspace/missions/${mission.id}/documents`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((json: { items?: DgMissionDocument[] }) => setMissionDocuments(json.items ?? []))
      .catch(() => setMissionDocuments([]));
  }, [mission?.id, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'mission-detail-sheet',
          mission?.status === 'CANCELLED' && 'mission-detail-sheet--cancelledled',
          mission?.status === 'ONGOING' && 'mission-detail-sheet--ongoing',
          mission?.status === 'COMPLETED' && 'mission-detail-sheet--completed',
          mission?.status === 'PLANNED' && 'mission-detail-sheet--planned',
          variant === 'trash' && 'mission-detail-sheet--trash'
        )}
      >
        {!mission ? (
          <SheetTitle className="sr-only">Détail de la mission</SheetTitle>
        ) : (
          <div className="mission-detail-layout">
            <SheetHeader className="mission-detail-sheet-header">
              <div className="mission-detail-header-top">
                <div className="mission-detail-type">{mission.missionType}</div>
                <div className="mission-detail-badges">
                  <MissionVisualBadge mission={mission} />
                  <MissionOperationalBadge mission={mission} />
                  {variant === 'trash' ? (
                    <span className="mission-detail-archived-badge">Corbeille</span>
                  ) : null}
                </div>
              </div>
              <SheetTitle className="mission-detail-title">{mission.subject}</SheetTitle>
              <SheetDescription className="sr-only">Détail de la mission</SheetDescription>
            </SheetHeader>

            <div className="mission-detail-body">
              <section className="mission-detail-card mission-detail-card--period">
                <div className="mission-detail-period-grid">
                  <div className="mission-detail-date-card">
                    <div className="mission-detail-date-icon" data-kind="depart">
                      <PlaneTakeoff className="h-3 w-3" aria-hidden />
                    </div>
                    <div className="mission-detail-date-content">
                      <div className="mission-detail-date-label">Départ</div>
                      <div className="mission-detail-date-main">{formatShortDate(mission.departAt)}</div>
                    </div>
                  </div>
                  <div className="mission-detail-duration-badge">
                    {missionDurationLabel(mission.departAt, mission.returnAt)}
                  </div>
                  <div className="mission-detail-date-card">
                    <div className="mission-detail-date-icon" data-kind="retour">
                      <PlaneLanding className="h-3 w-3" aria-hidden />
                    </div>
                    <div className="mission-detail-date-content">
                      <div className="mission-detail-date-label">Retour</div>
                      <div className="mission-detail-date-main">{formatShortDate(mission.returnAt)}</div>
                    </div>
                  </div>
                </div>
                {showInitialReturn ? (
                  <p className="mission-detail-initial-return">
                    Retour initial : {formatShortDate(mission.initialReturnAt)}
                  </p>
                ) : null}
              </section>

              {canManage && variant === 'active' && canAdjustReturn ? (
                <section className="mission-detail-card mission-detail-card--actions">
                  <p className="mission-detail-section-label">Ajustement du retour</p>
                  <div className="mission-detail-adjust-return-actions">
                    <button
                      type="button"
                      className="mission-detail-action-btn mission-detail-action-btn--extend"
                      disabled={statusLoading}
                      title="Prolonger la mission"
                      onClick={() => onExtend?.(mission)}
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      <span>Prolonger</span>
                    </button>
                    <button
                      type="button"
                      className="mission-detail-action-btn mission-detail-action-btn--shorten"
                      disabled={statusLoading}
                      title="Écourter la mission"
                      onClick={() => onShorten?.(mission)}
                    >
                      <CalendarMinus className="h-3.5 w-3.5" aria-hidden />
                      <span>Écourter</span>
                    </button>
                  </div>
                </section>
              ) : null}

              {canManage && variant === 'active' && canReopen ? (
                <section className="mission-detail-card mission-detail-card--actions mission-detail-card--reopen">
                  <p className="mission-detail-section-label">Réouverture</p>
                  <p className="mission-detail-action-hint">
                    Remet la mission en activité pour corrections et suivi.
                  </p>
                  <button
                    type="button"
                    className="mission-detail-action-btn mission-detail-action-btn--reopen mission-detail-action-btn--block"
                    disabled={statusLoading}
                    onClick={() => onReopen?.(mission)}
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden />
                    <span>Rouvrir la mission</span>
                  </button>
                </section>
              ) : null}

              {canManage && variant === 'active' && mission.status === 'PLANNED' ? (
                <section className="mission-detail-card mission-detail-card--actions">
                  <p className="mission-detail-section-label">Workflow</p>
                  <div className="mission-detail-workflow-actions">
                    <button
                      type="button"
                      className="mission-detail-action-btn mission-detail-action-btn--primary"
                      data-available={canStart && !statusLoading ? 'true' : undefined}
                      disabled={statusLoading || !canStart || !onStart}
                      title={
                        canStart
                          ? isMissionDepartingToday(mission.departAt)
                            ? 'Démarrer maintenant (sinon démarrage auto à 22h59)'
                            : 'Démarrer la mission (passer en cours)'
                          : mission.status === 'ONGOING'
                            ? 'Mission déjà en cours'
                            : 'Disponible pendant la période départ–retour (mission planifiée)'
                      }
                      onClick={() => onStart?.(mission)}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden />
                      <span>Démarrer</span>
                    </button>
                    <button
                      type="button"
                      className="mission-detail-action-btn mission-detail-action-btn--danger"
                      data-available={canCancelMission && !statusLoading ? 'true' : undefined}
                      disabled={statusLoading || !canCancelMission || !onCancel}
                      title={
                        canCancelMission
                          ? 'Annuler la mission'
                          : 'Disponible tant que la mission est planifiée (avant le démarrage auto à 22h59)'
                      }
                      onClick={() => onCancel?.(mission)}
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden />
                      <span>Annuler</span>
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="mission-detail-card mission-detail-card--info">
                <div className="mission-detail-info-list">
                  <InfoRow label="Destination" value={mission.destination} icon={<MapPin className="h-3 w-3" aria-hidden />} />
                  {mission.participants?.trim() ? (
                    <InfoRow
                      label="Participants"
                      icon={<Users className="h-3 w-3" aria-hidden />}
                      value={mission.participants}
                    />
                  ) : null}
                  <InfoRow
                    label="Documents"
                    icon={<FileText className="h-3 w-3" aria-hidden />}
                    value={
                      generalDocuments.length > 0 ? (
                        <ul className="mission-detail-doc-list">
                          {generalDocuments.map((doc) => (
                            <li key={doc.id}>
                              <a
                                href={`/api/workspace/missions/documents/${doc.id}`}
                                className="mission-detail-doc-link"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {doc.fileName}
                              </a>
                              <span className="mission-detail-doc-size">
                                {formatWorkspaceFileSize(doc.fileSize)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="mission-detail-empty">Aucun document</span>
                      )
                    }
                    inline={false}
                  />
                  {mission.cancelReason ? (
                    <div className="mission-detail-cancel-callout">
                      <div className="mission-detail-info-label">
                        <Ban className="h-3 w-3" aria-hidden />
                        <span>Motif d’annulation</span>
                      </div>
                      <p className="mission-detail-cancel-callout-text">
                        {MISSION_CANCEL_REASON_LABELS[mission.cancelReason as MissionCancelReason] ??
                          mission.cancelReason}
                      </p>
                    </div>
                  ) : null}
                  {mission.details?.trim() ? (
                    <InfoRow label="Logistique" value={mission.details} inline={false} />
                  ) : null}
                  {canEditObservations && onSaveObservations ? (
                    <div className="mission-detail-info-row">
                      <div className="mission-detail-info-label">Observations</div>
                      <Textarea
                        className="admin-field mission-detail-observations mt-1"
                        defaultValue={mission.observations ?? ''}
                        placeholder="Notes pendant la mission…"
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next !== (mission.observations ?? '').trim()) {
                            void onSaveObservations(mission.id, next);
                          }
                        }}
                      />
                    </div>
                  ) : mission.observations?.trim() ? (
                    <InfoRow label="Observations" value={mission.observations} inline={false} />
                  ) : null}
                </div>
              </section>

              {history.length > 0 ? (
                <section className="mission-detail-card mission-detail-card--history">
                  <div className="mission-detail-history-label mission-detail-history-label--section">
                    Historique
                  </div>
                  <ul className="mission-detail-history-list mission-detail-history-list--scroll">
                    {history.map((entry) => {
                      const detail = missionHistoryDetail(entry);
                      const actionLabel = missionHistoryActionLabel(entry);
                      const showDetail = detail && detail !== actionLabel;
                      return (
                        <li key={entry.id} className="mission-detail-history-item">
                          <div className="mission-detail-history-action">{actionLabel}</div>
                          {showDetail ? (
                            <div className="mission-detail-history-detail">{detail}</div>
                          ) : null}
                          <div className="mission-detail-history-meta">
                            {entry.userName} · {formatDateTime(entry.createdAt)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : (
                <section className="mission-detail-card mission-detail-card--muted">
                  <div className="mission-detail-history-grid">
                    <div>
                      <div className="mission-detail-history-label">Créée</div>
                      <div className="mission-detail-history-value">{formatDateTime(mission.createdAt)}</div>
                    </div>
                    <div>
                      <div className="mission-detail-history-label">Mise à jour</div>
                      <div className="mission-detail-history-value">{formatDateTime(mission.updatedAt)}</div>
                    </div>
                    {variant === 'trash' ? (
                      <div className="mission-detail-history-span">
                        <div className="mission-detail-history-label">Corbeille</div>
                        <div className="mission-detail-history-value">{formatDateTime(mission.archivedAt)}</div>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}
            </div>

            {canManage &&
            ((variant === 'active' && showActiveFooter) ||
              (variant === 'trash' && showTrashFooter)) ? (
              <footer className="mission-detail-footer">
                {variant === 'active' ? (
                  <div
                    className={cn(
                      'mission-detail-footer-grid',
                      [onEdit, onHotel, onArchive].filter(Boolean).length >= 3
                        ? 'mission-detail-footer-grid--3'
                        : undefined
                    )}
                  >
                    {onEdit ? (
                      <button
                        type="button"
                        className="mission-detail-action-btn mission-detail-action-btn--primary"
                        disabled={!canEditFields}
                        title={
                          canEditFields
                            ? 'Modifier la mission'
                            : 'Mission non modifiable (en cours, terminée ou annulée)'
                        }
                        onClick={() => {
                          if (!canEditFields) return;
                          onOpenChange(false);
                          onEdit(mission);
                        }}
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        <span>Modifier</span>
                      </button>
                    ) : null}
                    {onHotel ? (
                      <button
                        type="button"
                        className="mission-detail-action-btn mission-detail-action-btn--hotel"
                        disabled={!canManageHotel}
                        title={
                          canManageHotel
                            ? 'Réservations hôtel'
                            : 'Mission terminée — rouvrez la mission pour gérer l’hôtel'
                        }
                        onClick={() => {
                          if (!canManageHotel) return;
                          onOpenChange(false);
                          onHotel(mission);
                        }}
                      >
                        <Hotel className="h-3 w-3" aria-hidden />
                        <span>Hôtel</span>
                      </button>
                    ) : null}
                    {onArchive ? (
                      <button
                        type="button"
                        className={cn(
                          'mission-detail-action-btn mission-detail-action-btn--archive',
                          !archiveAllowed && !readOnly && 'mission-detail-action-btn--archive-blocked'
                        )}
                        disabled={readOnly}
                        title={
                          !archiveAllowed
                            ? 'Mission en cours — archivage indisponible'
                            : readOnly
                              ? 'Mission terminée ou annulée — archivage non disponible'
                              : 'Mettre en corbeille'
                        }
                        onClick={() => onArchive(mission)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        <span>Corbeille</span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mission-detail-footer-grid">
                    {onRestore ? (
                      <button
                        type="button"
                        className="mission-detail-action-btn mission-detail-action-btn--primary"
                        onClick={() => onRestore(mission)}
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        <span>Restaurer</span>
                      </button>
                    ) : null}
                    {onDeletePermanent ? (
                      <button
                        type="button"
                        className="mission-detail-action-btn mission-detail-action-btn--danger"
                        onClick={() => onDeletePermanent(mission)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        <span>Supprimer</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </footer>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
