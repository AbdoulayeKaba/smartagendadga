'use client';

import Link from 'next/link';
import { useApp } from '@/lib/app-context';
import { userInitials } from '@/lib/dg/role-labels';

export function DgSidebarRoleCard({ onNavigate }: { onNavigate?: () => void }) {
  const { currentUser, roleLabel } = useApp();
  const initials = userInitials(currentUser.firstName, currentUser.lastName);
  const name = `${currentUser.firstName} ${currentUser.lastName}`.trim();

  return (
    <Link
      href="/account"
      className="dg-sidebar-role-card"
      onClick={onNavigate}
      aria-label={`Ouvrir le profil de ${name || roleLabel}`}
    >
      <div className="dg-sidebar-role-avatar" aria-hidden>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="dg-sidebar-role-label">Rôle actuel</p>
        <p className="dg-sidebar-role-value">{roleLabel}</p>
      </div>
    </Link>
  );
}
