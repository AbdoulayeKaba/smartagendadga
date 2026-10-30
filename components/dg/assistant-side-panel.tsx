'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';

type PendingItem = {
  id: string;
  title: string;
  startAt: string;
  priority: string;
  requestedBy: { firstName: string; lastName: string };
};

type Props = {
  pending: PendingItem[];
};

export function AssistantSidePanel({ pending }: Props) {
  return (
    <div className="dg-assistant-side">
      <div className="dg-assistant-priority">
        <div className="dg-assistant-priority-head">
          <div>
            <p className="dg-assistant-priority-title">À valider en priorité</p>
            {pending.length > 0 ? (
              <p className="dg-assistant-priority-meta">
                {pending.length} rendez-vous ultra urgent{pending.length > 1 ? 's' : ''} aujourd’hui
              </p>
            ) : null}
          </div>
          <Link href="/dg/appointments" className="dg-assistant-priority-link">
            Tout voir
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="dg-assistant-priority-empty">Aucun rendez-vous ultra urgent aujourd’hui.</p>
        ) : (
          <ul className="dg-assistant-priority-list">
            {pending.map((p) => (
              <li key={p.id}>
                <Link href="/dg/appointments" className="dg-assistant-priority-item">
                  <AlertCircle className="dg-assistant-priority-item-icon" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="truncate text-muted-foreground">
                      {p.requestedBy.firstName} {p.requestedBy.lastName}
                      {' · '}
                      {format(new Date(p.startAt), 'd MMM · HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <span className="dg-assistant-priority-badge dg-assistant-priority-badge--high">
                    Ultra
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
