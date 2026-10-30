'use client';

import { cn } from '@/lib/utils';
import { DgSidebarBrand } from '@/components/layout/dg-sidebar-brand';
import { DgSidebarRoleCard } from '@/components/layout/dg-sidebar-role-card';
import { ExternalSidebarNav } from '@/components/layout/external-sidebar-nav';
import { useDgShell } from '@/components/layout/dg-shell-context';

export function ExternalSidebar() {
  const { desktopSidebarOpen } = useDgShell();

  return (
    <aside
      className={cn('dg-sidebar admin-theme hidden lg:flex', !desktopSidebarOpen && 'dg-sidebar--collapsed')}
      aria-hidden={!desktopSidebarOpen}
    >
      <div className="dg-sidebar-inner">
        <DgSidebarBrand />
        <ExternalSidebarNav />
        <DgSidebarRoleCard />
      </div>
    </aside>
  );
}
