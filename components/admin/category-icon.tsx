import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  FileDown,
  FileText,
  LayoutDashboard,
  Library,
  MapPin,
  Settings,
  Settings2,
  CalendarClock,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionCategory } from '@/lib/dg/permission-catalog';

const MAP: Record<NonNullable<PermissionCategory['icon']>, LucideIcon> = {
  admin: Settings,
  appointments: CalendarClock,
  calendar: CalendarDays,
  audit: FileDown,
  pilotage: LayoutDashboard,
  mon_espace: UserRound,
  menu: Briefcase,
  actions: CheckSquare,
  contacts: Users,
  missions: MapPin,
  documents: FileText,
  rooms: Building2,
  users: UserCog,
  referentials: Library,
  settings: Settings2,
};

export function CategoryIcon({ icon, className }: { icon?: PermissionCategory['icon']; className?: string }) {
  const Icon = (icon && MAP[icon]) || Settings;
  return <Icon className={className} />;
}
