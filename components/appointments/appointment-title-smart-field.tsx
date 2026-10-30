'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { inlineFieldErrorClass } from '@/components/ui/inline-field-error';
import { Input } from '@/components/ui/input';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/dg/appointments-review';
import type { AppointmentTitleMatch } from '@/lib/dg/appointment-title-match';
import {
  buildTitleDuplicateMessage,
  findBlockingAppointmentTitleMatch,
  findExactAppointmentTitleMatch,
} from '@/lib/dg/appointment-title-match';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  error?: string | null;
  errorId?: string;
  excludeId?: string | null;
  date?: string;
  disabled?: boolean;
  onBlockingDuplicate?: (message: string | null) => void;
};

function statusLabel(status: string): string {
  return (
    APPOINTMENT_STATUS_LABELS[status as keyof typeof APPOINTMENT_STATUS_LABELS] ?? status
  );
}

function formatMatchDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: fr });
  } catch {
    return '';
  }
}

export function AppointmentTitleSmartField({
  id,
  value,
  onChange,
  onBlur,
  className,
  placeholder = 'Objet du rendez-vous',
  error,
  errorId,
  excludeId,
  date,
  disabled,
  onBlockingDuplicate,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const onBlockingDuplicateRef = useRef(onBlockingDuplicate);
  onBlockingDuplicateRef.current = onBlockingDuplicate;
  const [matches, setMatches] = useState<AppointmentTitleMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exact, setExact] = useState<AppointmentTitleMatch | null>(null);
  const [blocking, setBlocking] = useState<AppointmentTitleMatch | null>(null);
  const duplicateAlertMessage =
    error ?? (blocking ? buildTitleDuplicateMessage(blocking, date) : null);
  const showDuplicateAlert = Boolean(duplicateAlertMessage);
  const invalid = Boolean(error) || showDuplicateAlert;
  const stableExcludeId = excludeId ?? '';
  const stableDate = date ?? '';

  useEffect(() => {
    const needle = value.trim();
    if (needle.length < 2) {
      setMatches([]);
      setExact(null);
      setBlocking(null);
      setOpen(false);
      setLoading(false);
      onBlockingDuplicateRef.current?.(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: needle });
        if (stableExcludeId) params.set('excludeId', stableExcludeId);
        if (stableDate) params.set('date', stableDate);
        const res = await fetch(`/api/appointments/title-lookup?${params}`);
        const json = (await res.json().catch(() => ({}))) as {
          matches?: AppointmentTitleMatch[];
          exact?: AppointmentTitleMatch | null;
          blocking?: AppointmentTitleMatch | null;
        };
        if (cancelled) return;
        if (!res.ok) {
          setMatches([]);
          setExact(null);
          setBlocking(null);
          onBlockingDuplicateRef.current?.(null);
          return;
        }
        const next = json.matches ?? [];
        const nextExact = json.exact ?? findExactAppointmentTitleMatch(next) ?? null;
        const nextBlocking =
          json.blocking ?? findBlockingAppointmentTitleMatch(next) ?? null;
        setMatches(next);
        setExact(nextExact);
        setBlocking(nextBlocking);
        setOpen(next.length > 0);
        onBlockingDuplicateRef.current?.(
          nextBlocking ? buildTitleDuplicateMessage(nextBlocking, stableDate) : null
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, stableExcludeId, stableDate]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const hintId = `${id}-exists-hint`;
  const describedBy = [showDuplicateAlert ? hintId : error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div ref={wrapRef} className="plan-title-smart">
      <div className="plan-title-smart-input-wrap">
        <Input
          id={id}
          className={inlineFieldErrorClass(
            invalid,
            cn(
              className,
              showDuplicateAlert ? 'plan-title-smart-input--error' : undefined,
              exact && !showDuplicateAlert ? 'plan-title-smart-input--warn' : undefined
            )
          )}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (matches.length > 0) setOpen(true);
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <span className="plan-title-smart-affix" aria-hidden>
          {loading ? (
            <Loader2 className="plan-title-smart-affix-icon animate-spin" />
          ) : (
            <Search className="plan-title-smart-affix-icon" />
          )}
        </span>
      </div>

      {open && matches.length > 0 ? (
        <ul id={listId} className="plan-title-smart-list" role="listbox" aria-label="Titres existants">
          {matches.map((match) => (
            <li key={match.id} role="option" aria-selected={match.exact}>
              <button
                type="button"
                className={cn(
                  'plan-title-smart-option',
                  match.exact && 'plan-title-smart-option--exact',
                  match.blocking && 'plan-title-smart-option--blocking'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(match.title);
                  setOpen(false);
                }}
              >
                <span className="plan-title-smart-option-title">{match.title}</span>
                <span className="plan-title-smart-option-meta">
                  {formatMatchDate(match.startAt)}
                  {formatMatchDate(match.startAt) ? ' · ' : ''}
                  {statusLabel(match.status)}
                  {match.blocking ? ' · doublon' : match.exact ? ' · déjà existant' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showDuplicateAlert ? (
        <p id={hintId} className="plan-title-smart-error" role="alert">
          <AlertTriangle className="plan-title-smart-warn-icon" aria-hidden />
          <span>{duplicateAlertMessage}</span>
        </p>
      ) : exact ? (
        <p id={hintId} className="plan-title-smart-warn" role="status">
          <AlertTriangle className="plan-title-smart-warn-icon" aria-hidden />
          <span>
            Un rendez-vous « {exact.title} » existe déjà (
            {formatMatchDate(exact.startAt)}
            {formatMatchDate(exact.startAt) ? ' — ' : ''}
            {statusLabel(exact.status)}). Vérifiez qu’il ne s’agit pas d’un doublon.
          </span>
        </p>
      ) : null}
    </div>
  );
}
