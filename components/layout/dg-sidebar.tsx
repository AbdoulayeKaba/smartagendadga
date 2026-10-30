'use client';

import { cn } from '@/lib/utils';
import { DgNavMenu } from '@/components/layout/dg-nav-menu';
import { DgSidebarBrand } from '@/components/layout/dg-sidebar-brand';
import { DgSidebarRoleCard } from '@/components/layout/dg-sidebar-role-card';
import { useDgShell } from '@/components/layout/dg-shell-context';

export function DgSidebar() {
  const { desktopSidebarOpen } = useDgShell();

  return (
    <aside
      className={cn(
        'dg-sidebar admin-theme hidden lg:flex',
        !desktopSidebarOpen && 'dg-sidebar--collapsed'
      )}
      aria-hidden={!desktopSidebarOpen}
    >
      <div className="dg-sidebar-inner">
        <DgSidebarBrand />

        <DgNavMenu />

        <DgSidebarRoleCard />
      </div>
    </aside>
  );
}
