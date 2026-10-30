'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DgaDecisionCards } from '@/components/dg/dga-decision-cards';
import type { DgaTomorrowBrief } from '@/lib/dg/dga-focus';

export function DgaTomorrowView() {
  const [brief, setBrief] = useState<DgaTomorrowBrief | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dg/dga-focus', { cache: 'no-store' });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const json = (await res.json()) as { tomorrow?: DgaTomorrowBrief };
      setBrief(json.tomorrow ?? null);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="dga-tomorrow">
      <header className="dga-tomorrow-head">
        <div>
          <p>Briefing de demain</p>
          <h1>{brief?.dateLabel ?? 'Demain'}</h1>
        </div>
        <Link href="/dg/dashboard">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Retour à l&apos;agenda
        </Link>
      </header>

      {failed ? <p className="dga-focus-empty">Impossible de charger le briefing.</p> : null}
      {!brief && !failed ? <p className="dga-focus-empty">Chargement…</p> : null}

      {brief ? (
        <>
          <section className="dg-cockpit-card dga-focus">
            <header className="dg-cockpit-card-head">
              <h2>Premier créneau</h2>
              <span>{brief.confirmedCount} confirmé{brief.confirmedCount > 1 ? 's' : ''}</span>
            </header>
            {brief.first ? (
              <article className="dga-tomorrow-first">
                <time>{brief.first.timeLabel}</time>
                <h3>{brief.first.title}</h3>
                <p>
                  <span className={brief.first.mode === 'En ligne' ? 'is-online' : 'is-onsite'}>
                    {brief.first.mode}
                  </span>
                  <span>{brief.first.place}</span>
                </p>
                {brief.first.teamsUrl ? (
                  <a href={brief.first.teamsUrl} target="_blank" rel="noreferrer">
                    Ouvrir le lien
                  </a>
                ) : null}
              </article>
            ) : (
              <p className="dga-focus-empty">Aucun rendez-vous confirmé demain.</p>
            )}
          </section>

          <section className="dg-cockpit-card dga-focus">
            <header className="dg-cockpit-card-head">
              <h2>Chevauchements</h2>
            </header>
            {brief.conflicts.length === 0 ? (
              <p className="dga-focus-empty">Aucun chevauchement sur les rendez-vous confirmés.</p>
            ) : (
              <ul className="dga-tomorrow-conflicts">
                {brief.conflicts.map((conflict) => (
                  <li key={conflict.id}>{conflict.message}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="dg-cockpit-card dga-focus" aria-label="Décisions de demain">
            <header className="dg-cockpit-card-head">
              <h2>Encore à trancher</h2>
            </header>
            <DgaDecisionCards
              cards={brief.decisions}
              onChanged={() => void load()}
              emptyLabel="Tout est tranché pour demain."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
