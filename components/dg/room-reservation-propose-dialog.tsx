'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { formatDateMedium, formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';
import type { RoomReservationReviewItem } from '@/lib/dg/room-reservation-review';
import { RoomReservationSlotPicker } from '@/components/dg/room-reservation-slot-picker';
import { cn } from '@/lib/utils';

/** `dateKey` au format YYYY-MM-DD : on ancre à midi local pour éviter tout décalage. */
function formatDayLabel(dateKey: string): string {
  if (!dateKey) return '';
  return formatDateMedium(new Date(`${dateKey}T12:00:00`));
}

type Props = {
  item: RoomReservationReviewItem | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function RoomReservationProposeDialog({
  item,
  open,
  loading: externalLoading,
  onOpenChange,
  onSuccess,
}: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item && open) {
      setDate(formatIsoDateInAppTz(item.startAt));
      setStartTime(formatTimeInAppTz(item.startAt));
      setEndTime(formatTimeInAppTz(item.endAt));
      setNote('');
      setError(null);
    }
  }, [item, open]);

  const handleSlotSelect = useCallback((slot: { startTime: string; endTime: string }) => {
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setError(null);
  }, []);

  const submit = async () => {
    if (!item || !date || !startTime || !endTime) {
      setError('Sélectionnez un créneau disponible.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dg/room-reservations/${item.id}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          note: note.trim() || undefined,
        }),
      });
      const raw = await res.text();
      let json: { message?: string } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as { message?: string };
        } catch {
          setError('Réponse serveur invalide.');
          return;
        }
      }
      if (!res.ok) {
        setError(json.message ?? 'Impossible de proposer ce créneau.');
        return;
      }
      toast({
        title: 'Créneau proposé',
        description: `${item.title} · ${startTime}–${endTime} — en attente de validation.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || externalLoading;
  const hasSlot = Boolean(date && startTime && endTime);
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-theme dg-room-res-propose-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[32rem]">
        <header className="dg-room-res-form-header">
          <div className="dg-room-res-form-header-icon" aria-hidden>
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="dg-room-res-form-title">Proposer un créneau</DialogTitle>
            <DialogDescription className="dg-room-res-form-desc">
              {item.title} · {item.roomName}
            </DialogDescription>
          </div>
        </header>

        <div className="dg-room-res-form-body dg-room-res-edit-dialog-body">
          <div className="dg-room-res-form-section dg-room-res-form-section--slot">
            <RoomReservationSlotPicker
              compact
              roomId={item.roomId}
              date={date}
              startTime={startTime}
              endTime={endTime}
              excludeReservationId={item.id}
              onDateChange={(next) => {
                if (next === date) return;
                setDate(next);
                setStartTime('');
                setEndTime('');
                setError(null);
              }}
              onSlotSelect={handleSlotSelect}
            />
            <p className="dg-room-res-edit-pending-hint">
              Le nouveau créneau restera en attente jusqu&apos;à validation.
            </p>
          </div>

          <div
            className={cn(
              'dg-room-res-propose-recap',
              !hasSlot && 'dg-room-res-propose-recap--empty'
            )}
            aria-live="polite"
          >
            <span className="dg-room-res-propose-recap-label">Créneau proposé</span>
            <span className="dg-room-res-propose-recap-value">
              {hasSlot ? `${formatDayLabel(date)} · ${startTime}–${endTime}` : 'Aucun créneau sélectionné'}
            </span>
          </div>

          <div className="dg-room-res-form-panel">
            <div className="dg-room-res-form-section">
              <label htmlFor="room-res-propose-note" className="dg-room-res-form-section-title">
                Message au demandeur
              </label>
              <Textarea
                id="room-res-propose-note"
                className="dg-room-res-textarea dg-room-res-textarea--compact"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. le créneau demandé est occupé, merci de confirmer celui-ci…"
                rows={2}
              />
            </div>
          </div>
        </div>

        {error ? <p className="dg-room-res-error">{error}</p> : null}

        <footer className="dg-room-res-form-footer">
          <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-create"
            disabled={busy || !hasSlot}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Proposer
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
