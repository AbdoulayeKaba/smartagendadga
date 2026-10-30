'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, UserCheck, Clock4, UserX, Timer } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Stats = {
  date: string;
  timezone: string;
  expectedToday: number;
  checkedIn: number;
  late: number;
  onTime: number;
  absent: number;
  workedMinutesTotal: number;
};

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

export function AttendanceRhDashboard() {
  const { t, language } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/dashboard/attendance', { credentials: 'include' });
        if (!res.ok) {
          setError('FORBIDDEN');
          return;
        }
        const json = (await res.json()) as Stats;
        if (!cancelled) setStats(json);
      } catch {
        if (!cancelled) setError('LOAD');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <p className="text-destructive">
        {error === 'FORBIDDEN' ? t('attendance.forbiddenDashboard') : t('common.loading')}
      </p>
    );
  }

  const cards = [
    {
      title: t('attendance.expected'),
      value: stats.expectedToday,
      icon: Users,
      desc: stats.date,
    },
    {
      title: t('attendance.checkedIn'),
      value: stats.checkedIn,
      icon: UserCheck,
      desc: stats.timezone,
    },
    {
      title: t('attendance.onTime'),
      value: stats.onTime,
      icon: Clock4,
      desc: language === 'fr' ? 'À l’arrivée' : 'At arrival',
    },
    {
      title: t('attendance.lateCount'),
      value: stats.late,
      icon: Clock4,
      desc: language === 'fr' ? 'Entrées tardives' : 'Late arrivals',
    },
    {
      title: t('attendance.absentCount'),
      value: stats.absent,
      icon: UserX,
      desc: language === 'fr' ? 'Sans pointage (après délai)' : 'No punch (after grace)',
    },
    {
      title: t('attendance.workedTotal'),
      value: formatHoursMinutes(stats.workedMinutesTotal),
      icon: Timer,
      desc: language === 'fr' ? 'Journées clôturées' : 'Closed days only',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('attendance.dashboardTitle')}</h1>
        <p className="text-muted-foreground">{t('attendance.dashboardSubtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title} className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{c.value}</div>
              <CardDescription className="mt-1">{c.desc}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
