'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/fetch-with-timeout';

export function useWorkspaceCrud(apiPath: string) {
  const [refresh, setRefresh] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const reload = useCallback(() => setRefresh((n) => n + 1), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${apiPath}/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setDeleteTarget(null);
        reload();
      }
    } finally {
      setDeleteLoading(false);
    }
  }, [apiPath, deleteTarget, reload]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const result = await fetchJson(`${apiPath}/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (result.ok) reload();
      return result.ok;
    },
    [apiPath, reload]
  );

  const create = useCallback(
    async (body: Record<string, unknown>) => {
      const result = await fetchJson(apiPath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (result.ok) reload();
      return result.ok;
    },
    [apiPath, reload]
  );

  return {
    refresh,
    reload,
    deleteTarget,
    setDeleteTarget,
    deleteLoading,
    confirmDelete,
    patch,
    create,
  };
}
