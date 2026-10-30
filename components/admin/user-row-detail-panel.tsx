'use client';

import { useEffect, useState } from 'react';
import { RolePermissionsPreview } from '@/components/admin/role-permissions-preview';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';

type Props = {
  role: RoleId;
  canEdit?: boolean;
  onEdit?: () => void;
};

/** Panneau déplié : permissions du rôle (les infos de la ligne restent dans le tableau). */
export function UserRowDetailPanel({ role, canEdit, onEdit }: Props) {
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/roles/${role}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        const fallback = isDgRole(role) ? permissionsForRole(role) : [];
        setPermissions(j?.labels?.length ? j.labels : fallback);
      })
      .catch(() => {
        if (!cancelled) {
          setPermissions(isDgRole(role) ? permissionsForRole(role) : []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="admin-user-row-detail">
      <div className="admin-user-row-detail-perms">
        <RolePermissionsPreview title="Permissions" permissions={permissions} compact />
        {canEdit && onEdit ? (
          <button type="button" className="admin-btn-create admin-user-row-detail-edit" onClick={onEdit}>
            Modifier
          </button>
        ) : null}
      </div>
    </div>
  );
}
