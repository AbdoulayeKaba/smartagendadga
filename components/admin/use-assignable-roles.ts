'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RoleId } from '@/lib/dg/role-ids';
import type { AssignableRoleOption } from '@/lib/services/assignable-roles';

export function useAssignableRoles(open: boolean) {
  const [roles, setRoles] = useState<AssignableRoleOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles/assignable');
      if (res.ok) {
        const j = (await res.json()) as { roles: AssignableRoleOption[] };
        setRoles(j.roles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return { roles, loading, reload: load };
}

export function useRolePermissionLabels(roleId: RoleId | string) {
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roleId) {
      setLabels([]);
      return;
    }
    setLoading(true);
    void fetch(`/api/admin/roles/${encodeURIComponent(roleId)}/permission-labels`)
      .then((r) => (r.ok ? r.json() : { labels: [] }))
      .then((j: { labels?: string[] }) => setLabels(j.labels ?? []))
      .finally(() => setLoading(false));
  }, [roleId]);

  return { labels, loading };
}
