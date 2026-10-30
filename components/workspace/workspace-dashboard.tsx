'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckSquare,
  FileSignature,
  Gavel,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTemporalQueryParams } from '@/components/temporal/temporal-navigation-context';
import { useApp } from '@/lib/app-context';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';
import {
  DECISION_STATUS_LABELS,
  MISSION_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/workspace/labels';
import { MissionAlertsBanner } from '@/components/workspace/mission-alerts-banner';
import { getMissionCountry } from '@/lib/workspace/mission-countries';
import { MissionOperationalBadge } from '@/components/workspace/mission-operational-badge';
import { MissionVisualBadge } from '@/lib/workspace/mission-status-ui';
import type { WorkspaceDashboard } from '@/lib/workspace/types';
import { cn } from '@/lib/utils';

const KPI_CONFIG = [
  { key: 'appointmentsToday' as const, label: "RDV aujourd'hui", href: '/dg/appointments', icon: Calendar, tone: 'green' as const },
  { key: 'pendingAppointments' as const, label: 'RDV en attente', href: '/dg/appointments', icon: Timer, tone: 'orange' as const },
  { key: 'mailPending' as const, label: 'Courriers', href: '/dg/workspace/mail', icon: Mail, tone: 'default' as const },
  { key: 'urgentTasks' as const, label: 'Tâches urgentes', href: '/dg/workspace/tasks', icon: CheckSquare, tone: 'orange' as const },
  { key: 'overdueDecisions' as const, label: 'Décisions retard', href: '/dg/workspace/decisions', icon: Gavel, tone: 'orange' as const },
  { key: 'documentsToSign' as const, label: 'Docs à signer', href: '/dg/workspace/documents', icon: FileSignature, tone: 'default' as const },
  { key: 'missionsOngoing' as const, label: 'Missions en cours', href: '/dg/workspace/missions', icon: MapPin, tone: 'orange' as const },
  { key: 'deadlinesSoon' as const, label: 'Échéances', href: '/dg/workspace/deadlines', icon: AlertTriangle, tone: 'orange' as const },
];

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone?: 'orange' | 'green' | 'blue' | 'default';
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn('workspace-dash-kpi', highlight && 'workspace-dash-kpi--alert')}
      data-tone={tone ?? 'default'}
    >
      <div className="workspace-dash-kpi-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="workspace-dash-kpi-label">{label}</p>
        <p className="workspace-dash-kpi-value">{value}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-40" />
    </Link>
  );
}

