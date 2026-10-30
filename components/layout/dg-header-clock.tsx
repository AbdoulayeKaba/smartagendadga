'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';

import { APP_LOCALE, APP_TIMEZONE } from '@/lib/datetime/locale';

const TIMEZONE = APP_TIMEZONE;

function formatClock(date: Date) {
  return date.toLocaleTimeString(APP_LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDate(date: Date, withYear = false) {
  return date.toLocaleDateString(APP_LOCALE, {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

export function DgHeaderClock({ variant = 'time-first' }: { variant?: 'time-first' | 'date-first' } = {}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeLabel = now
    ? variant === 'date-first'
      ? now.toLocaleTimeString(APP_LOCALE, { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
      : formatClock(now)
    : variant === 'date-first'
      ? '--:--'
      : '--:--:--';
  const dateLabel = now ? formatDate(now, variant === 'date-first') : '···';

  if (variant === 'date-first') {
    return (
      <div className="dg-header-clock dg-header-clock--date-first" aria-live="polite" aria-label={now ? `${dateLabel} ${timeLabel}` : 'Horloge'}>
        <span className="dg-header-clock-cal-wrap" aria-hidden>
          <CalendarDays className="dg-header-clock-cal" />
        </span>
        <span className="dg-header-clock-stack">
          <span className="dg-header-clock-date" suppressHydrationWarning>
            {dateLabel}
          </span>
          <time className="dg-header-clock-time" dateTime={now?.toISOString()} suppressHydrationWarning>
            {timeLabel}
          </time>
        </span>
      </div>
    );
  }

  return (
    <div
      className="dg-header-clock"
      aria-live="polite"
      aria-label={now ? `Heure actuelle ${timeLabel}` : 'Horloge'}
    >
      <span className="dg-header-clock-icon-wrap" aria-hidden>
        <Clock className="dg-header-clock-icon" />
      </span>
      <div className="dg-header-clock-text">
        <time
          className="dg-header-clock-time"
          dateTime={now?.toISOString()}
          suppressHydrationWarning
        >
          {timeLabel}
        </time>
        <span className="dg-header-clock-date" suppressHydrationWarning>
          {dateLabel}
        </span>
      </div>
    </div>
  );
}
