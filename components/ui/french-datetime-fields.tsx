'use client';

import { useEffect, useMemo, useState } from 'react';
import { isValid, parseISO } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DAY_PICKER_LOCALE, formatDate, formatIsoDate, formatTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';

function parseIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const parsed = parseISO(iso);
  return isValid(parsed) ? parsed : undefined;
}

function buildTimeSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

function timeToMinutes(value: string): number {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return h * 60 + m;
}

function isTimeInRange(slot: string, minTime?: string, maxTime?: string): boolean {
  const t = timeToMinutes(slot);
  if (minTime && t < timeToMinutes(minTime)) return false;
  if (maxTime && t > timeToMinutes(maxTime)) return false;
  return true;
}

function formatTimeLabel(value: string): string {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return formatTime(new Date(2000, 0, 1, h, m));
}

type FieldVariant = 'default' | 'compact';

const triggerBase: Record<FieldVariant, string> = {
  default:
    'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-background/70 px-3 py-2 text-sm shadow-sm transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  compact: 'dg-plan-input dg-plan-picker-trigger',
};

const iconBase: Record<FieldVariant, string> = {
  default: 'h-4 w-4 shrink-0 opacity-50',
  compact: 'dg-plan-picker-icon',
};

export type FrenchDateFieldProps = {
  id?: string;
  ariaDescribedBy?: string;
  value: string;
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  variant?: FieldVariant;
  className?: string;
  /** Classes additionnelles sur le popover du calendrier. */
  popoverClassName?: string;
  /** Motif d'affichage : dd/MM/yyyy (défaut) ou dd/MM/yy */
  displayPattern?: 'dd/MM/yyyy' | 'dd/MM/yy';
  /** Désactive des dates (ex. jours non ouvrés, fériés). */
  isDateDisabled?: (date: Date) => boolean;
};

