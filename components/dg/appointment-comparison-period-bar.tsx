'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import {
  buildPeriodRange,
  formatDateFrShort,
  isFullCalendarYearRange,
  periodDayCount,
  readStoredComparePeriods,
  writeStoredComparePeriods,
  yearToPeriodRange,
  type ComparePeriodRange,
  type StoredComparePeriods,
} from '@/lib/temporal/compare-period';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { clampYear, currentYear } from '@/lib/temporal/year-range';
import { cn } from '@/lib/utils';

export type ComparisonPeriodState = {
  period1: ComparePeriodRange;
  period2: ComparePeriodRange;
};

type PeriodSide = 'period1' | 'period2';

function shiftPeriodYear(range: ComparePeriodRange, delta: number): ComparePeriodRange {
  return yearToPeriodRange(clampYear(range.year + delta));
}

function DatePickerField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="compare-period-card__date-field compare-period-card__date-field--inline">
      <span className="compare-period-card__date-label">{label}</span>
      <FrenchDateField
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        variant="compact"
        className="compare-period-card__date-picker"
        placeholder={formatDateFrShort(value)}
      />
    </label>
  );
}

function PeriodCard({
  title,
  accent,
  range,
  onYearPrev,
  onYearNext,
  onDateChange,
}: {
  title: string;
  accent: 'p1' | 'p2';
  range: ComparePeriodRange;
  onYearPrev: () => void;
  onYearNext: () => void;
  onDateChange: (fromDate: string, toDate: string) => void;
}) {
  const fullYear = isFullCalendarYearRange(range.fromDate, range.toDate, range.year);
  const days = periodDayCount(range);

  return (
    <article className={cn('compare-period-card', `compare-period-card--${accent}`)}>
      <div className="compare-period-card__row">
        <div className="compare-period-card__meta">
          <div className="compare-period-card__head-left">
            <span className={cn('compare-period-card__dot', `compare-period-card__dot--${accent}`)} />
            <span className="compare-period-card__badge">{title}</span>
          </div>

          <div className="compare-period-card__stepper" role="group" aria-label={`${title} — année`}>
            <button
              type="button"
              className="compare-period-card__nav-btn"
              onClick={onYearPrev}
              aria-label="Année précédente"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={2.25} />
            </button>

            <div className="compare-period-card__year-wrap">
              <output className="compare-period-card__year" aria-live="polite">
                {fullYear ? range.year : '···'}
              </output>
              {!fullYear ? <p className="compare-period-card__range">{range.label}</p> : null}
            </div>

            <button
              type="button"
              className="compare-period-card__nav-btn"
              onClick={onYearNext}
              aria-label="Année suivante"
            >
              <ChevronRight className="h-3 w-3" strokeWidth={2.25} />
            </button>
          </div>

          <span className="compare-period-card__duration">
            {days} j
          </span>
        </div>

        <div className="compare-period-card__dates" lang="fr">
          <DatePickerField
            label="Du"
            value={range.fromDate}
            max={range.toDate}
            onChange={(from) => onDateChange(from, range.toDate)}
          />
          <DatePickerField
            label="Au"
            value={range.toDate}
            min={range.fromDate}
            onChange={(to) => onDateChange(range.fromDate, to)}
          />
        </div>
      </div>
    </article>
  );
}

export function AppointmentComparisonPeriodBar({
  referenceYear,
  value,
  onChange,
  className,
}: {
  referenceYear: number;
  value: ComparisonPeriodState;
  onChange: (next: ComparisonPeriodState) => void;
  className?: string;
}) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const stored = readStoredComparePeriods(referenceYear);
    const p1 = buildPeriodRange(stored.period1From, stored.period1To);
    const p2 = buildPeriodRange(stored.period2From, stored.period2To);
    if (p1 && p2) {
      onChange({ period1: p1, period2: p2 });
    }
    setInitialized(true);
  }, [initialized, onChange, referenceYear]);

  const persist = useCallback((period1: ComparePeriodRange, period2: ComparePeriodRange) => {
    writeStoredComparePeriods({
      period1From: period1.fromDate,
      period1To: period1.toDate,
      period2From: period2.fromDate,
      period2To: period2.toDate,
    } satisfies StoredComparePeriods);
  }, []);

  const applyBoth = useCallback(
    (period1: ComparePeriodRange, period2: ComparePeriodRange) => {
      onChange({ period1, period2 });
      persist(period1, period2);
    },
    [onChange, persist]
  );

  const updatePeriod = useCallback(
    (side: PeriodSide, nextRange: ComparePeriodRange) => {
      const next =
        side === 'period1'
          ? { period1: nextRange, period2: value.period2 }
          : { period1: value.period1, period2: nextRange };
      onChange(next);
      persist(next.period1, next.period2);
    },
    [onChange, persist, value.period1, value.period2]
  );

  const handleYearShift = (side: PeriodSide, delta: number) => {
    const range = side === 'period1' ? value.period1 : value.period2;
    updatePeriod(side, shiftPeriodYear(range, delta));
  };

  const handleDateChange = (side: PeriodSide, fromDate: string, toDate: string) => {
    const next = buildPeriodRange(fromDate, toDate);
    if (next) updatePeriod(side, next);
  };

  const swapPeriods = () => {
    applyBoth(value.period2, value.period1);
  };

  const applyConsecutiveYears = () => {
    const y = referenceYear;
    applyBoth(yearToPeriodRange(y - 1), yearToPeriodRange(y));
  };

  const isCurrentYearPeriod =
    value.period2.year === currentYear() &&
    isFullCalendarYearRange(value.period2.fromDate, value.period2.toDate, value.period2.year);

  return (
    <section className={cn('compare-period-bar', className)} aria-label="Filtre comparatif">
      <div className="compare-period-bar__glow" aria-hidden />
      <div className="compare-period-bar__glow compare-period-bar__glow--right" aria-hidden />

      <div className="compare-period-bar__top">
        <div className="compare-period-bar__brand">
          <CalendarRange className="compare-period-bar__icon-inline" strokeWidth={2} aria-hidden />
          <h2 className="compare-period-bar__title">Analyse comparative</h2>
        </div>

        <div className="compare-period-bar__actions">
          <button
            type="button"
            className="compare-period-bar__preset"
            onClick={applyConsecutiveYears}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {referenceYear - 1}/{referenceYear}
          </button>
          {isCurrentYearPeriod ? (
            <span className="compare-period-bar__badge compare-period-bar__badge--live">
              <span className="compare-period-bar__pulse" aria-hidden />
              En cours
            </span>
          ) : null}
        </div>
      </div>

      <div className="compare-period-bar__grid">
        <PeriodCard
          title="Période 1"
          accent="p1"
          range={value.period1}
          onYearPrev={() => handleYearShift('period1', -1)}
          onYearNext={() => handleYearShift('period1', 1)}
          onDateChange={(from, to) => handleDateChange('period1', from, to)}
        />

        <button
          type="button"
          className="compare-period-bar__swap"
          onClick={swapPeriods}
          title="Inverser les périodes"
          aria-label="Inverser les périodes"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        </button>

        <PeriodCard
          title="Période 2"
          accent="p2"
          range={value.period2}
          onYearPrev={() => handleYearShift('period2', -1)}
          onYearNext={() => handleYearShift('period2', 1)}
          onDateChange={(from, to) => handleDateChange('period2', from, to)}
        />
      </div>
    </section>
  );
}
