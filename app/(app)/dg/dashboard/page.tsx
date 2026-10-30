'use client';

import { useEffect, useRef, useState } from 'react';
import { DgWeekCalendar } from '@/components/appointments/dg-week-calendar';
import { DgCockpit } from '@/components/dg/dg-cockpit';
import { useDgRole } from '@/lib/auth/use-dg-role';
import type { DgCockpitData } from '@/lib/dg/dg-cockpit';

export default function DgDashboardPage() {
  const role = useDgRole();
  const canDrag = role === 'DG' || role === 'ASSISTANT';
  const [cockpit, setCockpit] = useState<DgCockpitData | null>(null);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const agendaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void fetch('/api/dashboard/dg')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { cockpit?: DgCockpitData } | null) => {
        setCockpit(payload?.cockpit ?? null);
      });
  }, []);

  useEffect(() => {
    if (agendaOpen) agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [agendaOpen]);

  if (!cockpit) {
    return (
      <div className="dg-dashboard-page dg-cockpit-loading">
        <p>Chargement de l’agenda…</p>
      </div>
    );
  }

  return (
    <div className="app-page dg-dashboard-page">
      <DgCockpit
        data={cockpit}
        agendaOpen={agendaOpen}
        onToggleAgenda={() => setAgendaOpen((open) => !open)}
      />
      {agendaOpen ? (
        <section
          ref={agendaRef}
          id="dg-dga-agenda-panel"
          className="dg-dga-agenda"
          aria-label="Agenda du Directeur général adjoint"
        >
          <div className="dg-dga-agenda-body">
            <div className="dg-calendar-stage">
              <DgWeekCalendar canDrag={canDrag} onHide={() => setAgendaOpen(false)} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
