'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  Clock,
  Phone,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RolePermissionsPreview } from '@/components/admin/role-permissions-preview';
import { UserAvatar } from '@/components/admin/user-avatar';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';

export type UserProfileData = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: RoleId;
  department: string;
  active: boolean;
};

type Props = {
  user: UserProfileData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastLoginLabel?: string;
  createdAtLabel?: string;
  archivedAtLabel?: string;
  roleLabel?: string;
  onEdit?: (user: UserProfileData) => void;
};

function MetaRow({
  icon,
  label,
  children,
  danger,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={
        danger
          ? 'admin-user-profile-meta-row admin-user-profile-meta-row--danger'
          : 'admin-user-profile-meta-row'
      }
    >
      <dt className="admin-user-profile-meta-label">
        <span className="admin-user-profile-meta-ico" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="admin-user-profile-meta-value">{children}</dd>
    </div>
  );
}

export function UserProfileDialog({
  user,
  open,
  onOpenChange,
  lastLoginLabel = 'Jamais',
  createdAtLabel = '—',
  archivedAtLabel,
  roleLabel,
  onEdit,
}: Props) {
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.role) {
      setPermissions([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/roles/${user.role}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        const fallback = isDgRole(user.role) ? permissionsForRole(user.role) : [];
        setPermissions(j?.labels?.length ? j.labels : fallback);
      })
      .catch(() => {
        if (!cancelled) {
          setPermissions(isDgRole(user.role) ? permissionsForRole(user.role) : []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-user-profile-dialog gap-0 border-[var(--admin-border)] p-0 shadow-[0_16px_40px_-16px_rgba(15,60,40,0.28)]">
        <DialogHeader className="sr-only">
          <DialogTitle>Profil utilisateur</DialogTitle>
          <DialogDescription>Informations détaillées en lecture seule.</DialogDescription>
        </DialogHeader>

        {user ? (
          <>
            <div className="admin-user-profile-body">
              <div className="admin-user-profile-summary">
                <UserAvatar firstName={user.firstName} lastName={user.lastName} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="admin-user-profile-name">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="admin-user-profile-email">{user.email}</p>
                </div>
                {user.active ? (
                  <span className="admin-status-active shrink-0">Actif</span>
                ) : (
                  <span className="admin-status-inactive shrink-0">Inactif</span>
                )}
              </div>

              <dl className="admin-user-profile-meta">
                <MetaRow icon={<ShieldCheck className="h-3 w-3" />} label="Rôle">
                  <span className="admin-role-pill">{roleLabel ?? user.role}</span>
                </MetaRow>
                <MetaRow icon={<Phone className="h-3 w-3" />} label="Tél.">
                  {user.phone || '—'}
                </MetaRow>
                <MetaRow icon={<Building2 className="h-3 w-3" />} label="Dépt.">
                  {user.department || '—'}
                </MetaRow>
                <MetaRow icon={<CalendarDays className="h-3 w-3" />} label="Créé">
                  <span className="tabular-nums">{createdAtLabel}</span>
                </MetaRow>
                <MetaRow icon={<Clock className="h-3 w-3" />} label="Connexion">
                  <span className="tabular-nums">{lastLoginLabel}</span>
                </MetaRow>
                {archivedAtLabel ? (
                  <MetaRow
                    icon={<Trash2 className="h-3 w-3" />}
                    label="Corbeille"
                    danger
                  >
                    <span className="tabular-nums">{archivedAtLabel}</span>
                  </MetaRow>
                ) : null}
              </dl>

              <RolePermissionsPreview
                title="Permissions"
                permissions={permissions}
                compact
              />
            </div>

            <div className="admin-user-profile-footer shrink-0">
              <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)}>
                Fermer
              </button>
              {onEdit ? (
                <button type="button" className="admin-btn-create" onClick={() => onEdit(user)}>
                  Modifier
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
