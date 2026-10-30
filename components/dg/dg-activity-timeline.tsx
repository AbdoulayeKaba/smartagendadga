'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { useApp } from '@/lib/app-context';
import { AppointmentRequesterProfileDialog } from '@/components/appointments/appointment-requester-profile-dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { APP_TIMEZONE, formatTimeInAppTz } from '@/lib/datetime';
import type { AuditJournalEntry } from '@/lib/dg/audit-journal';
import { involvementLabel, type AppointmentInvolvement } from '@/lib/dg/appointment-involvement';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import { userInitials } from '@/lib/dg/role-labels';
import { cn } from '@/lib/utils';

type ActivityRow = AuditJournalEntry & { involvement?: AppointmentInvolvement };

type ActivityPayload = {
  items: ActivityRow[];
  total: number;
  stats: {
    approvals: number;
    rejections: number;
    reschedules: number;
    requests: number;
  };
};

type ActivityFilter = 'all' | 'request' | 'approve' | 'reject' | 'reschedule';
type ActivityTone = 'green' | 'red' | 'blue' | 'amber' | 'neutral';

const SERVICE_LABEL = 'DGA';

const FILTERS: { id: ActivityFilter; label: string; tone: ActivityTone }[] = [
  { id: 'all', label: 'Toutes', tone: 'green' },
  { id: 'request', label: 'Demandes RDV', tone: 'green' },
  { id: 'approve', label: 'Validations', tone: 'green' },
  { id: 'reject', label: 'Refus', tone: 'red' },
  { id: 'reschedule', label: 'Reprogrammations', tone: 'amber' },
];

function bucketOf(actionCode: string): Exclude<ActivityFilter, 'all'> | 'other' {
  const code = actionCode.toLowerCase();
  if (code.includes('reschedule')) return 'reschedule';
  if (code.includes('reject') || code.includes('refus')) return 'reject';
  if (code.includes('approve') || code.includes('valid')) return 'approve';
  if (code.includes('request') || code.includes('demande')) return 'request';
  return 'other';
}

function activityTitle(row: AuditJournalEntry) {
  const bucket = bucketOf(row.actionCode);
  if (bucket === 'request') return 'Demande RDV';
  if (bucket === 'approve') return 'Validation';
  if (bucket === 'reject') return 'Refus';
  if (bucket === 'reschedule') return 'Reprogrammation';
  return row.actionLabel;
}

function activityVisual(actionCode: string): {
  Icon: ComponentType<{ className?: string }>;
  tone: ActivityTone;
} {
  const code = actionCode.toLowerCase();
  if (code.includes('reschedule')) return { Icon: CalendarClock, tone: 'blue' };
  if (code.includes('reject')) return { Icon: CalendarX, tone: 'red' };
  if (code.includes('approve')) return { Icon: CalendarCheck, tone: 'green' };
  if (code.includes('constraint')) return { Icon: Settings, tone: 'green' };
  if (code.includes('request')) return { Icon: FileText, tone: 'neutral' };
  return { Icon: Calendar, tone: 'red' };
}

function actorName(row: AuditJournalEntry) {
  return `${row.user.firstName} ${row.user.lastName}`.trim();
}

function journalSentence(row: AuditJournalEntry) {
  const name = actorName(row);
  if (name && row.description.startsWith(name)) {
    const rest = row.description.slice(name.length).trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : row.description;
  }
  return row.description;
}

