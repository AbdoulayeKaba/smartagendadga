'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Plane,
  RefreshCw,
  Sparkles,
  Umbrella,
  CalendarDays,
} from 'lucide-react';
import { LIVE_TOPICS, emitLiveRefresh } from '@/lib/dg/live-refresh';
import type { DgCalendarSyncResult } from '@/lib/services/dg-calendar-sync';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'running' | 'done' | 'error';

type Props = {
  year: number;
  compact?: boolean;
  onSynced?: () => void | Promise<void>;
};

const C = {
  primary: '#0f6b4c',
  primarySoft: '#e8f5ef',
  primaryMid: '#d3ebdd',
  primaryText: '#0b5a40',
  muted: '#64748b',
  line: '#e8eee9',
  surface: '#f6f9f7',
  ink: '#0f172a',
} as const;

const DETAIL_COLS = '1.25rem minmax(0, 1fr) 2.25rem 2.5rem';

function formatElapsed(ms: number) {
  return `${(Math.max(0, Math.round(ms / 100) / 10)).toFixed(1)} s`;
}

function Kpi({
  value,
  label,
  days,
  last,
}: {
  value: number;
  label: string;
  days: number;
  last?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-1.5 text-center"
      style={last ? undefined : { borderRight: `1px solid ${C.line}` }}
    >
      <span
        className="block text-[0.9375rem] font-bold tabular-nums leading-none tracking-tight"
        style={{ color: C.primary }}
      >
        {value}
      </span>
      <span
        className="block text-[8px] font-bold uppercase tracking-[0.06em] leading-none"
        style={{ color: C.muted }}
      >
        {label}
      </span>
      <span
        className="block text-[9px] font-semibold tabular-nums leading-none"
        style={{ color: C.primaryText }}
      >
        {days} j.
      </span>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  count,
  days,
  iconBg,
  iconColor,
}: {
  icon: typeof Plane;
  label: string;
  count: string;
  days: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="grid items-center gap-x-2" style={{ gridTemplateColumns: DETAIL_COLS }}>
      <span
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="min-w-0 truncate text-[10px] font-medium leading-none" style={{ color: C.muted }}>
        {label}
      </span>
      <span
        className="text-right text-[10px] font-bold tabular-nums leading-none"
        style={{ color: C.primary }}
      >
        {count}
      </span>
      <span
        className="text-right text-[10px] font-semibold tabular-nums leading-none"
        style={{ color: C.ink }}
      >
        {days}
      </span>
    </div>
  );
}

