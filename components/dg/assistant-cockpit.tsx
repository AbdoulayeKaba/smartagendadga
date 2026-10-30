'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  CalendarRange,
  Clock,
  XCircle,
  Zap,
} from 'lucide-react';
import { AssistantCharts } from '@/components/dg/assistant-charts';
import { type AssistantInsight } from '@/components/dg/assistant-insights';
import { AssistantSidePanel } from '@/components/dg/assistant-side-panel';
import { AssistantSparkline } from '@/components/dg/assistant-sparkline';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { LIVE_TOPICS, useLiveRefresh } from '@/lib/dg/live-refresh';
import { cn } from '@/lib/utils';

type PendingItem = {
  id: string;
  title: string;
  startAt: string;
  priority: string;
  requestedBy: { firstName: string; lastName: string };
};

type AgendaItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  priority: string;
  requestedBy: { firstName: string; lastName: string };
};

type AssistantDashboard = {
  pending: PendingItem[];
  todayAgenda: AgendaItem[];
  nextAppointment: {
    id: string;
    title: string;
    startAt: string;
    requestedBy: { firstName: string; lastName: string };
  } | null;
  tomorrowUrgentAppointments: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    requestedBy: { firstName: string; lastName: string };
  }[];
  insights: AssistantInsight[];
  stats: {
    pending: number;
    approvedToday: number;
    approvedWeek: number;
    approvalRate: number;
    highPriority: number;
    rejectedTotal: number;
    avgDecisionHours: number;
    peakDayLabel: string | null;
    peakDayCount: number;
    roomReservationsWeek: number;
    isCurrentYear: boolean;
    year: number;
  };
  charts: {
    weeklyFlow: {
      label: string;
      date: string;
      approved: number;
      pending: number;
      total: number;
    }[];
    roomTrend: {
      label: string;
      shortLabel: string;
      date: string;
      reunion: number;
      comite: number;
      autres: number;
      total: number;
    }[];
    byStatus: { key: string; label: string; value: number }[];
    sparklines: {
      flow: number[];
      rooms: number[];
      pending: number[];
      approval: number[];
    };
  };
};

function CockpitSkeleton() {
  return (
    <section className="dg-assistant-cockpit" aria-busy="true" aria-label="Chargement du cockpit">
      <div className="dg-assistant-cockpit-main">
        <div className="dg-assistant-cockpit-left">
          <div className="dg-assistant-kpi-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dg-assistant-kpi dg-assistant-skeleton" />
            ))}
          </div>
          <div className="dg-assistant-charts-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dg-assistant-chart-card dg-assistant-skeleton dg-assistant-skeleton--chart" />
            ))}
          </div>
        </div>
        <div className="dg-assistant-side dg-assistant-skeleton dg-assistant-skeleton--side" />
      </div>
    </section>
  );
}

function KpiRing({ value, tone }: { value: number; tone: 'green' | 'blue' }) {
  return (
    <div
      className={cn('dg-assistant-kpi-ring', `dg-assistant-kpi-ring--${tone}`)}
      style={{ '--pct': value } as CSSProperties}
      aria-hidden
    >
      <span>{value}%</span>
    </div>
  );
}

