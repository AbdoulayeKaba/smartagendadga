'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { timeToMinutes } from '@/lib/dg/schedule-capacity';
import { explainRoomSpan } from '@/lib/dg/room-slot-span';
import { RoomSlotSpanEditor } from '@/components/dg/room-slot-span-editor';
import { isSlotStartInThePast, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import { Loader2 } from 'lucide-react';
import { DgPlanCompactDateField } from '@/components/appointments/dg-plan-compact-fields';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';
import type { RoomAvailabilityResult } from '@/lib/services/room-availability';
import { cn } from '@/lib/utils';

function slotClass(status: AvailabilitySlot['status']) {
  switch (status) {
    case 'AVAILABLE':
      return 'admin-avail-slot--free';
    case 'BUSY':
      return 'admin-avail-slot--busy';
    case 'BUFFER':
      return 'admin-avail-slot--buffer';
    default:
      return 'admin-avail-slot--blocked';
  }
}

function slotLabel(slot: AvailabilitySlot) {
  if (slot.status === 'AVAILABLE') return 'Libre';
  if (slot.status === 'BUSY') return slot.label ?? 'Occupé';
  if (slot.status === 'BUFFER') return 'Tampon';
  return slot.reason ?? 'Bloqué';
}

type Props = {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeReservationId?: string;
  compact?: boolean;
  onDateChange: (date: string) => void;
  onSlotSelect: (slot: { startTime: string; endTime: string }) => void;
};

export function RoomReservationSlotPicker({
  roomId,
  date,
  startTime,
  endTime,
  excludeReservationId,
  compact = false,
  onDateChange,
  onSlotSelect,
}: Props) {
  const [data, setData] = useState<RoomAvailabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const syncedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId || !date) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ date, roomId });
      if (excludeReservationId) params.set('excludeReservationId', excludeReservationId);
      const res = await fetch(`/api/dg/availability?${params}`);
      if (!res.ok) {
        setData(null);
        setLoadError('Impossible de charger les créneaux.');
        return;
      }
      setData((await res.json()) as RoomAvailabilityResult);
    } catch {
      setData(null);
      setLoadError('Erreur réseau lors du chargement des créneaux.');
    } finally {
      setLoading(false);
    }
  }, [roomId, date, excludeReservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    syncedRef.current = null;
  }, [date, roomId, excludeReservationId]);

  useEffect(() => {
    if (!data?.slots.length || loading || !startTime || !endTime) return;

    const exact = explainRoomSpan(data.slots, startTime, endTime);
    if (exact.ok) return;

    const syncKey = `${date}|${startTime}|${endTime}|${data.slots.length}`;
    if (syncedRef.current === syncKey) return;

    const startMin = timeToMinutes(startTime);
    const match = data.slots.find((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      return startMin >= slotStart && startMin < slotEnd;
    });
    if (!match) return;
    if (match.status !== 'AVAILABLE' && !excludeReservationId) return;

    syncedRef.current = syncKey;
    onSlotSelect({ startTime: match.startTime, endTime: match.endTime });
  }, [data, loading, date, startTime, endTime, excludeReservationId, onSlotSelect]);

  const selected = startTime && endTime ? { startTime, endTime } : null;

  return (
    <div className={cn('dg-room-res-slot-picker', compact && 'dg-room-res-slot-picker--compact')}>
      <div className="dg-room-res-slot-toolbar">
        <div className="dg-room-res-field dg-room-res-slot-date-field">
          <label htmlFor="room-res-slot-date" className="dg-room-res-label">
            Date <span className="dg-room-res-required">*</span>
          </label>
          <DgPlanCompactDateField
            id="room-res-slot-date"
            value={date}
            onChange={onDateChange}
          />
        </div>
        {data?.schedule ? (
          <p className="dg-room-res-slot-hint">
            {data.schedule.durationMinutes} min · {data.schedule.workDayStart}–{data.schedule.workDayEnd}
          </p>
        ) : null}
      </div>

      <div className="dg-avail-grid-wrap dg-room-res-slot-grid-wrap">
        {loading ? (
          <div className="dg-avail-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="dg-room-res-slot-error">{loadError}</p>
        ) : data?.slots.length ? (
          <div className="dg-avail-grid">
            {data.slots.map((slot) => {
              const passed =
                slot.status === 'AVAILABLE' && isSlotStartInThePast(date, slot.startTime);
              const isSelected =
                !passed &&
                slot.status === 'AVAILABLE' &&
                selected != null &&
                timeToMinutes(slot.startTime) >= timeToMinutes(selected.startTime) &&
                timeToMinutes(slot.endTime) <= timeToMinutes(selected.endTime);
              const selectable = slot.status === 'AVAILABLE' && !passed;
              return (
                <button
                  key={`${slot.startTime}-${slot.endTime}`}
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    const extension =
                      startTime && timeToMinutes(slot.endTime) > timeToMinutes(startTime)
                        ? explainRoomSpan(data?.slots ?? [], startTime, slot.endTime)
                        : null;
                    if (extension?.ok) {
                      onSlotSelect({ startTime, endTime: slot.endTime });
                      return;
                    }
                    onSlotSelect({ startTime: slot.startTime, endTime: slot.endTime });
                  }}
                  className={cn(
                    'dg-avail-slot',
                    slotClass(passed ? 'BLOCKED' : slot.status),
                    isSelected && 'dg-avail-slot--selected'
                  )}
                  title={
                    passed
                      ? `${slot.startTime}–${slot.endTime} · ${PAST_SLOT_MESSAGE}`
                      : `${slot.startTime}–${slot.endTime} · ${slotLabel(slot)}${slot.reason ? ` — ${slot.reason}` : ''}`
                  }
                >
                  <span className="dg-avail-slot-time">
                    {slot.startTime}–{slot.endTime}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="dg-room-res-slot-error">Aucun créneau pour cette date.</p>
        )}
      </div>

      <RoomSlotSpanEditor
        slots={data?.slots ?? []}
        startTime={startTime}
        endTime={endTime}
        onChange={onSlotSelect}
      />

      {!compact ? (
        selected ? (
          <p className="dg-room-res-slot-selected">
            Créneau sélectionné : <strong>{selected.startTime}–{selected.endTime}</strong>
          </p>
        ) : (
          <p className="dg-room-res-slot-selected dg-room-res-slot-selected--empty">
            Sélectionnez un créneau disponible.
          </p>
        )
      ) : null}
    </div>
  );
}