function BarChart({
  title,
  items,
  labels,
}: {
  title: string;
  items: { status: string; count: number }[];
  labels: Record<string, string>;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="workspace-chart-card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="workspace-chart-title">{title}</p>
        <span className="text-xs text-muted-foreground">{total} au total</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Aucune donnée</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li key={`${title}-${String(item.status)}-${index}`}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {labels[item.status] ?? item.status}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{item.count}</span>
              </div>
              <div className="workspace-chart-bar-bg">
                <div
                  className="workspace-chart-bar-fill"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WidgetPanel({
  title,
  href,
  empty,
  items,
  icon: Icon,
}: {
  title: string;
  href: string;
  empty: string;
  items: { id: string; primary: string; secondary: string; href: string }[];
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="workspace-widget">
      <div className="workspace-widget-head">
        <div className="flex items-center gap-2">
          <span className="workspace-widget-icon">
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-[var(--admin-foreground)]">{title}</p>
        </div>
        <Link href={href} className="workspace-widget-more">
          Tout voir
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="workspace-widget-row">
                <span className="min-w-0 truncate font-medium">{item.primary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.secondary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WorkspaceDashboardView() {
  const { currentUser } = useApp();
  const temporalParams = useTemporalQueryParams();
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/dashboard?${new URLSearchParams(temporalParams)}`);
      if (res.ok) {
        setData((await res.json()) as WorkspaceDashboard);
        return;
      }
      setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [temporalParams]);

  useEffect(() => {
    void load();
    setTodayLabel(format(new Date(), "EEEE d MMMM yyyy", { locale: fr }));
  }, [load]);

  const alertCount = useMemo(() => {
    if (!data) return 0;
    const { kpis } = data;
    return (
      kpis.pendingAppointments +
      kpis.urgentTasks +
      kpis.overdueDecisions +
      kpis.mailPending +
      kpis.deadlinesSoon +
      kpis.missionsOngoing
    );
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--admin-primary)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="workspace-dash-empty">
        <p>Impossible de charger le tableau de bord.</p>
        <Button type="button" className="admin-btn-primary mt-3" onClick={() => void load()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const { kpis, charts, widgets } = data;

  return (
    <div className="workspace-dash space-y-6">
      <header className="workspace-dash-hero">
        <div className="workspace-dash-hero-text">
          <p className="workspace-dash-eyebrow">Plateforme institutionnelle · ARPT</p>
          <h1 className="workspace-dash-title">
            Bonjour {currentUser.firstName}
            <span className="text-[var(--admin-primary)]">.</span>
          </h1>
          <p className="workspace-dash-subtitle" suppressHydrationWarning>
            {todayLabel ? todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1) : ''} — pilotage
            unifié de l&apos;agenda, des tâches et des courriers de la Direction Générale Adjointe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="admin-appt-filter-btn" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualiser
          </Button>
          <Button type="button" className="admin-btn-primary" asChild>
            <Link href="/dg/plan">Planifier un RDV</Link>
          </Button>
          <Button type="button" variant="outline" className="admin-appt-filter-btn" asChild>
            <Link href={DG_ROOM_AVAILABILITY_HREF}>
              <CalendarRange className="mr-2 h-4 w-4" />
              {DG_ROOM_SLOTS_LABEL}
            </Link>
          </Button>
        </div>
      </header>

      {alertCount > 0 ? (
        <div className="workspace-dash-alert" role="status">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{alertCount} point{alertCount > 1 ? 's' : ''} nécessitent votre attention</p>
            <p className="mt-0.5 text-sm opacity-90">
              RDV en attente, tâches urgentes, décisions en retard, courriers ou échéances proches.
            </p>
          </div>
          <Button size="sm" variant="secondary" className="shrink-0 bg-white/90" asChild>
            <Link href="/dg/appointments">Traiter</Link>
          </Button>
        </div>
      ) : null}

      <section>
        <h2 className="workspace-dash-section-title">Indicateurs clés</h2>
        <div className="workspace-dash-kpi-grid">
          {KPI_CONFIG.map((cfg) => {
            const value = kpis[cfg.key];
            const highlight =
              (cfg.key === 'urgentTasks' ||
                cfg.key === 'overdueDecisions' ||
                cfg.key === 'pendingAppointments' ||
                cfg.key === 'missionsOngoing') &&
              value > 0;
            return (
              <KpiCard
                key={cfg.key}
                label={cfg.label}
                value={value}
                icon={cfg.icon}
                href={cfg.href}
                tone={cfg.tone}
                highlight={highlight}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="workspace-dash-section-title">Missions du DGA</h2>
        <div className="workspace-dash-kpi-grid">
          {(
            [
              { key: 'missionsTotal' as const, label: 'Total', tone: 'default' as const },
              { key: 'missionsPlanned' as const, label: 'Planifiées', tone: 'blue' as const },
              { key: 'missionsOngoing' as const, label: 'En cours', tone: 'orange' as const },
              { key: 'missionsCompleted' as const, label: 'Terminées', tone: 'green' as const },
              { key: 'missionsCancelled' as const, label: 'Annulées', tone: 'orange' as const },
              { key: 'missionsThisMonth' as const, label: 'Ce mois', tone: 'blue' as const },
              { key: 'missionsProlonged' as const, label: 'Prolongées', tone: 'orange' as const },
              { key: 'missionsProlongationTotal' as const, label: 'Prolongations', tone: 'default' as const },
            ] as const
          ).map((cfg) => (
            <KpiCard
              key={cfg.key}
              label={cfg.label}
              value={kpis[cfg.key]}
              icon={MapPin}
              href="/dg/workspace/missions"
              tone={cfg.tone}
              highlight={cfg.key === 'missionsOngoing' && kpis.missionsOngoing > 0}
            />
          ))}
        </div>
      </section>

      <section>
        <MissionAlertsBanner missions={data.widgets.attentionMissions} compact />
      </section>

      <section>
        <h2 className="workspace-dash-section-title">Missions prolongées</h2>
        <div className="workspace-widget">
          {data.widgets.prolongedMissions.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Aucune prolongation enregistrée.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.widgets.prolongedMissions.map((m) => (
                <li key={m.id}>
                  <Link href="/dg/workspace/missions" className="workspace-widget-row workspace-dash-mission-attention-item">
                    <span className="min-w-0 truncate font-medium">{m.subject}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {m.prolongationCount} prolong.
                      <MissionOperationalBadge mission={m} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="workspace-dash-section-title">Missions nécessitant une attention</h2>
        <div className="workspace-widget">
          <div className="workspace-widget-head">
            <div className="flex items-center gap-2">
              <span className="workspace-widget-icon">
                <MapPin className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-[var(--admin-foreground)]">
                Priorité : départ aujourd&apos;hui → en cours → départ demain → planifiées → terminées
              </p>
            </div>
            <Link href="/dg/workspace/missions" className="workspace-widget-more">
              Toutes les missions
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.widgets.attentionMissions.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Aucune mission à signaler.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.widgets.attentionMissions.map((m) => (
                <li key={m.id}>
                  <Link
                    href="/dg/workspace/missions"
                    className="workspace-widget-row workspace-dash-mission-attention-item"
                  >
                    <span className="min-w-0 truncate font-medium">{m.subject}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(m.departAt), 'd MMM', { locale: fr })}
                      </span>
                      <MissionVisualBadge mission={m} showIcon={false} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="workspace-dash-section-title">Synthèse d&apos;activité</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <BarChart title="Tâches par statut" items={charts.tasksByStatus} labels={TASK_STATUS_LABELS} />
          <BarChart title="Décisions par statut" items={charts.decisionsByStatus} labels={DECISION_STATUS_LABELS} />
          <BarChart
            title="Courriers (workflow)"
            items={charts.mailByStatus}
            labels={{
              RECEIVED: 'Reçu',
              ASSIGNED: 'Affecté',
              IN_PROGRESS: 'En cours',
              PROCESSED: 'Traité',
              ARCHIVED: 'Archivé',
              SENT: 'Envoyé',
            }}
          />
          <BarChart title="Missions par statut" items={charts.missionsByStatus} labels={MISSION_STATUS_LABELS} />
          <BarChart
            title="Missions par type"
            items={charts.missionsByType.map((i) => ({ status: i.type, count: i.count }))}
            labels={Object.fromEntries(charts.missionsByType.map((i) => [i.type, i.type]))}
          />
          <BarChart
            title="Missions par destination"
            items={charts.missionsByDestination.map((i) => ({ status: i.destination, count: i.count }))}
            labels={Object.fromEntries(
              charts.missionsByDestination.map((i) => [
                i.destination,
                getMissionCountry(i.destination)?.name ?? i.destination,
              ])
            )}
          />
        </div>
      </section>

      <section>
        <h2 className="workspace-dash-section-title">À traiter aujourd&apos;hui</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WidgetPanel
            title="Agenda du jour"
            href="/dg/appointments"
            icon={Calendar}
            empty="Aucun RDV approuvé aujourd'hui."
            items={widgets.todayAppointments.map((a) => ({
              id: a.id,
              primary: a.title,
              secondary: format(new Date(a.startAt), 'HH:mm', { locale: fr }),
              href: '/dg/appointments',
            }))}
          />
          <WidgetPanel
            title="Tâches prioritaires"
            href="/dg/workspace/tasks"
            icon={CheckSquare}
            empty="Aucune tâche urgente."
            items={widgets.urgentTasks.map((t) => ({
              id: t.id,
              primary: t.title,
              secondary: t.assigneeName,
              href: '/dg/workspace/tasks',
            }))}
          />
          <WidgetPanel
            title="Décisions en retard"
            href="/dg/workspace/decisions"
            icon={Gavel}
            empty="Aucun retard signalé."
            items={widgets.overdueDecisions.map((d) => ({
              id: d.id,
              primary: d.title,
              secondary: d.ownerName,
              href: '/dg/workspace/decisions',
            }))}
          />
          <WidgetPanel
            title="Courriers en attente"
            href="/dg/workspace/mail"
            icon={Mail}
            empty="File de courriers vide."
            items={widgets.mailQueue.map((m) => ({
              id: m.id,
              primary: m.subject,
              secondary: m.reference,
              href: '/dg/workspace/mail',
            }))}
          />
          <WidgetPanel
            title="Échéances proches"
            href="/dg/workspace/deadlines"
            icon={AlertTriangle}
            empty="Aucune échéance imminente."
            items={widgets.upcomingDeadlines.map((d) => ({
              id: d.id,
              primary: d.title,
              secondary: format(new Date(d.dueAt), 'd MMM', { locale: fr }),
              href: '/dg/workspace/deadlines',
            }))}
          />
          <WidgetPanel
            title="Missions en cours"
            href="/dg/workspace/missions"
            icon={MapPin}
            empty="Aucune mission en cours."
            items={widgets.ongoingMissions.map((m) => ({
              id: m.id,
              primary: m.subject,
              secondary: format(new Date(m.returnAt), 'd MMM', { locale: fr }),
              href: '/dg/workspace/missions',
            }))}
          />
          <WidgetPanel
            title="Prochaines missions"
            href="/dg/workspace/missions"
            icon={MapPin}
            empty="Aucune mission planifiée."
            items={widgets.upcomingMissionsList.map((m) => ({
              id: m.id,
              primary: m.subject,
              secondary: format(new Date(m.departAt), 'd MMM', { locale: fr }),
              href: '/dg/workspace/missions',
            }))}
          />
        </div>
      </section>
    </div>
  );
}
