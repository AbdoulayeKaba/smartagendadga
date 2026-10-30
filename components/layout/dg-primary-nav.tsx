'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { isExternalWorkspace } from '@/lib/layout/external-space';
import { DG_ADMIN_NAV_ITEMS, filterDgNav } from '@/lib/layout/dg-nav';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LIST_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  label,
  href,
  children,
  active,
  pathname,
}: {
  label: string;
  href?: string;
  children?: NavLink[];
  active: boolean;
  pathname: string;
}) {
  if (!children?.length) {
    if (!href) return null;
    return (
      <Link
        href={href}
        className={cn('dg-topnav-link', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <details className={cn('dg-topnav-menu', active && 'is-active')}>
      <summary>
        {label}
        <ChevronDown className="dg-topnav-chevron" aria-hidden />
      </summary>
      <div className="dg-topnav-panel">
        {children.map((item) => (
          <Link key={item.href} href={item.href} className={cn(isActive(pathname, item.href) && 'is-active')}>
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export function DgPrimaryNav() {
  const pathname = usePathname();
  const { permissions, roleId, dgRole } = useApp();
  const external = isExternalWorkspace(roleId, dgRole);
  const allowed = (id: string) => permissions[id] === true;

  const dashboardLinks: NavLink[] = [];
  if (!external && allowed('menu.dashboard')) {
    dashboardLinks.push({ label: 'Synthèse', href: '/dg/dashboard' });
  }
  if (!external && allowed('menu.assistant')) {
    dashboardLinks.push({ label: 'Espace assistante', href: '/dg/assistant' });
  }
  const dashboardHref = external ? '/appointments/board' : (dashboardLinks[0]?.href ?? '/dg/dashboard');

  const appointmentLinks: NavLink[] = [];
  if (allowed('menu.appointments_list')) {
    appointmentLinks.push({ label: 'Liste des rendez-vous', href: '/dg/appointments' });
  }
  if (allowed('menu.plan')) {
    appointmentLinks.push({ label: 'Planifier', href: '/dg/plan' });
  }
  if (allowed('menu.history')) {
    appointmentLinks.push({ label: 'Historique', href: '/dg/activity' });
  }

  const roomLinks: NavLink[] = [];
  if (allowed('menu.room_slots')) {
    roomLinks.push({ label: DG_ROOM_SLOTS_LABEL, href: DG_ROOM_AVAILABILITY_HREF });
  }
  if (allowed('menu.room_reservations')) {
    roomLinks.push({ label: DG_ROOM_RESERVATIONS_LIST_LABEL, href: DG_ROOM_RESERVATIONS_HREF });
  }

  const adminLinks = filterDgNav(
    [{ title: 'Administration', items: DG_ADMIN_NAV_ITEMS }],
    dgRole ?? 'EXTERNAL',
    permissions
  ).flatMap((section) => section.items.map((item) => ({ label: item.label, href: item.href })));

  const agendaActive =
    isActive(pathname, '/appointments/calendar') || isActive(pathname, '/dg/fiche-jour');
  const appointmentActive = appointmentLinks.some((item) => isActive(pathname, item.href));
  const roomActive = roomLinks.some((item) => isActive(pathname, item.href));
  const dashboardActive =
    isActive(pathname, dashboardHref) ||
    dashboardLinks.some((item) => isActive(pathname, item.href)) ||
    (external && isActive(pathname, '/appointments/board'));

  return (
    <nav className="dg-topnav" aria-label="Navigation principale">
      <NavItem
        label="Tableau de bord"
        href={dashboardLinks.length > 1 ? undefined : dashboardHref}
        children={dashboardLinks.length > 1 ? dashboardLinks : undefined}
        active={dashboardActive}
        pathname={pathname}
      />
      <NavItem label="Agenda" href="/appointments/calendar" active={agendaActive} pathname={pathname} />
      {appointmentLinks.length > 0 ? (
        <NavItem
          label="Rendez-vous"
          href={appointmentLinks.length === 1 ? appointmentLinks[0].href : undefined}
          children={appointmentLinks.length > 1 ? appointmentLinks : undefined}
          active={appointmentActive}
          pathname={pathname}
        />
      ) : null}
      {roomLinks.length > 0 ? (
        <NavItem
          label="Salles"
          href={roomLinks.length === 1 ? roomLinks[0].href : undefined}
          children={roomLinks.length > 1 ? roomLinks : undefined}
          active={roomActive}
          pathname={pathname}
        />
      ) : null}
      {allowed('menu.notifications') ? (
        <NavItem
          label="Notifications"
          href="/dg/notifications"
          active={isActive(pathname, '/dg/notifications')}
          pathname={pathname}
        />
      ) : null}
      {adminLinks.length > 0 ? (
        <NavItem
          label="Administration"
          children={adminLinks}
          active={
            adminLinks.some((item) => isActive(pathname, item.href)) || isActive(pathname, '/dg/audit')
          }
          pathname={pathname}
        />
      ) : null}
    </nav>
  );
}
