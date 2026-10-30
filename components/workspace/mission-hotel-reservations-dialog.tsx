'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Hotel, Loader2, Plus } from 'lucide-react';
import { HotelReservationFormFields } from '@/components/workspace/hotel-reservation-form-fields';
import { WorkspaceCrudDialog } from '@/components/workspace/workspace-crud-dialog';
import {
  WorkspaceDeleteDialog,
  WorkspaceRowActions,
} from '@/components/workspace/workspace-crud-actions';
import { useApp } from '@/lib/app-context';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';
import {
  HOTEL_ATTACHMENT_TYPE_LABELS,
  HOTEL_RESERVATION_STATUS_LABELS,
  MISSION_STATUS_LABELS,
} from '@/lib/workspace/labels';
import {
  buildHotelReservationPayload,
  emptyHotelReservationForm,
  formatHotelCost,
  isHotelReservationFormValid,
  toHotelReservationForm,
} from '@/lib/workspace/hotel-reservation-form-state';
import { defaultCountryCodeFromMission } from '@/lib/workspace/mission-countries';
import { canManageMissionHotel } from '@/lib/workspace/mission-hotel-status';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import type { DgMission, DgMissionHotelReservation } from '@/lib/workspace/types';

const API = '/api/workspace/hotel-reservations';

type Props = {
  mission: DgMission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReservationsChange?: () => void;
};

type ViewMode = 'list' | 'form';

function MissionSummary({ mission }: { mission: DgMission }) {
  return (
    <div className="mission-hotel-summary">
      <div className="mission-hotel-summary-row">
        <span className="mission-hotel-summary-label">Destination</span>
        <span className="mission-hotel-summary-value">{mission.destination}</span>
      </div>
      <div className="mission-hotel-summary-row">
        <span className="mission-hotel-summary-label">Départ</span>
        <span className="mission-hotel-summary-value">
          {format(new Date(mission.departAt), 'd MMM yyyy', { locale: fr })}
        </span>
      </div>
      <div className="mission-hotel-summary-row">
        <span className="mission-hotel-summary-label">Retour</span>
        <span className="mission-hotel-summary-value">
          {format(new Date(mission.returnAt), 'd MMM yyyy', { locale: fr })}
        </span>
      </div>
      <div className="mission-hotel-summary-row">
        <span className="mission-hotel-summary-label">Statut</span>
        <span className="mission-hotel-summary-value">{MISSION_STATUS_LABELS[mission.status]}</span>
      </div>
    </div>
  );
}

