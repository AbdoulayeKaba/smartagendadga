'use client';

import { Building2, CalendarRange, Monitor, Users } from 'lucide-react';
import type { AgendaWeekPressure } from '@/lib/ai/types';

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="dg-ai-kpi">
      <span className="dg-ai-kpi-value">{value}</span>
      <span className="dg-ai-kpi-label">{label}</span>
    </div>
  );
}

export function AgendaPressureBriefing({ data }: { data: AgendaWeekPressure }) {
  const max = Math.max(1, ...data.days.map((day) => day.confirmed + day.pending));

  return (
    <div className="dg-ai-pressure">
      <div className="dg-ai-kpi-grid">
        <Kpi label="Confirmés cette semaine" value={data.confirmedWeek} />
        <Kpi label="Demandes sur la semaine" value={data.pendingOnWeek} />
        <Kpi label="Hors semaine" value={data.pendingOutsideWeek} />
        <Kpi label="Haute priorité" value={data.highPriorityPending} />
        <Kpi label="Salles" value={data.roomsWeek} />
      </div>

      <section className="dg-ai-briefing-section" aria-labelledby="dg-ai-pressure-days">
        <div className="dg-ai-section-label" id="dg-ai-pressure-days">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden />
          Charge par jour
        </div>
        <div className="dg-ai-pressure-days">
          {data.days.map((day) => {
            const total = day.confirmed + day.pending;
            return (
              <article
                key={day.key}
                className={day.isToday ? 'dg-ai-pressure-day is-today' : 'dg-ai-pressure-day'}
              >
                <p className="dg-ai-pressure-day-label">{day.label}</p>
                <p className="dg-ai-pressure-day-count">
                  <span className="is-confirmed">{day.confirmed}</span>
                  <span className="is-pending">{day.pending}</span>
                </p>
                <div
                  className="dg-ai-pressure-meter"
                  role="img"
                  aria-label={`${day.label} : ${day.confirmed} confirmés, ${day.pending} en attente`}
                >
                  {total > 0 ? (
                    <span className="dg-ai-pressure-stack" style={{ width: `${(total / max) * 100}%` }}>
                      {day.confirmed > 0 ? (
                        <span className="is-confirmed" style={{ flexGrow: day.confirmed }} />
                      ) : null}
                      {day.pending > 0 ? (
                        <span className="is-pending" style={{ flexGrow: day.pending }} />
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <p className="dg-ai-pressure-legend">
          <i className="is-confirmed" /> Confirmés
          <i className="is-pending" /> Demandes
        </p>
      </section>

      <div className="dg-ai-pressure-split">
        <section className="dg-ai-briefing-section">
          <div className="dg-ai-section-label">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Mode des rendez-vous confirmés
          </div>
          <ul className="dg-ai-pressure-mix">
            <li>
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span>Présentiel</span>
              <strong>{data.onsiteWeek}</strong>
            </li>
            <li>
              <Monitor className="h-3.5 w-3.5" aria-hidden />
              <span>En ligne</span>
              <strong>{data.onlineWeek}</strong>
            </li>
            <li>
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              <span>Réservations de salles</span>
              <strong>{data.roomsWeek}</strong>
            </li>
          </ul>
        </section>
        <section className="dg-ai-briefing-section">
          <div className="dg-ai-section-label">Lecture</div>
          <ul className="dg-ai-pressure-reading">
            {data.reading.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
