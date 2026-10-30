'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  WORKSPACE_DEFAULT_TAB,
  WORKSPACE_MENU,
  type WorkspaceMenuItem,
} from '@/components/workspace/workspace-menu';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'dg-workspace-tabs-v1';

function getMenuItem(pathname: string): WorkspaceMenuItem | undefined {
  return WORKSPACE_MENU.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<string[]>([WORKSPACE_DEFAULT_TAB]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as string[];
      const filtered = parsed
        .filter((href) => href !== '/dg/workspace')
        .filter((href) => WORKSPACE_MENU.some((item) => item.href === href));
      setTabs(filtered.length ? filtered : [WORKSPACE_DEFAULT_TAB]);
    } catch {
      setTabs([WORKSPACE_DEFAULT_TAB]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const current = getMenuItem(pathname);
    if (!current) return;
    setTabs((prev) => {
      if (prev.includes(current.href)) return prev;
      return [...prev, current.href];
    });
  }, [pathname, ready]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs, ready]);

  const tabItems = useMemo(
    () => tabs.map((href) => WORKSPACE_MENU.find((item) => item.href === href)).filter(Boolean) as WorkspaceMenuItem[],
    [tabs]
  );

  const closeTab = (href: string) => {
    let navigateTo: string | null = null;

    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.indexOf(href);
      if (idx < 0) return prev;
      const next = prev.filter((item) => item !== href);
      if (pathname === href) {
        navigateTo = next[Math.max(0, idx - 1)] ?? WORKSPACE_DEFAULT_TAB;
      }
      return next.length ? next : [WORKSPACE_DEFAULT_TAB];
    });

    if (navigateTo) {
      router.push(navigateTo);
    }
  };

  return (
    <div className="admin-theme workspace-main workspace-main--compact min-w-0">
      <div className="workspace-tabs">
        {tabItems.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const canClose = tabItems.length > 1;
          return (
            <div key={tab.href} className={cn('workspace-tab', active && 'workspace-tab--active')}>
              <button type="button" className="workspace-tab-link" onClick={() => router.push(tab.href)}>
                <span className="truncate">{tab.label}</span>
              </button>
              {canClose ? (
                <button
                  type="button"
                  className="workspace-tab-close"
                  aria-label={`Fermer l'onglet ${tab.label}`}
                  onClick={() => {
                    closeTab(tab.href);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
