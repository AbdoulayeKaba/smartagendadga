'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatNotificationWhen, notificationInstant } from '@/lib/datetime';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/lib/app-context';
import { fetchJson } from '@/lib/fetch-with-timeout';
import { cn } from '@/lib/utils';

type InboxItem = {
  id: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
  scheduledFor?: string | null;
};

export function DgNotificationsBell() {
  const router = useRouter();
  const { permissions } = useApp();
  const notificationsHref = '/dg/notifications';
  const appointmentsHref = permissions['appointments.review']
    ? '/dg/appointments'
    : '/appointments/mine';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchJson<{ items: InboxItem[]; unread: number }>(
        '/api/dg/notifications',
        { timeoutMs: 15_000 }
      );
      if (!result.ok) return;
      setItems(result.data.items ?? []);
      setUnread(result.data.unread ?? 0);
    } catch {
      /* réseau / serveur indisponible : ne pas bloquer l'interface */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const markRead = async (id: string, href: string | null) => {
    try {
      await fetchJson('/api/dg/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* ignore */
    }
    void load();
    setOpen(false);
    if (href) router.push(href);
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetchJson('/api/dg/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="dg-notif-bell-btn relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 ? (
            <span className="dg-notif-bell-badge">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dg-notif-dropdown w-[min(100vw-1.5rem,14rem)] p-0">
        <div className="dg-notif-dropdown-head">
          <DropdownMenuLabel className="dg-notif-dropdown-title">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="dg-notif-mark-all"
              disabled={loading}
              onClick={() => void markAllRead()}
            >
              {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CheckCheck className="h-2.5 w-2.5" />}
              Tout lire
            </Button>
          ) : null}
        </div>
        <div className="dg-notif-dropdown-list">
          {items.length === 0 ? (
            <p className="dg-notif-empty">Aucune notification</p>
          ) : (
            items.map((n) => {
              const when = formatNotificationWhen(
                notificationInstant({
                  createdAt: n.createdAt,
                  scheduledFor: n.scheduledFor,
                })
              );
              return (
              <DropdownMenuItem
                key={n.id}
                className={cn('dg-notif-item', !n.read && 'dg-notif-item--unread')}
                onClick={() => void markRead(n.id, n.href)}
              >
                <span className="dg-notif-item-title">{n.title}</span>
                <span className="dg-notif-item-msg">{n.message}</span>
                <span className="dg-notif-item-time">
                  {when.clock} · {when.relative}
                </span>
              </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="dg-notif-dropdown-foot">
          <DropdownMenuItem asChild className="dg-notif-foot-link dg-notif-foot-link--primary">
            <Link href={notificationsHref} onClick={() => setOpen(false)}>
              Centre de notifications
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="dg-notif-foot-link">
            <Link href={appointmentsHref} onClick={() => setOpen(false)}>
              Voir les rendez-vous
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
