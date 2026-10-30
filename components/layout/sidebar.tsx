'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDgRole } from '@/lib/auth/use-dg-role';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  ListChecks,
  Shield,
  Settings,
  Users,
} from 'lucide-react';
import type { DgRole } from '@/lib/dg/rbac';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LIST_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';

type NavItem = { label: string; href: string; icon: React.ReactNode; roles?: DgRole[] };

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dg/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['DG', 'ASSISTANT'] },
  { label: 'Espace Assistante', href: '/dg/assistant', icon: <ClipboardList className="h-4 w-4" />, roles: ['ASSISTANT', 'DG'] },
  {
    label: 'Liste des rendez-vous',
    href: '/dg/appointments',
    icon: <ListChecks className="h-4 w-4" />,
    roles: ['ASSISTANT', 'DG'],
  },
  {
    label: DG_ROOM_SLOTS_LABEL,
    href: DG_ROOM_AVAILABILITY_HREF,
    icon: <Building2 className="h-4 w-4" />,
    roles: ['ASSISTANT', 'DG', 'MANAGER'],
  },
  {
    label: DG_ROOM_RESERVATIONS_LIST_LABEL,
    href: DG_ROOM_RESERVATIONS_HREF,
    icon: <ListChecks className="h-4 w-4" />,
    roles: ['ASSISTANT', 'DG', 'MANAGER'],
  },
  { label: 'Planifier un RDV', href: '/dg/plan', icon: <CalendarPlus className="h-4 w-4" />, roles: ['ASSISTANT', 'DG'] },
  { label: 'Administration', href: '/dg/admin', icon: <Settings className="h-4 w-4" />, roles: ['ASSISTANT'] },
  { label: 'Utilisateurs', href: '/dg/admin/users', icon: <Users className="h-4 w-4" />, roles: ['ASSISTANT'] },
  { label: 'Paramétrage', href: '/dg/admin/settings', icon: <Settings className="h-4 w-4" />, roles: ['ASSISTANT'] },
  { label: 'Calendrier', href: '/appointments/calendar', icon: <CalendarDays className="h-4 w-4" /> },
  { label: 'Mes demandes', href: '/appointments/mine', icon: <ClipboardList className="h-4 w-4" />, roles: ['MANAGER', 'EXTERNAL'] },
  { label: 'Audit', href: '/dg/audit', icon: <Shield className="h-4 w-4" />, roles: ['ASSISTANT', 'DG'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useDgRole();

  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <aside className="fixed left-0 top-[calc(3.5rem+4px)] z-30 hidden h-[calc(100vh-3.5rem-4px)] w-64 border-r border-sidebar-border bg-sidebar shadow-sm lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
            <span className="text-xs font-medium text-success">Système actif</span>
          </div>
          <p className="text-xs text-muted-foreground">Direction Générale Adjointe</p>
          <p className="text-sm font-semibold text-primary">Réservation intelligente</p>
          <p className="mt-1 text-xs capitalize text-muted-foreground">Rôle : {role.toLowerCase()}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
                  'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
