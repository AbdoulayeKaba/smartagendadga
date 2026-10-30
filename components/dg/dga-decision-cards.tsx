'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { DgaDecisionCard } from '@/lib/dg/dga-focus';

export function DgaDecisionCards({
  cards,
  onChanged,
  emptyLabel = "Rien à trancher pour aujourd'hui ni demain.",
}: {
  cards: DgaDecisionCard[];
  onChanged: () => void;
  emptyLabel?: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const visible = cards.slice(0, 3);
  const hidden = cards.length - visible.length;

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/appointments/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: action === 'APPROVE' ? 'Approbation impossible' : 'Refus impossible',
          description: json.message ?? 'Réessayez.',
        });
        return;
      }
      toast({
        title: action === 'APPROVE' ? 'Rendez-vous approuvé' : 'Demande refusée',
      });
      setRejectingId(null);
      onChanged();
    } catch {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: 'Réessayez.' });
    } finally {
      setBusyId(null);
    }
  };

  if (cards.length === 0) {
    return <p className="dga-focus-empty">{emptyLabel}</p>;
  }

  return (
    <div className="dga-focus-cards">
      {visible.map((card) => {
        const busy = busyId === card.id;
        return (
          <article key={card.id} className="dga-focus-card">
            <header>
              <span className="dga-focus-day">{card.dayLabel}</span>
              <time>{card.timeLabel}</time>
            </header>
            <h3>{card.title}</h3>
            <p>
              <span className={card.mode === 'En ligne' ? 'is-online' : 'is-onsite'}>{card.mode}</span>
              <span>{card.place}</span>
            </p>
            <div className="dga-focus-actions">
              <button type="button" disabled={busy} onClick={() => void decide(card.id, 'APPROVE')}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
                Approuver
              </button>
              {rejectingId === card.id ? (
                <button
                  type="button"
                  className="is-danger"
                  disabled={busy}
                  onClick={() => void decide(card.id, 'REJECT')}
                >
                  Confirmer le refus
                </button>
              ) : (
                <button type="button" className="is-danger" disabled={busy} onClick={() => setRejectingId(card.id)}>
                  <X className="h-4 w-4" aria-hidden />
                  Refuser
                </button>
              )}
              <Link href={`/dg/appointments?open=${encodeURIComponent(card.id)}`}>Reporter</Link>
            </div>
          </article>
        );
      })}
      {hidden > 0 ? (
        <p className="dga-focus-more">
          <Link href="/dg/appointments">Et {hidden} autre{hidden > 1 ? 's' : ''} demande{hidden > 1 ? 's' : ''}</Link>
        </p>
      ) : null}
    </div>
  );
}
