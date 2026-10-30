'use client';

import { useCallback, useEffect, useState } from 'react';
import { isSlotStartInThePast, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import Link from 'next/link';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarPlus,
  LayoutList,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';
import type { MeetingRoom, RoomAvailabilityResult } from '@/lib/services/room-availability';
import { DgAvailabilityWeekStrip } from '@/components/dg/dg-availability-week-strip';
import { RoomReservationFormPanel } from '@/components/dg/room-reservation-form-panel';
import { useDgRole } from '@/lib/auth/use-dg-role';
import {
  DG_ROOM_MY_RESERVATIONS_HREF,
  DG_ROOM_MY_RESERVATIONS_LINK_LABEL,
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LINK_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';
import { useApp } from '@/lib/app-context';
import { canRequestRoomReservation, canReviewRoomReservations } from '@/lib/dg/rbac';
import { PRIMARY_MEETING_ROOM_NAME } from '@/lib/dg/meeting-room-config';
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

export function DgAvailabilityView() {
  const searchParams = useSearchParams();
  const role = useDgRole();
  const canReview = canReviewRoomReservations(role);
  const canReserve = canRequestRoomReservation(role);
  const { permissions } = useApp();
  const canOpenReferentials = permissions['menu.admin.referentials'] === true;
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(() => {
    const fromUrl = searchParams.get('date');
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [data, setData] = useState<RoomAvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [roomSelectOpen, setRoomSelectOpen] = useState(false);

  const closeContextMenus = useCallback(() => {
    setRoomSelectOpen(false);
  }, []);

  const handleDateChange = useCallback(
    (nextDate: string) => {
      closeContextMenus();
      setDate(nextDate);
    },
    [closeContextMenus]
  );

  const handleRoomChange = useCallback(
    (nextRoomId: string) => {
      closeContextMenus();
      setRoomId(nextRoomId);
    },
    [closeContextMenus]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSelectSlot = useCallback(
    (slot: AvailabilitySlot) => {
      if (isSlotStartInThePast(date, slot.startTime, new Date(nowMs))) return;
      closeContextMenus();
      setSelected(slot);
      setShowReservationForm(false);
    },
    [closeContextMenus, date, nowMs]
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/dg/availability/rooms');
        if (!res.ok) {
          setRooms([]);
          setLoadError('Impossible de charger les salles.');
          return;
        }
        const payload = (await res.json()) as { items: MeetingRoom[] };
        setRooms(payload.items);
        setLoadError(null);
        const fromUrl = searchParams.get('roomId');
        if (fromUrl && payload.items.some((r) => r.id === fromUrl)) {
          setRoomId(fromUrl);
        } else if (payload.items[0]) {
          setRoomId(payload.items[0].id);
        }
      } catch {
        setRooms([]);
        setLoadError('Erreur réseau. Vérifiez votre connexion ou réessayez.');
      }
    })();
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!roomId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ date, roomId });
      const res = await fetch(`/api/dg/availability?${params.toString()}`);
      if (!res.ok) {
        setData(null);
        setLoadError('Impossible de charger les disponibilités.');
        return;
      }
      setData((await res.json()) as RoomAvailabilityResult);
      setSelected(null);
      setShowReservationForm(false);
    } catch {
      setData(null);
      setLoadError('Erreur réseau. Vérifiez votre connexion ou réessayez.');
    } finally {
      setLoading(false);
    }
  }, [date, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  return (
    <div className="dg-avail-page">
      <header className="dg-avail-head">
        <h1 className="dg-avail-head-title">{DG_ROOM_SLOTS_LABEL}</h1>
        <div className="dg-avail-head-actions">
          <Link
            href={canReview ? DG_ROOM_RESERVATIONS_HREF : DG_ROOM_MY_RESERVATIONS_HREF}
            className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--secondary dg-avail-reservations-link"
          >
            <LayoutList className="h-3 w-3" />
            {canReview ? DG_ROOM_RESERVATIONS_LINK_LABEL : DG_ROOM_MY_RESERVATIONS_LINK_LABEL}
          </Link>
          <button
            type="button"
            className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualiser"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
        </div>
      </header>

      <section className="dg-avail-panel">
        <div className="dg-avail-controls">
          {rooms.length <= 1 ? (
            <div className="dg-avail-room-select dg-avail-room-fixed" aria-label="Salle">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--admin-primary)]" aria-hidden />
              <span className="truncate">{selectedRoom?.name ?? PRIMARY_MEETING_ROOM_NAME}</span>
            </div>
          ) : (
            <Select
              open={roomSelectOpen}
              onOpenChange={setRoomSelectOpen}
              value={roomId}
              onValueChange={handleRoomChange}
              disabled={rooms.length === 0}
            >
              <SelectTrigger id="avail-room" className="dg-avail-room-select" aria-label="Salle">
                <SelectValue placeholder="Salle" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Label htmlFor="avail-date" className="sr-only">
            Date
          </Label>
          <FrenchDateField
            id="avail-date"
            className="dg-avail-date-input"
            variant="compact"
            value={date}
            onChange={handleDateChange}
          />
        </div>

        <DgAvailabilityWeekStrip selectedDate={date} onSelectDate={handleDateChange} roomId={roomId} />
      </section>

      {data ? (
        <>
          <div className="dg-avail-stats">
            <span>
              <strong>{data.daySummary.availableCount}</strong> lib.
            </span>
            <span>
              <strong>{data.daySummary.busyCount}</strong> occ.
            </span>
            {data.daySummary.bufferCount > 0 ? (
              <span>
                <strong>{data.daySummary.bufferCount}</strong> tamp.
              </span>
            ) : null}
            <span>
              <strong>{data.daySummary.bookingsCount}</strong> rés.
            </span>
            {data.daySummary.appointmentOccupancyCount > 0 ? (
              <span>
                <strong>{data.daySummary.appointmentOccupancyCount}</strong> aud.
              </span>
            ) : null}
            <span className="dg-avail-stats-hours">
              {data.schedule.workDayStart}–{data.schedule.workDayEnd} · {data.schedule.durationMinutes}m
            </span>
            {canOpenReferentials ? (
              <Link href="/dg/admin/referentials" className="dg-avail-stats-link">
                Référentiel
              </Link>
            ) : null}
          </div>

          {data.daySummary.policyBlock ? (
            <div className="dg-avail-alert">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
              <span>Journée non planifiable.</span>
            </div>
          ) : null}

          {canReserve && selected && !showReservationForm ? (
            <div className="dg-avail-action">
              <span className="dg-avail-action-time">
                {selected.startTime}–{selected.endTime}
                <span className="dg-avail-action-room"> · {data.room.name}</span>
              </span>
              <Button
                type="button"
                size="sm"
                className="admin-btn-primary dg-avail-action-btn"
                onClick={() => {
                  closeContextMenus();
                  setShowReservationForm(true);
                }}
              >
                <CalendarPlus className="h-3 w-3" />
                Réserver
              </Button>
            </div>
          ) : null}

          {canReserve && selected && selectedRoom ? (
            <Dialog
              open={showReservationForm}
              onOpenChange={(open) => {
                if (!open) setShowReservationForm(false);
              }}
            >
              <DialogContent className="admin-theme dg-room-book-dialog gap-0 border-[#e3ebe6] p-0 sm:max-w-[26.5rem]">
                <DialogTitle className="sr-only">Réservation de salle</DialogTitle>
                <DialogDescription className="sr-only">
                  Demande de réservation pour {selectedRoom.name}.
                </DialogDescription>
                <RoomReservationFormPanel
                  room={selectedRoom}
                  initial={{
                    date,
                    startTime: selected.startTime,
                    endTime: selected.endTime,
                    roomId: selectedRoom.id,
                    roomName: selectedRoom.name,
                  }}
                  onClose={() => setShowReservationForm(false)}
                  onSuccess={() => {
                    setShowReservationForm(false);
                    void load();
                  }}
                />
              </DialogContent>
            </Dialog>
          ) : null}

          <div className="dg-avail-grid-wrap">
            {loading ? (
              <div className="dg-avail-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="dg-avail-grid">
                {data.slots.map((slot) => {
                  const passed =
                    slot.status === 'AVAILABLE' &&
                    isSlotStartInThePast(date, slot.startTime, new Date(nowMs));
                  const selectable = slot.status === 'AVAILABLE' && !passed;
                  return (
                  <button
                    key={`${slot.startTime}-${slot.endTime}`}
                    type="button"
                    disabled={!selectable}
                onClick={() => handleSelectSlot(slot)}
                    className={cn(
                      'dg-avail-slot',
                      slotClass(passed ? 'BLOCKED' : slot.status),
                      selectable && selected?.startTime === slot.startTime && 'dg-avail-slot--selected'
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
                    {slot.status === 'BUSY' ? (
                      <span className="dg-avail-slot-note">Réservé</span>
                    ) : slot.status === 'BUFFER' ? (
                      <span className="dg-avail-slot-note">Tampon</span>
                    ) : null}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : !loading ? (
        <div className="dg-avail-empty">
          <XCircle className="h-5 w-5 text-destructive/60" aria-hidden />
          <p>
            {loadError ??
              (rooms.length === 0
                ? 'Aucune salle configurée.'
                : 'Impossible de charger les disponibilités.')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
