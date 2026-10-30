'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CalendarRange, CheckCircle2, Clock3, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LeaveItem = { status: string; workingDays: number };
type NotificationItem = { id: string; title: string; message: string; createdAt: string };

export default function ArptDashboardPage() {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch('/api/arpt/leave-requests').then((r) => (r.ok ? r.json() : { items: [] })),
      fetch('/api/arpt/notifications').then((r) => (r.ok ? r.json() : { items: [] })),
    ]).then(([l, n]) => {
      setLeaves((l.items ?? []) as LeaveItem[]);
      setNotifications((n.items ?? []) as NotificationItem[]);
    });
  }, []);

  const kpis = useMemo(() => {
    const submitted = leaves.filter((x) => x.status === 'submitted').length;
    const approved = leaves.filter((x) => x.status === 'approved').length;
    const rejected = leaves.filter((x) => x.status === 'rejected').length;
    const totalDays = leaves.reduce((acc, x) => acc + (x.workingDays ?? 0), 0);
    return { submitted, approved, rejected, totalDays };
  }, [leaves]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ARPT Leave Management</h1>
        <p className="text-sm text-muted-foreground">Tableau de bord professionnel des conges avec suivi en temps reel.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="En attente" value={kpis.submitted} icon={<Clock3 className="h-4 w-4" />} />
        <Metric title="Approuvees" value={kpis.approved} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric title="Jours demandes" value={kpis.totalDays} icon={<CalendarRange className="h-4 w-4" />} />
        <Metric title="Rejetees" value={kpis.rejected} icon={<Users className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.slice(0, 8).map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="rounded-lg border p-3"
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </motion.div>
          ))}
          {notifications.length === 0 ? <p className="text-sm text-muted-foreground">Aucune notification.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
