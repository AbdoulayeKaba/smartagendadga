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

export function ExternalTopNav() {
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
    <nav className="ext-nav" aria-label="Espace utilisateur externe">
      {EXTERNAL_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.id];
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn('ext-nav-link', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="ext-nav-icon" aria-hidden />
            <span>{item.label}</span>
            {item.id === 'notifications' && unread > 0 ? (
              <span className="ext-nav-badge">{unread > 9 ? '9+' : unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
