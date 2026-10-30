'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DgaDecisionCards } from '@/components/dg/dga-decision-cards';
import type { DgaDecisionCard } from '@/lib/dg/dga-focus';

export function DgaDecisions() {
  const [cards, setCards] = useState<DgaDecisionCard[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dg/dga-focus', { cache: 'no-store' });
      if (!res.ok) {
        setCards([]);
        return;
      }
      const json = (await res.json()) as { decisions?: DgaDecisionCard[] };
      setCards(json.decisions ?? []);
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="dg-cockpit-card dga-focus" aria-label="Décisions du jour">
      <header className="dg-cockpit-card-head">
        <h2>Décisions du jour</h2>
        <Link href="/dg/demain">Briefing de demain</Link>
      </header>
      {cards === null ? (
        <p className="dga-focus-empty">Chargement des décisions…</p>
      ) : (
        <DgaDecisionCards cards={cards} onChanged={() => void load()} />
      )}
    </section>
  );
}
