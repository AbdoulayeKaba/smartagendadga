'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Copy,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Plus,
} from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import {
  AdminEmptyTrashButton,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { CopyRolePermissionsDialog } from '@/components/admin/copy-role-permissions-dialog';
import { CreateRoleDialog } from '@/components/admin/create-role-dialog';
import { EditRoleDialog } from '@/components/admin/edit-role-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CategoryIcon } from '@/components/admin/category-icon';
import { RolesManagementSkeleton } from '@/components/admin/roles-skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import { resolveEffectivePermissionMap } from '@/lib/dg/expand-menu-permissions';
import { PERMISSION_CATALOG } from '@/lib/dg/permission-catalog';
import {
  buildMenuPermissionUpdates,
  isActionGatedByMenu,
  mergePermissionUpdates,
  parentMenusForAction,
} from '@/lib/dg/permission-menu-deps';
import type { DgRole } from '@/lib/dg/rbac';
import type { RoleId } from '@/lib/dg/role-ids';
import { cn } from '@/lib/utils';

type RoleRow = {
  id: RoleId;
  label: string;
  description: string;
  userCount: number;
  archived: boolean;
  isCustom?: boolean;
};

type CatalogSection = {
  id: string;
  label: string;
  icon?: 'admin' | 'calendar' | 'appointments' | 'audit' | 'pilotage' | 'menu' | 'actions' | 'contacts';
  permissions: { id: string; label: string; categoryId: string }[];
};

type ApiData = {
  roles: RoleRow[];
  permissions: Record<string, Record<string, boolean>>;
  catalog: CatalogSection[];
  totalPermissions: number;
};

type TabKey = 'active' | 'trash';

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Vous n’avez pas les droits pour accéder à cette ressource.',
  UNAUTHORIZED: 'Session expirée. Reconnectez-vous.',
  LOAD_FAILED: 'Erreur serveur lors du chargement des rôles.',
  CANNOT_ARCHIVE_ASSISTANT: 'Le rôle assistante ne peut pas être archivé.',
  CANNOT_PURGE_ASSISTANT: 'Le rôle assistante ne peut pas être supprimé.',
  ROLE_HAS_USERS: 'Ce rôle est encore assigné à des utilisateurs actifs.',
  VALIDATION_ERROR: 'Données invalides.',
  SAVE_FAILED: 'Impossible d’enregistrer (vérifiez la base de données).',
  ROLE_ARCHIVED_READONLY: 'Restaurez le rôle pour modifier ses permissions.',
  ROLE_LABEL_REQUIRED: 'Le nom du rôle est obligatoire (2 caractères minimum).',
  ROLE_LABEL_EXISTS: 'Un rôle porte déjà ce nom.',
  CREATE_FAILED: 'Impossible de créer le rôle.',
};

