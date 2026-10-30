'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, Check, Clock, Loader2, UserRound, X } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { toast } from '@/hooks/use-toast';
import {
  ROOM_USAGE_LABELS,
  type RoomReservationReviewItem,
} from '@/lib/dg/room-reservation-review';
import { cn } from '@/lib/utils';

type Props = {
  onChanged?: () => void;
};

type ConfirmAction =
  | { type: 'approve'; item: RoomReservationReviewItem }
  | { type: 'reject'; item: RoomReservationReviewItem };

function formatSlot(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${format(start, 'EEE d MMM', { locale: fr })} · ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
}

export function RoomReservationsReviewPanel({ onChanged }: Props) {
  const [items, setItems] = useState<RoomReservationReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dg/room-reservations?status=PENDING');
      if (!res.ok) {
        setItems([]);
        return;
      }
      const json = (await res.json()) as { items: RoomReservationReviewItem[] };
      setItems(json.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runDecision = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dg/room-reservations/${confirmAction.item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmAction.type === 'approve' ? 'APPROVE' : 'REJECT',
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast({
          title: 'Action impossible',
          description: json.message ?? 'La demande n’a pas pu être traitée.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: confirmAction.type === 'approve' ? 'Réservation confirmée' : 'Demande refusée',
        description: confirmAction.item.title,
      });
      setConfirmAction(null);
      await load();
      onChanged?.();
    } finally {
      setActionLoading(false);
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <>
      <section className="dg-room-review-panel" aria-label="Demandes de réservation en attente">
        <header className="dg-room-review-head">
          <div className="dg-room-review-head-main">
            <span className="dg-room-review-icon" aria-hidden>
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="dg-room-review-title">Demandes de salle en attente</h2>
              <p className="dg-room-review-sub">
                {loading ? 'Chargement…' : `${items.length} demande${items.length > 1 ? 's' : ''} à valider`}
              </p>
            </div>
          </div>
          <div className="dg-room-review-head-actions">
            <button
              type="button"
              className="dg-room-review-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Réduire' : 'Afficher'}
            </button>
            <Link href="/dg/availability/reservations" className="dg-room-review-link">
              Voir tout
            </Link>
          </div>
        </header>

        {expanded ? (
          <div className="dg-room-review-body">
            {loading ? (
              <div className="dg-room-review-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <ul className="dg-room-review-list">
                {items.map((item) => (
                  <li key={item.id} className="dg-room-review-item">
                    <div className="dg-room-review-item-main">
                      <p className="dg-room-review-item-title">{item.title}</p>
                      <p className="dg-room-review-item-meta">
                        <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{item.roomName}</span>
                        <span className="dg-room-review-dot">·</span>
                        <Clock className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{formatSlot(item.startAt, item.endAt)}</span>
                      </p>
                      <p className="dg-room-review-item-meta">
                        <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{item.bookedByName}</span>
                        <span className="dg-room-review-dot">·</span>
                        <span>{ROOM_USAGE_LABELS[item.usageType]}</span>
                        <span className="dg-room-review-dot">·</span>
                        <span>{item.organizerService}</span>
                      </p>
                    </div>
                    <div className="dg-room-review-actions">
                      <button
                        type="button"
                        className={cn('dg-room-review-btn', 'dg-room-review-btn--approve')}
                        disabled={actionLoading}
                        onClick={() => setConfirmAction({ type: 'approve', item })}
                        title="Valider la réservation"
                      >
                        <Check className="h-3 w-3" />
                        Valider
                      </button>
                      <button
                        type="button"
                        className={cn('dg-room-review-btn', 'dg-room-review-btn--reject')}
                        disabled={actionLoading}
                        onClick={() => setConfirmAction({ type: 'reject', item })}
                        title="Refuser la demande"
                      >
                        <X className="h-3 w-3" />
                        Refuser
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <AdminConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === 'approve'
            ? 'Confirmer la réservation ?'
            : 'Refuser la demande ?'
        }
        message={
          confirmAction ? (
            <>
              <span className="font-medium text-foreground">{confirmAction.item.title}</span>
              <br />
              {confirmAction.item.roomName} · {formatSlot(confirmAction.item.startAt, confirmAction.item.endAt)}
            </>
          ) : null
        }
        confirmLabel={confirmAction?.type === 'approve' ? 'Valider' : 'Refuser'}
        intent={confirmAction?.type === 'approve' ? 'success' : 'destructive'}
        loading={actionLoading}
        onConfirm={() => void runDecision()}
      />
    </>
  );
}
