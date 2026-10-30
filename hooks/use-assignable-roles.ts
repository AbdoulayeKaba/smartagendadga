'use client';

import { useEffect, useState } from 'react';
import type { AssignableRoleOption } from '@/lib/services/assignable-roles';

/** Charge les rôles actifs assignables (système + personnalisés). */
export function useAssignableRoles(enabled: boolean) {
  const [roles, setRoles] = useState<AssignableRoleOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRoles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch('/api/admin/roles/assignable')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { roles?: AssignableRoleOption[] } | null) => {
        if (!cancelled) setRoles(j?.roles ?? []);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { roles, loading };
}
