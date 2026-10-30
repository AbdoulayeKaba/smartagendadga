'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { useApp } from '@/lib/app-context';
import { filterDgNav, DG_NAV_SECTIONS, type DgNavSection } from '@/lib/layout/dg-nav';
import { useDgNavigation } from '@/components/layout/dg-navigation-context';

function normalizePathname(pathname: string | null): string {
  if (!pathname) return '';
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function pathMatches(pathname: string, href: string) {
  if (pathname === href) return true;
  // Créneaux salles ≠ listes / mes réservations (sous-chemins)
  if (
    href === '/dg/assistant' &&
    (pathname === '/dg/assistant/ia' || pathname.startsWith('/dg/assistant/ia/'))
  ) {
    return false;
  }
  if (
    href === '/dg/availability' &&
    (pathname === '/dg/availability/reservations' ||
      pathname.startsWith('/dg/availability/reservations/'))
  ) {
    return false;
  }
  // Liste globale ≠ vue personnelle sous …/reservations/mine
  if (
    href === '/dg/availability/reservations' &&
    (pathname === '/dg/availability/reservations/mine' ||
      pathname.startsWith('/dg/availability/reservations/mine/'))
  ) {
    return false;
  }
  if (href !== '/dg/admin' && pathname.startsWith(`${href}/`)) return true;
  return false;
}

/** Active uniquement l'entrée la plus spécifique (évite Liste RDV + Analyse comparative). */
function isItemActive(pathname: string, href: string, siblingHrefs: string[]) {
  if (!pathname || !pathMatches(pathname, href)) return false;

  const candidates = siblingHrefs.filter((other) => pathMatches(pathname, other));
  if (candidates.length <= 1) return true;

  const best = candidates.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

/**
 * Active nav après hydratation uniquement — évite mismatch SSR/client
 * (pathname / permissions parfois divergents au premier paint).
 */
function useNavHighlightReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}

function NavLink({
  href,
  className,
  onNavigate,
  children,
}: {
  href: string;
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const { startNavigation } = useDgNavigation();

  return (
    <Link
      href={href}
      prefetch
      className={className}
      onClick={() => {
        startNavigation();
        onNavigate?.();
      }}
    >
      {children}
    </Link>
  );
}

function NavSection({
  section,
  pathname,
  highlightReady,
  onNavigate,
}: {
  section: DgNavSection;
  pathname: string;
  highlightReady: boolean;
  onNavigate?: () => void;
}) {
  const sectionHrefs = section.items.map((item) => item.href);
  const hasActiveItem =
    highlightReady &&
    section.items.some((item) => isItemActive(pathname, item.href, sectionHrefs));
  const pinnedOpen = section.defaultOpen === true;
  // Ne pas dépendre de hasActiveItem au 1er paint (hydratation).
  const [open, setOpen] = useState(pinnedOpen);

  useEffect(() => {
    if (pinnedOpen || (section.collapsible && hasActiveItem)) {
      setOpen(true);
    }
  }, [hasActiveItem, section.collapsible, pinnedOpen]);

  if (section.collapsible && section.sectionIcon) {
    const SectionIcon = section.sectionIcon;
    const sectionActive = hasActiveItem;

    return (
      <div className="dg-nav-group">
        <button
          type="button"
          onClick={() => {
            if (!pinnedOpen) setOpen((v) => !v);
          }}
          className={cn(
            'dg-nav-group-trigger',
            sectionActive && 'dg-nav-group-trigger-active',
            pinnedOpen && 'dg-nav-group-trigger--pinned'
          )}
          aria-expanded={open}
          aria-disabled={pinnedOpen || undefined}
        >
          <SectionIcon className="dg-nav-icon shrink-0" aria-hidden />
          <span className="flex-1 text-left">{section.title}</span>
          {!pinnedOpen ? (
            <ChevronDown
              className={cn(
                'dg-nav-chevron shrink-0 opacity-60 transition-transform duration-200',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          ) : null}
        </button>
        {open ? (
          <ul className="dg-nav-group-items">
            {section.items.map((item) => {
              const active =
                highlightReady && isItemActive(pathname, item.href, sectionHrefs);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    onNavigate={onNavigate}
                    className={cn('dg-nav-sublink', active && 'dg-nav-sublink-active')}
                  >
                    <Icon className="dg-nav-icon shrink-0 opacity-80" aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="dg-nav-section-label">{section.title}</p>
      <ul className="dg-nav-section-items">
        {section.items.map((item) => {
          const active =
            highlightReady && isItemActive(pathname, item.href, sectionHrefs);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <NavLink
                href={item.href}
                onNavigate={onNavigate}
                className={cn('dg-nav-link', active && 'dg-nav-link-active')}
              >
                <Icon className="dg-nav-icon shrink-0 opacity-80" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = {
  className?: string;
  onNavigate?: () => void;
};

export function DgNavMenu({ className, onNavigate }: Props) {
  const pathname = normalizePathname(usePathname());
  const router = useRouter();
  const highlightReady = useNavHighlightReady();
  const role = useDgRole();
  const { permissions } = useApp();

  const sections = filterDgNav(DG_NAV_SECTIONS, role, permissions);

  useEffect(() => {
    for (const section of sections) {
      for (const item of section.items) {
        router.prefetch(item.href);
      }
    }
  }, [router, sections]);

  return (
    <nav className={cn('dg-sidebar-nav', className)}>
      {sections.map((section) => (
        <NavSection
          key={section.title}
          section={section}
          pathname={pathname}
          highlightReady={highlightReady}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
