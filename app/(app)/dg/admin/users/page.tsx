'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Search, Trash2 } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminUserRowActions } from '@/components/admin/admin-user-row-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { UserRowDetailPanel } from '@/components/admin/user-row-detail-panel';
import { UserAvatar } from '@/components/admin/user-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAssignableRoles } from '@/hooks/use-assignable-roles';
import { useApp } from '@/lib/app-context';
import { dgRoleLabel } from '@/lib/dg/role-labels';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';
import { cn } from '@/lib/utils';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleId;
  department: string;
  phone: string;
  active: boolean;
  archived: boolean;
  archivedAt?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
};

type TabKey = 'active' | 'trash';

function formatLastLogin(value?: string | null): string {
  if (!value) return 'Jamais';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Jamais';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

function formatUserDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export default function AdminUsersPage() {
  const { permissions } = useApp();
  const canCreate = permissions['action.users.create'] === true;
  const canEdit = permissions['action.users.edit'] === true;
  const canDelete = permissions['action.users.delete'] === true;
  const { roles: assignableRoles } = useAssignableRoles(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const roleLabel = (roleId: RoleId) =>
    assignableRoles.find((r) => r.id === roleId)?.label ??
    (isDgRole(roleId) ? dgRoleLabel(roleId) : roleId);
  const [tab, setTab] = useState<TabKey>('active');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'toggleActive'; user: UserRow; nextActive: boolean }
    | { type: 'archive'; user: UserRow }
    | { type: 'delete'; user: UserRow }
    | { type: 'emptyTrash' }
    | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        const items = (j.items ?? []) as UserRow[];
        setUsers(
          items.map((u) => ({
            ...u,
            department: u.department ?? '',
            phone: u.phone ?? '',
          }))
        );
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Chargement impossible',
        description:
          j.error === 'LOAD_FAILED'
            ? 'Erreur serveur. Redémarrez le serveur après `npx prisma generate`.'
            : j.error ?? `Erreur ${res.status}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setExpandedUserId(null);
  }, [tab, search, roleFilter]);

  const activeUsers = users.filter((u) => !u.archived);
  const trashUsers = users.filter((u) => u.archived);

  const filtered = useMemo(() => {
    const pool = tab === 'active' ? activeUsers : trashUsers;
    const q = search.trim().toLowerCase();
    const rows = pool.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.phone} ${u.department} ${u.role}`.toLowerCase();
      return hay.includes(q);
    });

    return rows.sort((a, b) => {
      const aKey =
        tab === 'trash'
          ? a.archivedAt ?? a.createdAt ?? ''
          : a.createdAt ?? '';
      const bKey =
        tab === 'trash'
          ? b.archivedAt ?? b.createdAt ?? ''
          : b.createdAt ?? '';
      return new Date(bKey).getTime() - new Date(aKey).getTime();
    });
  }, [activeUsers, trashUsers, tab, search, roleFilter]);

  const patchUser = async (
    u: UserRow,
    patch: { active?: boolean; archived?: boolean },
    successTitle: string
  ) => {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Modification impossible',
        description:
          j.error === 'LAST_ADMIN'
            ? 'Il doit rester au moins une assistante active.'
            : j.error === 'USER_ARCHIVED'
              ? 'Restaurez d’abord le compte depuis la corbeille.'
              : j.error === 'NOT_FOUND'
                ? 'Utilisateur introuvable.'
                : j.error === 'UPDATE_FAILED'
                  ? 'Mise à jour impossible. Redémarrez le serveur après `npx prisma generate`.'
                  : String(j.error ?? 'Échec'),
      });
      return false;
    }
    toast({ title: successTitle });
    await load();
    return true;
  };

  const patchUserActive = (u: UserRow, active: boolean) =>
    patchUser(u, { active }, active ? 'Compte activé' : 'Compte désactivé');

  const archiveUser = (u: UserRow) =>
    patchUser(u, { archived: true }, 'Compte déplacé dans la corbeille');

  const restoreUser = (u: UserRow) =>
    patchUser(
      u,
      { archived: false, active: true },
      'Compte restauré et réactivé'
    );

  const deleteUserPermanent = async (u: UserRow) => {
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Suppression impossible',
        description:
          j.error === 'CANNOT_DELETE_ASSISTANT'
            ? 'Le compte assistante ne peut pas être supprimé.'
            : j.error === 'USER_NOT_ARCHIVED'
              ? 'Mettez d’abord le compte dans la corbeille avant suppression définitive.'
              : String(j.error ?? 'Échec'),
      });
      return false;
    }
    toast({ title: 'Utilisateur supprimé définitivement' });
    await load();
    return true;
  };

  const emptyTrash = async () => {
    const res = await fetch('/api/admin/users/trash', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Échec',
        description: String(j.error ?? 'Impossible de vider la corbeille.'),
      });
      return false;
    }
    toast({
      title: 'Corbeille vidée',
      description: `${j.purged ?? 0} compte(s) supprimé(s)${j.skipped ? `, ${j.skipped} ignoré(s).` : '.'}`,
    });
    await load();
    return true;
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      let ok = false;
      if (confirmAction.type === 'emptyTrash') {
        ok = await emptyTrash();
      } else if (confirmAction.type === 'toggleActive') {
        ok = await patchUserActive(confirmAction.user, confirmAction.nextActive);
      } else if (confirmAction.type === 'archive') {
        ok = await archiveUser(confirmAction.user);
      } else {
        ok = await deleteUserPermanent(confirmAction.user);
      }
      if (ok) setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setExpandedUserId(null);
    setEditUser(u);
  };

  const toggleDetail = (u: UserRow) => {
    setExpandedUserId((id) => (id === u.id ? null : u.id));
  };

  const requestToggleActive = (u: UserRow) => {
    const nextActive = !u.active;
    if (nextActive) {
      void patchUserActive(u, true);
      return;
    }
    setConfirmAction({ type: 'toggleActive', user: u, nextActive: false });
  };

  const requestArchive = (u: UserRow) => {
    setConfirmAction({ type: 'archive', user: u });
  };

  return (
    <div className="admin-users-page space-y-2.5">
      <AdminPageHeader
        variant="flat"
        title="Gestion des utilisateurs"
        description="Gérez les comptes utilisateurs et leurs permissions."
        actions={
          canCreate ? (
            <button
              type="button"
              className="admin-appt-header-btn admin-appt-header-btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Nouvel utilisateur
            </button>
          ) : undefined
        }
      />

      <div
        className={cn(
          'admin-users-toolbar',
          tab === 'trash' && 'admin-trash-toolbar'
        )}
      >
        {tab === 'trash' ? (
          <AdminTrashBanner
            count={trashUsers.length}
            emptyHint="Aucun compte — espace prêt pour les utilisateurs archivés"
            filledHint={`${trashUsers.length} compte${trashUsers.length > 1 ? 's' : ''} — restaurables avant suppression définitive`}
          />
        ) : null}
        <AdminTrashScopeTabs
          value={tab}
          onChange={setTab}
          activeCount={activeUsers.length}
          trashCount={trashUsers.length}
        />

        <div className="admin-search-field">
          <span className="admin-search-field-icon" aria-hidden>
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="search"
            placeholder={tab === 'trash' ? 'Rechercher dans la corbeille…' : 'Rechercher...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-search-field-input"
            aria-label="Rechercher un utilisateur"
          />
        </div>

        <div className="admin-filter-wrap admin-users-toolbar-role">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="admin-filter-select admin-filter-select--role">
              <SelectValue placeholder="Tous les rôles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {assignableRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="admin-users-toolbar-end">
          {tab === 'trash' && trashUsers.length > 0 && canDelete ? (
            <AdminEmptyTrashButton
              onClick={() => setConfirmAction({ type: 'emptyTrash' })}
            />
          ) : null}
        </div>
      </div>

      {tab === 'trash' ? null : (
        <p className="admin-users-hint">
          Désactiver bloque la connexion. La corbeille archive pour suppression ultérieure.
        </p>
      )}

      <div
        className={cn(
          'admin-table-shell admin-users-table-shell',
          tab === 'trash' && 'admin-trash-table-wrap'
        )}
      >
        <div className="overflow-x-auto">
          <table className="admin-users-table w-full border-collapse">
            <thead>
              <tr className="admin-table-head">
                <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>Date de création</th>
                <th>{tab === 'trash' ? 'Mise en corbeille' : 'Dernière connexion'}</th>
                <th>Statut</th>
                <th className="admin-users-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="admin-table-row">
                  <td colSpan={8} className="admin-users-table-empty">
                    Chargement des comptes…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr className="admin-table-row">
                  <td colSpan={8} className="admin-users-table-empty">
                    {tab === 'trash' && !search.trim() ? (
                      <AdminTrashEmptyState
                        description="Les comptes mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
                        onBackToActive={() => setTab('active')}
                      />
                    ) : tab === 'trash' ? (
                      'Aucun compte dans la corbeille.'
                    ) : (
                      'Aucun utilisateur trouvé.'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((u, index) => {
                  const expanded = expandedUserId === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr
                        className={
                          expanded
                            ? 'admin-table-row admin-users-row--expanded'
                            : 'admin-table-row'
                        }
                      >
                        <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                        <td>
                          <div className="admin-users-cell-user">
                            <UserAvatar firstName={u.firstName} lastName={u.lastName} size="xs" />
                            <div className="min-w-0">
                              <p className="admin-users-cell-name">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="admin-users-cell-email">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="admin-role-pill">{roleLabel(u.role)}</span>
                        </td>
                        <td className="tabular-nums text-muted-foreground">{u.phone || '—'}</td>
                        <td className="tabular-nums text-muted-foreground">
                          {formatUserDate(u.createdAt)}
                        </td>
                        <td className="tabular-nums text-muted-foreground">
                          {tab === 'trash'
                            ? formatUserDate(u.archivedAt)
                            : formatLastLogin(u.lastLoginAt)}
                        </td>
                        <td>
                          {u.active ? (
                            <span className="admin-status-active">Actif</span>
                          ) : (
                            <span className="admin-status-inactive">Inactif</span>
                          )}
                        </td>
                        <td className="admin-users-actions-col">
                          <AdminUserRowActions
                            variant={tab}
                            isActive={u.active}
                            detailExpanded={expanded}
                            permissions={permissions}
                            onView={() => toggleDetail(u)}
                            onEdit={() => openEdit(u)}
                            onToggleActive={() => requestToggleActive(u)}
                            onMoveToTrash={() => requestArchive(u)}
                            onRestore={() => void restoreUser(u)}
                            onDeletePermanent={() =>
                              setConfirmAction({ type: 'delete', user: u })
                            }
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="admin-users-detail-row">
                          <td colSpan={8}>
                            <UserRowDetailPanel
                              role={u.role}
                              canEdit={canEdit}
                              onEdit={() => openEdit(u)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="workspace-module-footer admin-users-table-footer" suppressHydrationWarning>
          <strong>{filtered.length}</strong>
          {' '}
          utilisateur{filtered.length > 1 ? 's' : ''}
          {filtered.length !== (tab === 'active' ? activeUsers.length : trashUsers.length)
            ? ` (sur ${tab === 'active' ? activeUsers.length : trashUsers.length})`
            : ''}
          {tab === 'trash' ? ' · Corbeille' : ' · Actifs'}
        </p>
      </div>

      {canCreate ? (
        <CreateUserDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={load}
          existingUsers={users.map((u) => ({ id: u.id, email: u.email }))}
        />
      ) : null}

      {canEdit ? (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(o) => !o && setEditUser(null)}
          onSaved={load}
          existingUsers={users.map((u) => ({ id: u.id, email: u.email }))}
        />
      ) : null}

      <AdminConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille ?'
            : confirmAction?.type === 'delete'
              ? 'Supprimer définitivement ?'
              : confirmAction?.type === 'archive'
                ? 'Mettre dans la corbeille ?'
                : confirmAction?.type === 'toggleActive' && !confirmAction.nextActive
                  ? 'Désactiver le compte ?'
                  : 'Confirmer la modification ?'
        }
        message={
          confirmAction ? (
            confirmAction.type === 'emptyTrash' ? (
              <>
                Tous les comptes archivés seront supprimés définitivement de la base. Le compte
                assistante sera conservé. Cette action est irréversible.
              </>
            ) : confirmAction.type === 'delete' ? (
              <>
                Le compte <strong>{confirmAction.user.email}</strong> sera supprimé de la base.
                Cette action est irréversible.
              </>
            ) : confirmAction.type === 'archive' ? (
              <>
                Le compte <strong>{confirmAction.user.email}</strong> sera archivé et déplacé dans
                l’onglet Corbeille. L’utilisateur ne pourra plus se connecter.
              </>
            ) : confirmAction.type === 'toggleActive' && !confirmAction.nextActive ? (
              <>
                Le compte <strong>{confirmAction.user.email}</strong> sera désactivé. L’utilisateur
                ne pourra plus se connecter, mais le compte restera visible dans ce tableau avec le
                statut Inactif.
              </>
            ) : null
          ) : null
        }
        confirmLabel={
          confirmAction?.type === 'emptyTrash'
            ? 'Vider la corbeille'
            : confirmAction?.type === 'delete'
              ? 'Supprimer définitivement'
              : confirmAction?.type === 'archive'
                ? 'Mettre en corbeille'
                : confirmAction?.type === 'toggleActive' && !confirmAction.nextActive
                  ? 'Désactiver'
                  : 'Confirmer'
        }
        onConfirm={() => void runConfirmAction()}
        loading={actionLoading}
      />
    </div>
  );
}
