'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { getConstraintsPreviewSummary } from '@/components/admin/appointment-constraints-fields';
import { ScheduleSettingsPanel } from '@/components/admin/schedule-settings-panel';
import {
  BUSINESS_RULE_CATALOG,
  type AppointmentBusinessRules,
} from '@/lib/dg/appointment-business-rules';
import {
  HolidayReferentialDialog,
  UnavailabilityReferentialDialog,
} from '@/components/admin/referentials-forms';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashEmptyState,
} from '@/components/admin/admin-trash-ui';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import {
  confidentialityLabel,
  formatInclusiveDayCount,
  getHolidayMeta,
  getUnavailabilityMeta,
  holidayTypeLabel,
  unavailabilityTypeLabel,
} from '@/lib/dg/referential-types';
import type { ReferentialItem } from '@/lib/mock/referentials-store';
import {
  REFERENTIAL_CATEGORIES,
  type ReferentialCategory,
  type ReferentialCategoryId,
} from '@/lib/dg/referential-catalog';
import {
  canAccessReferentialTab,
  firstAccessibleReferentialTab,
} from '@/lib/dg/referential-tab-permissions';
import type { WeekdayKey } from '@/lib/dg/platform-config';
import type { ScheduleSettings } from '@/lib/services/referentials-admin';
import { cn } from '@/lib/utils';

type TabKey = ReferentialCategoryId | 'trash';

