'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Lightbulb } from 'lucide-react';
import { planningDurationLabel, type AppointmentPlanningForm } from '@/lib/dg/appointment-planning';
import {
  minSubmissionLeadNotice,
  type MinSubmissionLeadRule,
} from '@/lib/dg/min-submission-lead';

const TIPS = [
  'Précisez un objet explicite et un motif clair.',
  'Vérifiez la disponibilité du DGA avant de soumettre.',
  'Ajoutez les participants concernés.',
  'Réservez une salle si nécessaire.',
  'Joignez les documents utiles (ordre du jour, support…).',
] as const;

function hasPreview(form: AppointmentPlanningForm) {
  return Boolean(
    form.title.trim() ||
      form.description.trim() ||
      form.date ||
      form.motifRef ||
      form.participantUserIds.length ||
      form.externalParticipant
  );
}

export function ExternalPlanAside({
  form,
  minSubmissionLead,
}: {
  form: AppointmentPlanningForm;
  minSubmissionLead?: MinSubmissionLeadRule;
}) {
  const ready = hasPreview(form);
  const dateLabel = form.date
    ? format(new Date(`${form.date}T12:00:00`), 'EEEE d MMMM yyyy', { locale: fr })
    : null;
  const duration = form.allDay ? 'Journée entière' : planningDurationLabel(form.startTime, form.endTime);
  const lead = minSubmissionLead ? minSubmissionLeadNotice(minSubmissionLead) : null;
  const participantCount =
    form.participantUserIds.length + (form.externalParticipant ? 1 : 0);

  return (
    <aside className="ext-plan-aside" aria-label="Aide à la demande">
      <section className="ext-plan-card" aria-labelledby="ext-plan-preview-title">
        <header className="ext-plan-card-head">
          <span className="ext-plan-card-icon" aria-hidden>
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 id="ext-plan-preview-title">Aperçu du rendez-vous</h2>
            <p>Un récapitulatif se met à jour en temps réel.</p>
          </div>
        </header>
        {ready ? (
          <dl className="ext-plan-preview">
            <div>
              <dt>Objet</dt>
              <dd>{form.title.trim() || '—'}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>
                {form.meetingFormat === 'HYBRID'
                  ? 'Hybride'
                  : form.isOnlineMeeting
                    ? 'En ligne (Teams)'
                    : 'Présentiel'}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd className="capitalize">{dateLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>Horaire</dt>
              <dd>
                {form.allDay
                  ? 'Toute la journée'
                  : form.startTime && form.endTime
                    ? `${form.startTime} – ${form.endTime}${duration ? ` · ${duration}` : ''}`
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{participantCount > 0 ? String(participantCount) : '—'}</dd>
            </div>
            {form.urgencyLevel !== 'NORMAL' ? (
              <div>
                <dt>Urgence</dt>
                <dd>Demande urgente</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <div className="ext-plan-empty">
            <CalendarDays className="h-5 w-5" aria-hidden />
            <p>Aucune information pour le moment</p>
            <small>Renseignez les champs du formulaire pour voir l’aperçu de votre rendez-vous ici.</small>
          </div>
        )}
      </section>

      <section className="ext-plan-card ext-plan-card--tips" aria-labelledby="ext-plan-tips-title">
        <header className="ext-plan-card-head">
          <span className="ext-plan-card-icon ext-plan-card-icon--tips" aria-hidden>
            <Lightbulb className="h-4 w-4" />
          </span>
          <h2 id="ext-plan-tips-title">Bonnes pratiques</h2>
        </header>
        <ol className="ext-plan-tips">
          {TIPS.map((tip, index) => (
            <li key={tip}>
              <span aria-hidden>{index + 1}</span>
              {tip}
            </li>
          ))}
        </ol>
      </section>

      <section className="ext-plan-card ext-plan-card--warn" aria-labelledby="ext-plan-warn-title">
        <header className="ext-plan-card-head">
          <span className="ext-plan-card-icon ext-plan-card-icon--warn" aria-hidden>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <h2 id="ext-plan-warn-title">Points d’attention</h2>
        </header>
        <ul className="ext-plan-warn">
          <li>
            {lead ?? 'Un créneau trop proche est refusé, sauf urgence justifiée.'}
          </li>
          <li>Un créneau trop proche peut être refusé.</li>
          <li>En cas d’urgence, ajoutez une justification.</li>
          <li>Le rendez-vous n’apparaît sur l’agenda du DGA qu’après validation par l’assistante.</li>
        </ul>
      </section>
    </aside>
  );
}
