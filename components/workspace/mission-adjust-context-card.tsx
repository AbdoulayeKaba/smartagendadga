'use client';

import { CalendarClock, MapPin } from 'lucide-react';

type Props = {
  subject: string;
  destination?: string | null;
  returnLabel: string;
};

export function MissionAdjustContextCard({ subject, destination, returnLabel }: Props) {
  return (
    <div className="mission-adjust-context">
      <p className="mission-adjust-context-subject">{subject}</p>
      <dl className="mission-adjust-context-meta">
        {destination ? (
          <div className="mission-adjust-context-meta-row">
            <MapPin className="mission-adjust-context-meta-icon" aria-hidden />
            <dd className="mission-adjust-context-meta-value">{destination}</dd>
          </div>
        ) : null}
        <div className="mission-adjust-context-meta-row">
          <CalendarClock className="mission-adjust-context-meta-icon" aria-hidden />
          <dd className="mission-adjust-context-meta-value">
            Retour <strong>{returnLabel}</strong>
          </dd>
        </div>
      </dl>
    </div>
  );
}
