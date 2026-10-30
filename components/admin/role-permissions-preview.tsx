'use client';

type Props = {
  permissions: string[];
  emptyMessage?: string;
  title?: string;
  /** Affichage compact sans zone scrollable (modale création utilisateur). */
  compact?: boolean;
};

function formatCount(count: number): string {
  return `${count} permission${count > 1 ? 's' : ''} ${count > 1 ? 'actives' : 'active'}`;
}

/** Bloc permissions (modales création / profil utilisateur). */
export function RolePermissionsPreview({
  permissions,
  emptyMessage,
  title = 'Permissions liées au rôle',
  compact = false,
}: Props) {
  const count = permissions.length;

  return (
    <div className={compact ? 'admin-role-permissions-panel admin-role-permissions-panel--compact' : 'admin-role-permissions-panel'}>
      <p className="admin-role-permissions-title">
        {title}
        {compact ? (
          <span className="admin-role-permissions-count-inline">
            {' '}
            — {count > 0 ? formatCount(count) : '0 permission active'}
          </span>
        ) : null}
      </p>
      {!compact ? (
        <p className="admin-role-permissions-count">
          {count > 0 ? formatCount(count) : '0 permission active'}
        </p>
      ) : null}
      <div
        className={compact ? 'admin-role-permissions-scroll admin-role-permissions-scroll--compact' : 'admin-role-permissions-scroll'}
        role="region"
        aria-label="Liste des permissions"
        tabIndex={compact ? undefined : 0}
      >
        <div className="admin-role-permissions-tags">
          {count > 0 ? (
            permissions.map((p, i) => (
              <span key={`${p}-${i}`} className="admin-perm-chip">
                {p}
              </span>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              {emptyMessage ?? 'Aucune permission active pour ce rôle.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
