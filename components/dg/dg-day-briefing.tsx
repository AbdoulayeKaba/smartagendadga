'use client';

import Link from 'next/link';
import { ArrowUpRight, Calendar, DoorOpen, Mail, Printer } from 'lucide-react';
import { DG_ROOM_AVAILABILITY_HREF } from '@/lib/dg/meeting-room-config';
import type { DgDayBriefingData } from '@/lib/dg/day-briefing-types';
import { cn } from '@/lib/utils';

export type { DgDayBriefingData } from '@/lib/dg/day-briefing-types';

const MAIL_PIPE = [
  { key: 'RECEIVED', label: 'Reçu', tone: 'received' },
  { key: 'ASSIGNED', label: 'Affecté', tone: 'assigned' },
  { key: 'IN_PROGRESS', label: 'Traitement', tone: 'progress' },
  { key: 'SENT', label: 'Envoyé', tone: 'sent' },
] as const;

const MIX = [
  { key: 'mail', color: '#c47a12', label: 'Courriers', unit: 'dossiers' },
  { key: 'rdv', color: '#0e7a4b', label: 'RDV', unit: 'audiences' },
  { key: 'rooms', color: '#5c6b78', label: 'Salles', unit: 'occupations' },
] as const;

function situationLine(data: DgDayBriefingData) {
  const parts: string[] = [];
  if (data.appointmentsToday.count > 0) {
    parts.push(`${data.appointmentsToday.count} RDV`);
  }
  if (data.mailToProcess.count > 0) {
    parts.push(
      `${data.mailToProcess.count} courrier${data.mailToProcess.count > 1 ? 's' : ''} à traiter`
    );
  }
  if ((data.pendingCount ?? 0) > 0) {
    parts.push(`${data.pendingCount} demande${data.pendingCount > 1 ? 's' : ''} en attente`);
  }
  if (data.roomsOccupied.count > 0) {
    parts.push(`${data.roomsOccupied.count} salle${data.roomsOccupied.count > 1 ? 's' : ''}`);
  }
  if (parts.length === 0) {
    return { text: 'Journée libre — aucune charge sur l’agenda', urgent: false };
  }
  return { text: parts.join('  ·  '), urgent: data.mailToProcess.count > 0 };
}

function mixValues(data: DgDayBriefingData) {
  return {
    mail: data.mailToProcess.count,
    rdv: data.appointmentsToday.count,
    rooms: data.roomsOccupied.count,
  };
}

