'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentPlanningFields } from '@/components/appointments/appointment-planning-fields';
import { AppointmentPlanningBestPractices } from '@/components/appointments/appointment-planning-best-practices';
import { ExternalPlanAside } from '@/components/appointments/external-plan-aside';
import { useAppointmentPlanning } from '@/hooks/use-appointment-planning';
import { urgencyRequiresJustification } from '@/lib/dg/appointment-business-rules';
import type { PlanningInitial } from '@/lib/dg/appointment-planning';

export type { PlanningInitial };

export function AppointmentPlanningPanel({
  initial,
  onSuccess,
  compact = false,
  layout = 'default',
}: {
  initial?: PlanningInitial;
  onSuccess?: () => void;
  compact?: boolean;
  layout?: 'default' | 'external';
}) {
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
    role,
    isEditMode,
    checkConflict,
    submit,
    resetForm,
    handleTitleDuplicate,
  } = useAppointmentPlanning(initial);

  useEffect(() => {
    resetForm(initial);
  }, [initial?.editId, initial?.date, initial?.startTime, initial?.endTime, resetForm, initial]);

  const dateLabel = form.date
    ? format(new Date(`${form.date}T12:00:00`), 'EEEE d MMMM yyyy', { locale: fr })
    : null;

  const showJustificationError =
    urgencyJustificationRule != null &&
    urgencyRequiresJustification(urgencyJustificationRule, form.urgencyLevel);

  const fields = (
    <>
      <AppointmentPlanningFields
        compact={compact}
        presentation={layout === 'external' ? 'external' : 'default'}
        urgentAllowed={layout === 'external' ? urgentAllowed : false}
        form={form}
        onChange={setForm}
        onBlurCheckConflict={() => void checkConflict()}
        titleError={titleError}
        dateError={dateError}
        slotError={slotError}
        schedulingContext={schedulingContext}
        justificationError={showJustificationError ? formError : null}
        urgencyJustificationRule={urgencyJustificationRule}
        minSubmissionLead={minSubmissionLead}
        excludeAppointmentId={initial?.editId ?? null}
        onTitleDuplicate={handleTitleDuplicate}
        notifyDg={role === 'ASSISTANT' && !isEditMode}
        classNames={
          compact
            ? { input: 'dg-plan-input', select: 'dg-plan-select' }
            : { input: 'admin-settings-input', select: 'admin-settings-input mt-1 h-10 w-full' }
        }
      />
      {formError && !showJustificationError ? (
        <p className={compact ? 'dg-plan-conflict' : 'text-sm text-destructive'}>{formError}</p>
      ) : roomAvailabilityError ? (
        <p className={compact ? 'dg-plan-conflict' : 'text-sm text-destructive'}>{roomAvailabilityError}</p>
      ) : null}

      <Button
        id="plan-step-submit"
        type="button"
        className={compact ? 'admin-btn-primary dg-plan-submit' : 'admin-btn-primary w-full sm:w-auto'}
        onClick={() => void submit({ onSuccess })}
        disabled={
          loading ||
          titleDuplicateBlocked ||
          Boolean(titleError) ||
          Boolean(roomAvailabilityError) ||
          Boolean(dateError) ||
          Boolean(slotError) ||
          !form.title.trim()
        }
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {isEditMode ? 'Enregistrer les modifications' : 'Soumettre pour validation'}
      </Button>
    </>
  );

  if (layout === 'external') {
    return (
      <div className="ext-plan">
        <div className="ext-plan-grid">
          <div className="admin-appt-toolbar dg-plan-panel ext-plan-form space-y-2">{fields}</div>
          <ExternalPlanAside form={form} minSubmissionLead={minSubmissionLead} />
        </div>
      </div>
    );
  }

  return (
    <div className={isEditMode ? undefined : 'dg-plan-layout grid lg:grid-cols-[1fr_15.5rem]'}>
      <div
        className={
          compact
            ? 'admin-appt-toolbar dg-plan-panel space-y-2'
            : 'admin-appt-toolbar space-y-4 p-4 sm:p-5'
        }
      >
        <div className={compact ? 'dg-plan-panel-head' : undefined}>
          <p className={compact ? 'dg-plan-panel-hint' : 'text-sm text-muted-foreground'}>
            {isEditMode
              ? 'Modification du rendez-vous existant — les changements remplacent la demande en cours.'
              : 'Le rendez-vous reste en attente jusqu’à validation, refus ou replanification par l’assistante. Il n’apparaît sur l’agenda du DGA qu’après validation.'}
          </p>
          {dateLabel ? (
            <p
              className={
                compact
                  ? 'dg-plan-panel-date capitalize'
                  : 'mt-1 font-medium capitalize text-[var(--admin-foreground)]'
              }
            >
              {dateLabel}
            </p>
          ) : null}
        </div>
        {fields}
      </div>
      {!isEditMode ? <AppointmentPlanningBestPractices form={form} /> : null}
    </div>
  );
}
