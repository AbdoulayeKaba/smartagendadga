'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  Calendar,
  Download,
  Eye,
  FileEdit,
  Loader2,
  LogIn,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { UserAvatar } from '@/components/admin/user-avatar';
import { Button } from '@/components/ui/button';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditActionCategory, AuditJournalEntry, AuditJournalStats } from '@/lib/dg/audit-journal';
import { AuditEventDetailDialog } from '@/components/admin/audit-event-detail-dialog';
import { cn } from '@/lib/utils';

type ApiResponse = {
  items: AuditJournalEntry[];
  stats: AuditJournalStats;
  dominant: { label: string; count: number }[];
  users: { id: string; name: string; email: string; roleLabel: string }[];
};

const CATEGORY_OPTIONS: { value: AuditActionCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toutes les actions' },
  { value: 'LOGIN', label: 'Connexion' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'BUSINESS', label: 'Opération métier' },
];

function categoryBadgeClass(category: AuditActionCategory) {
  switch (category) {
    case 'LOGIN':
      return 'admin-audit-badge-login';
    case 'UPDATE':
      return 'admin-audit-badge-update';
    case 'DELETE':
      return 'admin-audit-badge-delete';
    case 'EXPORT':
      return 'admin-audit-badge-export';
    default:
      return 'admin-audit-badge-business';
  }
}

function AuditKpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'green' | 'orange' | 'blue' | 'default';
}) {
  return (
    <div className="admin-audit-kpi" data-tone={tone ?? 'default'}>
      <div className="admin-audit-kpi-icon">
        <Icon aria-hidden />
      </div>
      <div className="admin-audit-kpi-body">
        <p className="admin-audit-kpi-label">{label}</p>
        <p className="admin-audit-kpi-value">{value}</p>
        {hint ? <p className="admin-audit-kpi-hint">{hint}</p> : null}
      </div>
    </div>
  );
}

export function AuditJournal() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<AuditActionCategory | 'ALL'>('ALL');
  const [userId, setUserId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detail, setDetail] = useState<AuditJournalEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (category !== 'ALL') params.set('category', category);
      if (userId !== 'ALL') params.set('userId', userId);
      if (dateFrom) params.set('from', new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) params.set('to', new Date(`${dateTo}T23:59:59`).toISOString());
      const res = await fetch(`/api/dg/audit-logs?${params.toString()}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [q, category, userId, dateFrom, dateTo]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (userId === 'ALL' || !data) return;
    if (!data.users.some((u) => u.id === userId)) setUserId('ALL');
  }, [data, userId]);

  const trendLabel = useMemo(() => {
    if (!data?.stats) return '';
    const pct = data.stats.actions24hTrendPct;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct}% vs 24h précédentes`;
  }, [data?.stats]);

  const resetFilters = () => {
    setQ('');
    setCategory('ALL');
    setUserId('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="admin-theme admin-audit-page min-w-0 space-y-2.5">
      <AdminPageHeader
        variant="flat"
        title="Journal d'audit"
        description="Historique complet des actions effectuées sur la plateforme"
        actions={
          <div className="admin-audit-header-actions">
            <button
              type="button"
              className="admin-audit-header-btn"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Actualiser"
            >
              {loading ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            </button>
            <button type="button" className="admin-audit-header-btn admin-audit-header-btn--text">
              <Download aria-hidden />
              Exporter
            </button>
          </div>
        }
      />

      {data ? (
        <div className="admin-audit-kpi-grid">
          <AuditKpi
            icon={Activity}
            label="Actions (24h)"
            value={data.stats.actions24h}
            hint={trendLabel}
            tone="green"
          />
          <AuditKpi icon={LogIn} label="Connexions (LOGIN)" value={data.stats.logins24h} tone="green" />
          <AuditKpi
            icon={FileEdit}
            label="Opérations métier"
            value={data.stats.businessOps24h}
            tone="orange"
          />
          <AuditKpi
            icon={Users}
            label="Utilisateurs actifs (24h)"
            value={data.stats.activeUsers24h}
            tone="blue"
          />
        </div>
      ) : null}

      {data && data.dominant.length > 0 ? (
        <section className="admin-audit-dominant">
          <p className="admin-audit-dominant-title">Actions dominantes (vue filtrée)</p>
          <div className="admin-audit-dominant-pills">
            {data.dominant.map((d) => (
              <span key={d.label} className="admin-audit-dominant-pill">
                {d.label} ({d.count})
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-audit-filters">
        <div className="admin-audit-search">
          <Search className="admin-audit-search-icon" aria-hidden />
          <Input
            className="admin-settings-input admin-audit-search-input"
            placeholder="Rechercher dans les logs…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'admin-audit-filter-btn',
                (dateFrom || dateTo) && 'border-[var(--admin-primary)]/30 bg-[var(--admin-hero-bg)]'
              )}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              Période
            </Button>
          </PopoverTrigger>
          <PopoverContent className="admin-audit-period-popover w-auto border-[var(--admin-border)] p-2.5" align="start">
            <div className="admin-audit-period-popover-body">
              <p className="admin-audit-period-popover-title">Filtrer par période</p>
              <div className="admin-audit-period-popover-grid">
                <div className="admin-audit-period-field">
                  <Label htmlFor="audit-date-from" className="admin-audit-period-label">
                    Du
                  </Label>
                  <FrenchDateField
                    id="audit-date-from"
                    className="admin-field admin-audit-period-input"
                    value={dateFrom}
                    onChange={setDateFrom}
                  />
                </div>
                <div className="admin-audit-period-field">
                  <Label htmlFor="audit-date-to" className="admin-audit-period-label">
                    Au
                  </Label>
                  <FrenchDateField
                    id="audit-date-to"
                    className="admin-field admin-audit-period-input"
                    value={dateTo}
                    onChange={setDateTo}
                  />
                </div>
              </div>
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  className="admin-audit-period-clear"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  Effacer
                </button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Select value={category} onValueChange={(v) => setCategory(v as AuditActionCategory | 'ALL')}>
          <SelectTrigger className="admin-audit-filter-btn admin-audit-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="admin-audit-filter-btn admin-audit-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les utilisateurs</SelectItem>
            {data?.users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="admin-audit-filter-btn shrink-0" onClick={resetFilters}>
          Réinitialiser
        </Button>
      </section>

      <section className="admin-audit-table-wrap">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement…
          </div>
        ) : !data?.items.length ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Aucune entrée pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-audit-table">
              <thead>
                <tr>
                  <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                  <th>Date / Heure</th>
                  <th>Utilisateur</th>
                  <th>Actions utilisateur</th>
                  <th>IP</th>
                  <th className="w-12">Voir</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, index) => (
                  <tr key={row.id}>
                    <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </td>
                    <td>
                      <div className="admin-audit-user-cell">
                        <UserAvatar
                          firstName={row.user.firstName}
                          lastName={row.user.lastName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="admin-audit-user-name">
                            {row.user.firstName} {row.user.lastName}
                          </p>
                          <p className="admin-audit-user-role">{row.user.roleLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[220px]">
                      <span className={cn('admin-audit-badge', categoryBadgeClass(row.category))}>
                        <LogIn aria-hidden />
                        {row.actionLabel}
                      </span>
                      <p className="admin-audit-action-category">{row.category}</p>
                      <p className="admin-audit-action-desc">{row.description}</p>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{row.ip ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-audit-view-btn"
                        onClick={() => setDetail(row)}
                        aria-label="Voir le détail"
                      >
                        <Eye aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AuditEventDetailDialog
        entry={detail}
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </div>
  );
}
