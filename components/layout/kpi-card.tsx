import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
  className?: string;
};

export function KpiCard({ title, value, icon, hint, className }: Props) {
  return (
    <div className={cn('premium-kpi group', className)}>
      <div className="premium-kpi-head">
        <p className="premium-kpi-label">{title}</p>
        <div className="premium-kpi-icon">{icon}</div>
      </div>
      <p className="premium-kpi-value">{value}</p>
      {hint ? <p className="premium-kpi-hint">{hint}</p> : null}
    </div>
  );
}