export function FrenchDateField({
  id,
  ariaDescribedBy,
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled,
  placeholder = 'Choisir une date…',
  variant = 'default',
  className,
  popoverClassName,
  displayPattern = 'dd/MM/yyyy',
  isDateDisabled,
}: FrenchDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const minDate = useMemo(() => parseIsoDate(min ?? ''), [min]);
  const maxDate = useMemo(() => parseIsoDate(max ?? ''), [max]);
  const label = selected ? formatDate(selected, displayPattern) : placeholder;

  useEffect(() => {
    setOpen(false);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          aria-describedby={ariaDescribedBy}
          type="button"
          disabled={disabled}
          className={cn(
            triggerBase[variant],
            !selected && (variant === 'compact' ? 'dg-plan-picker-trigger--placeholder' : 'text-muted-foreground'),
            className
          )}
          onBlur={onBlur}
        >
          <span className="truncate">{label}</span>
          <CalendarIcon className={iconBase[variant]} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          variant === 'compact' ? 'dg-plan-date-popover p-0' : 'w-auto p-0',
          popoverClassName
        )}
        align="start"
        sideOffset={variant === 'compact' ? 2 : 4}
      >
        <Calendar
          mode="single"
          locale={DAY_PICKER_LOCALE}
          selected={selected}
          onSelect={(date) => {
            if (!date) {
              onChange('');
              setOpen(false);
              onBlur?.();
              return;
            }
            const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (minDate) {
              const floor = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
              if (day < floor) return;
            }
            if (maxDate) {
              const ceil = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
              if (day > ceil) return;
            }
            if (isDateDisabled?.(date)) return;
            onChange(formatIsoDate(date));
            setOpen(false);
            onBlur?.();
          }}
          disabled={(date) => {
            const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (minDate) {
              const floor = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
              if (day < floor) return true;
            }
            if (maxDate) {
              const ceil = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
              if (day > ceil) return true;
            }
            if (isDateDisabled?.(date)) return true;
            return false;
          }}
          className={variant === 'compact' ? 'dg-plan-compact-calendar' : undefined}
          classNames={
            variant === 'compact'
              ? {
                  month: 'gap-0',
                  weekdays: 'gap-0',
                  week: 'gap-0 mt-0',
                  month_caption: 'h-[1.375rem]',
                  weekday: 'text-[0.5rem]',
                }
              : undefined
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export type FrenchTimeFieldProps = {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: FieldVariant;
  className?: string;
  popoverClassName?: string;
  /** Pas entre créneaux (défaut 15 min). */
  stepMinutes?: number;
  /** Heure mini inclusive (HH:mm), ex. début de journée cabinet. */
  minTime?: string;
  /** Heure maxi inclusive (HH:mm), ex. fin de journée cabinet. */
  maxTime?: string;
  /**
   * Créneaux strictement après cette heure seulement (ex. fin > début).
   * Les horaires ≤ cette borne restent visibles mais non sélectionnables.
   */
  selectableAfter?: string;
  /**
   * `hide` : n’affiche pas les horaires hors plage min/max (défaut).
   * `disable` : les affiche grisés et non sélectionnables.
   */
  outOfRangeMode?: 'hide' | 'disable';
};

export function FrenchTimeField({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = 'Choisir une heure…',
  variant = 'default',
  className,
  popoverClassName,
  stepMinutes = 15,
  minTime,
  maxTime,
  selectableAfter,
  outOfRangeMode = 'hide',
}: FrenchTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const allSlots = useMemo(() => buildTimeSlots(stepMinutes), [stepMinutes]);
  const slots = useMemo(() => {
    if (outOfRangeMode === 'hide' && (minTime || maxTime)) {
      return allSlots.filter((slot) => isTimeInRange(slot, minTime, maxTime));
    }
    return allSlots;
  }, [allSlots, minTime, maxTime, outOfRangeMode]);
  const label = value ? formatTimeLabel(value) : placeholder;

  useEffect(() => {
    setOpen(false);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            triggerBase[variant],
            !value && (variant === 'compact' ? 'dg-plan-picker-trigger--placeholder' : 'text-muted-foreground'),
            className
          )}
          onBlur={onBlur}
        >
          <span className="truncate">{label}</span>
          <Clock className={iconBase[variant]} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          variant === 'compact' ? 'dg-plan-time-popover p-0' : 'w-auto p-0',
          popoverClassName
        )}
        align="start"
        sideOffset={variant === 'compact' ? 2 : 4}
      >
        <div
          className={cn(
            variant === 'compact' ? 'dg-plan-time-list' : 'max-h-[240px] overflow-y-auto py-1'
          )}
          role="listbox"
          aria-label="Choisir une heure"
        >
          {slots.length === 0 ? (
            <p
              className={
                variant === 'compact'
                  ? 'dg-plan-time-empty'
                  : 'px-3 py-2 text-xs text-muted-foreground'
              }
            >
              Aucun créneau dans la plage autorisée
            </p>
          ) : (
            slots.map((slot) => {
              const outOfRange = !isTimeInRange(slot, minTime, maxTime);
              const beforeStart =
                Boolean(selectableAfter) && timeToMinutes(slot) <= timeToMinutes(selectableAfter!);
              const optionDisabled =
                beforeStart || (outOfRangeMode === 'disable' && outOfRange);
              return (
                <button
                  key={slot}
                  type="button"
                  role="option"
                  aria-selected={value === slot}
                  aria-disabled={optionDisabled || undefined}
                  disabled={optionDisabled}
                  className={cn(
                    variant === 'compact' ? 'dg-plan-time-option' : 'flex w-full px-3 py-1.5 text-left text-sm hover:bg-accent',
                    value === slot &&
                      !optionDisabled &&
                      (variant === 'compact' ? 'dg-plan-time-option--active' : 'bg-accent font-medium'),
                    optionDisabled &&
                      (variant === 'compact'
                        ? 'dg-plan-time-option--disabled'
                        : 'cursor-not-allowed opacity-40 hover:bg-transparent')
                  )}
                  onClick={() => {
                    if (optionDisabled) return;
                    onChange(slot);
                    setOpen(false);
                    onBlur?.();
                  }}
                >
                  {formatTimeLabel(slot)}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Champ date pour formulaires HTML natifs (Server Actions) — valeur ISO dans un input hidden. */
export function FrenchDateFormField({
  name,
  required,
  defaultValue = '',
  className,
  min,
  max,
}: {
  name: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
  min?: string;
  max?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <FrenchDateField value={value} min={min} max={max} onChange={setValue} className={className} />
    </>
  );
}