export function DgCalendarSyncControl({ year, compact, onSynced }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<DgCalendarSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const runSync = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('running');
    setResult(null);
    setError(null);
    const startedAt = Date.now();
    setElapsedMs(0);
    const tick = window.setInterval(() => {
      if (openRef.current) setElapsedMs(Date.now() - startedAt);
    }, 100);

    try {
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);
      const res = await fetch('/api/dg/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from.toISOString(),
          to: to.toISOString(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<DgCalendarSyncResult> & {
        message?: string;
      };

      if (!openRef.current) return;

      if (!res.ok || !json.missions || !json.unavailabilities || !json.holidays) {
        setPhase('error');
        setError(json.message ?? 'Synchronisation impossible.');
        return;
      }

      setResult({
        transitions: json.transitions ?? { plannedToOngoing: 0, ongoingToCompleted: 0 },
        missions: {
          total: json.missions.total,
          planned: json.missions.planned ?? 0,
          ongoing: json.missions.ongoing,
          completed: json.missions.completed,
          days: json.missions.days,
          daysPlanned: json.missions.daysPlanned ?? 0,
          daysOngoing: json.missions.daysOngoing,
          daysCompleted: json.missions.daysCompleted,
        },
        unavailabilities: json.unavailabilities,
        holidays: json.holidays,
        overlays: json.overlays ?? {
          missions: json.missions.days,
          unavailabilities: json.unavailabilities.days,
          holidays: json.holidays.days,
          total:
            json.missions.days + json.unavailabilities.days + json.holidays.days,
        },
      });
      setElapsedMs(Date.now() - startedAt);
      await onSyncedRef.current?.();
      emitLiveRefresh(LIVE_TOPICS.all);
      if (openRef.current) setPhase('done');
    } catch {
      if (openRef.current) {
        setPhase('error');
        setError('Erreur réseau.');
      }
    } finally {
      window.clearInterval(tick);
      busyRef.current = false;
    }
  }, [year]);

  useEffect(() => {
    if (open && phase === 'idle') {
      void runSync();
    }
  }, [open, phase, runSync]);

  const handleOpenChange = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) {
      setPhase('idle');
      setResult(null);
      setError(null);
      setElapsedMs(0);
    }
  };

  const m = result?.missions;
  const u = result?.unavailabilities;
  const h = result?.holidays;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'dg-cal-import-btn dg-cal-ai-btn',
            compact && 'dg-cal-import-btn--compact',
            open && 'dg-cal-ai-btn--open'
          )}
          aria-label="Synchroniser l'agenda"
          title="Synchroniser missions, indisponibilités, congés et jours fériés"
        >
          {phase === 'running' && open ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="hidden xl:inline">Synchroniser</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
        className="w-[17.5rem] overflow-hidden rounded-md border-0 bg-white p-0 shadow-[0_14px_32px_-16px_rgba(15,23,42,0.28)]"
        style={{
          border: `1.5px solid ${C.primary}`,
          boxShadow: `0 14px 32px -16px rgba(15, 23, 42, 0.28), 0 0 0 1px ${C.primaryMid}`,
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          aria-hidden
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, ${C.primary} 0%, #1a9a6c 55%, #34d399 100%)`,
          }}
        />

        <header className="flex items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className="m-0 truncate text-[12px] font-semibold leading-none tracking-tight"
                style={{ color: C.ink }}
              >
                {phase === 'running'
                  ? 'Synchronisation'
                  : phase === 'done'
                    ? 'Agenda à jour'
                    : phase === 'error'
                      ? 'Échec'
                      : 'Synchroniser'}
              </h3>
              {phase === 'done' ? (
                <span
                  className="inline-flex h-3.5 shrink-0 items-center rounded px-1 text-[8px] font-bold uppercase tracking-wide"
                  style={{ background: C.primarySoft, color: C.primaryText }}
                >
                  OK
                </span>
              ) : null}
              {phase === 'running' ? (
                <span
                  className="inline-flex h-3.5 shrink-0 items-center rounded px-1 text-[8px] font-bold uppercase tracking-wide"
                  style={{ background: C.primarySoft, color: C.primaryText }}
                >
                  …
                </span>
              ) : null}
              {phase === 'error' ? (
                <span className="inline-flex h-3.5 shrink-0 items-center rounded bg-red-50 px-1 text-[8px] font-bold uppercase tracking-wide text-red-700">
                  Err
                </span>
              ) : null}
            </div>
            <p className="m-0 mt-1 truncate text-[9px] leading-none" style={{ color: C.muted }}>
              Missions · indispos · congés · fériés
            </p>
          </div>
          <div className="shrink-0 text-right leading-none">
            <div className="text-[9px] font-medium tabular-nums" style={{ color: C.muted }}>
              {year}
            </div>
            <div className="mt-0.5 text-[9px] font-bold tabular-nums" style={{ color: C.primary }}>
              {formatElapsed(elapsedMs)}
            </div>
          </div>
        </header>

        {phase === 'running' ? (
          <div
            className="flex items-center gap-2 px-2.5 py-3"
            style={{ borderTop: `1px solid ${C.line}` }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
              style={{ background: C.primarySoft, color: C.primary }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold leading-none" style={{ color: C.ink }}>
                Alignement des sources
              </p>
              <p className="m-0 mt-1 text-[9px] leading-none" style={{ color: C.muted }}>
                Overlays agenda…
              </p>
            </div>
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <div
            className="flex flex-col gap-1.5 px-2.5 py-2.5"
            style={{ borderTop: `1px solid ${C.line}` }}
            role="alert"
          >
            <p className="m-0 text-[11px] font-medium leading-snug text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void runSync()}
              className="inline-flex h-7 items-center justify-center gap-1 rounded text-[10px] font-semibold text-white"
              style={{ background: C.primary }}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Réessayer
            </button>
          </div>
        ) : null}

        {phase === 'done' && m && u && h ? (
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="mx-2.5 mt-2 flex overflow-hidden rounded" style={{ background: C.surface }}>
              <Kpi value={m.total} label="Missions" days={m.days} />
              <Kpi value={u.total} label="Réf." days={u.days} />
              <Kpi value={h.items} label="Fériés" days={h.days} last />
            </div>

            <div className="px-2.5 pb-1.5 pt-2">
              <div className="mb-1.5 grid gap-x-2" style={{ gridTemplateColumns: DETAIL_COLS }}>
                <span />
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                  Détail
                </span>
                <span
                  className="text-right text-[8px] font-bold uppercase tracking-wide"
                  style={{ color: C.muted }}
                >
                  Nb
                </span>
                <span
                  className="text-right text-[8px] font-bold uppercase tracking-wide"
                  style={{ color: C.muted }}
                >
                  Jours
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <DetailRow
                  icon={Plane}
                  label="Planifiées"
                  count={String(m.planned)}
                  days={`${m.daysPlanned} j.`}
                  iconBg="#ecfdf5"
                  iconColor="#15803d"
                />
                <DetailRow
                  icon={Plane}
                  label="En cours"
                  count={String(m.ongoing)}
                  days={`${m.daysOngoing} j.`}
                  iconBg="#e6f7f4"
                  iconColor="#0f766e"
                />
                <DetailRow
                  icon={Plane}
                  label="Terminées"
                  count={String(m.completed)}
                  days={`${m.daysCompleted} j.`}
                  iconBg="#eef2f7"
                  iconColor="#475569"
                />
                {u.byType.length > 0 ? (
                  u.byType.map((row) => (
                    <DetailRow
                      key={`${row.type}-${row.label}`}
                      icon={Umbrella}
                      label={row.label}
                      count={String(row.items)}
                      days={`${row.days} j.`}
                      iconBg="#fff7ed"
                      iconColor="#c2410c"
                    />
                  ))
                ) : (
                  <DetailRow
                    icon={Umbrella}
                    label="Référentiel"
                    count={String(u.total)}
                    days={`${u.days} j.`}
                    iconBg="#fff7ed"
                    iconColor="#c2410c"
                  />
                )}
                <DetailRow
                  icon={CalendarDays}
                  label="Jours fériés"
                  count={String(h.items)}
                  days={`${h.days} j.`}
                  iconBg={C.primarySoft}
                  iconColor={C.primary}
                />
              </div>
            </div>

            <footer
              className="flex items-center gap-1.5 px-2.5 py-1.5"
              style={{ borderTop: `1px solid ${C.line}`, background: C.surface }}
            >
              <p
                className="m-0 flex min-w-0 flex-1 items-center gap-1 text-[9px] font-semibold"
                style={{ color: C.primaryText }}
              >
                <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="truncate">Calendrier actualisé</span>
              </p>
              <button
                type="button"
                onClick={() => void runSync()}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[9px] font-semibold text-white"
                style={{ background: C.primary }}
              >
                <RefreshCw className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                Resync
              </button>
            </footer>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
