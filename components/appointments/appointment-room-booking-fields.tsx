'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DgPlanCompactSelect } from '@/components/appointments/dg-plan-compact-fields';
import {
  ROOM_EQUIPMENT_OPTIONS,
  ROOM_USAGE_OPTIONS,
  type RoomEquipmentValue,
  type RoomUsageType,
} from '@/lib/dg/room-reservation-form';
import type { AppointmentPlanningForm } from '@/lib/dg/appointment-planning';
import {
  evaluatePlanningRoomSlot,
  type PlanningRoomSlotStatus,
} from '@/lib/dg/planning-room-slot';
import type { MeetingRoom } from '@/lib/services/room-availability';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';
import { cn } from '@/lib/utils';

type Props = {
  form: AppointmentPlanningForm;
  onChange: (updater: (prev: AppointmentPlanningForm) => AppointmentPlanningForm) => void;
  idPrefix?: string;
  compact?: boolean;
  disabled?: boolean;
  classNames?: { input?: string; select?: string };
  /** Remonte l’indisponibilité salle pour bloquer la soumission. */
  onAvailabilityChange?: (message: string | null) => void;
  /** En édition : ignorer le RDV courant dans la grille salle. */
  excludeAppointmentId?: string | null;
};

function formatSlotDate(date: string) {
  if (!date) return '';
  try {
    return format(new Date(`${date}T12:00:00`), 'EEE d MMM', { locale: fr });
  } catch {
    return date;
  }
}

