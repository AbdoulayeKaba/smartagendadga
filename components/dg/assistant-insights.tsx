'use client';

import { AlertTriangle, CalendarClock, Lightbulb, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssistantInsight = {
  id: string;
  tone: 'info' | 'warning' | 'success' | 'neutral';
  message: string;
};

const TONE_ICON = {
  info: Lightbulb,
  warning: AlertTriangle,
  success: TrendingUp,
  neutral: CalendarClock,
} as const;

export function AssistantInsights({ items }: { items: AssistantInsight[] }) {
  if (!items.length) return null;

  return (
    <div className="dg-assistant-insights" role="list" aria-label="Alertes et recommandations">
      {items.map((item) => {
        const Icon = TONE_ICON[item.tone];
        return (
          <div
            key={item.id}
            role="listitem"
            className={cn('dg-assistant-insight', `dg-assistant-insight--${item.tone}`)}
          >
            <Icon className="dg-assistant-insight-icon" aria-hidden />
            <span>{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}
