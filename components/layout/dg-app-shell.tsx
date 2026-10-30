'use client';

import { DgHeader } from '@/components/layout/dg-header';
import { DgSidebar } from '@/components/layout/dg-sidebar';
import { ExternalWorkspaceHeader } from '@/components/layout/external-workspace-header';
import { ExternalSidebar } from '@/components/layout/external-sidebar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DgShellProvider, useDgShell } from '@/components/layout/dg-shell-context';
import { TemporalNavigationProvider } from '@/components/temporal/temporal-navigation-context';
import { DgNavigationProvider } from '@/components/layout/dg-navigation-context';
import { useApp } from '@/lib/app-context';
import { isExternalWorkspace } from '@/lib/layout/external-space';
import { cn } from '@/lib/utils';
import { AppSecurityFooter } from '@/components/layout/app-security-footer';

function DgAppShellBody({ children }: { children: React.ReactNode }) {
  const { desktopSidebarOpen } = useDgShell();
  const { roleId, dgRole } = useApp();
  const external = isExternalWorkspace(roleId, dgRole);

  if (external) {
    return (
      <div
        className={cn(
          'ext-shell flex min-h-screen flex-col app-pro-shell',
          !desktopSidebarOpen && 'dg-shell-sidebar-closed'
        )}
      >
        <ExternalWorkspaceHeader />
        <ExternalSidebar />
        <main
          className={cn(
            'ext-shell-main flex-1 transition-[padding-left] duration-200 ease-out',
            desktopSidebarOpen ? 'lg:pl-[var(--dg-sidebar-width)]' : 'lg:pl-0'
          )}
        >
          <div className="admin-theme mx-auto max-w-[1280px] px-3 py-3 lg:px-6 lg:py-4">
            <Breadcrumbs variant="pro" />
            {children}
          </div>
        </main>
        <div
          className={cn(
            'transition-[padding-left] duration-200 ease-out',
            desktopSidebarOpen ? 'lg:pl-[var(--dg-sidebar-width)]' : 'lg:pl-0'
          )}
        >
          <AppSecurityFooter />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col app-pro-shell',
        !desktopSidebarOpen && 'dg-shell-sidebar-closed'
      )}
    >
      <DgHeader />
      <DgSidebar />
      <main
        className={cn(
          'flex-1 pt-[calc(2.75rem+4px)] transition-[padding-left] duration-200 ease-out',
          desktopSidebarOpen ? 'lg:pl-[var(--dg-sidebar-width)]' : 'lg:pl-0'
        )}
      >
        <div className="admin-theme mx-auto max-w-[1600px] px-3 py-3 lg:px-5 lg:py-4">
          <Breadcrumbs variant="pro" />
          {children}
        </div>
      </main>
      <div
        className={cn(
          'transition-[padding-left] duration-200 ease-out',
          desktopSidebarOpen ? 'lg:pl-[var(--dg-sidebar-width)]' : 'lg:pl-0'
        )}
      >
        <AppSecurityFooter />
      </div>
    </div>
  );
}

export function DgAppShell({ children }: { children: React.ReactNode }) {
  return (
    <DgShellProvider>
      <DgNavigationProvider>
        <TemporalNavigationProvider>
          <DgAppShellBody>{children}</DgAppShellBody>
        </TemporalNavigationProvider>
      </DgNavigationProvider>
    </DgShellProvider>
  );
}
