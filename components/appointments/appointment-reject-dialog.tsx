'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Loader2,
  Mail,
  UserRound,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_URGENCY_LABELS,
  appointmentUrgencyBadgeClass,
} from '@/lib/dg/appointments-review';
import { displayRequesterName } from '@/lib/dg/appointment-review-display';
import { formatDateLong, formatTimeRange } from '@/lib/datetime';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentReviewItem | null;
  loading?: boolean;
  onSubmit: (reason: string) => void | Promise<void>;
};

const btnCancel =
  'admin-appt-detail-btn inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-45';

const btnConfirm =
  'admin-appt-detail-btn inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-red-700 bg-red-600 px-3 text-xs font-semibold text-white transition-colors hover:border-red-800 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5';

export function AppointmentRejectDialog({
  open,
  onOpenChange,
  appointment,
  loading = false,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 3;
  const cancelling = appointment?.status === 'APPROVED';

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-theme admin-appt-reject-dialog admin-appt-reject-dialog--compact gap-0 border-[var(--admin-border)] p-0 sm:max-w-[27rem]">
        <header className="admin-appt-reject-header">
          <div className="admin-appt-reject-header-icon" aria-hidden>
            <X className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="admin-appt-reject-title">
              {cancelling ? 'Annuler le rendez-vous' : 'Refuser la demande'}
            </DialogTitle>
            <DialogDescription className="admin-appt-reject-subtitle">
              {cancelling
                ? 'Le rendez-vous validé sera retiré de l’agenda. Le demandeur sera notifié.'
                : 'Le motif sera communiqué au demandeur par notification'}
            </DialogDescription>
          </div>
        </header>

        <div className="admin-appt-reject-body">
          {appointment ? (
            <>
              <div className="admin-appt-reject-hero">
                <p className="admin-appt-reject-hero-title">{appointment.title}</p>
                <span
                  className={cn(
                    'admin-appt-badge',
                    appointmentUrgencyBadgeClass(appointment.urgencyLevel)
                  )}
                >
                  {APPOINTMENT_URGENCY_LABELS[appointment.urgencyLevel]}
                </span>
              </div>

              <div className="admin-appt-reject-slot">
                <Calendar className="admin-appt-reject-slot-icon" aria-hidden />
                <div className="min-w-0">
                  <p className="admin-appt-reject-slot-date capitalize">
                    {formatDateLong(appointment.startAt)}
                  </p>
                  <p className="admin-appt-reject-slot-time">
                    <Clock className="inline h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    <span>{formatTimeRange(appointment.startAt, appointment.endAt)}</span>
                  </p>
                </div>
              </div>

              <div className="admin-appt-reject-requester">
                <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                <span className="admin-appt-reject-requester-label">Demandeur</span>
                <span className="admin-appt-reject-requester-value">
                  {displayRequesterName(appointment)}
                </span>
              </div>

              <div className="admin-appt-reject-callout">
                <Mail className="admin-appt-reject-callout-icon" aria-hidden />
                <p>
                  Motif communiqué au demandeur pour{' '}
                  <span className="admin-appt-reject-callout-emphasis">
                    « {appointment.title} »
                  </span>
                  .
                </p>
              </div>
            </>
          ) : null}

          <section className="admin-appt-reject-form">
            <label htmlFor="reject-reason" className="admin-appt-reject-form-label">
              {cancelling ? 'Motif de l’annulation' : 'Motif du refus'}
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              className="admin-appt-reject-textarea"
              placeholder="Ex. créneau non disponible, dossier incomplet…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="admin-appt-reject-form-hint">
              {canSubmit ? 'Prêt à confirmer' : 'Minimum 3 caractères requis'}
            </p>
          </section>
        </div>

        <footer className="admin-appt-reject-footer">
          <button
            type="button"
            className={btnCancel}
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            className={btnConfirm}
            disabled={loading || !canSubmit}
            onClick={() => void onSubmit(trimmed)}
          >
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
            {cancelling ? 'Confirmer l’annulation' : 'Confirmer le refus'}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
