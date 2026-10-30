import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bell,
  ClipboardList,
  Building2,
  CalendarDays,
  LayoutDashboard,
  CalendarPlus,
  ListChecks,
  Sparkles,
  SlidersHorizontal,
  Users,
  UserCog,
  Database,
  Settings,
  ScrollText,
} from 'lucide-react';
import type { DgRole } from '@/lib/dg/rbac';
import { hasAnyPermission } from '@/lib/dg/role-access';
import { ADMIN_MENU_PERMISSION_IDS } from '@/lib/dg/permission-catalog';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LIST_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';

export type DgNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: DgRole[];
  /** Au moins une de ces permissions suffit (prioritaire sur `roles` si map fournie). */
  permissions?: string[];
  /** Masquer l'entrée si l'utilisateur possède l'une de ces permissions. */
  denyPermissions?: string[];
};

export type DgNavSection = {
  title: string;
  items: DgNavItem[];
  roles?: DgRole[];
  permissions?: string[];
  /** Section repliable (ex. Administration) */
  collapsible?: boolean;
  sectionIcon?: LucideIcon;
  /** Ouverte par défaut et non repliable (ex. Administration). */
  defaultOpen?: boolean;
};

/** Menus Administration (réf. ARPT) — 1 entrée = 1 permission menu. */
export const DG_ADMIN_NAV_ITEMS: DgNavItem[] = [
  {
    label: 'Utilisateurs',
    href: '/dg/admin/users',
    icon: Users,
    permissions: ['menu.admin.users'],
  },
  {
    label: 'Rôles & Permissions',
    href: '/dg/admin/roles',
    icon: UserCog,
    permissions: ['menu.admin.roles'],
  },
  {
    label: 'Référentiels',
    href: '/dg/admin/referentials',
    icon: Database,
    permissions: ['menu.admin.referentials'],
  },
  {
    label: 'Paramètres',
    href: '/dg/admin/settings',
    icon: Settings,
    permissions: ['menu.admin.settings'],
  },
  {
    label: "Journal d'audit",
    href: '/dg/audit',
    icon: ScrollText,
    permissions: ['menu.admin.audit'],
  },
];

export const DG_NAV_SECTIONS: DgNavSection[] = [
  {
    title: 'Pilotage',
    defaultOpen: true,
    sectionIcon: LayoutDashboard,
    items: [
      {
        label: 'Tableau de bord',
        href: '/dg/dashboard',
        icon: LayoutDashboard,
        permissions: ['menu.dashboard'],
      },
      {
        label: 'Espace assistante',
        href: '/dg/assistant',
        icon: ClipboardList,
        permissions: ['menu.assistant'],
      },
    ],
  },
  {
    title: 'Rendez-vous',
    collapsible: true,
    defaultOpen: true,
    sectionIcon: CalendarDays,
    items: [
      {
        label: 'Liste des rendez-vous',
        href: '/dg/appointments',
        icon: ListChecks,
        permissions: ['menu.appointments_list'],
      },
      {
        label: 'Planifier un RDV',
        href: '/dg/plan',
        icon: CalendarPlus,
        permissions: ['menu.plan'],
      },
      {
        label: 'Historique RDV',
        href: '/dg/activity',
        icon: Activity,
        permissions: ['menu.history'],
      },
      {
        label: 'Lecture de la semaine',
        href: '/dg/assistant/ia',
        icon: Sparkles,
        permissions: ['menu.assistant'],
      },
      {
        label: 'Notifications',
        href: '/dg/notifications',
        icon: Bell,
        permissions: ['menu.notifications'],
      },
    ],
  },
  {
    title: 'Salles',
    collapsible: true,
    defaultOpen: true,
    sectionIcon: Building2,
    items: [
      {
        label: DG_ROOM_SLOTS_LABEL,
        href: DG_ROOM_AVAILABILITY_HREF,
        icon: Building2,
        permissions: ['menu.room_slots'],
      },
      {
        label: DG_ROOM_RESERVATIONS_LIST_LABEL,
        href: DG_ROOM_RESERVATIONS_HREF,
        icon: ClipboardList,
        permissions: ['menu.room_reservations'],
      },
    ],
  },
  {
    title: 'Administration',
    permissions: [...ADMIN_MENU_PERMISSION_IDS],
    collapsible: true,
    defaultOpen: true,
    sectionIcon: SlidersHorizontal,
    items: DG_ADMIN_NAV_ITEMS,
  },
];

function canAccessNavItem(
  item: DgNavItem,
  role: DgRole,
  permissionMap?: Record<string, boolean>
): boolean {
  if (permissionMap) {
    if (item.denyPermissions?.length && hasAnyPermission(permissionMap, item.denyPermissions)) {
      return false;
    }
    if (item.permissions?.length) {
      // Menu visible uniquement si au moins une permission requise est explicitement activée.
      return item.permissions.some((id) => permissionMap[id] === true);
    }
    return !item.roles || item.roles.includes(role);
  }
  if (item.denyPermissions?.length) return false;
  return !item.roles || item.roles.includes(role);
}

function canAccessNavSection(
  section: DgNavSection,
  role: DgRole,
  permissionMap?: Record<string, boolean>
): boolean {
  if (permissionMap && section.permissions?.length) {
    return section.permissions.some((id) => permissionMap[id] === true);
  }
  if (permissionMap) {
    // Section sans gate : visible si au moins un item l'est (filtré ensuite).
    return true;
  }
  return !section.roles || section.roles.includes(role);
}

export function filterDgNav(
  sections: DgNavSection[],
  role: DgRole,
  permissionMap?: Record<string, boolean>
): DgNavSection[] {
  return sections
    .filter((section) => canAccessNavSection(section, role, permissionMap))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessNavItem(item, role, permissionMap)),
    }))
    .filter((section) => section.items.length > 0);
}

export function isDgAppPath(pathname: string): boolean {
  return (
    pathname.startsWith('/dg') ||
    pathname.startsWith('/appointments') ||
    pathname === '/account' ||
    pathname.startsWith('/account/')
  );
}

export function isAdminNavActive(pathname: string): boolean {
  return (
    pathname.startsWith('/dg/admin') ||
    pathname === '/dg/audit' ||
    pathname.startsWith('/dg/audit/')
  );
}