export function AssistantCockpit() {
  const { year, isCurrentYear } = useTemporalNavigation();
  const [data, setData] = useState<AssistantDashboard | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ year: String(year) });
    const res = await fetch(`/api/dashboard/assistant?${params}`, {
      cache: 'no-store',
    });
    if (res.ok) setData((await res.json()) as AssistantDashboard);
  }, [year]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  useLiveRefresh(() => void load(), {
    topics: [LIVE_TOPICS.appointments, LIVE_TOPICS.rooms],
    intervalMs: 0,
  });

  if (!data) return <CockpitSkeleton />;

  return (
    <section className="dg-assistant-cockpit">
      <div className="dg-assistant-cockpit-main">
        <motion.div
          className="dg-assistant-cockpit-left"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="dg-assistant-kpi-grid">
            <div className="dg-assistant-kpi" data-tone="amber">
              <Clock className="dg-assistant-kpi-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="dg-assistant-kpi-label">En attente</p>
                <p className="dg-assistant-kpi-value">{data.stats.pending}</p>
                {data.stats.highPriority > 0 ? (
                  <p className="dg-assistant-kpi-hint">{data.stats.highPriority} urgente(s)</p>
                ) : null}
              </div>
              <AssistantSparkline values={data.charts.sparklines.pending} tone="amber" />
            </div>

            <div className="dg-assistant-kpi" data-tone="green">
              <CalendarCheck className="dg-assistant-kpi-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="dg-assistant-kpi-label">
                  {isCurrentYear ? "Aujourd'hui" : `RDV ${year}`}
                </p>
                <p className="dg-assistant-kpi-value">{data.stats.approvedToday}</p>
                {isCurrentYear && data.nextAppointment ? (
                  <p className="dg-assistant-kpi-hint">
                    Prochain {format(new Date(data.nextAppointment.startAt), 'HH:mm', { locale: fr })}
                  </p>
                ) : !isCurrentYear ? (
                  <p className="dg-assistant-kpi-hint">confirmés sur la période</p>
                ) : null}
              </div>
              <AssistantSparkline values={data.charts.sparklines.flow} tone="green" />
            </div>

            <div className="dg-assistant-kpi" data-tone="green">
              <CalendarRange className="dg-assistant-kpi-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="dg-assistant-kpi-label">
                  {isCurrentYear ? 'Cette semaine' : 'Activité'}
                </p>
                <p className="dg-assistant-kpi-value">{data.stats.approvedWeek}</p>
                {data.stats.peakDayLabel ? (
                  <p className="dg-assistant-kpi-hint">
                    Pic {data.stats.peakDayLabel} ({data.stats.peakDayCount})
                  </p>
                ) : null}
              </div>
              <AssistantSparkline values={data.charts.sparklines.rooms} tone="green" />
            </div>

            <div className="dg-assistant-kpi dg-assistant-kpi--rate" data-tone="blue">
              <div className="min-w-0 flex-1">
                <p className="dg-assistant-kpi-label">Taux validation</p>
                <div className="dg-assistant-kpi-rate-row">
                  <KpiRing value={data.stats.approvalRate} tone="blue" />
                  <div>
                    <p className="dg-assistant-kpi-value dg-assistant-kpi-value--sm">
                      {data.stats.avgDecisionHours > 0
                        ? `${data.stats.avgDecisionHours} h`
                        : '—'}
                    </p>
                    <p className="dg-assistant-kpi-hint">délai moyen</p>
                  </div>
                </div>
              </div>
              <div className="dg-assistant-kpi-mini-stat">
                <XCircle className="h-3 w-3" aria-hidden />
                <span>{data.stats.rejectedTotal} refus</span>
              </div>
            </div>
          </div>

          <AssistantCharts charts={data.charts} />
        </motion.div>

        <motion.aside
          className="dg-assistant-cockpit-right"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <AssistantSidePanel pending={data.pending} />
          <div className="dg-assistant-next-rdv">
            <p className="dg-assistant-next-rdv-label">
              {isCurrentYear
                ? 'Prochain RDV ultra urgent — demain'
                : `RDV ultra urgents — ${year}`}
            </p>
            {data.tomorrowUrgentAppointments.length > 0 ? (
              <ul className="dg-assistant-next-rdv-list">
                {data.tomorrowUrgentAppointments.map((item) => (
                  <li key={item.id}>
                    <Link href="/dg/appointments" className="dg-assistant-next-rdv-card">
                      <Zap className="dg-assistant-next-rdv-icon dg-assistant-next-rdv-icon--urgent" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="truncate text-muted-foreground">
                          {format(new Date(item.startAt), 'EEEE d MMM · HH:mm', { locale: fr })}
                          {' · '}
                          {item.requestedBy.firstName} {item.requestedBy.lastName}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dg-assistant-next-rdv-empty">Aucun RDV ultra urgent prévu demain.</p>
            )}
          </div>
        </motion.aside>
      </div>
    </section>
  );
}
