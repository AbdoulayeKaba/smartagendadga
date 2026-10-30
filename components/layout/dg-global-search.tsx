'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Search } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/dg/appointments-review';

type SearchItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  priority: string;
  requestedByName: string;
  href: string;
};

export function DgGlobalSearch() {
  const router = useRouter();
  const { permissions } = useApp();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const searchTarget = useMemo(() => {
    if (permissions['appointments.review']) return '/dg/appointments';
    if (permissions['appointments.view_own']) return '/appointments/mine';
    return '/dg/appointments';
  }, [permissions]);

  const submitFullSearch = useCallback(() => {
    const needle = q.trim();
    if (!needle) return;
    setOpen(false);
    router.push(`${searchTarget}?q=${encodeURIComponent(needle)}`);
  }, [q, router, searchTarget]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dg/search?q=${encodeURIComponent(needle)}`);
        if (!res.ok) {
          setItems([]);
          return;
        }
        const json = (await res.json()) as { items: SearchItem[] };
        setItems(json.items ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="dg-search-wrap relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {loading ? (
        <Loader2 className="absolute right-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      <input
        type="search"
        placeholder="Rechercher…"
        className="dg-header-search dg-header-search--compact"
        aria-label="Recherche globale"
        aria-expanded={open}
        aria-autocomplete="list"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (q.trim().length >= 2 && items.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitFullSearch();
          if (e.key === 'Escape') setOpen(false);
        }}
      />

      {open && q.trim().length >= 2 ? (
        <div className="dg-search-dropdown" role="listbox">
          {items.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun résultat</p>
          ) : (
            <>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  className="dg-search-result"
                  onClick={() => {
                    setOpen(false);
                    router.push(`${searchTarget}?q=${encodeURIComponent(item.title)}`);
                  }}
                >
                  <span className="dg-search-result-title">{item.title}</span>
                  <span className="dg-search-result-meta">
                    {format(new Date(item.startAt), 'd MMM yyyy · HH:mm', { locale: fr })}
                    {item.requestedByName ? ` · ${item.requestedByName}` : ''}
                  </span>
                  <span className="dg-search-result-badges">
                    <span className="dg-search-badge">
                      {APPOINTMENT_STATUS_LABELS[item.status as keyof typeof APPOINTMENT_STATUS_LABELS] ??
                        item.status}
                    </span>
                    <span className="dg-search-badge dg-search-badge--muted">{item.priority}</span>
                  </span>
                </button>
              ))}
              <button type="button" className="dg-search-footer" onClick={submitFullSearch}>
                Voir tous les résultats pour « {q.trim()} »
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
