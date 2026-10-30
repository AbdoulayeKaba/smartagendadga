'use client';

import { useEffect, useState } from 'react';

export type DepartmentOption = { id: string; name: string };

/** Charge les départements actifs du référentiel (formulaires métier / admin). */
export function useDepartmentsReferential(enabled = true) {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch('/api/dg/referentials/departements')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { items?: DepartmentOption[] } | null) => {
        if (!cancelled) setDepartments(json?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { departments, loading };
}
