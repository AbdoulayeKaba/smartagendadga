'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, Moon, Sun, UserCog } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { homePathForPermissions } from '@/lib/dg/role-access';
import { userInitials } from '@/lib/dg/role-labels';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DgNotificationsBell } from '@/components/layout/dg-notifications-bell';
import { DgGlobalSearch } from '@/components/layout/dg-global-search';
import { DgHeaderClock } from '@/components/layout/dg-header-clock';
import { ClientMount } from '@/components/ui/client-mount';
import { InstitutionBrandMark } from '@/components/layout/institution-brand-mark';
import { DgMobileNav } from '@/components/layout/dg-mobile-nav';
import { useDgShell } from '@/components/layout/dg-shell-context';
import { TemporalNavigationCenter } from '@/components/temporal/temporal-navigation-center';
import { shouldShowGlobalTemporalNav } from '@/components/temporal/temporal-nav-visibility';

function DgMenuButton({ className, onClick }: { className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn('dg-header-menu-btn', className)}
      onClick={onClick}
      aria-label="Afficher le menu"
    >
      <Menu className="h-3 w-3" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

export function DgHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, isDarkMode, toggleDarkMode, branding, roleLabel, permissions } = useApp();
  const { toggleDesktopSidebar, openNavigation } = useDgShell();
  const showTemporalNav = shouldShowGlobalTemporalNav(pathname);

  const handleMenuClick = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      toggleDesktopSidebar();
      return;
    }
    openNavigation();
  };
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = userInitials(currentUser.firstName, currentUser.lastName);

  const homeHref = homePathForPermissions(permissions);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="dg-header">
      <div className="esmt-header-stripe" />
      <div className="dg-header-bar flex h-[2.75rem] items-center gap-2 px-3 lg:px-5">
        <ClientMount fallback={null}>
          <DgMobileNav />
        </ClientMount>

        <div className="dg-header-brand flex min-w-0 max-w-[min(52vw,11rem)] items-center gap-1 sm:max-w-none">
          <Link href={homeHref} className="dg-header-brand-link shrink-0" aria-label={branding.organizationName}>
            <InstitutionBrandMark compact showText={false} logoClassName="dg-header-brand-logo" />
          </Link>
          <div className="hidden min-w-0 flex-1 sm:flex sm:items-end sm:gap-1">
            <div className="min-w-0">
              <Link
                href={homeHref}
                className="block truncate text-[11px] font-bold leading-tight text-emerald-700 hover:opacity-90"
              >
                {branding.organizationName}
              </Link>
              <p className="mt-0 truncate text-[8px] leading-tight text-muted-foreground">
                {branding.institutionAcronym || 'Plateforme de réservation'}
              </p>
            </div>
            <ClientMount fallback={<DgMenuButton onClick={() => undefined} />}>
              <DgMenuButton onClick={handleMenuClick} className="dg-header-menu-btn--offset" />
            </ClientMount>
          </div>
          <ClientMount fallback={null}>
            <div className="sm:hidden">
              <DgMenuButton onClick={handleMenuClick} />
            </div>
          </ClientMount>
        </div>

        <div
          className={cn(
            'dg-header-search-slot',
            showTemporalNav && 'dg-header-search-slot--temporal'
          )}
        >
          {showTemporalNav ? (
            <TemporalNavigationCenter variant="header" />
          ) : (
            <DgGlobalSearch />
          )}
        </div>

        <div className="dg-header-actions ml-auto flex shrink-0 items-center gap-1">
          <DgHeaderClock />
          <ClientMount fallback={null}>
            <DgNotificationsBell />
          </ClientMount>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="dg-header-icon-btn rounded-full"
          >
            {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>

          <ClientMount
            fallback={
              <span className="dg-header-user-btn">
                <span className="dg-header-user-avatar">{initials}</span>
              </span>
            }
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="dg-header-user-btn">
                  <span className="dg-header-user-avatar">
                    {currentUser.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={currentUser.avatar} alt="" className="dg-header-user-avatar-img" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="dg-header-user-name hidden max-w-[5.5rem] truncate md:inline">
                    {currentUser.firstName}
                  </span>
                  <ChevronDown className="dg-header-user-chevron hidden md:block" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {currentUser.firstName} {currentUser.lastName}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
                    <span className="text-xs font-normal text-primary">{roleLabel}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserCog className="mr-2 h-4 w-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ClientMount>
        </div>
      </div>
    </header>
  );
}
