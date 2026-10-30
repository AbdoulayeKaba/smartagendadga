'use client';

import { Check, Loader2, Pencil, RefreshCw, X } from 'lucide-react';

type Props = {
  loading?: boolean;
  disabled?: boolean;
  canEdit?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onEdit?: () => void;
};

export function ContactAppointmentPendingActions({
  loading = false,
  disabled = false,
  canEdit = false,
  onApprove,
  onReject,
  onReschedule,
  onEdit,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <div className="workspace-contact-rdv-pending-actions" role="group" aria-label="Actions sur le rendez-vous">
      <button
        type="button"
        className="admin-appt-action-btn admin-appt-action-btn--approve"
        disabled={isDisabled}
        title="Valider le rendez-vous"
        aria-label="Valider le rendez-vous"
        onClick={onApprove}
      >
        {loading ? (
          <Loader2 className="admin-appt-action-icon animate-spin" aria-hidden />
        ) : (
          <Check className="admin-appt-action-icon" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="admin-appt-action-btn admin-appt-action-btn--reschedule"
        disabled={isDisabled}
        title="Replanifier"
        aria-label="Replanifier le rendez-vous"
        onClick={onReschedule}
      >
        <RefreshCw className="admin-appt-action-icon" aria-hidden />
      </button>
      {canEdit && onEdit ? (
        <button
          type="button"
          className="admin-appt-action-btn admin-appt-action-btn--edit"
          disabled={isDisabled}
          title="Modifier"
          aria-label="Modifier le rendez-vous"
          onClick={onEdit}
        >
          <Pencil className="admin-appt-action-icon" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="admin-appt-action-btn admin-appt-action-btn--reject"
        disabled={isDisabled}
        title="Refuser"
        aria-label="Refuser le rendez-vous"
        onClick={onReject}
      >
        <X className="admin-appt-action-icon" aria-hidden />
      </button>
    </div>
  );
}
