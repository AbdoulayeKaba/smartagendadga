'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { CountrySingleSelect } from '@/components/workspace/country-single-select';
import { HotelReservationAttachmentsField } from '@/components/workspace/hotel-reservation-attachments-field';
import { WorkspaceCompactDateField } from '@/components/workspace/workspace-compact-date-field';
import { WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { defaultCountryCodeFromMission } from '@/lib/workspace/mission-countries';
import { hotelRoomTypeSelectOptions } from '@/lib/workspace/hotel-room-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HOTEL_CURRENCY_OPTIONS, hotelCurrencyLabel } from '@/lib/workspace/hotel-currencies';
import {
  HOTEL_RESERVATION_FORM_STATUS_ORDER,
  HOTEL_RESERVATION_STATUS_LABELS,
} from '@/lib/workspace/labels';
import type { HotelReservationFormState } from '@/lib/workspace/hotel-reservation-form-state';
import type { DgMission, HotelReservationStatus } from '@/lib/workspace/types';

type Props = {
  form: HotelReservationFormState;
  setForm: React.Dispatch<React.SetStateAction<HotelReservationFormState>>;
  canManage: boolean;
  missions?: DgMission[];
  missionIdLocked?: boolean;
  idPrefix?: string;
};

const COMPACT_SELECT_TRIGGER = 'workspace-crud-compact-select-trigger admin-field w-full';
const COMPACT_SELECT_CONTENT = 'workspace-crud-compact-select-content';

export function HotelReservationFormFields({
  form,
  setForm,
  canManage,
  missions = [],
  missionIdLocked = false,
  idPrefix = 'hotel',
}: Props) {
  const showMissionSelect = missions.length > 0;

  useEffect(() => {
    if (!form.missionId || form.country) return;
    const mission = missions.find((m) => m.id === form.missionId);
    if (!mission) return;
    const code = defaultCountryCodeFromMission(mission);
    if (code) setForm((f) => ({ ...f, country: code }));
  }, [form.missionId, form.country, missions, setForm]);

  const roomTypeOptions = useMemo(
    () => hotelRoomTypeSelectOptions(form.roomType),
    [form.roomType]
  );

  return (
    <div className="workspace-crud-form-grid workspace-crud-form-compact hotel-reservation-form">
      {showMissionSelect ? (
        <WorkspaceCrudField
          id={`${idPrefix}-mission`}
          label="Mission liée *"
          className="workspace-crud-span-2"
        >
          <Select
            value={form.missionId || undefined}
            onValueChange={(v) => setForm((f) => ({ ...f, missionId: v ?? '' }))}
            disabled={missionIdLocked}
          >
            <SelectTrigger id={`${idPrefix}-mission`} className={COMPACT_SELECT_TRIGGER}>
              <SelectValue placeholder="Choisir une mission…" />
            </SelectTrigger>
            <SelectContent className={COMPACT_SELECT_CONTENT}>
              {missions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCrudField>
      ) : null}

      <WorkspaceCrudField id={`${idPrefix}-name`} label="Hôtel *" className="workspace-crud-span-2">
        <Input
          id={`${idPrefix}-name`}
          className="admin-field"
          required
          value={form.hotel}
          onChange={(e) => setForm((f) => ({ ...f, hotel: e.target.value }))}
          placeholder="Nom de l’hôtel"
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-address`} label="Adresse" className="workspace-crud-span-2">
        <Input
          id={`${idPrefix}-address`}
          className="admin-field"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Adresse de l’établissement"
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-city`} label="Ville *">
        <Input
          id={`${idPrefix}-city`}
          className="admin-field"
          required
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-country`} label="Pays *">
        <CountrySingleSelect
          id={`${idPrefix}-country`}
          value={form.country}
          onChange={(code) => setForm((f) => ({ ...f, country: code }))}
          placeholder="Choisir un pays…"
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-contact`} label="Contact" className="workspace-crud-span-2">
        <Input
          id={`${idPrefix}-contact`}
          className="admin-field"
          placeholder="Téléphone, e-mail, réception…"
          value={form.contact}
          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-rooms`} label="Chambres *">
        <Input
          id={`${idPrefix}-rooms`}
          type="number"
          min={1}
          max={99}
          className="admin-field"
          required
          value={form.roomCount}
          onChange={(e) =>
            setForm((f) => ({ ...f, roomCount: Math.max(1, Number(e.target.value) || 1) }))
          }
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-room-type`} label="Type de chambre">
        <Select
          value={form.roomType || undefined}
          onValueChange={(v) => setForm((f) => ({ ...f, roomType: v }))}
        >
          <SelectTrigger id={`${idPrefix}-room-type`} className={COMPACT_SELECT_TRIGGER}>
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent className={COMPACT_SELECT_CONTENT}>
            {roomTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-arrival`} label="Arrivée *">
        <WorkspaceCompactDateField
          id={`${idPrefix}-arrival`}
          value={form.arrivalDate}
          onChange={(arrivalDate) => setForm((f) => ({ ...f, arrivalDate }))}
        />
      </WorkspaceCrudField>

      <WorkspaceCrudField id={`${idPrefix}-departure`} label="Départ *">
        <WorkspaceCompactDateField
          id={`${idPrefix}-departure`}
          value={form.departureDate}
          min={form.arrivalDate}
          onChange={(departureDate) => setForm((f) => ({ ...f, departureDate }))}
        />
      </WorkspaceCrudField>

      <div className="hotel-reservation-money-row workspace-crud-span-2">
        <WorkspaceCrudField id={`${idPrefix}-cost`} label="Coût">
          <Input
            id={`${idPrefix}-cost`}
            type="number"
            min={0}
            className="admin-field"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            placeholder="0"
          />
        </WorkspaceCrudField>

        <WorkspaceCrudField id={`${idPrefix}-currency`} label="Devise *">
          <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
            <SelectTrigger id={`${idPrefix}-currency`} className={COMPACT_SELECT_TRIGGER}>
              <SelectValue placeholder="Devise">{hotelCurrencyLabel(form.currency)}</SelectValue>
            </SelectTrigger>
            <SelectContent className={COMPACT_SELECT_CONTENT}>
              {HOTEL_CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.menuLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCrudField>

        <WorkspaceCrudField id={`${idPrefix}-status`} label="Statut *">
          <Select
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v as HotelReservationStatus }))}
          >
            <SelectTrigger id={`${idPrefix}-status`} className={COMPACT_SELECT_TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={COMPACT_SELECT_CONTENT}>
              {HOTEL_RESERVATION_FORM_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {HOTEL_RESERVATION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCrudField>
      </div>

      <HotelReservationAttachmentsField form={form} setForm={setForm} canManage={canManage} />
    </div>
  );
}
