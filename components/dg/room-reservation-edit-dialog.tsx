'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  buildRoomReservationBody,
  roomReservationFormFromItem,
  ROOM_USAGE_OPTIONS,
  type RoomReservationForm,
} from '@/lib/dg/room-reservation-form';
import type { RoomReservationReviewItem } from '@/lib/dg/room-reservation-review';
import { RoomReservationSlotPicker } from '@/components/dg/room-reservation-slot-picker';
import { DgPlanCompactSelect } from '@/components/appointments/dg-plan-compact-fields';

type Props = {
  item: RoomReservationReviewItem | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function RoomReservationEditDialog({ item, open, loading: externalLoading, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<RoomReservationForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item && open) {
      setForm(roomReservationFormFromItem(item));
      setError(null);
    }
  }, [item, open]);

  const set = useCallback((patch: Partial<RoomReservationForm>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setError(null);
  }, []);

  const handleSlotSelect = useCallback(
    (slot: { startTime: string; endTime: string }) => set(slot),
    [set]
  );

  const submit = async () => {
    if (!item || !form) return;
    if (!form.title.trim() || !form.date || !form.startTime || !form.endTime) {
      setError('Objet et horaires sont requis.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dg/room-reservations/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildRoomReservationBody(form, { id: item.roomId, name: item.roomName })
        ),
      });
      const raw = await res.text();
      let json: { message?: string; pending?: boolean } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as { message?: string };
        } catch {
          setError('Réponse serveur invalide.');
          return;
        }
      }
      if (!res.ok) {
        setError(json.message ?? 'Impossible de modifier la réservation.');
        return;
      }
      toast({
        title: json.pending ? 'Créneau modifié — en attente' : 'Réservation modifiée',
        description: json.pending
          ? `${item.roomName} · ${form.startTime}–${form.endTime} — validation assistante requise.`
          : `${item.roomName} · ${form.startTime}–${form.endTime}`,
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

  if (!item || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-theme dg-room-res-edit-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[32rem]">
        <header className="dg-room-res-form-header">
          <div className="dg-room-res-form-header-icon" aria-hidden>
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="dg-room-res-form-title">Modifier la réservation</DialogTitle>
            <DialogDescription className="dg-room-res-form-desc">
              {item.roomName} — ajustez les informations et le créneau.
            </DialogDescription>
          </div>
        </header>

        <div className="dg-room-res-form-body dg-room-res-edit-dialog-body">
          <div className="dg-room-res-form-section dg-room-res-form-section--slot">
            <RoomReservationSlotPicker
              compact
              roomId={item.roomId}
              date={form.date}
              startTime={form.startTime}
              endTime={form.endTime}
              excludeReservationId={item.id}
              onDateChange={(date) => {
                setForm((prev) => {
                  if (!prev) return prev;
                  if (date === prev.date) return prev;
                  return { ...prev, date, startTime: '', endTime: '' };
                });
                setError(null);
              }}
              onSlotSelect={handleSlotSelect}
            />
          </div>

          <div className="dg-room-res-form-panel">
            <div className="dg-room-res-form-section">
              <p className="dg-room-res-form-section-title">Informations</p>
              <div className="dg-room-res-form-grid">
                <div className="dg-room-res-form-row-dual">
                  <div className="dg-room-res-field">
                    <label htmlFor="room-res-edit-title" className="dg-room-res-label">
                      Objet de la réservation <span className="dg-room-res-required">*</span>
                    </label>
                    <Input
                      id="room-res-edit-title"
                      className="dg-room-res-input"
                      value={form.title}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </div>
                  <div className="dg-room-res-field">
                    <label htmlFor="room-res-edit-usage" className="dg-room-res-label">
                      Type d&apos;usage
                    </label>
                    <DgPlanCompactSelect
                      id="room-res-edit-usage"
                      value={form.usageType}
                      options={ROOM_USAGE_OPTIONS}
                      onChange={(v) => set({ usageType: v as RoomReservationForm['usageType'] })}
                    />
                  </div>
                </div>
                <div className="dg-room-res-field dg-room-res-field--full">
                  <label htmlFor="room-res-edit-notes" className="dg-room-res-label">
                    Notes
                  </label>
                  <Textarea
                    id="room-res-edit-notes"
                    className="dg-room-res-textarea dg-room-res-textarea--compact"
                    value={form.logisticsNotes}
                    onChange={(e) => set({ logisticsNotes: e.target.value })}
                    rows={1}
                    placeholder="Disposition, matériel…"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="dg-room-res-error px-4 pb-2">{error}</p> : null}

        <footer className="dg-room-res-form-footer">
          <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-create"
            disabled={busy || !form.title.trim() || !form.date || !form.startTime || !form.endTime}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            Enregistrer
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
