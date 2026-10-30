'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { isExternalWorkspace } from '@/lib/layout/external-space';
import {
  DG_ROOM_RESERVATIONS_LIST_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';

const pathTranslations: Record<string, { fr: string; en: string }> = {
  dashboard: { fr: 'Tableau de bord', en: 'Dashboard' },
  login: { fr: 'Connexion', en: 'Login' },
  pointage: { fr: 'Pointage', en: 'Attendance' },
  presences: { fr: 'Présences', en: 'Presence list' },
  rh: { fr: 'Tableau RH', en: 'HR dashboard' },
  'mon-qr': { fr: 'Mon QR', en: 'My QR' },
  scanner: { fr: 'Scanner borne', en: 'Kiosk scanner' },
  admin: { fr: 'Administration', en: 'Administration' },
  employes: { fr: 'Employés', en: 'Employees' },
  lieux: { fr: 'Lieux', en: 'Sites' },
  parametrage: { fr: 'Paramétrage', en: 'Configuration' },
  'jours-feries': { fr: 'Jours fériés', en: 'Public holidays' },
  conges: { fr: 'Congés', en: 'Leave' },
  securite: { fr: 'Sécurité', en: 'Security' },
  audit: { fr: 'Journal d’audit', en: 'Audit log' },
  admissions: { fr: 'Admissions', en: 'Admissions' },
  preregistrations: { fr: 'Préinscriptions', en: 'Pre-registrations' },
  applications: { fr: 'Candidatures', en: 'Applications' },
  documents: { fr: 'Documents', en: 'Documents' },
  dg: { fr: 'DGA', en: 'Deputy General Management' },
  assistant: { fr: 'Espace assistante', en: 'Assistant workspace' },
  ia: { fr: 'Lecture de la semaine', en: 'Week reading' },
  appointments: { fr: 'Rendez-vous', en: 'Appointments' },
  users: { fr: 'Utilisateurs', en: 'Users' },
  roles: { fr: 'Gestion des rôles', en: 'Role management' },
  referentials: { fr: 'Référentiels', en: 'Referentials' },
  settings: { fr: 'Paramètres', en: 'Settings' },
  calendar: { fr: 'Calendrier', en: 'Calendar' },
  mine: { fr: 'Mes demandes', en: 'My requests' },
  board: { fr: 'Tableau de bord', en: 'Dashboard' },
  agenda: { fr: 'Agenda', en: 'Agenda' },
  account: { fr: 'Mon profil', en: 'My profile' },
  availability: { fr: DG_ROOM_SLOTS_LABEL, en: 'Room slots' },
  reservations: { fr: DG_ROOM_RESERVATIONS_LIST_LABEL, en: 'Room reservations list' },
  plan: { fr: 'Planifier un RDV', en: 'Schedule appointment' },
  activity: { fr: 'Historique RDV', en: 'Appointment history' },
  notifications: { fr: 'Notifications', en: 'Notifications' },
  export: { fr: 'Export', en: 'Export' },
  workspace: { fr: 'Espace de travail', en: 'Workspace' },
  tasks: { fr: 'Tâches', en: 'Tasks' },
  decisions: { fr: 'Décisions', en: 'Decisions' },
  projects: { fr: 'Dossiers stratégiques', en: 'Strategic dossiers' },
  mail: { fr: 'Courriers', en: 'Mail' },
  contacts: { fr: 'Contacts', en: 'Contacts' },
  audiences: { fr: 'Audiences', en: 'Audiences' },
  invitations: { fr: 'Invitations', en: 'Invitations' },
  missions: { fr: 'Missions', en: 'Missions' },
  'hotel-reservations': { fr: "Réservation d'hôtel", en: 'Hotel reservation' },
  deadlines: { fr: 'Echeances', en: 'Deadlines' },
  documents: { fr: 'Documents', en: 'Documents' },
  school: { fr: 'Gestion scolaire', en: 'School management' },
  students: { fr: 'Eleves', en: 'Students' },
  teachers: { fr: 'Professeurs', en: 'Teachers' },
  parents: { fr: 'Parents', en: 'Parents' },
  classrooms: { fr: 'Salles & classes', en: 'Classrooms' },
  academics: { fr: 'Structure academique', en: 'Academic structure' },
  assignments: { fr: 'Affectations', en: 'Assignments' },
  timetable: { fr: 'Operations pedagogiques', en: 'Academic operations' },
};

type BreadcrumbsProps = {
  variant?: 'default' | 'pro';
};

export function Breadcrumbs({ variant = 'default' }: BreadcrumbsProps) {
  const pathname = usePathname();
  const { language, roleId, dgRole } = useApp();
  const external = isExternalWorkspace(roleId, dgRole);

  if (pathname === '/') return null;
  if (pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password') return null;

  const allSegments = pathname.split('/').filter(Boolean);

  const displaySegments =
    allSegments[0] === 'dg' && allSegments[1] === 'admin' ? allSegments.slice(1) : allSegments;

  const breadcrumbs = displaySegments.map((segment, index) => {
    const slice = displaySegments.slice(0, index + 1);
    const path =
      allSegments[0] === 'dg' && allSegments[1] === 'admin'
        ? `/dg/${slice.join('/')}`
        : `/${slice.join('/')}`;
    const isLast = index === displaySegments.length - 1;
    
    // Check if segment is an ID (contains numbers or is a UUID pattern)
    const isId = /^[0-9a-f-]+$/i.test(segment) && segment.length > 2;
    
    let label = pathTranslations[segment]?.[language] || segment;
    if (segment === 'mine' && allSegments.includes('reservations')) {
      label = language === 'fr' ? 'Mes réservations' : 'My reservations';
    }
    if (isId) {
      label = language === 'fr' ? 'Détails' : 'Details';
    }

    return {
      label,
      path,
      isLast,
    };
  }).filter((crumb) => !(pathname.startsWith('/dg/assistant/ia') && crumb.path === '/dg/assistant'));

  const homeHref = external
    ? '/appointments/board'
    : pathname.startsWith('/dg') ||
        pathname.startsWith('/appointments') ||
        pathname.startsWith('/account')
      ? '/dg/assistant'
      : '/';

  if (variant === 'pro') {
    return (
      <nav aria-label="Breadcrumb" className="admin-breadcrumb">
        <ol className="admin-breadcrumb-list">
          <li className="admin-breadcrumb-item">
            <Link href={homeHref} className="admin-breadcrumb-link admin-breadcrumb-home">
              <Home className="admin-breadcrumb-home-icon" aria-hidden />
              <span className="sr-only">{language === 'fr' ? 'Accueil' : 'Home'}</span>
            </Link>
          </li>
          {breadcrumbs.map((crumb) => (
            <li key={crumb.path} className="admin-breadcrumb-item">
              <ChevronRight className="admin-breadcrumb-sep" aria-hidden />
              {crumb.isLast ? (
                <span className="admin-breadcrumb-current" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.path} className="admin-breadcrumb-link">
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link
            href={homeHref}
            className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">{language === 'fr' ? 'Accueil' : 'Home'}</span>
          </Link>
        </li>
        {breadcrumbs.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {crumb.isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.path}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
