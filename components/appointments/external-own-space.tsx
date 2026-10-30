'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  LayoutDashboard,
  Loader2,
  XCircle,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { APP_TIMEZONE } from '@/lib/datetime/locale';
import { formatTimeInAppTz } from '@/lib/datetime/format';

type OwnItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Validé',
  REJECTED: 'Refusé',
};

function dayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function dayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)));
}

export function ExternalOwnSpace({ mode }: { mode: 'board' | 'agenda' }) {
  const [items, setItems] = useState<OwnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/appointments/mine?involved=1')
      .then(async (res) => {
        if (!res.ok) throw new Error('LOAD');
        return res.json() as Promise<{ items?: OwnItem[] }>;
      })
      .then((json) => {
        if (!cancelled) setItems(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger vos rendez-vous.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();
  const upcoming = items.filter((item) => item.status === 'APPROVED' && new Date(item.startAt).getTime() >= now);
  const pending = items.filter((item) => item.status === 'PENDING');
  const approved = items.filter((item) => item.status === 'APPROVED');
  const rejected = items.filter((item) => item.status === 'REJECTED');

  const groups = useMemo(() => {
    const map = new Map<string, OwnItem[]>();
    for (const item of items) {
      const key = dayKey(item.startAt);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => ({
        key,
        label: dayLabel(key),
        rows: rows.sort((a, b) => a.startAt.localeCompare(b.startAt)),
      }));
  }, [items]);

  const nextItems = [...items]
    .filter((item) => new Date(item.endAt).getTime() >= now && item.status !== 'REJECTED')
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 6);

  const kpis = [
    { key: 'upcoming', label: 'À venir', value: upcoming.length, icon: CalendarClock },
    { key: 'pending', label: 'En attente', value: pending.length, icon: Clock3 },
    { key: 'approved', label: 'Validés', value: approved.length, icon: CheckCircle2 },
    { key: 'rejected', label: 'Refusés', value: rejected.length, icon: XCircle },
  ] as const;

  return (
    <div className="app-page admin-theme ext-own-page mx-auto w-full max-w-none">
      <AdminPageHeader
        variant="flat"
        title={mode === 'board' ? 'Tableau de bord' : 'Agenda'}
        description={
          mode === 'board'
            ? 'Vos demandes et les rendez-vous auxquels vous êtes invité.'
            : 'Créneaux que vous avez demandés ou pour lesquels vous êtes invité.'
        }
        mark={
          <span className="ext-plan-mark" aria-hidden>
            {mode === 'board' ? <LayoutDashboard className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          </span>
        }
      />

      {loading ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement…
        </p>
      ) : error ? (
        <p className="p-4 text-sm text-destructive">{error}</p>
      ) : mode === 'board' ? (
        <div className="ext-own-board">
          <div className="ext-own-kpis">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <article key={kpi.key} className={`ext-own-kpi ext-own-kpi--${kpi.key}`}>
                  <span className="ext-own-kpi-icon" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <strong>{kpi.value}</strong>
                    <span>{kpi.label}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="ext-own-grid">
            <section className="ext-own-card" aria-labelledby="ext-own-next-title">
              <header className="ext-own-card-head">
                <h2 id="ext-own-next-title">Prochains rendez-vous</h2>
              </header>
              {nextItems.length === 0 ? (
                <div className="ext-own-empty">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                  <p>Aucun rendez-vous à venir pour le moment.</p>
                  <small>Une demande validée par l’assistante apparaîtra ici.</small>
                </div>
              ) : (
                <ul className="ext-own-list">
                  {nextItems.map((item) => (
                    <li key={item.id}>
                      <time dateTime={item.startAt}>
                        <span className="capitalize">{dayLabel(dayKey(item.startAt))}</span>
                        <strong>{formatTimeInAppTz(item.startAt)}</strong>
                      </time>
                      <span className="ext-own-item-title">{item.title}</span>
                      <span className={`ext-own-status ext-own-status--${item.status.toLowerCase()}`}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <aside className="ext-own-side" aria-label="Raccourcis">
              <section className="ext-own-card">
                <h2>Raccourcis</h2>
                <ul className="ext-own-links">
                  <li>
                    <Link href="/dg/activity">
                      <History className="h-4 w-4" aria-hidden />
                      Historique
                    </Link>
                  </li>
                </ul>
              </section>
              <section className="ext-own-card ext-own-card--tips">
                <h2>Bonnes pratiques</h2>
                <ol className="ext-plan-tips">
                  <li>
                    <span aria-hidden>1</span>
                    Précisez un objet explicite et un motif clair.
                  </li>
                  <li>
                    <span aria-hidden>2</span>
                    Déposez la demande au moins 2 jours avant le créneau.
                  </li>
                  <li>
                    <span aria-hidden>3</span>
                    Le rendez-vous n’apparaît ici qu’après validation.
                  </li>
                </ol>
              </section>
            </aside>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="ext-own-card ext-own-empty-card">
          <CalendarDays className="h-5 w-5" aria-hidden />
          <p>Aucun rendez-vous sur votre agenda.</p>
        </div>
      ) : (
        <div className="ext-own-agenda">
          {groups.map((group) => (
            <section key={group.key} className="ext-own-card" aria-labelledby={`day-${group.key}`}>
              <h2 id={`day-${group.key}`} className="capitalize">
                {group.label}
              </h2>
              <ul className="ext-own-list">
                {group.rows.map((item) => (
                  <li key={item.id}>
                    <time dateTime={item.startAt}>
                      <strong>
                        {formatTimeInAppTz(item.startAt)} – {formatTimeInAppTz(item.endAt)}
                      </strong>
                    </time>
                    <span className="ext-own-item-title">{item.title}</span>
                    <span className={`ext-own-status ext-own-status--${item.status.toLowerCase()}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
