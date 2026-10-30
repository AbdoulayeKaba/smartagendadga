'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { APPOINTMENT_URGENCY_LABELS } from '@/lib/dg/appointments-review';
import { planningDurationLabel, type AppointmentPlanningForm } from '@/lib/dg/appointment-planning';
import { cn } from '@/lib/utils';

function formatMeta(form: AppointmentPlanningForm) {
  if (form.meetingFormat === 'ONLINE') return { label: 'En ligne', tone: 'online' as const };
  if (form.meetingFormat === 'HYBRID') return { label: 'Hybride', tone: 'hybrid' as const };
  return { label: 'Présentiel', tone: 'onsite' as const };
}

export function AppointmentPlanningBestPractices({ form }: { form: AppointmentPlanningForm }) {
  const title = form.title.trim();
  const modality = formatMeta(form);
  const dateLabel = form.date
    ? format(new Date(`${form.date}T12:00:00`), 'EEE d MMM', { locale: fr })
    : '';
  const duration = planningDurationLabel(form.startTime, form.endTime);
  const timeLabel =
    form.startTime && form.endTime
      ? `${form.startTime}–${form.endTime}${duration ? ` · ${duration}` : ''}`
      : '';
  const requester = form.requesterContactEnabled ? form.requesterFullName.trim() : '';
  const urgency = form.urgencyLevel.toLowerCase();

  return (
    <aside className="dg-plan-live" aria-labelledby="dg-plan-live-title" aria-live="polite">
      <header className="dg-plan-live__head">
        <span className="dg-plan-live__pulse" aria-hidden />
        <h2 id="dg-plan-live-title" className="dg-plan-live__title">
          Aperçu en direct
        </h2>
      </header>

      <p className={cn('dg-plan-live__object', !title && 'is-empty')}>{title || 'Sans objet'}</p>

      <div className="dg-plan-live__chips">
        <span className={cn('dg-plan-live__chip', `dg-plan-live__chip--${modality.tone}`)}>
          {modality.label}
        </span>
        <span className={cn('dg-plan-live__chip', `dg-plan-live__chip--${urgency}`)}>
          {APPOINTMENT_URGENCY_LABELS[form.urgencyLevel]}
        </span>
      </div>

      <dl className="dg-plan-live__rows">
        <div>
          <dt>Créneau</dt>
          <dd className={cn(!dateLabel && !timeLabel && 'is-empty')}>
            {dateLabel || timeLabel ? (
              <>
                {dateLabel ? <span className="dg-plan-live__date">{dateLabel}</span> : null}
                {timeLabel ? <span className="dg-plan-live__time">{timeLabel}</span> : null}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Demandeur</dt>
          <dd className={cn(!requester && 'is-empty')}>{requester || '—'}</dd>
        </div>
      </dl>
    </aside>
  );
}
