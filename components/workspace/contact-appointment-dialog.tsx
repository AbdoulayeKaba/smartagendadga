'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, CalendarPlus, Loader2, Pencil, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppointmentPlanningFields } from '@/components/appointments/appointment-planning-fields';
import { useAppointmentPlanning } from '@/hooks/use-appointment-planning';
import { CONTACT_CATEGORY_LABELS } from '@/lib/workspace/labels';
import type { StrategicContact } from '@/lib/workspace/types';
import type { PlanningInitial } from '@/lib/dg/appointment-planning';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function contactPlanningInitial(contact: StrategicContact): PlanningInitial {
  return {
    title: `RDV — ${contact.fullName}`,
    participantName: contact.fullName,
    participantEmail: contact.email ?? '',
    type: 'EXTERNAL',
    strategicContactId: contact.id,
  };
}

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export type ContactAppointmentDialogProps = {
  contact: StrategicContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Si défini, charge le RDV existant et enregistre via PATCH. */
  editAppointmentId?: string | null;
};

export function ContactAppointmentDialog({
  contact,
  open,
  onOpenChange,
  onSuccess,
  editAppointmentId = null,
}: ContactAppointmentDialogProps) {
  const contactId = contact?.id;
  const contactRef = useRef(contact);
  contactRef.current = contact;
  const isEdit = Boolean(editAppointmentId);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const planningSeed = useMemo(
    () => (editAppointmentId ? { editId: editAppointmentId } : undefined),
    [editAppointmentId]
  );

  const {
    form,
    setForm,
    loading,
    titleError,
    titleDuplicateBlocked,
    roomAvailabilityError,
    dateError,
    slotError,
    schedulingContext,
    minSubmissionLead,
    checkConflict,
    submit,
    resetForm,
    handleTitleDuplicate,
  } = useAppointmentPlanning(planningSeed, { requireValidation: !isEdit });

  useEffect(() => {
    if (!open || !contactId) return;
    const current = contactRef.current;
    if (!current) return;

    if (!editAppointmentId) {
      resetForm(contactPlanningInitial(current));
      return;
    }

    let cancelled = false;
    setLoadingInitial(true);
    void fetch(`/api/appointments/${editAppointmentId}`)
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          initial?: PlanningInitial;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.initial) {
          toast({
            variant: 'destructive',
            title: 'Chargement impossible',
            description: 'Impossible de charger le rendez-vous à modifier.',
          });
          onOpenChange(false);
          return;
        }
        resetForm({
          ...j.initial,
          editId: editAppointmentId,
          strategicContactId: j.initial.strategicContactId ?? current.id,
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast({
          variant: 'destructive',
          title: 'Chargement impossible',
          description: 'Impossible de charger le rendez-vous à modifier.',
        });
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, contactId, editAppointmentId, resetForm, onOpenChange]);

  const dateLabel = form.date
    ? format(new Date(`${form.date}T12:00:00`), 'EEE d MMM yyyy', { locale: fr })
    : null;

  if (!contact) return null;

  const submitDisabled =
    loading ||
    loadingInitial ||
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
          'admin-theme contact-rdv-dialog--pro rdv-plan-dialog--compact gap-0 border-[var(--admin-border)] p-0 sm:max-w-[32rem]'
        )}
        aria-describedby="contact-rdv-dialog-desc"
      >
        <header className="contact-rdv-dialog-header">
          <div className="contact-rdv-dialog-header-top">
            <div className="rdv-plan-dialog-header-icon" aria-hidden>
              {isEdit ? <Pencil className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="rdv-plan-dialog-title">
                {isEdit ? 'Modifier le rendez-vous' : 'Planifier un rendez-vous'}
              </DialogTitle>
              <DialogDescription id="contact-rdv-dialog-desc" className="rdv-plan-dialog-desc">
                {isEdit
                  ? 'Mettez à jour les informations du rendez-vous, puis enregistrez.'
                  : 'Le rendez-vous reste en attente jusqu’à validation, refus ou replanification par l’assistante. Il n’apparaît sur l’agenda du DGA qu’après validation.'}
              </DialogDescription>
            </div>
          </div>

          <div className="contact-rdv-dialog-contact-card">
            <div className="contact-rdv-dialog-avatar" aria-hidden>
              {contactInitials(contact.fullName)}
            </div>
            <div className="contact-rdv-dialog-contact-meta">
              <p className="contact-rdv-dialog-contact-name">{contact.fullName}</p>
              <p className="contact-rdv-dialog-contact-org">
                <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                {contact.organization}
              </p>
              {contact.jobTitle ? (
                <p className="contact-rdv-dialog-contact-role">
                  <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                  {contact.jobTitle}
                </p>
              ) : null}
            </div>
            <div className="contact-rdv-dialog-contact-badges">
              <span className="contact-rdv-dialog-category">
                {CONTACT_CATEGORY_LABELS[contact.category]}
              </span>
              {dateLabel ? (
                <span className="rdv-plan-dialog-date-badge capitalize">{dateLabel}</span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="rdv-plan-dialog-body contact-rdv-dialog-body">
          {loadingInitial ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Chargement du rendez-vous…
            </div>
          ) : (
            <AppointmentPlanningFields
              form={form}
              onChange={setForm}
              onBlurCheckConflict={() => void checkConflict()}
              titleError={titleError}
              dateError={dateError}
              slotError={slotError}
              schedulingContext={schedulingContext}
              minSubmissionLead={minSubmissionLead}
              idPrefix={isEdit ? 'contact-rdv-edit' : 'contact-rdv'}
              variant="contact"
              excludeAppointmentId={editAppointmentId}
              onTitleDuplicate={handleTitleDuplicate}
              classNames={{ input: 'dg-plan-input', select: 'dg-plan-select' }}
            />
          )}
        </div>

        <footer className="rdv-plan-dialog-footer contact-rdv-dialog-footer">
          <button
            type="button"
            className="admin-btn-cancel"
            onClick={() => onOpenChange(false)}
            disabled={loading || loadingInitial}
          >
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-create contact-rdv-dialog-submit"
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
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {isEdit ? 'Enregistrer' : 'Soumettre'}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
