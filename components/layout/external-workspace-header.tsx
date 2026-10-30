'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, UserCog } from 'lucide-react';
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
import { DgHeaderClock } from '@/components/layout/dg-header-clock';
import { ClientMount } from '@/components/ui/client-mount';
import { InstitutionBrandMark } from '@/components/layout/institution-brand-mark';
import { ExternalMobileNav } from '@/components/layout/external-mobile-nav';
import { useDgShell } from '@/components/layout/dg-shell-context';
import { Moon, Sun } from 'lucide-react';

export function ExternalWorkspaceHeader() {
  const router = useRouter();
  const { currentUser, isDarkMode, toggleDarkMode, branding, roleLabel, permissions } = useApp();
  const { toggleDesktopSidebar, openNavigation } = useDgShell();
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = userInitials(currentUser.firstName, currentUser.lastName);
  const homeHref = permissions['menu.plan'] ? '/appointments/board' : homePathForPermissions(permissions);

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

  const handleMenuClick = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      toggleDesktopSidebar();
      return;
    }
    openNavigation();
  };

  return (
    <header className="dg-header ext-header">
    <div className="esmt-header-stripe" />
    <div className="ext-header-top dg-header-bar flex h-[2.75rem] items-center px-3 lg:px-5">
      <ClientMount fallback={null}>
        <ExternalMobileNav />
      </ClientMount>
      <div className="dg-header-brand flex min-w-0 shrink-0 items-center gap-1">
        <Link href={homeHref} className="dg-header-brand-link shrink-0" aria-label={branding.organizationName}>
          <InstitutionBrandMark compact showText={false} logoClassName="dg-header-brand-logo" />
        </Link>
        <div className="hidden min-w-0 sm:block">
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
        <button
          type="button"
          className="dg-header-menu-btn dg-header-menu-btn--offset"
          onClick={handleMenuClick}
          aria-label="Afficher le menu"
        >
          <Menu className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="dg-header-actions ml-auto flex shrink-0 items-center gap-1">
        <DgHeaderClock variant="date-first" />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="dg-header-icon-btn rounded-full"
          aria-label={isDarkMode ? 'Mode clair' : 'Mode sombre'}
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
              <button type="button" className="dg-header-user-btn ext-user-btn">
                <span className="dg-header-user-avatar">
                  {currentUser.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar} alt="" className="dg-header-user-avatar-img" />
                  ) : (
                    initials
                  )}
                </span>
                <span className="ext-user-copy hidden sm:flex">
                  <span className="dg-header-user-name">{currentUser.firstName}</span>
                  <span className="ext-user-role">{roleLabel}</span>
                </span>
                <ChevronDown className="dg-header-user-chevron hidden sm:block" aria-hidden />
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
