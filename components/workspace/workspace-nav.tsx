'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  BookUser,
  Briefcase,
  CalendarCheck2,
  CalendarDays,
  CalendarClock,
  Bell,
  ClipboardList,
  FolderOpen,
  Mail,
  Settings,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { WORKSPACE_MENU } from '@/components/workspace/workspace-menu';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LIST_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';

const MODULES = [
  { href: '/dg/assistant', label: 'Agenda & RDV', icon: CalendarDays },
  { href: '/dg/appointments', label: 'Liste des rendez-vous', icon: ClipboardList },
  { href: '/dg/plan', label: 'Planifier un RDV', icon: CalendarClock },
  { href: '/dg/activity', label: 'Historique RDV', icon: CalendarDays },
  { href: '/dg/notifications', label: 'Notifications', icon: Bell },
  { href: '/dg/workspace/mail', label: 'Courriers départ', icon: Mail },
  { href: '/dg/workspace/mail-enregistrement', label: 'Coffre-fort', icon: FolderOpen },
  { href: '/dg/workspace/contacts', label: 'Contacts', icon: Users },
  { href: '/dg/workspace/audiences', label: 'Audiences', icon: BookUser },
  { href: '/dg/workspace/deadlines', label: 'Echeances', icon: Briefcase },
  { href: '/dg/workspace/documents', label: 'Compte rendu', icon: FileText },
  { href: DG_ROOM_AVAILABILITY_HREF, label: DG_ROOM_SLOTS_LABEL, icon: CalendarCheck2 },
  { href: DG_ROOM_RESERVATIONS_HREF, label: DG_ROOM_RESERVATIONS_LIST_LABEL, icon: ClipboardList },
  { href: '/dg/admin/settings', label: 'Paramétrage', icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn('workspace-sidebar-link', active && 'workspace-sidebar-link--active')}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function WorkspaceNav() {
  const pathname = usePathname();
  const hasWorkspaceActive = useMemo(
    () =>
      WORKSPACE_MENU.some((item) =>
        item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
      ),
    [pathname]
  );
  const [open, setOpen] = useState(true);

  return (
    <nav className="workspace-sidebar-nav" aria-label="Navigation espace assistante">
      <div className="workspace-sidebar-brand">
        <Briefcase className="h-5 w-5 text-[var(--admin-primary)]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[var(--admin-foreground)]">Espace assistante</p>
          <p className="text-[10px] text-[var(--admin-muted)]">DGA · ARPT</p>
        </div>
      </div>

      <button
        type="button"
        className={cn('workspace-sidebar-parent', hasWorkspaceActive && 'workspace-sidebar-parent--active')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Espace de travail
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <ul className="workspace-sidebar-submenu space-y-0.5">
          {MODULES.map((link) => (
            <li key={link.href}>
              <NavLink {...link} />
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