export function RolesManagement() {
  const router = useRouter();
  const { roleId: sessionRoleId, roleLabel, setPermissions, refreshPermissions } = useApp();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('active');
  const [selectedId, setSelectedId] = useState<RoleId | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmPurgeRole, setConfirmPurgeRole] = useState<RoleId | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState<DgRole>('ASSISTANT');
  const [copyTo, setCopyTo] = useState<RoleId>('MANAGER');
  const [roleSearch, setRoleSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      const j = await res.json();
      if (res.ok) {
        setData(j);
      } else {
        toast({
          variant: 'destructive',
          title: 'Chargement impossible',
          description: ERROR_MESSAGES[j.error as string] ?? 'Réessayez plus tard.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: 'Impossible de charger les rôles.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rolesFiltered = useMemo(() => {
    if (!data) return [];
    const pool = data.roles.filter((r) => (tab === 'trash' ? r.archived : !r.archived));
    const q = roleSearch.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [data, tab, roleSearch]);

  useEffect(() => {
    if (!data || !selectedId || tab === 'trash') return;
    setOpenSections({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement au changement de rôle
  }, [selectedId, tab]);

  useEffect(() => {
    if (rolesFiltered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rolesFiltered.some((r) => r.id === selectedId)) {
      setSelectedId(rolesFiltered[0].id);
    }
  }, [rolesFiltered, selectedId, tab]);

  const selected = data?.roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!data || !selectedId || !selected?.archived) return;
    setOpenSections(Object.fromEntries(data.catalog.map((c) => [c.id, true])));
  }, [selectedId, selected?.archived, data]);
  const permMap = selectedId && data ? data.permissions[selectedId] ?? {} : {};

  const stats = useMemo(() => {
    const total = data?.totalPermissions ?? 0;
    const active = Object.values(permMap).filter(Boolean).length;
    const coverage = total > 0 ? Math.round((active / total) * 100) : 0;
    return { active, total, coverage };
  }, [permMap, data?.totalPermissions]);

  const syncSidebarIfCurrentRole = useCallback(
    (roleId: RoleId, menuMap: Record<string, boolean>) => {
      const edited = data?.roles.find((r) => r.id === roleId);
      const isCurrent =
        roleId === sessionRoleId ||
        (edited?.label != null && edited.label === roleLabel);
      if (isCurrent) {
        setPermissions(resolveEffectivePermissionMap(menuMap));
      }
      void refreshPermissions();
      router.refresh();
    },
    [data?.roles, refreshPermissions, roleLabel, router, sessionRoleId, setPermissions]
  );

  const applyOptimisticPermissions = (roleId: RoleId, updates: Record<string, boolean>) => {
    const nextMap = { ...(data?.permissions[roleId] ?? {}), ...updates };
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [roleId]: nextMap,
        },
      };
    });
    const edited = data?.roles.find((r) => r.id === roleId);
    const isCurrent =
      roleId === sessionRoleId ||
      (edited?.label != null && edited.label === roleLabel);
    if (isCurrent) {
      setPermissions(resolveEffectivePermissionMap(nextMap));
    }
  };

  const applyOptimisticArchived = (roleId: RoleId, archived: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: prev.roles.map((r) => (r.id === roleId ? { ...r, archived } : r)),
      };
    });
  };

  const patchRole = async (
    roleId: RoleId,
    body: Record<string, unknown>,
    opts?: { optimistic?: Record<string, boolean>; successMessage?: string; onSuccess?: () => void }
  ) => {
    const snapshot = data ? JSON.parse(JSON.stringify(data)) as ApiData : null;
    if (opts?.optimistic) {
      applyOptimisticPermissions(roleId, opts.optimistic);
    }
    if (typeof body.archived === 'boolean') {
      applyOptimisticArchived(roleId, body.archived);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (snapshot) {
          setData(snapshot);
          if (roleId === sessionRoleId) {
            setPermissions(
              resolveEffectivePermissionMap(snapshot.permissions[roleId] ?? {})
            );
          }
        }
        const code = j.error as string | undefined;
        if (code !== 'ROLE_LABEL_EXISTS') {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: ERROR_MESSAGES[code ?? ''] ?? String(code ?? 'Échec'),
          });
        }
        return { ok: false as const, error: code };
      }
      if (opts?.successMessage) {
        toast({ title: opts.successMessage });
      }
      if (j.roles && j.permissions && j.catalog) {
        setData(j as ApiData);
        const savedMap = (j as ApiData).permissions[roleId];
        if (savedMap) syncSidebarIfCurrentRole(roleId, savedMap);
      } else {
        await load();
        if (opts?.optimistic && roleId === sessionRoleId) {
          // État local déjà à jour via optimistic ; forcer refresh serveur
          router.refresh();
        }
      }
      opts?.onSuccess?.();
      return { ok: true as const };
    } catch {
      if (snapshot) {
        setData(snapshot);
        if (roleId === sessionRoleId) {
          setPermissions(
            resolveEffectivePermissionMap(snapshot.permissions[roleId] ?? {})
          );
        }
      }
      toast({ variant: 'destructive', title: 'Erreur réseau', description: 'Action non enregistrée.' });
      return { ok: false as const };
    } finally {
      setSaving(false);
    }
  };

  const buildSetAllUpdates = (roleId: RoleId, value: boolean, sectionId?: string) => {
    const ids = sectionId
      ? PERMISSION_CATALOG.filter((p) => p.categoryId === sectionId).map((p) => p.id)
      : PERMISSION_CATALOG.map((p) => p.id);
    const updates = Object.fromEntries(ids.map((id) => [id, value]));
    const merged = mergePermissionUpdates(data?.permissions[roleId] ?? {}, updates);
    return { updates, merged };
  };

  const handleSetAll = (value: boolean, sectionId?: string) => {
    if (!selectedId) return;
    const { updates, merged } = buildSetAllUpdates(selectedId, value, sectionId);
    void patchRole(
      selectedId,
      { setAll: value, sectionId },
      {
        optimistic: merged,
        successMessage: value ? 'Toutes les permissions activées.' : 'Toutes les permissions désactivées.',
      }
    );
  };

  const handleTogglePerm = (permissionId: string, enabled: boolean) => {
    if (!selectedId) return;

    if (permissionId.startsWith('action.') && enabled) {
      const parents = parentMenusForAction(permissionId);
      if (parents.length > 0 && !parents.some((menuId) => permMap[menuId] === true)) {
        toast({
          variant: 'destructive',
          title: 'Menu requis',
          description: 'Activez d’abord le menu associé pour autoriser cette action.',
        });
        return;
      }
    }

    const updates =
      permissionId.startsWith('menu.') && !enabled
        ? buildMenuPermissionUpdates(permMap, permissionId, false)
        : { [permissionId]: enabled };
    const merged = mergePermissionUpdates(permMap, updates);

    void patchRole(
      selectedId,
      { permissions: updates },
      { optimistic: merged }
    );
  };

  const handleArchive = async () => {
    if (!selectedId) return;
    const roleId = selectedId;
    const ok = await patchRole(roleId, { archived: true }, { successMessage: 'Rôle déplacé dans la corbeille.' });
    setConfirmArchive(false);
    if (ok.ok) {
      setTab('trash');
      setSelectedId(roleId);
    }
  };

  const handleCreateRole = async (payload: {
    label: string;
    description: string;
    copyFrom: RoleId;
  }): Promise<{ ok: boolean; roleId?: RoleId; error?: string }> => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = j.error as string | undefined;
        if (code !== 'ROLE_LABEL_EXISTS') {
          toast({
            variant: 'destructive',
            title: 'Création impossible',
            description: ERROR_MESSAGES[code ?? ''] ?? ERROR_MESSAGES.CREATE_FAILED,
          });
        }
        return { ok: false, error: code };
      }
      if (j.roles && j.permissions && j.catalog) {
        setData(j as ApiData);
      } else {
        await load();
      }
      const roleId = (j.roleId as RoleId) ?? undefined;
      toast({ title: 'Rôle créé', description: `« ${payload.label} » est prêt à être configuré.` });
      setTab('active');
      if (roleId) setSelectedId(roleId);
      return { ok: true, roleId };
    } catch {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: ERROR_MESSAGES.CREATE_FAILED });
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (roleId: RoleId) => {
    void patchRole(roleId, { archived: false }, {
      successMessage: 'Rôle restauré.',
      onSuccess: () => {
        setTab('active');
        setSelectedId(roleId);
      },
    });
  };

  const handlePurge = async () => {
    if (!confirmPurgeRole) return;
    const roleId = confirmPurgeRole;
    const ok = await patchRole(roleId, { purge: true }, { successMessage: 'Rôle supprimé définitivement.' });
    setConfirmPurgeRole(null);
    if (ok.ok) setSelectedId(null);
  };

  const handleCopyPermissions = async () => {
    if (copyFrom === copyTo) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Choisissez deux rôles différents.' });
      return;
    }
    const sourcePerms = data?.permissions[copyFrom];
    const ok = await patchRole(
      copyTo,
      { copyFrom },
      {
        optimistic: sourcePerms ? { ...sourcePerms } : undefined,
        successMessage: `Permissions copiées de « ${data?.roles.find((r) => r.id === copyFrom)?.label ?? copyFrom} » vers « ${data?.roles.find((r) => r.id === copyTo)?.label ?? copyTo} ».`,
        onSuccess: () => {
          setCopyOpen(false);
          setTab('active');
          setSelectedId(copyTo);
        },
      }
    );
    if (ok.ok) setCopyOpen(false);
  };

  const emptyTrash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/roles/trash', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Échec', description: j.error });
        return;
      }
      toast({
        title: 'Corbeille vidée',
        description: `${j.purged} rôle(s) supprimé(s)${j.skipped ? `, ${j.skipped} ignoré(s).` : '.'}`,
      });
      setConfirmEmptyTrash(false);
      setSelectedId(null);
      await load();
    } catch {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: 'Action annulée.' });
    } finally {
      setSaving(false);
    }
  };

  const sectionStats = (section: CatalogSection) => {
    const active = section.permissions.filter((p) => permMap[p.id]).length;
    return { active, total: section.permissions.length };
  };

  if (loading && !data) {
    return <RolesManagementSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Impossible de charger les rôles.</p>
        <Button variant="outline" onClick={() => void load()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const activeCount = data.roles.filter((r) => !r.archived).length;
  const trashCount = data.roles.filter((r) => r.archived).length;
  const activeRoles = data.roles.filter((r) => !r.archived);

  return (
    <div className="admin-theme admin-roles-page">
      <AdminPageHeader
        variant="flat"
        title="Gestion des rôles"
        description="Définissez les rôles et les permissions des utilisateurs."
        actions={
          <button
            type="button"
            className="admin-appt-header-btn admin-appt-header-btn--primary"
            disabled={saving}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" aria-hidden />
            Nouveau rôle
          </button>
        }
      />

      <div className="admin-roles-layout">
        <aside className="admin-roles-sidebar admin-table-shell flex flex-col">
          <div className="admin-roles-sidebar-toolbar">
            <AdminTrashScopeTabs
              value={tab}
              onChange={setTab}
              activeLabel="Rôles"
              activeCount={activeCount}
              trashCount={trashCount}
              className="w-full"
            />
          </div>

          <div className="admin-roles-sidebar-search">
            <Search className="admin-roles-sidebar-search-icon" aria-hidden />
            <input
              type="search"
              placeholder="Rechercher un rôle…"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              className="admin-roles-sidebar-search-input"
              aria-label="Rechercher un rôle"
            />
          </div>

          <div className="admin-roles-sidebar-list">
            {rolesFiltered.length === 0 ? (
              tab === 'trash' ? (
                <AdminTrashEmptyState
                  className="admin-roles-sidebar-trash-empty"
                  showTips={false}
                  description="Les rôles archivés apparaîtront ici."
                  onBackToActive={() => setTab('active')}
                  backLabel="Retour aux rôles"
                />
              ) : (
                <p className="admin-roles-sidebar-empty">Aucun rôle actif.</p>
              )
            ) : tab === 'trash' ? (
              rolesFiltered.map((role) => (
                <div
                  key={role.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(role.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(role.id);
                    }
                  }}
                  className={cn(
                    'admin-roles-role-card cursor-pointer',
                    selectedId === role.id && 'admin-roles-role-card--selected'
                  )}
                >
                  <div className="admin-roles-role-card-inner">
                    <div className="admin-roles-shield-icon">
                      <Shield aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="admin-trash-badge">Corbeille</span>
                      <p className="admin-roles-role-label">{role.label}</p>
                      <p className="admin-roles-role-desc">{role.description}</p>
                      <span className="admin-roles-role-count">
                        {role.userCount} utilisateur{role.userCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="admin-roles-role-trash-actions">
                      <button
                        type="button"
                        title="Restaurer"
                        disabled={saving}
                        className="admin-roles-action-btn admin-roles-action-btn--restore"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(role.id);
                        }}
                      >
                        <RotateCcw aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Supprimer définitivement"
                        disabled={saving || role.id === 'ASSISTANT' || role.userCount > 0}
                        className="admin-roles-action-btn admin-roles-action-btn--delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmPurgeRole(role.id);
                        }}
                      >
                        <Trash2 aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              rolesFiltered.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  disabled={saving}
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    'admin-roles-role-card w-full text-left',
                    selectedId === role.id && 'admin-roles-role-card--selected'
                  )}
                >
                  <div className="admin-roles-role-card-inner">
                    <div className="admin-roles-shield-icon">
                      <Shield aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="admin-roles-role-label">
                        {role.label}
                        {role.isCustom ? (
                          <span className="admin-roles-role-custom">Perso.</span>
                        ) : null}
                      </p>
                      <p className="admin-roles-role-desc">{role.description}</p>
                      <span className="admin-roles-role-count">
                        {role.userCount} utilisateur{role.userCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {tab === 'trash' && trashCount > 0 ? (
            <div className="admin-roles-sidebar-footer">
              <AdminEmptyTrashButton
                disabled={saving}
                onClick={() => setConfirmEmptyTrash(true)}
                className="w-full justify-center"
              />
            </div>
          ) : null}
        </aside>

        {tab === 'trash' && !selectedId ? (
          <TrashPanel />
        ) : selected && selectedId ? (
          <div className={cn('admin-roles-panel admin-table-shell relative flex flex-col', saving && 'admin-panel-saving')}>
            {saving ? (
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-xs shadow-sm ring-1 ring-border">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--admin-primary)]" />
                Enregistrement…
              </div>
            ) : null}

            <div className="admin-roles-panel-body flex-1 overflow-y-auto">
              {selected.archived ? (
                <div className="admin-trash-banner">
                  <div className="admin-trash-banner-icon">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm leading-snug text-amber-950">
                      Ce rôle est en corbeille : les permissions sont en lecture seule ; restaurez-le ou supprimez-le
                      via les icônes dans la liste à gauche.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="admin-roles-panel-header">
                <div className="min-w-0">
                  <h2>Permissions : {selected.label}</h2>
                  <p className="admin-roles-panel-subtitle">
                    {selected.archived
                      ? 'Consultation des permissions (lecture seule)'
                      : 'Configurez les permissions pour ce rôle. Si un menu est désactivé, ses actions liées sont désactivées automatiquement.'}
                  </p>
                </div>
                {!selected.archived ? (
                  <div className="admin-roles-panel-actions">
                    <button
                      type="button"
                      className="admin-roles-btn-archive"
                      disabled={saving || selectedId === 'ASSISTANT'}
                      onClick={() => setConfirmArchive(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Mettre dans la corbeille
                    </button>
                    <button
                      type="button"
                      className="admin-roles-btn-edit"
                      disabled={saving}
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Modifier
                    </button>
                  </div>
                ) : null}
              </div>

              {!selected.archived ? (
                <div className="admin-quick-actions admin-roles-quick-actions">
                  <div className="admin-roles-quick-copy">
                    <p>Actions rapides</p>
                    <span>Stratégie globale puis ajustement par bloc.</span>
                  </div>
                  <div className="admin-roles-quick-btns">
                    <button
                      type="button"
                      className="admin-roles-quick-btn"
                      disabled={saving}
                      onClick={() => setCopyOpen(true)}
                    >
                      <Copy aria-hidden />
                      Copier un modèle
                    </button>
                    <button
                      type="button"
                      className="admin-roles-quick-btn admin-roles-quick-btn--activate"
                      disabled={saving}
                      onClick={() => handleSetAll(true)}
                    >
                      Tout activer
                    </button>
                    <button
                      type="button"
                      className="admin-roles-quick-btn"
                      disabled={saving}
                      onClick={() => handleSetAll(false)}
                    >
                      Tout désactiver
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={cn('admin-roles-stats', selected.archived && 'admin-stat-card-muted')}>
                <StatCard label="Permissions actives" value={String(stats.active)} />
                <StatCard label="Permissions disponibles" value={String(stats.total)} />
                <StatCard label="Couverture du rôle" value={`${stats.coverage}%`} />
              </div>

              <div className="admin-perm-accordion">
                {data.catalog.map((section) => {
                  const { active, total } = sectionStats(section);
                  const open = openSections[section.id] ?? false;
                  return (
                    <div key={section.id} className="admin-perm-section">
                      <button
                        type="button"
                        className="admin-perm-section-header"
                        disabled={saving}
                        onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !open }))}
                      >
                        <div className="admin-perm-section-icon">
                          <CategoryIcon icon={section.icon} className="text-[var(--admin-primary)]" />
                        </div>
                        <span className="admin-perm-section-label">
                          {section.label}
                        </span>
                        <span className="admin-count-badge">{total}</span>
                        <span className="admin-perm-active-label whitespace-nowrap">
                          {active} actif{active > 1 ? 's' : ''}
                        </span>
                        <ChevronDown
                          className={cn('admin-perm-section-chevron', open && 'rotate-180')}
                          aria-hidden
                        />
                      </button>
                      {open ? (
                        <div
                          className={cn(
                            'admin-perm-section-body',
                            selected.archived ? 'bg-muted/10' : 'bg-muted/15'
                          )}
                        >
                          {selected.archived ? (
                            <p className="mb-3 text-center text-xs text-muted-foreground">
                              Lecture seule — restaurez le rôle pour modifier les permissions
                            </p>
                          ) : (
                            <div className="mb-3 flex flex-wrap justify-end gap-3 text-xs">
                              <button
                                type="button"
                                className="font-medium text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                                disabled={saving}
                                onClick={() => handleSetAll(true, section.id)}
                              >
                                Activer toute la section
                              </button>
                              <button
                                type="button"
                                className="font-medium text-destructive hover:underline disabled:opacity-50"
                                disabled={saving}
                                onClick={() => handleSetAll(false, section.id)}
                              >
                                Désactiver toute la section
                              </button>
                            </div>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {section.permissions.map((perm) => {
                              const isOn = Boolean(permMap[perm.id]);
                              const actionParents = perm.id.startsWith('action.')
                                ? parentMenusForAction(perm.id)
                                : [];
                              const actionBlocked =
                                perm.id.startsWith('action.') &&
                                actionParents.length > 0 &&
                                !isActionGatedByMenu(perm.id, permMap);
                              return (
                              <div
                                key={perm.id}
                                className={cn(
                                  'admin-perm-row',
                                  isOn ? 'admin-perm-row-on' : 'admin-perm-row-off',
                                  actionBlocked && 'admin-perm-row-blocked'
                                )}
                              >
                                <span
                                  className={cn(
                                    'leading-snug',
                                    isOn
                                      ? 'text-[var(--admin-foreground)]'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {perm.label}
                                  {actionBlocked ? (
                                    <span className="mt-0.5 block text-[0.62rem] font-normal text-muted-foreground">
                                      Menu associé désactivé
                                    </span>
                                  ) : null}
                                </span>
                                <Switch
                                  checked={isOn && !actionBlocked}
                                  disabled={saving || selected.archived || actionBlocked}
                                  onCheckedChange={(v) => handleTogglePerm(perm.id, v)}
                                  className={cn(
                                    'admin-perm-switch shrink-0',
                                    selected.archived && 'admin-perm-switch-readonly'
                                  )}
                                />
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-roles-panel admin-table-shell flex items-center justify-center p-12 text-sm text-muted-foreground">
            Sélectionnez un rôle à gauche.
          </div>
        )}
      </div>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={saving}
        existingRoles={(data?.roles ?? []).map((r) => ({ id: r.id, label: r.label }))}
        templateRoles={(data?.roles ?? []).filter((r) => !r.archived).map((r) => ({
          id: r.id,
          label: r.label,
        }))}
        permissionsByRole={data?.permissions}
        onSubmit={handleCreateRole}
      />

      <EditRoleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingRoles={(data?.roles ?? []).map((r) => ({ id: r.id, label: r.label }))}
        role={
          selected && selectedId
            ? {
                id: selectedId,
                label: selected.label,
                description: selected.description,
                isCustom: selected.isCustom,
              }
            : null
        }
        templateRoles={(data?.roles ?? [])
          .filter((r) => !r.archived && r.id !== selectedId)
          .map((r) => ({ id: r.id, label: r.label }))}
        permissionsByRole={data?.permissions}
        saving={saving}
        onSave={async (payload) => {
          if (!selectedId) return { ok: false };
          const body: Record<string, unknown> = {
            description: payload.description,
            label: payload.label,
          };
          if (payload.copyFrom) body.copyFrom = payload.copyFrom;
          const message = payload.copyFrom
            ? 'Rôle enregistré et permissions du modèle appliquées.'
            : 'Rôle enregistré.';
          return patchRole(selectedId, body, { successMessage: message });
        }}
      />

      <CopyRolePermissionsDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        saving={saving}
        sourceRoles={(data?.roles ?? [])
          .filter((r) => !r.isCustom && !r.archived)
          .map((r) => ({ id: r.id, label: r.label }))}
        targetRoles={activeRoles.map((r) => ({ id: r.id, label: r.label }))}
        copyFrom={copyFrom}
        copyTo={copyTo}
        onCopyFromChange={(v) => setCopyFrom(v as DgRole)}
        onCopyToChange={setCopyTo}
        onApply={() => void handleCopyPermissions()}
      />

      <AdminConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Confirmer la mise en corbeille"
        message={
          <>
            Mettre le rôle <strong className="text-foreground">« {selected?.label} »</strong> dans la corbeille ?
          </>
        }
        confirmLabel="Mettre dans la corbeille"
        loading={saving}
        onConfirm={() => void handleArchive()}
      />

      <AdminConfirmDialog
        open={!!confirmPurgeRole}
        onOpenChange={(o) => !o && setConfirmPurgeRole(null)}
        title="Supprimer définitivement"
        message={
          <>
            Supprimer définitivement le rôle{' '}
            <strong className="text-foreground">
              « {data.roles.find((r) => r.id === confirmPurgeRole)?.label} »
            </strong>
            ? Il ne reviendra pas dans la liste des rôles.
          </>
        }
        confirmLabel="Supprimer définitivement"
        loading={saving}
        onConfirm={() => void handlePurge()}
      />

      <AdminConfirmDialog
        open={confirmEmptyTrash}
        onOpenChange={setConfirmEmptyTrash}
        title="Vider la corbeille"
        message="Les rôles de la corbeille seront supprimés définitivement. Les rôles encore assignés à un utilisateur actif seront conservés."
        confirmLabel="Vider la corbeille"
        loading={saving}
        onConfirm={() => void emptyTrash()}
      />
    </div>
  );
}

function TrashPanel() {
  return (
    <AdminTrashEmptyState
      className="admin-roles-panel admin-table-shell flex-1"
      title="Corbeille des rôles"
      description="Sélectionnez un rôle à gauche pour consulter ses permissions en lecture seule, le restaurer ou vider la corbeille."
      showTips
    />
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-stat-card admin-roles-stat-card">
      <p className="admin-roles-stat-label">{label}</p>
      <p className="admin-roles-stat-value">{value}</p>
    </div>
  );
}
