'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  Clock,
  LayoutList,
  Loader2,
  MapPin,
  ShieldCheck,
  Tag,
  UserRound,
  Video,
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
import {
  DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES,
  isPendingAppointmentExpired,
} from '@/lib/dg/appointment-expiry';
import {
  displayAppointmentModality,
  displayAppointmentType,
  displayLocation,
  displayMotif,
  displayRequesterContactLine,
  displayRequesterName,
} from '@/lib/dg/appointment-review-display';
import { formatDateLong, formatTimeRange } from '@/lib/datetime';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentReviewItem | null;
  loading?: boolean;
  /** Délai référentiel (min avant le début). Si omis, chargé via /api/appointments/constraints. */
  autoRejectBeforeStartMinutes?: number;
  onConfirm: () => void | Promise<void>;
};

const approveBtnCancel =
  'admin-appt-detail-btn inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[0.6875rem] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-45';

const approveBtnConfirm =
  'admin-appt-detail-btn inline-flex h-7 items-center justify-center gap-1 rounded-md border border-emerald-700 bg-emerald-600 px-2.5 text-[0.6875rem] font-semibold text-white transition-colors hover:border-emerald-800 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3';

function formatLeadLabel(minutes: number): string {
  if (minutes <= 0) return 'désactivé';
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} h avant le début`;
  }
  return `${minutes} min avant le début`;
}

export function AppointmentApproveDialog({
  open,
  onOpenChange,
  appointment,
  loading = false,
  autoRejectBeforeStartMinutes,
  onConfirm,
}: Props) {
  const [leadMinutes, setLeadMinutes] = useState(
    autoRejectBeforeStartMinutes ?? DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES
  );

  useEffect(() => {
    if (typeof autoRejectBeforeStartMinutes === 'number') {
      setLeadMinutes(autoRejectBeforeStartMinutes);
      return;
    }
    if (!open) return;
    let cancelled = false;
    void fetch('/api/appointments/constraints')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const minutes = j?.scheduling?.autoRejectBeforeStartMinutes;
        if (typeof minutes === 'number' && Number.isFinite(minutes)) {
          setLeadMinutes(Math.max(0, Math.trunc(minutes)));
        }
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, [open, autoRejectBeforeStartMinutes]);

  const slotExpired =
    appointment != null &&
    isPendingAppointmentExpired(appointment.status, appointment.startAt, new Date(), leadMinutes);

  const modality = appointment ? displayAppointmentModality(appointment) : null;
  const ModalityIcon = modality?.online ? Video : Building2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="admin-theme admin-appt-approve-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[22rem]"
        onPointerDownOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.app-toast, .app-toast-viewport, [data-slot="dialog-content"]')) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.app-toast, .app-toast-viewport, [data-slot="dialog-content"]')) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.app-toast, .app-toast-viewport, [data-slot="dialog-content"]')) {
            event.preventDefault();
          }
        }}
      >
        <header className="admin-appt-approve-header">
          <div className="admin-appt-approve-header-icon" aria-hidden>
            <Check className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="admin-appt-approve-title">Confirmer l&apos;approbation</DialogTitle>
            <DialogDescription className="admin-appt-approve-subtitle">
              Validation définitive du créneau demandé
            </DialogDescription>
          </div>
        </header>

        {appointment ? (
          <div className="admin-appt-approve-body">
            <div className="admin-appt-approve-hero">
              <p className="admin-appt-approve-hero-title">{appointment.title}</p>
              <span
                className={cn(
                  'admin-appt-badge',
                  appointmentUrgencyBadgeClass(appointment.urgencyLevel)
                )}
              >
                {APPOINTMENT_URGENCY_LABELS[appointment.urgencyLevel]}
              </span>
            </div>

            <div className="admin-appt-approve-slot">
              <Calendar className="admin-appt-approve-slot-icon" aria-hidden />
              <p className="admin-appt-approve-slot-line">
                <span className="admin-appt-approve-slot-date capitalize">
                  {formatDateLong(appointment.startAt)}
                </span>
                <span className="admin-appt-approve-slot-time">
                  <Clock className="inline h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  <span>{formatTimeRange(appointment.startAt, appointment.endAt)}</span>
                </span>
              </p>
            </div>

            <div className="admin-appt-approve-meta-grid">
              <div className="admin-appt-approve-meta-item">
                <span className="admin-appt-approve-meta-label">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  Demandeur
                </span>
                <span className="admin-appt-approve-meta-value">{displayRequesterName(appointment)}</span>
                {appointment.requesterPhone || appointment.requesterEmail ? (
                  <span className="admin-appt-approve-meta-sub">
                    {displayRequesterContactLine(appointment)}
                  </span>
                ) : null}
              </div>
              <div className="admin-appt-approve-meta-item">
                <span className="admin-appt-approve-meta-label">
                  <ModalityIcon className="h-3.5 w-3.5" aria-hidden />
                  Choix
                </span>
                <span className="admin-appt-approve-meta-value">
                  {modality ? `${modality.label} · ${modality.hint}` : '—'}
                </span>
              </div>
              <div className="admin-appt-approve-meta-item">
                <span className="admin-appt-approve-meta-label">
                  <LayoutList className="h-3.5 w-3.5" aria-hidden />
                  Type
                </span>
                <span className="admin-appt-approve-meta-value">
                  {displayAppointmentType(appointment)}
                </span>
              </div>
              <div className="admin-appt-approve-meta-item">
                <span className="admin-appt-approve-meta-label">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Emplacement
                </span>
                <span className="admin-appt-approve-meta-value">{displayLocation(appointment)}</span>
              </div>
              <div className="admin-appt-approve-meta-item">
                <span className="admin-appt-approve-meta-label">
                  <Tag className="h-3.5 w-3.5" aria-hidden />
                  Motif
                </span>
                <span className="admin-appt-approve-meta-value">{displayMotif(appointment)}</span>
              </div>
            </div>

            {slotExpired ? (
              <div className="admin-appt-approve-warning" role="alert">
                Le délai de validation est dépassé ({formatLeadLabel(leadMinutes)}). Cette demande ne
                peut plus être approuvée et sera refusée automatiquement.
              </div>
            ) : (
              <div className="admin-appt-approve-callout">
                <ShieldCheck className="admin-appt-approve-callout-icon" aria-hidden />
                <p>
                  Le rendez-vous sera ajouté à l&apos;agenda du DGA. Le demandeur et les participants
                  seront notifiés par e-mail.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <footer className="admin-appt-approve-footer">
          <button
            type="button"
            className={approveBtnCancel}
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            className={approveBtnConfirm}
            disabled={loading || slotExpired}
            onClick={() => void onConfirm()}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Check aria-hidden />}
            Approuver le rendez-vous
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
