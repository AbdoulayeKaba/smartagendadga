'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clampYear,
  currentYear,
  TEMPORAL_STORAGE_KEY,
  TEMPORAL_YEAR_MAX,
  TEMPORAL_YEAR_MIN,
  yearRange,
  type YearRange,
} from '@/lib/temporal/year-range';

type TemporalNavigationContextValue = {
  year: number;
  range: YearRange;
  isCurrentYear: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  setYear: (year: number) => void;
  goToPreviousYear: () => void;
  goToNextYear: () => void;
  goToCurrentYear: () => void;
};

const TemporalNavigationContext = createContext<TemporalNavigationContextValue | null>(null);

function readStoredYear(): number {
  if (typeof window === 'undefined') return currentYear();
  try {
    const raw = localStorage.getItem(TEMPORAL_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) return clampYear(parsed);
  } catch {
    /* ignore */
  }
  return currentYear();
}

export function TemporalNavigationProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState(() => currentYear());

  useEffect(() => {
    setYearState(readStoredYear());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== TEMPORAL_STORAGE_KEY) return;
      const parsed = event.newValue ? Number(event.newValue) : NaN;
      if (Number.isFinite(parsed)) setYearState(clampYear(parsed));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setYear = useCallback((next: number) => {
    const y = clampYear(next);
    setYearState(y);
    try {
      localStorage.setItem(TEMPORAL_STORAGE_KEY, String(y));
    } catch {
      /* ignore */
    }
  }, []);

  const goToPreviousYear = useCallback(() => {
    setYearState((prev) => {
      const y = clampYear(prev - 1);
      try {
        localStorage.setItem(TEMPORAL_STORAGE_KEY, String(y));
      } catch {
        /* ignore */
      }
      return y;
    });
  }, []);

  const goToNextYear = useCallback(() => {
    setYearState((prev) => {
      const y = clampYear(prev + 1);
      try {
        localStorage.setItem(TEMPORAL_STORAGE_KEY, String(y));
      } catch {
        /* ignore */
      }
      return y;
    });
  }, []);

  const goToCurrentYear = useCallback(() => {
    setYear(currentYear());
  }, [setYear]);

  const range = useMemo(() => yearRange(year), [year]);
  const isCurrentYear = year === currentYear();
  const canGoPrevious = year > TEMPORAL_YEAR_MIN;
  const canGoNext = year < TEMPORAL_YEAR_MAX;

  const value = useMemo(
    () => ({
      year,
      range,
      isCurrentYear,
      canGoPrevious,
      canGoNext,
      setYear,
      goToPreviousYear,
      goToNextYear,
      goToCurrentYear,
    }),
    [
      year,
      range,
      isCurrentYear,
      canGoPrevious,
      canGoNext,
      setYear,
      goToPreviousYear,
      goToNextYear,
      goToCurrentYear,
    ]
  );

  return (
    <TemporalNavigationContext.Provider value={value}>{children}</TemporalNavigationContext.Provider>
  );
}

export function useTemporalNavigation() {
  const ctx = useContext(TemporalNavigationContext);
  if (!ctx) {
    throw new Error('useTemporalNavigation must be used within TemporalNavigationProvider');
  }
  return ctx;
}

/** Paramètres URL pour les requêtes filtrées par année. */
export function useTemporalQueryParams(): Record<string, string> {
  const { year } = useTemporalNavigation();
  return useMemo(() => ({ year: String(year) }), [year]);
}
