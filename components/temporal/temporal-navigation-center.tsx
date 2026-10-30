'use client';

import { ChevronLeft, ChevronRight, CalendarRange, RotateCcw } from 'lucide-react';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { cn } from '@/lib/utils';

export function TemporalNavigationCenter({
  className,
  variant = 'page',
}: {
  className?: string;
  variant?: 'page' | 'header';
}) {
  const {
    year,
    isCurrentYear,
    canGoPrevious,
    canGoNext,
    goToPreviousYear,
    goToNextYear,
    goToCurrentYear,
  } = useTemporalNavigation();

  return (
    <section
      className={cn(
        'temporal-nav-center',
        variant === 'header' && 'temporal-nav-center--header admin-theme',
        className
      )}
      aria-label="Centre de navigation annuelle"
    >
      <div className="temporal-nav-center__accent" aria-hidden />
      <div className="temporal-nav-center__glow" aria-hidden />
      <div className="temporal-nav-center__sheen" aria-hidden />

      <div className="temporal-nav-center__inner">
        <div className="temporal-nav-center__brand">
          <div className="temporal-nav-center__icon-wrap">
            <CalendarRange className="temporal-nav-center__icon" strokeWidth={2} aria-hidden />
          </div>
          <div className="temporal-nav-center__titles">
            <p className="temporal-nav-center__eyebrow">Navigation annuelle</p>
            <p className="temporal-nav-center__title">
              {variant === 'header' ? 'Filtre global' : "Filtre global de l'application"}
            </p>
          </div>
        </div>

        <div className="temporal-nav-center__stepper" role="group" aria-label="Sélection de l'année">
          <button
            type="button"
            className="temporal-nav-center__nav-btn temporal-nav-center__nav-btn--prev"
            onClick={goToPreviousYear}
            disabled={!canGoPrevious}
            aria-label="Année précédente"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={2.25} />
          </button>

          <div className="temporal-nav-center__year-block" key={year}>
            <span className="temporal-nav-center__year-label">Exercice</span>
            <output className="temporal-nav-center__year temporal-nav-center__year--pop" aria-live="polite">
              {year}
            </output>
            <span className="temporal-nav-center__range">1 janv. – 31 déc. {year}</span>
          </div>

          <button
            type="button"
            className="temporal-nav-center__nav-btn temporal-nav-center__nav-btn--next"
            onClick={goToNextYear}
            disabled={!canGoNext}
            aria-label="Année suivante"
          >
            <ChevronRight className="h-3 w-3" strokeWidth={2.25} />
          </button>
        </div>

        <div className="temporal-nav-center__status">
          <span
            className={cn(
              'temporal-nav-center__badge temporal-nav-center__badge--live',
              !isCurrentYear && 'temporal-nav-center__badge--hidden'
            )}
          >
            <span className="temporal-nav-center__pulse" aria-hidden />
            Année en cours
          </span>
          <span
            className={cn(
              'temporal-nav-center__badge temporal-nav-center__badge--archive',
              isCurrentYear && 'temporal-nav-center__badge--hidden'
            )}
          >
            Période {year}
          </span>
          <button
            type="button"
            className={cn(
              'temporal-nav-center__reset-btn',
              isCurrentYear && 'temporal-nav-center__reset-btn--hidden'
            )}
            onClick={goToCurrentYear}
            tabIndex={isCurrentYear ? -1 : undefined}
            aria-hidden={isCurrentYear}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Revenir à l&apos;année en cours
          </button>
        </div>
      </div>
    </section>
  );
}
