'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, History, LayoutDashboard } from 'lucide-react';
import { fetchJson } from '@/lib/fetch-with-timeout';
import {
  EXTERNAL_NAV_ITEMS,
  externalNavActiveId,
  type ExternalNavId,
} from '@/lib/layout/external-space';
import { cn } from '@/lib/utils';

const ICONS: Record<ExternalNavId, typeof LayoutDashboard> = {
  board: LayoutDashboard,
  history: History,
  notifications: Bell,
};

const SECTIONS: { title: string; ids: ExternalNavId[] }[] = [
  { title: 'Pilotage', ids: ['board'] },
  { title: 'Suivi', ids: ['history', 'notifications'] },
];

export function ExternalSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeId = externalNavActiveId(pathname);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchJson<{ unread?: number }>('/api/dg/notifications', {
        timeoutMs: 15_000,
      });
      if (!cancelled && result.ok) setUnread(result.data.unread ?? 0);
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <nav className="dg-sidebar-nav" aria-label="Espace utilisateur externe">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="dg-nav-section-label">{section.title}</p>
          <ul className="dg-nav-section-items">
            {section.ids.map((id) => {
              const item = EXTERNAL_NAV_ITEMS.find((entry) => entry.id === id);
              if (!item) return null;
              const Icon = ICONS[id];
              const active = id === activeId;
              return (
                <li key={id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn('dg-nav-link', active && 'dg-nav-link-active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="dg-nav-icon shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {id === 'notifications' && unread > 0 ? (
                      <span className="ext-nav-badge">{unread > 9 ? '9+' : unread}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
