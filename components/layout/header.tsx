'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp, usePermissions } from '@/lib/app-context';
import { USER_ROLE_LABELS, type UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Moon,
  Sun,
  Globe,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Menu,
  GraduationCap,
  ChevronDown,
  LayoutDashboard,
  FileCheck2,
  FolderOpen,
  SlidersHorizontal,
  Shield,
  School,
} from 'lucide-react';

const roles: UserRole[] = [
  'super_admin',
  'admin_metier',
  'analyste',
  'decideur',
  'auditeur',
  'lecture_seule',
];

export function Header() {
  const router = useRouter();
  const { t, language, setLanguage, currentUser, currentRole, setCurrentRole, isDarkMode, toggleDarkMode, sessionBacked, appRole } =
    useApp();
  const { canManageAttendanceAdmin, canViewAuditLog } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const mobileLinks: { href: string; label: string; show: boolean }[] = [
    { href: '/dashboard', label: t('nav.dashboard'), show: true },
    { href: '/admissions/preregistrations', label: t('nav.preregistration'), show: true },
    { href: '/admissions/applications', label: t('nav.applications'), show: true },
    { href: '/admissions/documents', label: t('nav.admissionDocuments'), show: true },
    { href: '/admin/admissions', label: t('nav.admissionsAdmin'), show: canManageAttendanceAdmin },
    { href: '/admin/school', label: t('nav.schoolAdmin'), show: canManageAttendanceAdmin },
    { href: '/admin/school/timetable', label: t('nav.schoolOps'), show: canManageAttendanceAdmin },
    { href: '/admin/securite/audit', label: t('nav.auditLog'), show: canViewAuditLog },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card shadow-sm">
      <div className="esmt-header-stripe" />
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle>{t('nav.admissions')}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {mobileLinks
                  .filter((l) => l.show)
                  .map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg esmt-gradient-orange shadow-sm">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-base font-bold leading-none text-primary">DGA</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('nav.productName')}</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {!sessionBacked ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex gap-2 bg-transparent">
                  <User className="h-4 w-4" />
                  <span className="max-w-[100px] truncate">{USER_ROLE_LABELS[currentRole][language]}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('roleDemo.title')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => setCurrentRole(role)}
                    className={currentRole === role ? 'bg-accent' : ''}
                  >
                    {USER_ROLE_LABELS[role][language]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" className="hidden md:flex gap-2 bg-transparent" disabled>
              <User className="h-4 w-4" />
              <span className="max-w-[160px] truncate">
                {appRole === 'hr_admin'
                  ? language === 'fr'
                    ? 'RH'
                    : 'HR'
                  : appRole === 'hr_auditor'
                    ? language === 'fr'
                      ? 'Auditeur RH'
                      : 'HR auditor'
                    : language === 'fr'
                      ? 'Employé'
                      : 'Employee'}
              </span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Globe className="h-4 w-4" />
                <span className="sr-only">Langue</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('fr')} className={language === 'fr' ? 'bg-accent' : ''}>
                Français
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-accent' : ''}>
                English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {currentUser.firstName[0]}
                  {currentUser.lastName[0]}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>
                    {currentUser.firstName} {currentUser.lastName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {t('nav.dashboard')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admissions/preregistrations" className="cursor-pointer">
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  {t('nav.preregistration')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admissions/applications" className="cursor-pointer">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  {t('nav.applications')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admissions/documents" className="cursor-pointer">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('nav.admissionDocuments')}
                </Link>
              </DropdownMenuItem>
              {canViewAuditLog ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin/securite/audit" className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    {t('nav.auditLog')}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canManageAttendanceAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/admissions" className="cursor-pointer">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      {t('nav.admissionsAdmin')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/school" className="cursor-pointer">
                      <School className="mr-2 h-4 w-4" />
                      {t('nav.schoolAdmin')}
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                {t('header.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                {t('header.settings')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                {t('header.help')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" disabled={loggingOut} onClick={() => void handleLogout()}>
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? t('common.loading') : t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
