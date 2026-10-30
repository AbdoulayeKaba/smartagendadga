'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AppointmentPlanningFields } from '@/components/appointments/appointment-planning-fields';
import { useAppointmentPlanning } from '@/hooks/use-appointment-planning';
import { urgencyRequiresJustification } from '@/lib/dg/appointment-business-rules';
import { cn } from '@/lib/utils';

export type AppointmentPlanningDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** yyyy-MM-dd */
  defaultDate?: string;
  onSuccess?: () => void;
};

export function AppointmentPlanningDialog({
  open,
  onOpenChange,
  defaultDate,
  onSuccess,
}: AppointmentPlanningDialogProps) {
  const {
    form,
    setForm,
    loading,
    titleError,
    titleDuplicateBlocked,
    roomAvailabilityError,
    dateError,
    slotError,
    formError,
    schedulingContext,
    urgencyJustificationRule,
    minSubmissionLead,
    urgentAllowed,
    checkConflict,
    submit,
    resetForm,
    handleTitleDuplicate,
  } = useAppointmentPlanning();

  useEffect(() => {
    if (!open) return;
    resetForm({ date: defaultDate ?? format(new Date(), 'yyyy-MM-dd') });
  }, [open, defaultDate, resetForm]);

  const dateLabel = form.date
    ? format(new Date(`${form.date}T12:00:00`), 'EEE d MMM yyyy', { locale: fr })
    : null;

  const showJustificationError =
    urgencyJustificationRule != null &&
    urgencyRequiresJustification(urgencyJustificationRule, form.urgencyLevel);

  const submitDisabled =
    loading ||
    titleDuplicateBlocked ||
    Boolean(titleError) ||
    Boolean(roomAvailabilityError) ||
    Boolean(dateError) ||
    Boolean(slotError) ||
    !form.title.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'admin-theme rdv-plan-dialog--compact gap-0 border-[var(--admin-border)] p-0 sm:max-w-[32rem]'
        )}
      >
        <header className="rdv-plan-dialog-header">
          <div className="rdv-plan-dialog-header-icon" aria-hidden>
            <CalendarPlus className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <DialogTitle className="rdv-plan-dialog-title">Planifier un rendez-vous</DialogTitle>
              {dateLabel ? (
                <span className="rdv-plan-dialog-date-badge capitalize">{dateLabel}</span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="rdv-plan-dialog-body">
          <AppointmentPlanningFields
            variant="dialog"
            form={form}
            onChange={setForm}
            onBlurCheckConflict={() => void checkConflict()}
            titleError={titleError}
            dateError={dateError}
            slotError={slotError}
            schedulingContext={schedulingContext}
            urgencyJustificationRule={urgencyJustificationRule}
            minSubmissionLead={minSubmissionLead}
            justificationError={showJustificationError ? formError : null}
            urgentAllowed={urgentAllowed}
            onTitleDuplicate={handleTitleDuplicate}
            idPrefix="rdv-plan"
            classNames={{ input: 'dg-plan-input', select: 'dg-plan-select' }}
          />
          {formError && !showJustificationError ? (
            <p className="rdv-plan-dialog-error">{formError}</p>
          ) : null}
        </div>

        <footer className="rdv-plan-dialog-footer">
          <button
            type="button"
            className="admin-btn-cancel"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-create"
            disabled={submitDisabled}
            onClick={() =>
              void submit({
                onSuccess: () => {
                  onOpenChange(false);
                  onSuccess?.();
                },
              })
            }
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Soumettre
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