function ReservationDetailCard({
  reservation,
  canManage,
  onEdit,
  onDelete,
}: {
  reservation: DgMissionHotelReservation;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="mission-hotel-card">
      <div className="mission-hotel-card-header">
        <div className="min-w-0">
          <h4 className="mission-hotel-card-title">{reservation.hotel}</h4>
          <p className="mission-hotel-card-subtitle">
            {reservation.city}, {reservation.country}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <span className="mission-hotel-status-badge" data-status={reservation.status}>
            {HOTEL_RESERVATION_STATUS_LABELS[reservation.status]}
          </span>
          {canManage ? (
            <WorkspaceRowActions forceShow onEdit={onEdit} onDelete={onDelete} />
          ) : null}
        </div>
      </div>

      <dl className="mission-hotel-detail-grid">
        {reservation.address ? (
          <div className="mission-hotel-detail-item mission-hotel-detail-span-2">
            <dt>Adresse</dt>
            <dd>{reservation.address}</dd>
          </div>
        ) : null}
        {reservation.contact ? (
          <div className="mission-hotel-detail-item mission-hotel-detail-span-2">
            <dt>Contact</dt>
            <dd>{reservation.contact}</dd>
          </div>
        ) : null}
        <div className="mission-hotel-detail-item">
          <dt>Arrivée</dt>
          <dd>{format(new Date(reservation.arrivalDate), 'd MMM yyyy', { locale: fr })}</dd>
        </div>
        <div className="mission-hotel-detail-item">
          <dt>Départ</dt>
          <dd>{format(new Date(reservation.departureDate), 'd MMM yyyy', { locale: fr })}</dd>
        </div>
        <div className="mission-hotel-detail-item">
          <dt>Chambres</dt>
          <dd>
            {reservation.roomCount}
            {reservation.roomType ? ` — ${reservation.roomType}` : ''}
          </dd>
        </div>
        <div className="mission-hotel-detail-item">
          <dt>Coût</dt>
          <dd>{formatHotelCost(reservation.cost, reservation.currency)}</dd>
        </div>
      </dl>

      {reservation.attachments.length > 0 ? (
        <div className="mission-hotel-attachments">
          <p className="workspace-crud-label">Pièces jointes ({reservation.attachments.length})</p>
          <ul className="mission-hotel-attachment-list">
            {reservation.attachments.map((a) => (
              <li key={a.id}>
                <span className="mission-hotel-attachment-type">
                  {HOTEL_ATTACHMENT_TYPE_LABELS[a.attachmentType]}
                </span>
                <a
                  href={`/api/workspace/hotel-reservations/attachments/${a.id}`}
                  className="mission-hotel-attachment-name mission-hotel-attachment-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function MissionHotelReservationsDialog({
  mission,
  open,
  onOpenChange,
  onReservationsChange,
}: Props) {
  const role = useDgRole();
  const { permissions } = useApp();
  const canManage =
    canManageWorkspace(role) && permissions['action.missions.hotel'] === true;
  const crud = useWorkspaceCrud(API);

  const [view, setView] = useState<ViewMode>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyHotelReservationForm());
  const [items, setItems] = useState<DgMissionHotelReservation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReservations = useCallback(async () => {
    if (!mission) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?missionId=${encodeURIComponent(mission.id)}`);
      const json = res.ok ? await res.json() : { items: [] };
      setItems((json.items ?? []) as DgMissionHotelReservation[]);
    } finally {
      setLoading(false);
    }
  }, [mission]);

  useEffect(() => {
    if (open && mission) {
      setView('list');
      setEditId(null);
      void loadReservations();
    }
  }, [open, mission, crud.refresh, loadReservations]);

  const closeDialog = () => onOpenChange(false);

  const openCreate = () => {
    if (!mission) return;
    setEditId(null);
    setForm(
      emptyHotelReservationForm(mission.id, {
        arrivalDate: mission.departAt.slice(0, 10),
        departureDate: mission.returnAt.slice(0, 10),
        country: defaultCountryCodeFromMission(mission),
      })
    );
    setView('form');
  };

  const openEdit = (row: DgMissionHotelReservation) => {
    setEditId(row.id);
    setForm(toHotelReservationForm(row));
    setView('form');
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
  };

  const save = async () => {
    const payload = buildHotelReservationPayload(form);
    const ok = editId ? await crud.patch(editId, payload) : await crud.create(payload);
    if (ok) {
      setView('list');
      setEditId(null);
      void loadReservations();
      onReservationsChange?.();
    }
  };

  const canSave = isHotelReservationFormValid(form);

  if (!mission) return null;

  const hotelLocked = !canManageMissionHotel(mission);

  const title =
    view === 'form'
      ? editId
        ? 'Modifier la réservation'
        : "Nouvelle réservation d'hôtel"
      : "Réservations hôtel";

  return (
    <>
      <WorkspaceCrudDialog
        open={open}
        onOpenChange={onOpenChange}
        className="workspace-crud-dialog--mission-hotel"
        title={title}
        onSubmit={view === 'form' ? () => void save() : undefined}
        footer={
          view === 'list' ? (
            <>
              <button type="button" className="admin-btn-cancel" onClick={closeDialog}>
                Fermer
              </button>
              {canManage && !hotelLocked ? (
                <button type="button" className="admin-btn-create" onClick={openCreate}>
                  <Plus className="mr-1 inline h-3 w-3" aria-hidden />
                  Nouvelle réservation
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" className="admin-btn-cancel" onClick={backToList}>
                Retour
              </button>
              <button type="submit" className="admin-btn-create" disabled={!canSave}>
                Enregistrer
              </button>
            </>
          )
        }
      >
        {view === 'list' ? (
          <div className="mission-hotel-panel">
            <div className="mission-hotel-mission-bar">
              <Hotel className="h-3.5 w-3.5 shrink-0 text-[var(--admin-primary)]" />
              <p className="mission-hotel-mission-subject">{mission.subject}</p>
            </div>
            <MissionSummary mission={mission} />

            {loading ? (
              <div className="mission-hotel-loading">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span>Chargement des réservations…</span>
              </div>
            ) : items.length === 0 ? (
              <div className="mission-hotel-empty">
                <Hotel className="h-5 w-5 text-muted-foreground/60" aria-hidden />
                <p>Aucune réservation pour cette mission.</p>
                {hotelLocked ? (
                  <p className="mission-hotel-empty-hint">
                    Mission terminée — rouvrez la mission pour gérer l’hôtel.
                  </p>
                ) : canManage ? (
                  <p className="mission-hotel-empty-hint">
                    Cliquez sur « Nouvelle réservation » pour en ajouter une.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mission-hotel-list">
                {items.map((row) => (
                  <ReservationDetailCard
                    key={row.id}
                    reservation={row}
                    canManage={canManage && !hotelLocked}
                    onEdit={() => openEdit(row)}
                    onDelete={() =>
                      crud.setDeleteTarget({ id: row.id, label: `${row.hotel} — ${row.city}` })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <HotelReservationFormFields
            form={form}
            setForm={setForm}
            canManage={canManage}
            missions={[mission]}
            missionIdLocked
            idPrefix="mission-hotel"
          />
        )}
      </WorkspaceCrudDialog>

      {crud.deleteTarget ? (
        <WorkspaceDeleteDialog
          open={!!crud.deleteTarget}
          onOpenChange={(o) => !o && crud.setDeleteTarget(null)}
          label={crud.deleteTarget.label}
          loading={crud.deleteLoading}
          onConfirm={() =>
            void crud.confirmDelete().then(() => {
              void loadReservations();
              onReservationsChange?.();
            })
          }
        />
      ) : null}
    </>
  );
}
