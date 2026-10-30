'use client';

import { DgWeekCalendar } from '@/components/appointments/dg-week-calendar';
import { AssistantCockpit } from '@/components/dg/assistant-cockpit';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export default function AssistantDashboardPage() {
  return (
    <div className="app-page admin-theme dg-assistant-page">
      <AdminPageHeader variant="flat" title="Espace Assistante" />

      <AssistantCockpit />

      <section className="dg-assistant-calendar-section">
        <div className="dg-assistant-section-head">
          <div>
            <h2 className="dg-assistant-section-title">Agenda DGA</h2>
            <p className="dg-assistant-section-sub">
              Agenda, demandes en attente et conflits de planning
            </p>
          </div>
        </div>
        <div className="dg-assistant-calendar-frame">
          <DgWeekCalendar canDrag compact />
        </div>
      </section>
    </div>
  );
}
