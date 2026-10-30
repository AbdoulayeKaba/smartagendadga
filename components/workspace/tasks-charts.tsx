'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { countTasksByStatus, workloadByAssignee } from '@/lib/workspace/task-utils';
import type { DgTask } from '@/lib/workspace/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'oklch(0.75 0.04 155)',
  IN_PROGRESS: 'oklch(0.52 0.12 155)',
  SUSPENDED: 'oklch(0.72 0.12 85)',
  COMPLETED: 'oklch(0.42 0.11 155)',
  CANCELLED: 'oklch(0.65 0.05 155)',
};

type Props = {
  tasks: DgTask[];
};

export function TasksCharts({ tasks }: Props) {
  const statusData = useMemo(
    () => countTasksByStatus(tasks).filter((d) => d.count > 0),
    [tasks]
  );
  const workloadData = useMemo(() => workloadByAssignee(tasks).slice(0, 6), [tasks]);

  if (statusData.length === 0 && workloadData.length === 0) return null;

  return (
    <div className="tasks-charts">
      {statusData.length > 0 ? (
        <article className="tasks-chart-card">
          <h4>Répartition par statut</h4>
          <div className="tasks-chart-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statusData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.88 0.04 155)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(value) => [`${value} tâche(s)`, 'Nombre']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? 'oklch(0.5 0.1 155)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      {workloadData.length > 0 ? (
        <article className="tasks-chart-card">
          <h4>Charge par responsable (h)</h4>
          <div className="tasks-chart-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={workloadData}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.88 0.04 155)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as { count?: number } | undefined;
                    return [`${value} h (${payload?.count ?? 0} tâche(s))`, 'Charge'];
                  }}
                />
                <Bar dataKey="hours" fill="oklch(0.42 0.11 155)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}
    </div>
  );
}
