'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { HotelReservationFormFields } from '@/components/workspace/hotel-reservation-form-fields';
import { WorkspaceCrudDialog } from '@/components/workspace/workspace-crud-dialog';
import { WorkspaceModuleList } from '@/components/workspace/workspace-module-list';
import { useWorkspaceCrudWithDelete } from '@/components/workspace/workspace-crud-actions';
import { HOTEL_RESERVATION_STATUS_LABELS } from '@/lib/workspace/labels';
import {
  buildHotelReservationPayload,
  emptyHotelReservationForm,
  formatHotelCost,
  isHotelReservationFormValid,
  toHotelReservationForm,
} from '@/lib/workspace/hotel-reservation-form-state';
import { defaultCountryCodeFromMission } from '@/lib/workspace/mission-countries';
import type { DgMission, DgMissionHotelReservation } from '@/lib/workspace/types';

const API = '/api/workspace/hotel-reservations';
const MISSIONS_API = '/api/workspace/missions';

export function HotelReservationsView() {
  const searchParams = useSearchParams();
  const missionIdFilter = searchParams.get('missionId') ?? '';

  const queryParams = useMemo(
    () => (missionIdFilter ? { missionId: missionIdFilter } : undefined),
    [missionIdFilter]
  );

  const { refresh, create, patch, canManage, deleteDialog, rowActions } =
    useWorkspaceCrudWithDelete(API);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyHotelReservationForm(missionIdFilter));
  const [missions, setMissions] = useState<DgMission[]>([]);

  useEffect(() => {
    void fetch(MISSIONS_API)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items: DgMission[] }) => setMissions(json.items ?? []));
  }, []);

  const missionLabel = missions.find((m) => m.id === missionIdFilter)?.subject;
  const canSave = isHotelReservationFormValid(form);

  const save = async () => {
    const payload = buildHotelReservationPayload(form);
    const ok = editId ? await patch(editId, payload) : await create(payload);
    if (ok) setOpen(false);
  };

  const openCreate = () => {
    setEditId(null);
    const mission = missions.find((m) => m.id === missionIdFilter);
    setForm(
      emptyHotelReservationForm(missionIdFilter, {
        country: mission ? defaultCountryCodeFromMission(mission) : '',
      })
    );
    setOpen(true);
  };

  return (
    <>
      <WorkspaceModuleList<DgMissionHotelReservation>
        refreshTrigger={refresh}
        title="Réservation d'hôtel"
        description="Gestion des hébergements liés aux missions du DGA : statut, coûts et pièces jointes."
        apiPath={API}
        exportFilename="reservations-hotel.csv"
        searchPlaceholder="Hôtel, ville, mission…"
        queryParams={queryParams}
        onCreateClick={canManage ? openCreate : undefined}
        createLabel="Nouvelle réservation"
        actions={
          missionIdFilter ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dg/workspace/missions">← Missions</Link>
            </Button>
          ) : undefined
        }
        rowActions={(row) =>
          rowActions(row, `${row.hotel} — ${row.city}`, () => {
            setEditId(row.id);
            setForm(toHotelReservationForm(row));
            setOpen(true);
          })
        }
        columns={[
          { key: 'mission', header: 'Mission', render: (r) => r.missionSubject },
          { key: 'hotel', header: 'Hôtel', render: (r) => r.hotel },
          { key: 'city', header: 'Ville', render: (r) => `${r.city}, ${r.country}` },
          {
            key: 'arrival',
            header: 'Arrivée',
            render: (r) => format(new Date(r.arrivalDate), 'd MMM yyyy', { locale: fr }),
          },
          {
            key: 'departure',
            header: 'Départ',
            render: (r) => format(new Date(r.departureDate), 'd MMM yyyy', { locale: fr }),
          },
          { key: 'rooms', header: 'Chambres', render: (r) => String(r.roomCount) },
          { key: 'cost', header: 'Coût', render: (r) => formatHotelCost(r.cost, r.currency) },
          {
            key: 'status',
            header: 'Statut',
            render: (r) => HOTEL_RESERVATION_STATUS_LABELS[r.status],
          },
          { key: 'pj', header: 'PJ', render: (r) => String(r.attachments.length) },
        ]}
      />

      {missionIdFilter && missionLabel ? (
        <p className="mx-auto mt-2 max-w-6xl px-4 text-sm text-muted-foreground">
          Filtre mission : <span className="font-medium text-foreground">{missionLabel}</span>
        </p>
      ) : null}

      {deleteDialog}

      <WorkspaceCrudDialog
        open={open}
        onOpenChange={setOpen}
        className="workspace-crud-dialog--wide workspace-crud-dialog--mission-hotel"
        title={editId ? 'Modifier la réservation' : "Nouvelle réservation d'hôtel"}
        onSubmit={() => void save()}
        footer={
          <>
            <button type="button" className="admin-btn-cancel" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="admin-btn-create" disabled={!canSave}>
              Enregistrer
            </button>
          </>
        }
      >
        <HotelReservationFormFields
          form={form}
          setForm={setForm}
          canManage={canManage}
          missions={missions}
          missionIdLocked={!!missionIdFilter && !editId}
        />
      </WorkspaceCrudDialog>
    </>
  );
}