function MixLollipop({ data }: { data: DgDayBriefingData }) {
  const values = mixValues(data);
  const rows = [...MIX]
    .map((item) => ({ ...item, value: values[item.key] }))
    .sort((a, b) => b.value - a.value);
  const peak = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const plotLeft = 72;
  const plotRight = 188;
  const plotW = plotRight - plotLeft;
  const vbH = 118;
  const rowH = 26;
  const top = 10;

  return (
    <div className="dg-briefing-lollipop">
      <svg
        viewBox={`0 0 200 ${vbH}`}
        className="dg-briefing-lollipop-svg"
        role="img"
        aria-label={`Charge comparée : ${total} actifs`}
      >
        {[0, 0.5, 1].map((t) => {
          const x = plotLeft + t * plotW;
          return (
            <g key={t}>
              <line className="dg-briefing-lollipop-grid" x1={x} x2={x} y1={4} y2={vbH - 16} />
              <text className="dg-briefing-lollipop-tick" x={x} y={vbH - 4} textAnchor="middle">
                {Math.round(t * peak)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const y = top + index * rowH;
          const x = plotLeft + (row.value / peak) * plotW;
          const hot = row.value > 0;
          return (
            <g key={row.key}>
              <text
                className={hot ? 'dg-briefing-lollipop-name is-hot' : 'dg-briefing-lollipop-name'}
                x={4}
                y={y + 4}
              >
                {row.label}
              </text>
              <line
                className={hot ? 'dg-briefing-lollipop-stem is-hot' : 'dg-briefing-lollipop-stem'}
                x1={plotLeft}
                x2={hot ? x : plotLeft + 2}
                y1={y}
                y2={y}
              />
              <circle
                cx={hot ? x : plotLeft}
                cy={y}
                r={hot ? 5.2 : 3.2}
                fill={hot ? row.color : '#c5d4cb'}
              />
              <text
                className={hot ? 'dg-briefing-lollipop-val is-hot' : 'dg-briefing-lollipop-val'}
                x={194}
                y={y + 4}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HourChart({ data }: { data: DgDayBriefingData }) {
  const peak = Math.max(1, ...data.hours.map((h) => Math.max(h.appointments, h.rooms)));
  return (
    <div className="dg-briefing-hours" role="img" aria-label="Charge horaire de 8 h à 17 h">
      {data.hours.map((bucket) => {
        const apptH = Math.max(6, Math.round((bucket.appointments / peak) * 100));
        const roomH = Math.max(6, Math.round((bucket.rooms / peak) * 100));
        return (
          <div
            key={bucket.hour}
            className={cn('dg-briefing-hour', bucket.now && 'is-now')}
            title={`${bucket.label} · ${bucket.appointments} RDV · ${bucket.rooms} salle`}
          >
            <div className="dg-briefing-hour-cols">
              {bucket.appointments > 0 ? (
                <span
                  className="dg-briefing-col dg-briefing-col--rdv"
                  style={{ height: `${apptH}%` }}
                />
              ) : null}
              {bucket.rooms > 0 ? (
                <span
                  className="dg-briefing-col dg-briefing-col--room"
                  style={{ height: `${roomH}%` }}
                />
              ) : null}
            </div>
            <span className="dg-briefing-hour-label">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DgDayBriefing({ data }: { data: DgDayBriefingData }) {
  const situation = situationLine(data);
  const hours = data.hours ?? [];
  const weekdays = data.weekdays ?? [];
  const mailSlices = data.mailSlices ?? [];
  const weekPeak = Math.max(1, ...weekdays.map((d) => d.count));

  return (
    <section className="dg-briefing" aria-label="Synthèse du jour">
      <header className="dg-briefing-head">
        <div className="dg-briefing-head-copy">
          <p className="dg-briefing-kicker">Synthèse du jour</p>
          <h2 className="dg-briefing-title">{data.dateLabel}</h2>
        </div>
        <div className="dg-briefing-head-actions">
          <Link href="/dg/fiche-jour" className="dg-briefing-sheet-link">
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Fiche du jour
          </Link>
          <p className={cn('dg-briefing-situation', situation.urgent && 'is-urgent')}>
            <span className="dg-briefing-pulse" aria-hidden />
            {situation.text}
          </p>
        </div>
      </header>

      <div className="dg-briefing-viz">
        <article className="dg-briefing-panel">
          <div className="dg-briefing-panel-head">
            <div>
              <p className="dg-briefing-panel-kicker">Charge horaire</p>
              <h3>Agenda 8 h – 17 h</h3>
            </div>
            <div className="dg-briefing-keys">
              <span>
                <i className="is-rdv" /> RDV
              </span>
              <span>
                <i className="is-room" /> Salles
              </span>
            </div>
          </div>
          <HourChart data={{ ...data, hours }} />
        </article>

        <article className="dg-briefing-panel">
          <div className="dg-briefing-panel-head">
            <div>
              <p className="dg-briefing-panel-kicker">Comparaison</p>
              <h3>Charge du jour</h3>
            </div>
            <span className="dg-briefing-total">
              {MIX.reduce((sum, item) => sum + mixValues(data)[item.key], 0)} actifs
            </span>
          </div>
          <MixLollipop data={data} />
        </article>
      </div>

      <div className="dg-briefing-strip">
        <article className="dg-briefing-spark">
          <div className="dg-briefing-spark-head">
            <span>Semaine</span>
            <b>{weekdays.reduce((sum, d) => sum + d.count, 0)} RDV</b>
          </div>
          <div className="dg-briefing-week">
            {weekdays.map((day) => (
              <div key={day.key} className={cn('dg-briefing-week-col', day.today && 'is-today')}>
                <span
                  className="dg-briefing-week-bar"
                  style={{ height: `${Math.max(10, (day.count / weekPeak) * 100)}%` }}
                  data-empty={day.count === 0 ? 'true' : 'false'}
                />
                <em>{day.label}</em>
              </div>
            ))}
          </div>
          <div className="dg-briefing-week-extra">
            <div className="dg-briefing-load">
              <span>Charge planning</span>
              <span className="dg-briefing-load-track" aria-hidden>
                <span style={{ width: `${data.loadPercent ?? 0}%` }} />
              </span>
              <b>{data.loadPercent ?? 0}%</b>
            </div>
            <Link href="/dg/appointments" className="dg-briefing-pending">
              <span>En attente</span>
              <b>{data.pendingCount ?? 0}</b>
            </Link>
          </div>
        </article>

        <article className="dg-briefing-spark dg-briefing-spark--mail">
          <div className="dg-briefing-spark-head">
            <span>Circuit courriers</span>
            <b>{data.mailToProcess.count} ouverts</b>
          </div>
          {data.mailToProcess.count === 0 ? (
            <p className="dg-briefing-empty-line">File à jour</p>
          ) : (
            <ol className="dg-briefing-path" aria-label="Parcours du circuit courriers">
              {MAIL_PIPE.map((stage) => {
                const count = mailSlices.find((slice) => slice.key === stage.key)?.count ?? 0;
                return (
                  <li
                    key={stage.key}
                    className={cn('dg-briefing-path-step', `is-${stage.tone}`, count === 0 && 'is-empty')}
                  >
                    <span className="dg-briefing-path-dot">{count}</span>
                    <em>{stage.label}</em>
                  </li>
                );
              })}
            </ol>
          )}
        </article>
      </div>

      <nav className="dg-briefing-jump" aria-label="Accès rapide synthèse">
        <Link
          href="/appointments/calendar"
          className={cn(data.appointmentsToday.count > 0 && 'is-live')}
        >
          <span className="dg-briefing-jump-icon" aria-hidden>
            <Calendar className="h-3.5 w-3.5" />
          </span>
          <span className="dg-briefing-jump-copy">
            <em>Agenda</em>
            <strong>RDV</strong>
          </span>
          <b>{data.appointmentsToday.count}</b>
          <ArrowUpRight className="dg-briefing-jump-go" aria-hidden />
        </Link>
        <Link
          href="/dg/workspace/mail"
          className={cn(data.mailToProcess.count > 0 && 'is-action')}
        >
          <span className="dg-briefing-jump-icon" aria-hidden>
            <Mail className="h-3.5 w-3.5" />
          </span>
          <span className="dg-briefing-jump-copy">
            <em>Cabinet</em>
            <strong>Courriers</strong>
          </span>
          <b>{data.mailToProcess.count}</b>
          <ArrowUpRight className="dg-briefing-jump-go" aria-hidden />
        </Link>
        <Link
          href={DG_ROOM_AVAILABILITY_HREF}
          className={cn(data.roomsOccupied.count > 0 && 'is-live')}
        >
          <span className="dg-briefing-jump-icon" aria-hidden>
            <DoorOpen className="h-3.5 w-3.5" />
          </span>
          <span className="dg-briefing-jump-copy">
            <em>Salles</em>
            <strong>Occupées</strong>
          </span>
          <b>{data.roomsOccupied.count}</b>
          <ArrowUpRight className="dg-briefing-jump-go" aria-hidden />
        </Link>
      </nav>
    </section>
  );
}