export function AppointmentRoomBookingFields({
  form,
  onChange,
  idPrefix = 'plan',
  compact = false,
  disabled = false,
  classNames,
  onAvailabilityChange,
  excludeAppointmentId = null,
}: Props) {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [slotStatus, setSlotStatus] = useState<PlanningRoomSlotStatus>('idle');
  const [slotMessage, setSlotMessage] = useState<string | null>(null);

  const labelCls = compact ? 'dg-plan-label' : undefined;
  const selectCls =
    classNames?.select ?? 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  const inputCls = classNames?.input ?? '';
  const rowGap = compact ? 'dg-plan-row' : 'grid gap-2';
  const selectMt = compact ? '' : 'mt-1';
  const inputMt = compact ? '' : 'mt-1';

  useEffect(() => {
    if (!form.reserveRoom || disabled) return;
    let cancelled = false;
    setRoomsLoading(true);
    setRoomsError(null);
    void fetch('/api/dg/availability/rooms')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: MeetingRoom[] } | null) => {
        if (cancelled) return;
        const items = j?.items ?? [];
        setRooms(items);
        if (items.length === 0) {
          setRoomsError('Aucune salle réservable n’est configurée pour le moment.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([]);
          setRoomsError('Impossible de charger les salles.');
        }
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.reserveRoom, disabled]);

  useEffect(() => {
    if (!form.reserveRoom || disabled || form.roomId || rooms.length !== 1) return;
    const only = rooms[0]!;
    onChange((s) => {
      if (s.roomId) return s;
      return {
        ...s,
        roomId: only.id,
        roomName: only.name,
        location: only.name,
        locationRef: '',
      };
    });
  }, [disabled, form.reserveRoom, form.roomId, onChange, rooms]);

  useEffect(() => {
    if (!form.reserveRoom || disabled || form.allDay || !form.roomId || !form.date) {
      setSlotStatus('idle');
      setSlotMessage(null);
      onAvailabilityChange?.(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSlotStatus('loading');
      try {
        const params = new URLSearchParams({ date: form.date, roomId: form.roomId });
        if (form.roomReservationId.trim()) {
          params.set('excludeReservationId', form.roomReservationId.trim());
        }
        if (excludeAppointmentId?.trim()) {
          params.set('excludeAppointmentId', excludeAppointmentId.trim());
        }
        const res = await fetch(`/api/dg/availability?${params}`);
        if (cancelled) return;
        if (!res.ok) {
          setSlotStatus('error');
          setSlotMessage('Impossible de vérifier la disponibilité de la salle.');
          onAvailabilityChange?.(null);
          return;
        }
        const json = (await res.json()) as { slots?: AvailabilitySlot[] };
        const evaluation = evaluatePlanningRoomSlot(
          json.slots ?? [],
          form.startTime,
          form.endTime
        );
        if (cancelled) return;
        setSlotStatus(evaluation.status);
        setSlotMessage(evaluation.message);
        onAvailabilityChange?.(evaluation.ok ? null : evaluation.message);
      } catch {
        if (cancelled) return;
        setSlotStatus('error');
        setSlotMessage('Erreur réseau lors de la vérification de la salle.');
        onAvailabilityChange?.(null);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    disabled,
    excludeAppointmentId,
    form.allDay,
    form.date,
    form.endTime,
    form.reserveRoom,
    form.roomId,
    form.roomReservationId,
    form.startTime,
    onAvailabilityChange,
  ]);

  const roomOptions = useMemo(
    () => [
      { value: '', label: roomsLoading ? 'Chargement…' : '— Sélectionner une salle —' },
      ...rooms.map((r) => ({ value: r.id, label: r.name })),
    ],
    [rooms, roomsLoading]
  );

  if (disabled) return null;

  const setReserveRoom = (reserveRoom: boolean) => {
    onChange((s) => {
      if (!reserveRoom) {
        onAvailabilityChange?.(null);
        return {
          ...s,
          reserveRoom: false,
          roomId: '',
          roomName: '',
          roomOrganizerService: '',
          roomParticipantCount: '',
          roomEquipment: [],
          roomLogisticsNotes: '',
        };
      }
      return {
        ...s,
        reserveRoom: true,
        allDay: false,
      };
    });
  };

  const setRoomId = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    onChange((s) => ({
      ...s,
      roomId,
      roomName: room?.name ?? '',
      location: room?.name ?? s.location,
      locationRef: '',
    }));
  };

  const toggleEquipment = (value: RoomEquipmentValue) => {
    onChange((s) => ({
      ...s,
      roomEquipment: s.roomEquipment.includes(value)
        ? s.roomEquipment.filter((v) => v !== value)
        : [...s.roomEquipment, value],
    }));
  };

  const statusIcon =
    slotStatus === 'loading' ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : slotStatus === 'available' ? (
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
    ) : slotStatus === 'idle' ? (
      <Clock className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
    );

  return (
    <div
      className={cn('plan-room-booking', compact && 'plan-room-booking--compact')}
      data-active={form.reserveRoom ? 'true' : 'false'}
      data-slot-status={slotStatus}
    >
      <div
        className={cn(
          'plan-room-booking-toggle',
          compact ? 'plan-room-booking-toggle--compact' : 'plan-room-booking-toggle--default'
        )}
      >
        <div className="min-w-0">
          <Label
            htmlFor={`${idPrefix}-reserve-room`}
            className={cn(compact ? 'dg-plan-label' : 'text-sm font-medium', 'inline-flex items-center gap-1.5')}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Réserver une salle
          </Label>
          <p className={compact ? 'text-[11px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
            Optionnel — le créneau salle est toujours celui du rendez-vous.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-reserve-room`}
          className={
            compact
              ? 'appointment-allday-switch shrink-0 data-[state=checked]:!bg-[#008d4c] data-[state=unchecked]:!bg-[#ee3124]'
              : undefined
          }
          checked={form.reserveRoom}
          onCheckedChange={setReserveRoom}
          disabled={form.allDay}
        />
      </div>

      {form.allDay ? (
        <p className={compact ? 'dg-plan-conflict' : 'text-xs text-muted-foreground'}>
          Désactivez « Toute la journée » pour réserver une salle sur un créneau horaire.
        </p>
      ) : null}

      {form.reserveRoom && !form.allDay ? (
        <div className={cn(rowGap, 'plan-room-booking-fields')}>
          <div className="plan-room-booking-slot-lock" aria-live="polite">
            <div className="plan-room-booking-slot-lock-head">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <p className="plan-room-booking-slot-lock-title">
                Créneau salle = RDV
                <span className="plan-room-booking-slot-lock-desc">
                  {' '}
                  · {formatSlotDate(form.date)}
                  {form.date ? ' · ' : ''}
                  <strong>
                    {form.startTime}–{form.endTime}
                  </strong>
                </span>
              </p>
              {slotStatus !== 'idle' ? (
                <span
                  className={cn(
                    'plan-room-booking-badge',
                    slotStatus === 'available' && 'plan-room-booking-badge--ok',
                    (slotStatus === 'margin' ||
                      slotStatus === 'busy' ||
                      slotStatus === 'blocked' ||
                      slotStatus === 'outside' ||
                      slotStatus === 'error') &&
                      'plan-room-booking-badge--warn'
                  )}
                >
                  {statusIcon}
                  {slotStatus === 'loading'
                    ? '…'
                    : slotStatus === 'available'
                      ? 'Libre'
                      : slotStatus === 'margin'
                        ? 'Marge'
                        : slotStatus === 'busy'
                          ? 'Occupée'
                          : 'Indispo.'}
                </span>
              ) : null}
            </div>
          </div>

          {roomsError ? <p className="plan-room-booking-error">{roomsError}</p> : null}

          <div className={`${rowGap} sm:grid-cols-2`}>
            <div>
              <Label htmlFor={`${idPrefix}-room`} className={labelCls}>
                Salle <span className="text-destructive">*</span>
              </Label>
              {compact ? (
                <DgPlanCompactSelect
                  id={`${idPrefix}-room`}
                  value={form.roomId}
                  options={roomOptions}
                  onChange={setRoomId}
                  placeholder="— Sélectionner une salle —"
                  disabled={roomsLoading || rooms.length === 0}
                />
              ) : (
                <select
                  id={`${idPrefix}-room`}
                  className={`${selectCls} ${selectMt}`.trim()}
                  value={form.roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={roomsLoading || rooms.length === 0}
                >
                  {roomOptions.map((opt) => (
                    <option key={opt.value || '__empty__'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-room-usage`} className={labelCls}>
                Type d&apos;usage
              </Label>
              {compact ? (
                <DgPlanCompactSelect
                  id={`${idPrefix}-room-usage`}
                  value={form.roomUsageType}
                  options={ROOM_USAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(roomUsageType) =>
                    onChange((s) => ({
                      ...s,
                      roomUsageType: roomUsageType as RoomUsageType,
                    }))
                  }
                />
              ) : (
                <select
                  id={`${idPrefix}-room-usage`}
                  className={`${selectCls} ${selectMt}`.trim()}
                  value={form.roomUsageType}
                  onChange={(e) =>
                    onChange((s) => ({
                      ...s,
                      roomUsageType: e.target.value as RoomUsageType,
                    }))
                  }
                >
                  {ROOM_USAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <p className={cn(labelCls ?? 'text-sm font-medium', 'plan-room-booking-equip-label')}>
              Équipements
              <span className="plan-room-booking-equip-hint">optionnel</span>
            </p>
            <div
              className="dg-room-res-equipment dg-room-res-equipment--compact plan-room-booking-equipment"
              role="group"
              aria-label="Équipements souhaités"
            >
              {ROOM_EQUIPMENT_OPTIONS.map((opt) => {
                const active = form.roomEquipment.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'dg-room-res-equip-pill',
                      active && 'dg-room-res-equip-pill--active'
                    )}
                    aria-pressed={active}
                    onClick={() => toggleEquipment(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor={`${idPrefix}-room-notes`} className={labelCls}>
              Notes
            </Label>
            <Textarea
              id={`${idPrefix}-room-notes`}
              className={cn(compact ? 'dg-plan-textarea' : undefined, inputCls, inputMt)}
              rows={1}
              value={form.roomLogisticsNotes}
              onChange={(e) => onChange((s) => ({ ...s, roomLogisticsNotes: e.target.value }))}
              placeholder="Disposition, matériel…"
            />
          </div>

          {slotMessage ? (
            <p
              className={cn(
                'plan-room-booking-status',
                slotStatus === 'available' && 'plan-room-booking-status--ok',
                (slotStatus === 'margin' ||
                  slotStatus === 'busy' ||
                  slotStatus === 'blocked' ||
                  slotStatus === 'outside' ||
                  slotStatus === 'error') &&
                  'plan-room-booking-status--warn'
              )}
              role={slotStatus === 'available' || slotStatus === 'margin' ? 'status' : 'alert'}
            >
              {statusIcon}
              <span>{slotMessage}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