export function ReferentialsManagement() {
  const searchParams = useSearchParams();
  const { permissions } = useApp();
  const canSchedule = canAccessReferentialTab(permissions, 'horaires');
  const canTrash = canAccessReferentialTab(permissions, 'trash');
  const visibleCategories = useMemo(
    () =>
      REFERENTIAL_CATEGORIES.filter(
        (c) => c.id !== 'departements' && canAccessReferentialTab(permissions, c.id)
      ),
    [permissions]
  );
  const [tab, setTab] = useState<TabKey>('horaires');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, { active: number; trash: number }>>({});
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [items, setItems] = useState<ReferentialItem[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [unavailabilityDialogOpen, setUnavailabilityDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ReferentialItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [businessRules, setBusinessRules] = useState<AppointmentBusinessRules | null>(null);
  const [constraintsActive, setConstraintsActive] = useState<string>('—');

  const listCategory = tab === 'trash' || tab === 'horaires' ? null : tab;
  const activeCategory = REFERENTIAL_CATEGORIES.find((c) => c.id === tab);

  const loadOverview = useCallback(async () => {
    const [refRes, rulesRes] = await Promise.all([
      fetch('/api/admin/referentials'),
      fetch('/api/admin/appointment-constraints'),
    ]);
    if (refRes.ok) {
      const j = await refRes.json();
      setCounts(j.counts ?? {});
      setSchedule(j.schedule ?? null);
    }
    if (rulesRes.ok) {
      const r = await rulesRes.json();
      const rules = r.rules as AppointmentBusinessRules | undefined;
      if (rules) {
        setBusinessRules(rules);
        const { active, total } = getConstraintsPreviewSummary(rules, 'referentials');
        setConstraintsActive(`${active}/${total}`);
      }
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!listCategory && tab !== 'trash') return;
    const url =
      tab === 'trash'
        ? `/api/admin/referentials?trash=true&search=${encodeURIComponent(search)}`
        : `/api/admin/referentials?category=${listCategory}&archived=false&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const j = await res.json();
    setItems(j.items ?? []);
  }, [listCategory, tab, search]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadOverview();
      setLoading(false);
    })();
  }, [loadOverview]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'horaires' || t === 'contraintes-rdv') setTab('horaires');
  }, [searchParams]);

  useEffect(() => {
    if (canAccessReferentialTab(permissions, tab)) return;
    const next = firstAccessibleReferentialTab(permissions);
    if (next) setTab(next);
  }, [permissions, tab]);

  useEffect(() => {
    if (tab === 'horaires') return;
    void (async () => {
      setLoading(true);
      await loadItems();
      setLoading(false);
    })();
  }, [tab, loadItems]);

  const trashTotal = useMemo(
    () => Object.values(counts).reduce((n, c) => n + (c.trash ?? 0), 0),
    [counts]
  );

  const openCreate = () => {
    setEditItem(null);
    setFormName('');
    setFormValue('');
    if (listCategory === 'jours-feries') {
      setHolidayDialogOpen(true);
      return;
    }
    if (listCategory === 'indisponibilites') {
      setUnavailabilityDialogOpen(true);
      return;
    }
    setDialogOpen(true);
  };

  const openEdit = (item: ReferentialItem) => {
    setEditItem(item);
    if (item.categoryId === 'jours-feries') {
      setHolidayDialogOpen(true);
      return;
    }
    if (item.categoryId === 'indisponibilites') {
      setUnavailabilityDialogOpen(true);
      return;
    }
    setFormName(item.name);
    setFormValue(item.value ?? '');
    setDialogOpen(true);
  };

  const persistReferential = async (
    categoryId: ReferentialCategoryId,
    payload: { name: string; value?: string; meta?: unknown }
  ) => {
    if (editItem) {
      const res = await fetch(`/api/admin/referentials/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('ERR');
    } else {
      const res = await fetch('/api/admin/referentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, ...payload }),
      });
      if (!res.ok) throw new Error('ERR');
    }
  };

  const saveItem = async () => {
    if (!listCategory && tab !== 'trash') return;
    const categoryId = tab === 'trash' ? editItem?.categoryId : listCategory;
    if (!categoryId || categoryId === 'horaires') return;
    if (!formName.trim()) {
      toast({ variant: 'destructive', title: 'Le nom est obligatoire.' });
      return;
    }
    setSaving(true);
    try {
      await persistReferential(categoryId, { name: formName.trim(), value: formValue.trim() || undefined });
      setDialogOpen(false);
      toast({ title: editItem ? 'Élément modifié.' : 'Élément ajouté.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const saveStructuredItem = async (payload: { name: string; meta: unknown }) => {
    const categoryId = tab === 'trash' ? editItem?.categoryId : listCategory;
    if (!categoryId || categoryId === 'horaires') return;
    setSaving(true);
    try {
      await persistReferential(categoryId, payload);
      setHolidayDialogOpen(false);
      setUnavailabilityDialogOpen(false);
      toast({ title: editItem ? 'Élément modifié.' : 'Élément ajouté.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const archiveItem = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/referentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error('ERR');
      toast({ title: 'Élément déplacé dans la corbeille.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const restoreItem = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/referentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) throw new Error('ERR');
      toast({ title: 'Élément restauré.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const purgeItem = async () => {
    if (!confirmPurgeId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/referentials/${confirmPurgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purge: true }),
      });
      if (!res.ok) throw new Error('ERR');
      setConfirmPurgeId(null);
      toast({ title: 'Élément supprimé définitivement.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Suppression impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const emptyTrash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/referentials?action=empty-trash', { method: 'POST' });
      if (!res.ok) throw new Error('ERR');
      setConfirmEmptyTrash(false);
      toast({ title: 'Corbeille vidée.' });
      await loadOverview();
      await loadItems();
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const saveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;
    setSaving(true);
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/admin/referentials/schedule', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedule),
        }),
      ];
      if (businessRules) {
        requests.push(
          fetch('/api/admin/appointment-constraints', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(businessRules),
          })
        );
      }
      const results = await Promise.all(requests);
      if (results.some((r) => !r.ok)) throw new Error('ERR');
      const schedJson = await results[0].json();
      setSchedule(schedJson.schedule);
      if (businessRules && results[1]) {
        const rulesJson = await results[1].json();
        setBusinessRules(rulesJson.rules);
        const { active, total } = getConstraintsPreviewSummary(rulesJson.rules, 'referentials');
        setConstraintsActive(`${active}/${total}`);
      }
      toast({ title: 'Horaires et contraintes enregistrés.' });
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekday = (key: WeekdayKey) => {
    if (!schedule) return;
    const set = new Set(schedule.workingDays ?? []);
    if (set.has(key)) {
      if (set.size <= 1) return;
      set.delete(key);
    } else {
      set.add(key);
    }
    setSchedule({ ...schedule, workingDays: [...set] });
  };

  if (loading && !schedule) {
    return <p className="text-sm text-muted-foreground">Chargement des référentiels…</p>;
  }

  return (
    <div className="admin-theme admin-referentials-page space-y-3">
      <AdminPageHeader
        variant="flat"
        title="Gestion des référentiels"
        description="Administration des données de référence : horaires, jours fériés, contraintes métier et listes."
      />

      <div className="admin-ref-kpi-grid">
        {canSchedule ? (
          <KpiCard
            icon={Clock}
            label="Horaires"
            value={schedule ? `${schedule.workDayStart} – ${schedule.workDayEnd}` : '—'}
            active={tab === 'horaires'}
            onClick={() => {
              setTab('horaires');
              setSearch('');
            }}
          />
        ) : null}
        {visibleCategories
          .filter((c) => c.kind === 'list')
          .map((cat) => (
            <KpiCard
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              value={String(counts[cat.id]?.active ?? 0)}
              suffix="entrées"
              active={tab === cat.id}
              onClick={() => {
                setTab(cat.id);
                setSearch('');
              }}
            />
          ))}
        {canSchedule ? (
          <KpiCard
            icon={ShieldCheck}
            label="Contraintes RDV"
            value={constraintsActive}
            suffix="actives"
            active={tab === 'horaires'}
            onClick={() => {
              setTab('horaires');
              setSearch('');
            }}
          />
        ) : null}
        {canTrash ? (
          <KpiCard
            icon={Trash2}
            label="Corbeille"
            value={String(trashTotal)}
            suffix={trashTotal === 1 ? 'élément' : 'éléments'}
            tone="danger"
            active={tab === 'trash'}
            onClick={() => {
              setTab('trash');
              setSearch('');
            }}
          />
        ) : null}
      </div>

      {visibleCategories.length === 0 && !canTrash ? (
        <p className="text-sm text-muted-foreground">
          Aucun onglet référentiel n’est autorisé pour votre rôle.
        </p>
      ) : null}

      <div className={cn('admin-table-shell overflow-hidden', tab === 'trash' && 'admin-trash-table-wrap')}>
        <div className={cn('admin-ref-toolbar', tab === 'trash' && 'admin-trash-toolbar')}>
          {tab === 'trash' ? (
            <AdminTrashBanner
              count={trashTotal}
              emptyHint="Aucun élément — espace prêt pour les référentiels archivés"
              filledHint={`${trashTotal} élément${trashTotal > 1 ? 's' : ''} — restaurables avant suppression définitive`}
            />
          ) : null}
          <div className="admin-ref-toolbar-actions">
            {tab === 'horaires' && canSchedule ? (
              <button
                type="submit"
                form="schedule-form"
                className="admin-ref-toolbar-btn admin-ref-toolbar-btn--primary admin-ref-toolbar-btn--compact"
                disabled={saving || !schedule || !businessRules}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-3 w-3" aria-hidden />
                )}
                Enregistrer
              </button>
            ) : tab === 'trash' && canTrash ? (
              <AdminEmptyTrashButton
                disabled={saving || trashTotal === 0}
                onClick={() => setConfirmEmptyTrash(true)}
              />
            ) : tab !== 'horaires' && tab !== 'trash' && canAccessReferentialTab(permissions, tab) ? (
              <button
                type="button"
                className="admin-ref-toolbar-btn admin-ref-toolbar-btn--primary"
                onClick={openCreate}
              >
                <Plus className="h-3 w-3" aria-hidden />
                Ajouter
              </button>
            ) : null}
          </div>
        </div>

        <div className="admin-ref-panel-body">
          {tab === 'horaires' && schedule && businessRules ? (
            <ScheduleSettingsPanel
              schedule={schedule}
              businessRules={businessRules}
              onBusinessRulesChange={(next) => {
                setBusinessRules(next);
                const { active, total } = getConstraintsPreviewSummary(next, 'referentials');
                setConstraintsActive(`${active}/${total}`);
              }}
              saving={saving}
              onChange={setSchedule}
              onSubmit={saveSchedule}
              onToggleWeekday={toggleWeekday}
              showAside
              compact
              variant="referentials"
            />
          ) : tab === 'horaires' ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--admin-primary)]" />
            </div>
          ) : (
            <>
              {activeCategory ? (
                <ListCategoryHeader category={activeCategory} count={items.length} />
              ) : tab === 'trash' ? (
                <ListCategoryHeader
                  title="Corbeille"
                  description="Éléments archivés — restaurez ou supprimez définitivement."
                  icon={Trash2}
                  count={items.length}
                />
              ) : null}
              <ReferentialListTable
                items={items}
                category={tab === 'trash' ? undefined : activeCategory}
                isTrash={tab === 'trash'}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                onEdit={openEdit}
                onArchive={archiveItem}
                onRestore={restoreItem}
                onPurge={setConfirmPurgeId}
              />
            </>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-dialog admin-dialog-user-form admin-dialog-ref-simple gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]">
          <DialogHeader className="admin-dialog-header admin-create-user-header shrink-0 border-b border-border text-left">
            <DialogTitle className="admin-create-user-title">
              {editItem ? 'Modifier' : 'Ajouter'}
            </DialogTitle>
          </DialogHeader>
          <form
            className="min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving && formName.trim()) void saveItem();
            }}
          >
            <div className="admin-dialog-body">
              <div className="admin-create-user-field">
                <label htmlFor="ref-name" className="admin-create-user-label">
                  Nom
                </label>
                <Input
                  id="ref-name"
                  className="admin-field"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="admin-dialog-footer">
              <button
                type="button"
                className="admin-btn-cancel"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="admin-btn-create-role"
                disabled={saving || !formName.trim()}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <HolidayReferentialDialog
        open={holidayDialogOpen}
        onOpenChange={(o) => {
          setHolidayDialogOpen(o);
          if (!o) setEditItem(null);
        }}
        saving={saving}
        initial={
          editItem?.categoryId === 'jours-feries'
            ? { name: editItem.name, meta: getHolidayMeta(editItem) }
            : null
        }
        onSave={(p) => void saveStructuredItem(p)}
      />

      <UnavailabilityReferentialDialog
        open={unavailabilityDialogOpen}
        onOpenChange={(o) => {
          setUnavailabilityDialogOpen(o);
          if (!o) setEditItem(null);
        }}
        saving={saving}
        initial={
          editItem?.categoryId === 'indisponibilites' && getUnavailabilityMeta(editItem)
            ? { name: editItem.name, meta: getUnavailabilityMeta(editItem)! }
            : null
        }
        onSave={(p) => void saveStructuredItem(p)}
      />

      <AdminConfirmDialog
        open={confirmEmptyTrash}
        onOpenChange={setConfirmEmptyTrash}
        title="Vider la corbeille"
        message="Tous les éléments de la corbeille seront supprimés définitivement."
        confirmLabel="Vider la corbeille"
        loading={saving}
        onConfirm={() => void emptyTrash()}
      />

      <AdminConfirmDialog
        open={!!confirmPurgeId}
        onOpenChange={(o) => !o && setConfirmPurgeId(null)}
        title="Supprimer définitivement"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={saving}
        onConfirm={() => void purgeItem()}
      />
    </div>
  );
}

function ListCategoryHeader({
  category,
  title,
  description,
  icon: IconOverride,
  count,
}: {
  category?: ReferentialCategory;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  count: number;
}) {
  const Icon = IconOverride ?? category?.icon ?? Inbox;
  const heading = title ?? category?.label ?? '';
  const sub = description ?? category?.description ?? '';

  return (
    <header className="admin-ref-list-header">
      <div className="admin-ref-list-header-icon">
        <Icon aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="admin-ref-list-header-title">
          <h2>{heading}</h2>
          <span className="admin-ref-list-header-count">
            {count} {count === 1 ? 'entrée' : 'entrées'}
          </span>
        </div>
        {sub ? <p className="admin-ref-list-header-desc">{sub}</p> : null}
      </div>
    </header>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone = 'default',
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  suffix?: string;
  tone?: 'default' | 'danger';
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('admin-ref-kpi', tone === 'danger' && 'admin-ref-kpi--danger')}
      data-active={active ?? false}
      onClick={onClick}
    >
      <div className="admin-ref-kpi-icon">
        <Icon aria-hidden />
      </div>
      <div className="admin-ref-kpi-body">
        <p className="admin-ref-kpi-label">{label}</p>
        <p className="admin-ref-kpi-value">
          {value}
          {suffix ? <span className="admin-ref-kpi-suffix">{suffix}</span> : null}
        </p>
      </div>
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReferentialListTable({
  items,
  category,
  isTrash,
  loading,
  search,
  onSearchChange,
  onEdit,
  onArchive,
  onRestore,
  onPurge,
}: {
  items: ReferentialItem[];
  category?: ReferentialCategory;
  isTrash: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onEdit: (item: ReferentialItem) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}) {
  const isHolidays = category?.id === 'jours-feries';
  const isUnavailability = category?.id === 'indisponibilites';
  const q = search.trim();

  return (
    <div className="admin-ref-table">
      <div className="admin-ref-table-search">
        <Search className="admin-ref-table-search-icon" aria-hidden />
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="admin-ref-table-search-input"
          aria-label="Rechercher"
        />
      </div>

      {loading ? (
        <div className="admin-ref-loading">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--admin-primary)]" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        isTrash && !q ? (
          <AdminTrashEmptyState
            description="Les éléments archivés apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
          />
        ) : (
        <div className="admin-ref-empty">
          <div className="admin-ref-empty-icon">
            <Inbox aria-hidden />
          </div>
          <p className="admin-ref-empty-title">
            {q
              ? 'Aucun résultat'
              : isTrash
                ? 'Corbeille vide'
                : 'Aucun élément pour le moment'}
          </p>
          <p className="admin-ref-empty-desc">
            {q
              ? `Aucune entrée ne correspond à « ${q} ».`
              : isTrash
                ? 'Les éléments archivés apparaîtront ici.'
                : 'Utilisez le bouton Ajouter pour créer une première entrée.'}
          </p>
        </div>
        )
      ) : (
        <>
      <div
        className={cn(
          'admin-table-head admin-ref-table-head admin-ref-table-grid',
          isUnavailability && 'admin-ref-table-grid--unav',
          isHolidays && 'admin-ref-table-grid--holidays'
        )}
      >
        <span>Libellé</span>
        {isHolidays ? (
          <>
            <span className="hidden sm:block">Date</span>
            <span className="hidden sm:block">Type</span>
            <span className="hidden sm:block">Actif</span>
          </>
        ) : isUnavailability ? (
          <>
            <span className="hidden sm:block">Période</span>
            <span>Jours</span>
            <span className="hidden sm:block">Type</span>
          </>
        ) : (
          <span className="hidden sm:block" />
        )}
        <span className="text-right">Actions</span>
      </div>
      {items.map((item, index) => {
        const holiday = isHolidays || (isTrash && item.categoryId === 'jours-feries')
          ? getHolidayMeta(item)
          : null;
        const unav =
          isUnavailability || (isTrash && item.categoryId === 'indisponibilites')
            ? getUnavailabilityMeta(item)
            : null;

        return (
        <div
          key={item.id}
          className={cn(
            'admin-table-row admin-ref-table-row admin-ref-table-grid',
            isUnavailability && 'admin-ref-table-grid--unav',
            isHolidays && 'admin-ref-table-grid--holidays'
          )}
          data-even={index % 2 === 1}
        >
          <div className="min-w-0">
            {isTrash ? (
              <span className="admin-ref-trash-badge mb-1 inline-block">
                {REFERENTIAL_CATEGORIES.find((c) => c.id === item.categoryId)?.label}
              </span>
            ) : null}
            <span className="admin-ref-table-name">{item.name}</span>
            {unav ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unav.motif}</p>
            ) : null}
          </div>
          {isHolidays && holiday ? (
            <>
              <span className="admin-ref-table-cell admin-ref-table-date hidden sm:block">
                {holiday.date}
              </span>
              <span className="admin-ref-table-cell hidden sm:block">
                {holidayTypeLabel(holiday.type)}
              </span>
              <span className="hidden sm:block">
                <span
                  className={cn(
                    'admin-ref-status-badge',
                    holiday.active ? 'admin-ref-status-badge--active' : 'admin-ref-status-badge--inactive'
                  )}
                >
                  {holiday.active ? 'Actif' : 'Inactif'}
                </span>
              </span>
            </>
          ) : isUnavailability && unav ? (
            <>
              <span className="admin-ref-table-cell admin-ref-table-date hidden sm:block">
                {unav.startDate} → {unav.endDate}
                <br />
                {unav.startTime} – {unav.endTime}
              </span>
              <span
                className="admin-ref-table-cell admin-ref-table-date admin-ref-table-days"
                title="Nombre de jours calendaires inclusifs"
              >
                {formatInclusiveDayCount(unav.startDate, unav.endDate)}
              </span>
              <span className="admin-ref-table-cell hidden sm:block">
                {unavailabilityTypeLabel(unav.type, unav.typeOther)}
                <span className="mt-0.5 block text-[10px]">
                  {confidentialityLabel(unav.confidentialityLevel)}
                </span>
              </span>
            </>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="admin-ref-table-actions">
            {isTrash ? (
              <>
                <button
                  type="button"
                  className="admin-ref-action-btn admin-ref-action-btn--restore"
                  title="Restaurer"
                  onClick={() => onRestore(item.id)}
                >
                  <RotateCcw aria-hidden />
                </button>
                <button
                  type="button"
                  className="admin-ref-action-btn admin-ref-action-btn--delete"
                  title="Supprimer définitivement"
                  onClick={() => onPurge(item.id)}
                >
                  <Trash2 aria-hidden />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="admin-ref-action-btn admin-ref-action-btn--edit"
                  title="Modifier"
                  onClick={() => onEdit(item)}
                >
                  <Pencil aria-hidden />
                </button>
                <button
                  type="button"
                  className="admin-ref-action-btn admin-ref-action-btn--delete"
                  title="Mettre en corbeille"
                  onClick={() => onArchive(item.id)}
                >
                  <Trash2 aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
        );
      })}
        </>
      )}
    </div>
  );
}
