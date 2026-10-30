'use client';

import Link from 'next/link';
import {
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  Activity,
  LayoutDashboard,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';

const ACTIONS = [
  {
    label: 'Agenda',
    href: '/appointments/calendar',
    icon: CalendarDays,
    tone: 'default' as const,
  },
  {
    label: 'Liste des RDV',
    href: '/dg/appointments',
    icon: ListChecks,
    tone: 'default' as const,
  },
  {
    label: DG_ROOM_SLOTS_LABEL,
    href: DG_ROOM_AVAILABILITY_HREF,
    icon: Building2,
    tone: 'default' as const,
  },
  {
    label: 'Planifier',
    href: '/dg/plan',
    icon: CalendarPlus,
    tone: 'default' as const,
  },
  {
    label: 'Historique',
    href: '/dg/activity',
    icon: Activity,
    tone: 'default' as const,
  },
  {
    label: 'Notifications',
    href: '/dg/notifications',
    icon: Bell,
    tone: 'default' as const,
  },
  {
    label: 'Lecture de la semaine',
    href: '/dg/assistant/ia',
    icon: Sparkles,
    tone: 'default' as const,
  },
  {
    label: 'Tableau de bord',
    href: '/dg/dashboard',
    icon: LayoutDashboard,
    tone: 'default' as const,
  },
];

export function DgQuickActions({
  className,
  compact = false,
  excludeHrefs = [],
}: {
  className?: string;
  compact?: boolean;
  /** Masque des liens déjà présents ailleurs sur la page (évite les doublons). */
  excludeHrefs?: string[];
}) {
  const exclude = new Set(excludeHrefs);
  const items = ACTIONS.filter((action) => !exclude.has(action.href));

  if (items.length === 0) return null;

  return (
    <section
      className={cn('dg-quick-actions', compact && 'dg-quick-actions--compact', className)}
      aria-label="Raccourcis"
    >
      {items.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn('dg-quick-action', action.tone === 'primary' && 'dg-quick-action--primary')}
          >
            <Icon className="dg-quick-action-icon shrink-0" aria-hidden />
            <span>{action.label}</span>
          </Link>
        );
      })}
    </section>
  );
}
