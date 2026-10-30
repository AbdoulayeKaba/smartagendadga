'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useApp } from '@/lib/app-context';
import { DgSidebarBrand } from '@/components/layout/dg-sidebar-brand';
import { DgSidebarRoleCard } from '@/components/layout/dg-sidebar-role-card';
import { ExternalSidebarNav } from '@/components/layout/external-sidebar-nav';
import { useDgShell } from '@/components/layout/dg-shell-context';

export function ExternalMobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useDgShell();
  const { branding } = useApp();

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="dg-mobile-nav-sheet w-[min(18rem,88vw)] border-0 p-0">
        <div className="dg-sidebar admin-theme flex h-full flex-col">
          <SheetHeader className="shrink-0 border-b p-0 text-left">
            <SheetTitle className="sr-only">{branding.organizationName}</SheetTitle>
            <DgSidebarBrand />
          </SheetHeader>
          <ExternalSidebarNav onNavigate={() => setMobileNavOpen(false)} />
          <DgSidebarRoleCard onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
