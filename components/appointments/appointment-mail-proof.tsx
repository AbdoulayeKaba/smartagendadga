'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Clock, Mail, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fetchJson } from '@/lib/fetch-with-timeout';
import type { AppointmentMailProofLine } from '@/lib/dg/appointment-mail-proof';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

function formatProofAt(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'd MMM HH:mm', { locale: fr });
}

function proofSummary(lines: AppointmentMailProofLine[]) {
  const sent = lines.filter((line) => line.status === 'sent').length;
  if (sent === 0) return 'Aucun envoi';
  if (sent === 1) return '1 envoi';
  return `${sent} envois`;
}

export function AppointmentMailProof({ appointmentId }: { appointmentId: string }) {
  const [lines, setLines] = useState<AppointmentMailProofLine[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setLines(null);
    let cancelled = false;
    void fetchJson<{ items: AppointmentMailProofLine[] }>(
      `/api/appointments/${appointmentId}/mail-proof`
    ).then((res) => {
      if (cancelled) return;
      setLines(res.ok ? res.data.items ?? [] : []);
    });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (lines === null) {
    return (
      <section className="admin-appt-mail-proof" aria-busy="true">
        <p className="admin-appt-detail-label">
          <Mail className="admin-appt-detail-label-icon" aria-hidden />
          Preuve de notification
        </p>
        <p className="admin-appt-mail-proof-loading">Vérification des envois…</p>
      </section>
    );
  }

  if (lines.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="admin-appt-mail-proof">
      <CollapsibleTrigger className="admin-appt-mail-proof-trigger" type="button">
        <span className="admin-appt-detail-label">
          <Mail className="admin-appt-detail-label-icon" aria-hidden />
          Preuve de notification
        </span>
        <span className="admin-appt-mail-proof-summary">{proofSummary(lines)}</span>
        <ChevronDown
          className={cn('admin-appt-mail-proof-chevron', open && 'is-open')}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="admin-appt-mail-proof-list">
          {lines.map((line) => {
            const at = formatProofAt(line.at);
            return (
              <li
                key={line.kind}
                className={cn('admin-appt-mail-proof-item', `is-${line.status}`)}
              >
                <span className="admin-appt-mail-proof-icon" aria-hidden>
                  {line.status === 'sent' ? (
                    <Check className="h-3 w-3" />
                  ) : line.status === 'scheduled' ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                </span>
                <span className="admin-appt-mail-proof-copy">
                  <strong>{line.label}</strong>
                  <span>
                    {line.status === 'scheduled' && at
                      ? `${line.detail} ${at}`
                      : line.status === 'sent' && at
                        ? `Envoyé le ${at}`
                        : line.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
