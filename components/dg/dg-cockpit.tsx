import Link from 'next/link';
import { CalendarClock, CalendarDays } from 'lucide-react';
import type { CockpitAgendaItem, DgCockpitData } from '@/lib/dg/dg-cockpit';

function readRange(timeLabel: string): { start: number; end: number } | null {
  const match = timeLabel.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) return null;
  return { start, end };
}

function hourLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}h`;
}

function layoutTrack(
  items: CockpitAgendaItem[],
  axisStart: number,
  span: number
) {
  const placed = items
    .map((item) => {
      const range = readRange(item.timeLabel);
      return range ? { item, ...range } : null;
    })
    .filter((entry): entry is { item: CockpitAgendaItem; start: number; end: number } => entry !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const rowEnds: number[] = [];
  return {
    placed,
    blocks: placed.map((entry, index) => {
      let row = rowEnds.findIndex((end) => end <= entry.start);
      if (row < 0) {
        row = rowEnds.length;
        rowEnds.push(entry.end);
      } else {
        rowEnds[row] = entry.end;
      }
      const left = ((Math.max(entry.start, axisStart) - axisStart) / span) * 100;
      const width = ((entry.end - entry.start) / span) * 100;
      return {
        ...entry,
        index: index + 1,
        row,
        left,
        width: Math.max(2.2, Math.min(width, 100 - left)),
        showTitle: width >= 12,
      };
    }),
    rows: Math.max(rowEnds.length, 1),
  };
}

function DayBoard({
  appointments,
  rooms,
}: {
  appointments: CockpitAgendaItem[];
  rooms: CockpitAgendaItem[];
}) {
  const ranges = [...appointments, ...rooms]
    .map((item) => readRange(item.timeLabel))
    .filter((range): range is { start: number; end: number } => range !== null);
  const axisStart =
    Math.floor(Math.min(8 * 60, ...ranges.map((range) => range.start), 8 * 60) / 60) * 60;
  const axisEnd =
    Math.ceil(Math.max(18 * 60, ...ranges.map((range) => range.end), 18 * 60) / 60) * 60;
  const span = Math.max(60, axisEnd - axisStart);
  const agenda = layoutTrack(appointments, axisStart, span);
  const salles = layoutTrack(rooms, axisStart, span);
  const marks: number[] = [];
  for (let minute = axisStart; minute <= axisEnd; minute += 60) marks.push(minute);

  return (
    <section className="dg-cockpit-card dg-frise-card">
      <header className="dg-cockpit-card-head">
        <h2>Journée du Directeur général adjoint</h2>
        <span className="dg-cockpit-count">
          {agenda.placed.length} rendez-vous · {salles.placed.length} salle
          {salles.placed.length > 1 ? 's' : ''}
        </span>
      </header>
      <div className="dg-frise" role="img" aria-label="Journée du DGA, agenda et réservations de salles">
        <div className="dg-lane dg-lane--ruler">
          <span className="dg-lane-name" aria-hidden />
          <div className="dg-frise-axis">
            {marks.map((minute, index) => {
              const labeled = index === 0 || minute % 120 === 0 || index === marks.length - 1;
              return (
                <span
                  key={minute}
                  className={labeled ? 'is-label' : 'is-tick'}
                  style={{ left: `${((minute - axisStart) / span) * 100}%` }}
                >
                  {labeled ? hourLabel(minute) : ''}
                </span>
              );
            })}
          </div>
        </div>
        <Track name="Agenda" lane="agenda" rows={agenda.rows} marks={marks} axisStart={axisStart} span={span} blocks={agenda.blocks} />
        <Track name="Salles" lane="salle" rows={salles.rows} marks={marks} axisStart={axisStart} span={span} blocks={salles.blocks} />
      </div>
      <ul className="dg-frise-legend">
        <li><i className="is-presentiel" /> Présentiel</li>
        <li><i className="is-ligne" /> En ligne</li>
        <li><i className="is-salle" /> Salle</li>
      </ul>
      <div className="dg-day-split">
        <ReadingList title="Rendez-vous" tone="rdv" items={agenda.placed.map((entry) => entry.item)} />
        <ReadingList title="Réservations de salles" tone="salle" items={salles.placed.map((entry) => entry.item)} />
      </div>
    </section>
  );
}

function blockTone(item: CockpitAgendaItem, lane: 'agenda' | 'salle') {
  if (lane === 'salle') return 'salle';
  return item.kind === 'reunion' ? 'ligne' : 'presentiel';
}

function Track({
  name,
  lane,
  rows,
  marks,
  axisStart,
  span,
  blocks,
}: {
  name: string;
  lane: 'agenda' | 'salle';
  rows: number;
  marks: number[];
  axisStart: number;
  span: number;
  blocks: Array<{
    item: CockpitAgendaItem;
    index: number;
    row: number;
    left: number;
    width: number;
    showTitle: boolean;
  }>;
}) {
  return (
    <div className={`dg-lane dg-lane--${lane}`}>
      <span className="dg-lane-name">{name}</span>
      <div className="dg-lane-track" style={{ height: `${rows * 1.7 + 0.45}rem` }}>
        {marks.map((minute) => (
          <i
            key={minute}
            className="dg-hour-line"
            style={{ left: `${((minute - axisStart) / span) * 100}%` }}
          />
        ))}
        {blocks.map((block) => (
          <Link
            key={block.item.id}
            href={block.item.href}
            className={`dg-frise-block dg-frise-block--${blockTone(block.item, lane)}`}
            style={{
              left: `${block.left}%`,
              width: `${block.width}%`,
              top: `${block.row * 1.7 + 0.22}rem`,
            }}
            title={`${block.item.timeLabel} · ${block.item.title}${block.item.place ? ` · ${block.item.place}` : ''}`}
          >
            <em>{block.index}</em>
            {block.showTitle ? <span>{block.item.title}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReadingList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'rdv' | 'salle';
  items: CockpitAgendaItem[];
}) {
  return (
    <div>
      <h3 className={`dg-day-kicker dg-day-kicker--${tone}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="dg-cockpit-empty">
          {tone === 'salle' ? 'Aucune réservation de salle aujourd’hui.' : 'Aucun rendez-vous aujourd’hui.'}
        </p>
      ) : (
        <ol className="dg-day-index">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link href={item.href}>
                <em className={`dg-day-num dg-day-num--${tone === 'salle' ? 'salle' : item.kind === 'reunion' ? 'ligne' : 'presentiel'}`}>{index + 1}</em>
                <time>{item.timeLabel}</time>
                <span>
                  <strong>{item.title}</strong>
                  <small>{tone === 'salle' ? item.meta : item.place}</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function DgCockpit({
  data,
  agendaOpen = false,
  onToggleAgenda,
}: {
  data: DgCockpitData;
  agendaOpen?: boolean;
  onToggleAgenda?: () => void;
}) {
  const appointments = data.agenda.filter((item) => item.lane === 'agenda' && item.kind !== 'free' && item.kind !== 'mission');
  const rooms = data.agenda.filter((item) => item.lane === 'salle');
  const upcoming = data.upcoming.filter((item) => !item.href.includes('/missions'));

  return (
    <div className="dg-cockpit dg-cockpit--simple">
      <header className="dg-cockpit-top">
        <div>
          <h1 className="dg-cockpit-hello">{data.greeting}</h1>
          <p className="dg-cockpit-lead">Agenda du Directeur général adjoint</p>
        </div>
        <div className="dg-cockpit-top-actions">
          {onToggleAgenda ? (
            <button
              type="button"
              className={agendaOpen ? 'dg-dga-agenda-toggle is-open' : 'dg-dga-agenda-toggle'}
              aria-expanded={agendaOpen}
              aria-controls="dg-dga-agenda-panel"
              onClick={onToggleAgenda}
            >
              <CalendarDays aria-hidden />
              <span>{agendaOpen ? 'Masquer' : 'Agenda'}</span>
            </button>
          ) : null}
          <span className="dg-cockpit-date">
            <CalendarDays aria-hidden />
            {data.dateLabel}
          </span>
          <Link
            href={data.focus.href}
            className={`dg-cockpit-now dg-cockpit-now--${data.focus.state}`}
          >
            <span className="dg-cockpit-now-dot" aria-hidden />
            <span className="dg-cockpit-now-copy">
              <small>
                {data.focus.state === 'ongoing'
                  ? 'En cours'
                  : data.focus.state === 'next'
                    ? 'Prochain'
                    : 'Aujourd’hui'}
              </small>
              <strong>{data.focus.title}</strong>
            </span>
            {data.focus.timeLabel ? <time>{data.focus.timeLabel}</time> : null}
          </Link>
        </div>
      </header>

      <DayBoard appointments={appointments} rooms={rooms} />

      <section className="dg-cockpit-card">
        <header className="dg-cockpit-card-head">
          <h2>
            <CalendarClock aria-hidden /> Ensuite
          </h2>
          {onToggleAgenda ? (
            <button
              type="button"
              className={
                agendaOpen
                  ? 'dg-dga-agenda-toggle dg-dga-agenda-toggle--inline is-open'
                  : 'dg-dga-agenda-toggle dg-dga-agenda-toggle--inline'
              }
              aria-expanded={agendaOpen}
              aria-controls="dg-dga-agenda-panel"
              onClick={onToggleAgenda}
            >
              {agendaOpen ? 'Masquer' : 'Agenda'}
            </button>
          ) : (
            <Link href={data.upcomingHref}>Agenda</Link>
          )}
        </header>
        {upcoming.length === 0 ? (
          <p className="dg-cockpit-empty">Rien de prévu dans les prochains jours.</p>
        ) : (
          <ul className="dg-cockpit-upcoming dg-cockpit-upcoming--row">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link href={item.href}>
                  <span className="dg-cockpit-up-date">
                    <strong>{item.day}</strong>
                    <small>{item.month}</small>
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