function formatDayHeading(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatDetailWhen(iso: string) {
  const day = formatDayHeading(iso);
  return `Le ${day} à ${formatTimeInAppTz(iso)}`;
}

function formatJournalDay(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function activityCountLabel(count: number) {
  return count === 1 ? '1 activité' : `${count} activités`;
}

export function DgActivityTimeline() {
  const router = useRouter();
  const { permissions } = useApp();
  const canReview = permissions['appointments.review'] === true;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<AppointmentReviewItem | null>(null);
  const closedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/dg/activity?${params.toString()}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as ActivityPayload);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      all: items.length,
      request: items.filter((item) => bucketOf(item.actionCode) === 'request').length,
      approve: items.filter((item) => bucketOf(item.actionCode) === 'approve').length,
      reject: items.filter((item) => bucketOf(item.actionCode) === 'reject').length,
      reschedule: items.filter((item) => bucketOf(item.actionCode) === 'reschedule').length,
    };
  }, [data]);

  const visible = useMemo(() => {
    const items = data?.items ?? [];
    if (filter === 'all') return items;
    return items.filter((item) => bucketOf(item.actionCode) === filter);
  }, [data, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const item of visible) {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(item.createdAt));
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()];
  }, [visible]);

  useEffect(() => {
    if (!visible.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && visible.some((item) => item.id === current)) return current;
      if (closedRef.current) return null;
      return visible[0]?.id ?? null;
    });
  }, [visible]);

  const selected = visible.find((item) => item.id === selectedId) ?? null;

  const applyFilter = (next: ActivityFilter) => {
    closedRef.current = false;
    setFilter(next);
  };

  const openAppointment = () => {
    if (!selected?.appointmentId) return;
    const base = canReview ? '/dg/appointments' : '/appointments/mine';
    router.push(`${base}?open=${encodeURIComponent(selected.appointmentId)}`);
  };

  const openDetail = async () => {
    if (!selected?.appointmentId) return;
    const appointmentId = selected.appointmentId;
    setDetailItem(null);
    setDetailLoading(true);
    window.setTimeout(() => setDetailOpen(true), 0);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/detail`);
      if (!res.ok) throw new Error('LOAD_FAILED');
      const json = (await res.json()) as { item: AppointmentReviewItem };
      if (!json.item) throw new Error('LOAD_FAILED');
      setDetailItem(json.item);
    } catch {
      setDetailOpen(false);
      toast({
        title: 'Impossible d’ouvrir le détail',
        description: 'Ce rendez-vous n’est plus disponible.',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const filtersActive = filter !== 'all' || q.trim().length > 0;

  return (
    <div className="dg-act-shell">
      <AdminPageHeader
        variant="flat"
        eyebrow="DGA"
        title="Historique des rendez-vous"
        description="Validations, refus, demandes et reprogrammations."
        mark={
          <span className="dg-act-mark" aria-hidden>
            <FileText className="h-4 w-4" />
          </span>
        }
        actions={
          <button
            type="button"
            className="dg-act-refresh"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualiser"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        }
      />

      <section className="dg-act-toolbar">
        <div className="dg-act-search">
          <Search className="dg-act-search-icon" aria-hidden />
          <Input
            className="dg-act-search-input"
            placeholder="Filtrer par utilisateur, action, date, motif…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filtrer l'historique"
          />
        </div>
        <button
          type="button"
          className="dg-act-filter-btn"
          aria-label="Réinitialiser les filtres"
          aria-pressed={filtersActive}
          onClick={() => {
            setQ('');
            applyFilter('all');
          }}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
        <div className="dg-act-tabs" role="tablist" aria-label="Catégories">
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className="dg-act-tab"
              data-tone={tab.tone}
              data-active={filter === tab.id ? 'true' : 'false'}
              onClick={() => applyFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="dg-act-tab-count">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="dg-act-split">
        <section className="dg-act-list-card" aria-label="Activités">
          {loading && !data ? (
            <div className="dg-activity-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !visible.length ? (
            <p className="dg-activity-empty">Aucune activité pour ce filtre.</p>
          ) : (
            groups.map(([day, rows]) => (
              <div key={day} className="dg-act-day">
                <header className="dg-act-day-head">
                  <span className="dg-act-day-title">
                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                    {formatDayHeading(rows[0]?.createdAt ?? day)}
                  </span>
                  <span className="dg-act-day-count">{activityCountLabel(rows.length)}</span>
                </header>
                <ul className="dg-act-day-list">
                  {rows.map((row) => {
                    const { Icon, tone } = activityVisual(row.actionCode);
                    const active = row.id === selectedId;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={cn('dg-act-row', active && 'dg-act-row--selected')}
                          aria-pressed={active}
                          onClick={() => {
                            closedRef.current = false;
                            setSelectedId(row.id);
                          }}
                        >
                          <time className="dg-act-time" dateTime={row.createdAt}>
                            {formatTimeInAppTz(row.createdAt)}
                          </time>
                          <span className="dg-act-rail" aria-hidden>
                            <span className="dg-act-dot" />
                          </span>
                          <span className={cn('dg-act-icon', `dg-act-icon--${tone}`)}>
                            <Icon className="dg-act-icon-svg" />
                          </span>
                          <span className="dg-act-main">
                            <span className="dg-act-title">{activityTitle(row)}</span>
                            <span className="dg-act-desc">{row.description}</span>
                            {row.involvement ? (
                              <em className="dg-act-role" data-kind={row.involvement}>
                                {involvementLabel(row.involvement)}
                              </em>
                            ) : null}
                          </span>
                          <span className="dg-act-actor">
                            <span className="dg-act-avatar" aria-hidden>
                              {userInitials(row.user.firstName, row.user.lastName)}
                            </span>
                            <span className="dg-act-actor-copy">
                              <span className="dg-act-actor-name">{actorName(row)}</span>
                              <span className="dg-act-actor-role">{row.user.roleLabel}</span>
                            </span>
                          </span>
                          <ChevronRight className="dg-act-chevron" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="dg-act-detail" aria-label="Détail de l'activité">
          <header className="dg-act-detail-head">
            <h2>
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              Détail de l&apos;activité
            </h2>
            {selected ? (
              <button
                type="button"
                className="dg-act-detail-close"
                aria-label="Fermer le détail"
                onClick={() => {
                  closedRef.current = true;
                  setSelectedId(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </header>

          {selected ? (
            <ActivityDetail
              row={selected}
              detailLoading={detailLoading}
              onOpenAppointment={openAppointment}
              onOpenDetail={() => void openDetail()}
            />
          ) : (
            <p className="dg-act-detail-empty">Sélectionnez une activité pour afficher le détail.</p>
          )}
        </aside>
      </div>

      <AppointmentRequesterProfileDialog
        appointment={detailItem}
        open={detailOpen}
        loading={detailLoading}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

function ActivityDetail({
  row,
  detailLoading,
  onOpenAppointment,
  onOpenDetail,
}: {
  row: ActivityRow;
  detailLoading: boolean;
  onOpenAppointment: () => void;
  onOpenDetail: () => void;
}) {
  const { Icon, tone } = activityVisual(row.actionCode);
  const title = activityTitle(row);
  const linked = Boolean(row.appointmentId);

  return (
    <div className="dg-act-detail-body">
      <div className="dg-act-detail-hero">
        <span className={cn('dg-act-icon', `dg-act-icon--${tone}`)}>
          <Icon className="dg-act-icon-svg" />
        </span>
        <div className="dg-act-detail-hero-copy">
          <p className="dg-act-detail-title">{title}</p>
          <p className="dg-act-detail-when">{formatDetailWhen(row.createdAt)}</p>
        </div>
        <span className={cn('dg-act-badge', `dg-act-badge--${tone}`)}>{title}</span>
      </div>

      <dl className="dg-act-facts">
        <div>
          <dt>
            <UserRound aria-hidden /> Acteur
          </dt>
          <dd>
            <span className="dg-act-avatar" aria-hidden>
              {userInitials(row.user.firstName, row.user.lastName)}
            </span>
            <span>
              <span className="dg-act-actor-name">{actorName(row)}</span>
              <span className="dg-act-actor-role">{row.user.roleLabel}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt>
            <Calendar aria-hidden /> Date et heure
          </dt>
          <dd className="dg-act-when-pills">
            <span>
              <Calendar aria-hidden /> {formatDayHeading(row.createdAt)}
            </span>
            <span>
              <CalendarClock aria-hidden /> {formatTimeInAppTz(row.createdAt)}
            </span>
          </dd>
        </div>
        <div>
          <dt>
            <FileText aria-hidden /> Action
          </dt>
          <dd>{title}</dd>
        </div>
        {row.involvement ? (
          <div>
            <dt>
              <UserRound aria-hidden /> Votre lien
            </dt>
            <dd>
              <em className="dg-act-role" data-kind={row.involvement}>
                {involvementLabel(row.involvement)}
              </em>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>
            <FileText aria-hidden /> Objet / Contexte
          </dt>
          <dd className="dg-act-fact-text">{row.description}</dd>
        </div>
        <div>
          <dt>
            <Building2 aria-hidden /> Service
          </dt>
          <dd>{SERVICE_LABEL}</dd>
        </div>
      </dl>

      <section className="dg-act-journal">
        <h3>Historique / Journal</h3>
        <p className="dg-act-journal-line">
          <span className="dg-act-journal-dot" aria-hidden />
          <span>
            <span className="dg-act-journal-meta">
              {formatJournalDay(row.createdAt)} · {formatTimeInAppTz(row.createdAt)} {actorName(row)}
            </span>
            <span className="dg-act-journal-text">{journalSentence(row)}</span>
            <span className="dg-act-journal-role">
              {row.user.roleLabel} — {SERVICE_LABEL}
            </span>
          </span>
        </p>
      </section>

      <div className="dg-act-actions">
        <button
          type="button"
          className="dg-act-btn dg-act-btn--primary"
          disabled={!linked}
          title={linked ? 'Ouvrir ce rendez-vous' : 'Cette action n’est pas liée à un rendez-vous'}
          onClick={onOpenAppointment}
        >
          <Eye aria-hidden /> Voir le RDV
        </button>
        <button
          type="button"
          className="dg-act-btn dg-act-btn--ghost"
          disabled={!linked || detailLoading}
          title={linked ? 'Ouvrir la fiche du rendez-vous' : 'Cette action n’est pas liée à un rendez-vous'}
          onClick={onOpenDetail}
        >
          {detailLoading ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
          Voir le détail
        </button>
      </div>
    </div>
  );
}
