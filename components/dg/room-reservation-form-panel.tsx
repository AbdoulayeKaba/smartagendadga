'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, Calendar, Clock, Loader2, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  buildRoomReservationBody,
  emptyRoomReservationForm,
  ROOM_USAGE_OPTIONS,
  type RoomReservationForm,
  type RoomReservationInitial,
} from '@/lib/dg/room-reservation-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MeetingRoom } from '@/lib/services/room-availability';
import { DgPlanCompactSelect } from '@/components/appointments/dg-plan-compact-fields';
import { isSlotStartInThePast, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import { explainRoomSpan } from '@/lib/dg/room-slot-span';
import { RoomSlotSpanEditor } from '@/components/dg/room-slot-span-editor';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';

type Props = {
  room: MeetingRoom;
  initial: RoomReservationInitial;
  onClose: () => void;
  onSuccess: () => void;
};

function formatFormDate(date: string) {
  if (!date) return null;
  try {
    return format(new Date(`${date}T12:00:00`), 'EEE d MMM yyyy', { locale: fr });
  } catch {
    return date;
  }
}

export function RoomReservationFormPanel({ room, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<RoomReservationForm>(() => emptyRoomReservationForm(initial));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = useMemo(() => {
    const label = formatFormDate(form.date);
    if (!label) return null;
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [form.date]);

  useEffect(() => {
    setForm(emptyRoomReservationForm(initial));
    setError(null);
  }, [initial.date, initial.startTime, initial.endTime, room.id]);

  useEffect(() => {
    if (!room.id || !form.date) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ date: form.date, roomId: room.id });
        const res = await fetch(`/api/dg/availability?${params}`);
        if (!res.ok) return;
        const payload = (await res.json()) as { slots?: AvailabilitySlot[] };
        if (!cancelled) setSlots(payload.slots ?? []);
      } catch {
        if (!cancelled) setSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id, form.date]);

  const set = useCallback((patch: Partial<RoomReservationForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.date || !form.startTime || !form.endTime) {
      setError('Objet et horaires sont requis.');
      return;
    }
    if (isSlotStartInThePast(form.date, form.startTime)) {
      setError(PAST_SLOT_MESSAGE);
      return;
    }
    if (slots.length) {
      const span = explainRoomSpan(slots, form.startTime, form.endTime);
      if (!span.ok) {
        setError(span.message);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dg/room-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRoomReservationBody(form, room)),
      });
      const raw = await res.text();
      let json: { message?: string; error?: string; pending?: boolean } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as typeof json;
        } catch {
          setError('Réponse serveur invalide. Réessayez ou contactez l’administrateur.');
          return;
        }
      }
      if (!res.ok) {
        setError(json.message ?? 'Impossible d’enregistrer la réservation.');
        return;
      }
      toast({
        title: 'Demande envoyée',
        description: `${room.name} · ${form.startTime}–${form.endTime} — en attente de validation par l’assistante.`,
      });
      onSuccess();
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-dossier dg-room-book" aria-label="Formulaire de réservation de salle">
      <header className="contact-dossier-bar">
        <h2>
          <Building2 aria-hidden /> Réservation de salle
        </h2>
      </header>

      <section className="dg-room-book-summary">
        <span className="dg-room-book-mark" aria-hidden>
          <Building2 />
        </span>
        <div>
          <strong>{room.name}</strong>
          <span>
            {dateLabel ? (
              <>
                <Calendar aria-hidden /> {dateLabel}
              </>
            ) : null}
            <Clock aria-hidden /> {form.startTime}–{form.endTime}
          </span>
        </div>
      </section>

      <div className="contact-dossier-body dg-room-book-body">
        <article className="contact-dossier-card dg-room-book-card">
          <header>
            <h3>Créneau</h3>
          </header>
          <RoomSlotSpanEditor
            slots={slots}
            startTime={form.startTime}
            endTime={form.endTime}
            onChange={(slot) => set(slot)}
          />
        </article>

        <article className="contact-dossier-card dg-room-book-card">
          <header>
            <h3>Demande</h3>
          </header>
          <div className="dg-room-res-sheet-fields">
            <div className="dg-room-res-field">
              <label htmlFor="room-res-title" className="dg-room-res-label">
                Objet <span className="dg-room-res-required">*</span>
              </label>
              <Input
                id="room-res-title"
                className="dg-room-res-input"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Ex. Point coordination budget"
              />
            </div>
            <div className="dg-room-res-field">
              <label htmlFor="room-res-usage" className="dg-room-res-label">
                Type d&apos;usage
              </label>
              <DgPlanCompactSelect
                id="room-res-usage"
                value={form.usageType}
                options={ROOM_USAGE_OPTIONS}
                onChange={(v) => set({ usageType: v as RoomReservationForm['usageType'] })}
              />
            </div>
            <div className="dg-room-res-field">
              <label htmlFor="room-res-notes" className="dg-room-res-label">
                Notes
              </label>
              <Textarea
                id="room-res-notes"
                className="dg-room-res-textarea dg-room-res-textarea--compact"
                value={form.logisticsNotes}
                onChange={(e) => set({ logisticsNotes: e.target.value })}
                placeholder="Disposition, matériel…"
                rows={1}
              />
            </div>
          </div>
          {error ? <p className="dg-room-res-error">{error}</p> : null}
        </article>

        <p className="dg-room-book-note">Transmise à l’assistante pour validation.</p>

        <div className="contact-dossier-actions dg-room-book-actions">
          <button
            type="button"
            className="is-primary"
            disabled={loading || !form.title.trim()}
            onClick={() => void submit()}
          >
            {loading ? <Loader2 aria-hidden /> : <Send aria-hidden />}
            Envoyer la demande
          </button>
          <button type="button" onClick={onClose} disabled={loading}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
