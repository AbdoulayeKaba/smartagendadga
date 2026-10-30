'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type KPI = {
  studentsTotal: number;
  teachersTotal: number;
  parentsTotal: number;
  classroomsTotal: number;
  activeEnrollments: number;
  gradesCount: number;
  absencesCount: number;
  justifiedAbsences: number;
  absenceJustificationRate: number;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  recipientEmail: string | null;
  status: string;
  createdAt: string;
};

export default function SchoolAnalyticsPage() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchInfo, setDispatchInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [kpiRes, notifRes] = await Promise.all([
        fetch('/api/school/kpis', { cache: 'no-store' }),
        fetch('/api/school/notifications?limit=50', { cache: 'no-store' }),
      ]);
      if (!kpiRes.ok || !notifRes.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [kpiJson, notifJson] = await Promise.all([kpiRes.json(), notifRes.json()]);
      if (!cancelled) {
        setKpi(kpiJson);
        setNotifications(notifJson.items ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics scolaire</h1>
        <p className="text-muted-foreground">KPI globaux et journal des notifications automatiques.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Eleves" value={kpi?.studentsTotal} loading={loading} />
        <MetricCard title="Professeurs" value={kpi?.teachersTotal} loading={loading} />
        <MetricCard title="Parents" value={kpi?.parentsTotal} loading={loading} />
        <MetricCard title="Classes" value={kpi?.classroomsTotal} loading={loading} />
        <MetricCard title="Inscriptions actives" value={kpi?.activeEnrollments} loading={loading} />
        <MetricCard title="Notes publiees" value={kpi?.gradesCount} loading={loading} />
        <MetricCard title="Absences" value={kpi?.absencesCount} loading={loading} />
        <MetricCard
          title="Taux justification absences"
          value={kpi ? `${kpi.absenceJustificationRate}%` : undefined}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const res = await fetch('/api/school/notifications/dispatch', { method: 'POST' });
              if (!res.ok) {
                setDispatchInfo('Echec du dispatch.');
                return;
              }
              const json = await res.json();
              setDispatchInfo(`Dispatch: ${json.processed} traitees, ${json.sent} envoyees, ${json.failed} en echec.`);
            }}
          >
            Lancer dispatch notifications
          </Button>
          {dispatchInfo ? <p className="text-xs text-muted-foreground">{dispatchInfo}</p> : null}
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification disponible.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <span className="text-xs uppercase text-muted-foreground">{n.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.recipientEmail ?? 'Destinataire in-app'} - {new Date(n.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, loading }: { title: string; value: number | string | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{loading ? '...' : (value ?? 0)}</p>
      </CardContent>
    </Card>
  );
}

