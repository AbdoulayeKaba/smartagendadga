'use client';

import { CalendarDays, MapPin, Printer, Video } from 'lucide-react';
import type { DgDaySheet } from '@/lib/services/dg-day-sheet';

export function DgDaySheetView({ sheet }: { sheet: DgDaySheet }) {
  const count = sheet.rows.length;
  const online = sheet.rows.filter((row) => row.modality === 'En ligne').length;
  const onsite = count - online;
  const span =
    count > 0 ? `${sheet.rows[0]?.start} – ${sheet.rows[count - 1]?.end}` : '—';

  return (
    <article className="dg-day-sheet">
      <header className="dg-day-sheet-mast">
        <div className="dg-day-sheet-brand">
          <span className="dg-day-sheet-mark" aria-hidden>
            DGA
          </span>
          <div className="dg-day-sheet-title">
            <p className="dg-day-sheet-kicker">Agenda</p>
            <h1>Fiche du jour</h1>
          </div>
          <p className="dg-day-sheet-date">{sheet.dateLabel}</p>
        </div>
        <button type="button" className="dg-day-sheet-print no-print" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Imprimer
        </button>
      </header>

      <ul className="dg-day-sheet-stats">
        <li>
          <b>{count}</b>
          <span>Validés</span>
        </li>
        <li>
          <b>{span}</b>
          <span>Amplitude</span>
        </li>
        <li>
          <b>{onsite}</b>
          <span>Présentiel</span>
        </li>
        <li>
          <b>{online}</b>
          <span>En ligne</span>
        </li>
      </ul>

      {count === 0 ? (
        <div className="dg-day-sheet-empty">
          <span className="dg-day-sheet-empty-icon" aria-hidden>
            <CalendarDays className="h-5 w-5" />
          </span>
          <strong>Journée sans créneau validé</strong>
          <p>Aucun rendez-vous confirmé n’est inscrit à l’agenda pour cette date.</p>
        </div>
      ) : (
        <ol className="dg-day-sheet-agenda">
          {sheet.rows.map((row) => {
            const online = row.modality === 'En ligne';
            const roomLabel = row.room === 'Non réservée' ? 'Salle non réservée' : row.room;
            return (
              <li key={row.id} className="dg-day-sheet-item">
                <time className="dg-day-sheet-slot" dateTime={`${row.start}/${row.end}`}>
                  <strong>{row.start}</strong>
                  <span>{row.end}</span>
                </time>
                <div className="dg-day-sheet-body">
                  <div className="dg-day-sheet-body-top">
                    <h2>{row.title}</h2>
                    <span className={online ? 'dg-day-sheet-badge is-online' : 'dg-day-sheet-badge is-onsite'}>
                      {online ? (
                        <Video className="h-3 w-3" aria-hidden />
                      ) : (
                        <MapPin className="h-3 w-3" aria-hidden />
                      )}
                      {row.modality}
                    </span>
                  </div>
                  <p className="dg-day-sheet-sub">
                    <span className="dg-day-sheet-avatar" aria-hidden>
                      {row.initials}
                    </span>
                    <span className="dg-day-sheet-name">{row.requester}</span>
                    <span className="dg-day-sheet-dot" aria-hidden>
                      ·
                    </span>
                    <span>{row.place}</span>
                    <span className="dg-day-sheet-dot" aria-hidden>
                      ·
                    </span>
                    <span>{roomLabel}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="dg-day-sheet-foot">
        <span>
          {count === 0
            ? 'Aucun créneau'
            : `${count} rendez-vous validé${count > 1 ? 's' : ''}`}
        </span>
        <span>Direction Générale · usage interne</span>
      </footer>
    </article>
  );
}
