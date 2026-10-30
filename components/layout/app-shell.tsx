'use client';

import { usePathname } from 'next/navigation';
import { Header } from './header';
import { DgAppShell } from './dg-app-shell';
import { Sidebar } from './sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { AppSecurityFooter } from '@/components/layout/app-security-footer';
import { isDgAppPath } from '@/lib/layout/dg-nav';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const dgApp = isDgAppPath(pathname);

  if (dgApp) {
    return <DgAppShell>{children}</DgAppShell>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Sidebar />
      <main className="flex-1 pt-[calc(2.75rem+4px)] transition-[padding] lg:pl-64">
        <div className="container mx-auto p-5 lg:p-8">
          <Breadcrumbs variant="default" />
          {children}
        </div>
      </main>
      <AppSecurityFooter />
    </div>
  );
}
