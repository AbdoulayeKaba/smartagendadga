'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isToday, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DgAvailabilityDaySummary } from '@/lib/services/dg-availability';
import type { RoomAvailabilityDaySummary } from '@/lib/services/room-availability';
import { cn } from '@/lib/utils';

type WeekDaySummary = DgAvailabilityDaySummary | RoomAvailabilityDaySummary;

type WeekPayload = {
  anchor: string;
  days: WeekDaySummary[];
  room?: { id: string; name: string };
};

type Props = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  roomId?: string;
};

function slotSegments(day: WeekDaySummary) {
  const total = Math.max(day.totalSlots, 1);
  const free = (day.availableCount / total) * 100;
  const busy = (day.busyCount / total) * 100;
  const other = 100 - free - busy;
  return { free, busy, other: Math.max(0, other) };
}

function MiniAgendaDay({
  day,
  selected,
  onSelect,
}: {
  day: WeekDaySummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const dateObj = new Date(`${day.date}T12:00:00`);
  const dayNum = format(dateObj, 'd');
  const today = isToday(dateObj);
  const offDay = Boolean(day.policyBlock) || !day.isWorkingDay;
  const segments = slotSegments(day);
  const statLine = offDay ? '—' : String(day.availableCount);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${format(dateObj, 'EEEE d MMMM', { locale: fr })}`}
      className={cn(
        'dg-mini-agenda-day',
        selected && 'dg-mini-agenda-day--selected',
        offDay && 'dg-mini-agenda-day--off',
        today && 'dg-mini-agenda-day--today'
      )}
    >
      <span className="dg-mini-agenda-day__dow">{day.weekdayLabel.slice(0, 3).toUpperCase()}</span>
      <span className="dg-mini-agenda-day__num">{dayNum}</span>
      <div className="dg-mini-agenda-day__bar" aria-hidden>
        <span className="dg-mini-agenda-bar-seg dg-mini-agenda-bar-seg--free" style={{ width: `${segments.free}%` }} />
        <span className="dg-mini-agenda-bar-seg dg-mini-agenda-bar-seg--busy" style={{ width: `${segments.busy}%` }} />
        <span className="dg-mini-agenda-bar-seg dg-mini-agenda-bar-seg--off" style={{ width: `${segments.other}%` }} />
      </div>
      <span className={cn('dg-mini-agenda-day__stat', !offDay && 'dg-mini-agenda-day__stat--free')}>{statLine}</span>
    </button>
  );
}

export function DgAvailabilityWeekStrip({ selectedDate, onSelectDate, roomId }: Props) {
  const [anchor, setAnchor] = useState(() =>
    format(startOfWeek(new Date(`${selectedDate}T12:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anchor });
      if (roomId) params.set('roomId', roomId);
      const res = await fetch(`/api/dg/availability/week?${params.toString()}`);
      if (!res.ok) {
        setWeek(null);
        return;
      }
      setWeek((await res.json()) as WeekPayload);
    } catch {
      setWeek(null);
    } finally {
      setLoading(false);
    }
  }, [anchor, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const weekStart = format(
      startOfWeek(new Date(`${selectedDate}T12:00:00`), { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    );
    if (weekStart !== anchor) setAnchor(weekStart);
  }, [selectedDate, anchor]);

  const shiftWeek = (delta: number) => {
    const d = new Date(`${anchor}T12:00:00`);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(format(d, 'yyyy-MM-dd'));
  };

  const goToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    onSelectDate(today);
    setAnchor(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };

  const days = week?.days ?? [];

  const weekRangeLabel = useMemo(() => {
    if (days.length < 7) return format(new Date(`${anchor}T12:00:00`), 'MMM yyyy', { locale: fr });
    const start = format(new Date(`${days[0]!.date}T12:00:00`), 'd', { locale: fr });
    const end = format(new Date(`${days[6]!.date}T12:00:00`), 'd MMM', { locale: fr });
    return `${start}–${end}`;
  }, [days, anchor]);

  return (
    <section className="dg-mini-agenda dg-mini-agenda--dense" aria-label="Semaine">
      <div className="dg-mini-agenda-nav dg-mini-agenda-nav--dense">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="dg-mini-agenda-nav-btn"
          onClick={() => shiftWeek(-1)}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="dg-mini-agenda-title">
          <p className="dg-mini-agenda-title__month">{weekRangeLabel}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="dg-mini-agenda-nav-btn"
          onClick={() => shiftWeek(1)}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        <div className="dg-mini-agenda-nav-actions">
          {loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
          <button type="button" className="dg-mini-agenda-today-btn" onClick={goToday}>
            Auj.
          </button>
        </div>
      </div>

      <div className="dg-mini-agenda-week-scroll">
        <div className="dg-mini-agenda-week">
          {days.length === 0 && loading
            ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="dg-mini-agenda-skeleton" />)
            : days.map((day) => (
                <MiniAgendaDay
                  key={day.date}
                  day={day}
                  selected={day.date === selectedDate}
                  onSelect={() => onSelectDate(day.date)}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
