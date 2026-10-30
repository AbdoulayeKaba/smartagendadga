'use client';

import Link from 'next/link';
import { CalendarPlus, ListChecks, LayoutDashboard } from 'lucide-react';
import { DgOutlookCalendar } from '@/components/appointments/dg-outlook-calendar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { useDgRole } from '@/lib/auth/use-dg-role';

export default function CalendarPage() {
  const role = useDgRole();
  const canDrag = role === 'ASSISTANT' || role === 'DG';

  return (
    <div className="app-page admin-theme dg-calendar-page">
      <AdminPageHeader
        variant="flat"
        eyebrow="Planification"
        title="Agenda DGA"
        description={
          canDrag
            ? 'Vues mois, semaine et jour — reprogrammation et priorités.'
            : 'Consultation de l’agenda du DGA.'
        }
        actions={
          <div className="dg-calendar-header-actions">
            <Link href="/dg/dashboard" className="admin-appt-filter-btn dg-calendar-action-btn">
              <LayoutDashboard className="h-3 w-3" aria-hidden />
              Cockpit
            </Link>
            <Link href="/dg/appointments" className="admin-appt-filter-btn dg-calendar-action-btn">
              <ListChecks className="h-3 w-3" aria-hidden />
              Liste RDV
            </Link>
            <Link href="/dg/plan" className="admin-btn-primary dg-calendar-action-btn">
              <CalendarPlus className="h-3 w-3" aria-hidden />
              Planifier
            </Link>
          </div>
        }
      />

      <div className="dg-calendar-stage">
        <DgOutlookCalendar canDrag={canDrag} />
      </div>
    </div>
  );
}
