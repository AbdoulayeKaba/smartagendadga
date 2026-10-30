'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { LIVE_TOPICS, emitLiveRefresh } from '@/lib/dg/live-refresh';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canUseUrgentOverride, canAutoApprovePlannedAppointment } from '@/lib/dg/rbac';
import {
  DEFAULT_APPOINTMENT_BUSINESS_RULES,
  isMinSubmissionLeadWaivedByUrgency,
  normalizeBusinessRules,
  validateUrgencyJustification,
  type AppointmentBusinessRules,
} from '@/lib/dg/appointment-business-rules';
import {
  isDateBlockedByMinSubmissionLead,
  minSubmissionLeadMessage,
  validateSlotAgainstMinSubmissionLead,
} from '@/lib/dg/min-submission-lead';
import {
  buildAppointmentRequestBody,
  buildConflictCheckBody,
  buildSubmitParticipants,
  ONLINE_MEETING_LOCATION,
  emptyPlanningForm,
  requesterContactError,
  initialPlanningSlotSignature,
  planningSlotSignature,
  resolvePlanningTimes,
  type AppointmentPlanningForm,
  type PlanningInitial,
} from '@/lib/dg/appointment-planning';
import {
  DEFAULT_SCHEDULING_CONTEXT,
  normalizeSchedulingContext,
  validatePlanningDate,
  isPlanningDateBlocked,
  type AppointmentSchedulingContext,
} from '@/lib/dg/appointment-scheduling-context';
import {
  isDatePolicyViolation,
} from '@/lib/dg/scheduling-policy';
import {
  buildTitleDuplicateMessage,
  type AppointmentTitleMatch,
} from '@/lib/dg/appointment-title-match';
import type { AppointmentParticipantUser } from '@/lib/services/appointment-participant-users';

type ConflictCheckResponse = {
  available?: boolean;
  error?: string;
  message?: string;
  violations?: { code?: string; message?: string }[];
};

type UseAppointmentPlanningOptions = {
  /** Soumet en file d'attente sans validation automatique (ex. planification depuis un contact). */
  requireValidation?: boolean;
};

export function useAppointmentPlanning(
  initial?: PlanningInitial,
  options?: UseAppointmentPlanningOptions
) {
  const role = useDgRole();
  const urgentAllowed = canUseUrgentOverride(role);
  const requireValidation = options?.requireValidation === true;
  const autoApprove = canAutoApprovePlannedAppointment(role) && !requireValidation;
  const editId = initial?.editId;
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleDuplicateBlocked, setTitleDuplicateBlocked] = useState(false);
  const [roomAvailabilityError, setRoomAvailabilityError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setFormState] = useState<AppointmentPlanningForm>(() => emptyPlanningForm(initial));
  const [directoryUsers, setDirectoryUsers] = useState<AppointmentParticipantUser[]>([]);
  const [businessRules, setBusinessRules] = useState<AppointmentBusinessRules>(
    DEFAULT_APPOINTMENT_BUSINESS_RULES
  );
  const businessRulesRef = useRef(businessRules);
  businessRulesRef.current = businessRules;
  const rulesSyncedRef = useRef(false);
  const rulesLoadRef = useRef<Promise<void> | null>(null);
  const [schedulingContext, setSchedulingContext] = useState<AppointmentSchedulingContext>(
    DEFAULT_SCHEDULING_CONTEXT
  );
  const initialSlotSignatureRef = useRef<string | null>(initialPlanningSlotSignature(initial));

  useEffect(() => {
    initialSlotSignatureRef.current = initialPlanningSlotSignature(initial);
    setSlotError(null);
  }, [initial]);

  useEffect(() => {
    const load = fetch('/api/appointments/constraints')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.participantUsers) setDirectoryUsers(j.participantUsers);
        if (j?.rules) {
          const next = normalizeBusinessRules(j.rules);
          businessRulesRef.current = next;
          rulesSyncedRef.current = true;
          setBusinessRules(next);
        }
        if (j?.scheduling) setSchedulingContext(normalizeSchedulingContext(j.scheduling));
      })
      .catch(() => undefined);
    rulesLoadRef.current = load.then(() => undefined);
  }, []);

  const validateDateReferential = useCallback(
    (date: string, ctx: AppointmentSchedulingContext = schedulingContext) =>
      validatePlanningDate(ctx, date, { isOnlineMeeting: form.meetingFormat === 'ONLINE' }),
    [schedulingContext, form.meetingFormat]
  );

  useEffect(() => {
    // Les dates invalides (week-end, férié, mission, congé) sont grisées dans le calendrier :
    // pas de message rouge sous le champ pour éviter de laisser choisir puis bloquer.
    setDateError(null);
  }, [form.date, validateDateReferential]);

  useEffect(() => {
    if (!form.date) return;
    const blockedForPresentiel = isPlanningDateBlocked(schedulingContext, form.date, {
      isOnlineMeeting: false,
    });
    if (!blockedForPresentiel) return;
    if (form.meetingFormat === 'ONLINE') return;
    // Mission, congé ou férié : bascule automatique en ligne (la date reste sélectionnée).
    setFormState((prev) => {
      if (prev.date !== form.date || prev.meetingFormat === 'ONLINE') return prev;
      return {
        ...prev,
        isOnlineMeeting: true,
        meetingFormat: 'ONLINE',
        reserveRoom: false,
        roomId: '',
        roomName: '',
        roomOrganizerService: '',
        roomParticipantCount: '',
        roomEquipment: [],
        roomLogisticsNotes: '',
        location: ONLINE_MEETING_LOCATION,
        locationRef: '',
      };
    });
    setDateError(null);
    setSlotError(null);
  }, [form.date, form.meetingFormat, schedulingContext]);

  const setForm = useCallback((updater: (prev: AppointmentPlanningForm) => AppointmentPlanningForm) => {
    setFormState((prev) => {
      const next = updater(prev);
      if (next.title !== prev.title) {
        setTitleError(null);
        setTitleDuplicateBlocked(false);
      }
      if (
        next.reserveRoom !== prev.reserveRoom ||
        next.roomId !== prev.roomId ||
        next.date !== prev.date ||
        next.startTime !== prev.startTime ||
        next.endTime !== prev.endTime ||
        next.allDay !== prev.allDay
      ) {
        setRoomAvailabilityError(null);
      }
      setFormError(null);
      return next;
    });
  }, []);

  const resetForm = useCallback((nextInitial?: PlanningInitial) => {
    setFormState(emptyPlanningForm(nextInitial));
    setTitleError(null);
    setTitleDuplicateBlocked(false);
    setRoomAvailabilityError(null);
    setDateError(null);
    setSlotError(null);
    setFormError(null);
  }, []);

  const applyConflictResponse = useCallback((j: ConflictCheckResponse) => {
    const justification = j.violations?.find((v) => v.code === 'JUSTIFICATION_REQUIRED');
    if (justification?.message) {
      setFormError(String(justification.message));
      setTitleError(null);
      setDateError(null);
      setSlotError(null);
      return false;
    }
    const duplicate = j.violations?.find((v) => v.code === 'DUPLICATE_REQUEST');
    if (duplicate?.message) {
      setTitleError(duplicate.message);
      setTitleDuplicateBlocked(true);
      setDateError(null);
      setSlotError(null);
      return false;
    }
    if (j.available) {
      setSlotError(null);
      return true;
    }
    setTitleError(null);
    const blockedMessage =
      j.message ??
      (j.error && isDatePolicyViolation(j.error)
        ? 'Cette date n’est pas disponible pour un rendez-vous.'
        : 'Ce créneau ne respecte pas les règles de planification.');
    if (j.error && isDatePolicyViolation(j.error)) {
      setDateError(blockedMessage);
      setSlotError(null);
      return false;
    }
    setDateError(null);
    setSlotError(blockedMessage);
    return false;
  }, []);

  const validateClientSide = useCallback(() => {
    setFormError(null);

    if ((role === 'ASSISTANT' || role === 'DG') && form.requesterContactEnabled) {
      const contactError = requesterContactError({
        fullName: form.requesterFullName,
        phone: form.requesterPhone,
        email: form.requesterEmail,
      });
      if (contactError) {
        setFormError(contactError);
        return false;
      }
    }

    const referentialDateError = validateDateReferential(form.date);
    if (referentialDateError) {
      toast({
        variant: 'destructive',
        title: 'Date non disponible',
        description: 'Choisissez une date active dans le calendrier (les jours grisés sont indisponibles).',
      });
      setDateError(null);
      return false;
    }

    if (!form.allDay) {
      const [sh = 0, sm = 0] = form.startTime.split(':').map(Number);
      const [eh = 0, em = 0] = form.endTime.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes <= startMinutes) {
        setSlotError('L’heure de fin doit être après l’heure de début.');
        return false;
      }
    }

    const rules = businessRulesRef.current;
    if (rulesSyncedRef.current) {
      const justificationError = validateUrgencyJustification(
        rules.urgencyJustification,
        form.urgencyLevel,
        form.justification
      );
      if (justificationError) {
        setFormError(justificationError);
        return false;
      }

      const leadWaived = isMinSubmissionLeadWaivedByUrgency(
        rules.urgencyJustification,
        form.urgencyLevel,
        form.justification
      );
      if (rules.minSubmissionLead.enabled && !leadWaived) {
        const leadError = form.allDay
          ? isDateBlockedByMinSubmissionLead(form.date, new Date(), rules.minSubmissionLead)
            ? minSubmissionLeadMessage(rules.minSubmissionLead)
            : null
          : validateSlotAgainstMinSubmissionLead({
              date: form.date,
              startTime: form.startTime,
              rule: rules.minSubmissionLead,
            });
        if (leadError) {
          setSlotError(leadError);
          return false;
        }
      }
    }

    const externalEmail = form.externalParticipant?.email?.trim();
    if (externalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail)) {
      setFormError('Adresse e-mail de l’invité externe invalide.');
      return false;
    }
    if (form.copyEmails?.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setFormError('Une adresse en copie n’est pas valide.');
      return false;
    }

    return true;
  }, [businessRules.minSubmissionLead, businessRules.urgencyJustification, form, role, validateDateReferential]);

  const checkConflict = useCallback(
    async (options?: { force?: boolean }) => {
      if (!form.date) return;
      const referentialDateError = validateDateReferential(form.date);
      if (referentialDateError) {
        setDateError(referentialDateError);
        setSlotError(null);
        return false;
      }

      const currentSlotSignature = planningSlotSignature(form);
      if (
        isEditMode &&
        editId &&
        !options?.force &&
        initialSlotSignatureRef.current != null &&
        currentSlotSignature === initialSlotSignatureRef.current
      ) {
        setSlotError(null);
        return true;
      }

      const res = await fetch('/api/appointments/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildConflictCheckBody(form, form.urgentOverride && urgentAllowed, editId)
        ),
      });
      const j = (await res.json().catch(() => ({}))) as ConflictCheckResponse;
      if (!res.ok) {
        setSlotError(
          j.message ??
            (res.status >= 500
              ? 'Erreur serveur lors de la vérification du créneau. Réessayez.'
              : 'Impossible de vérifier le créneau.')
        );
        return false;
      }
      const accepted = applyConflictResponse(j);
      if (options?.force && accepted === false) {
        const detail =
          j.violations?.find((v) => v.message)?.message ??
          j.message ??
          'Ce créneau ne peut pas être enregistré.';
        toast({
          variant: 'destructive',
          title: 'Soumission impossible',
          description: detail,
        });
      }
      return accepted;
    },
    [applyConflictResponse, editId, form, isEditMode, urgentAllowed, validateDateReferential]
  );

  const verifyTitleDuplicate = useCallback(async (): Promise<string | null> => {
    if (!rulesSyncedRef.current || !businessRulesRef.current.duplicateControl.enabled) return null;
    const needle = form.title.trim();
    if (needle.length < 2 || !form.date) return null;

    const params = new URLSearchParams({ q: needle, date: form.date });
    if (editId) params.set('excludeId', editId);
    const res = await fetch(`/api/appointments/title-lookup?${params}`);
    const json = (await res.json().catch(() => ({}))) as {
      blocking?: AppointmentTitleMatch | null;
    };
    if (!res.ok || !json.blocking) return null;

    const message = buildTitleDuplicateMessage(json.blocking, form.date);
    setTitleError(message);
    setTitleDuplicateBlocked(true);
    return message;
  }, [editId, form.date, form.title]);

  const submit = useCallback(
    async (options?: { onSuccess?: () => void }) => {
      if (!form.title.trim() || !form.date) {
        toast({ variant: 'destructive', title: 'Titre et date requis.' });
        return;
      }

      await rulesLoadRef.current;

      if (!validateClientSide()) return;

      if (titleDuplicateBlocked || titleError) {
        toast({
          variant: 'destructive',
          title: titleError ?? 'Ce titre est déjà utilisé pour une demande existante.',
        });
        return;
      }

      const duplicateMessage = await verifyTitleDuplicate();
      if (duplicateMessage) {
        toast({
          variant: 'destructive',
          title: duplicateMessage,
        });
        return;
      }

      const available = await checkConflict({ force: true });
      if (available === false) return;

      if (titleDuplicateBlocked || titleError || dateError || slotError) return;

      setLoading(true);
      try {
        const participants = buildSubmitParticipants(
          form.participantUserIds,
          directoryUsers,
          role === 'ASSISTANT' || role === 'DG' ? null : form.externalParticipant,
          form.copyEmails ?? []
        );

        const body = buildAppointmentRequestBody(form, {
          urgentOverride: form.urgentOverride && urgentAllowed,
          participants,
        });
        const requestBody = body;

        const res = editId
          ? await fetch(`/api/appointments/${editId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            })
          : await fetch('/api/appointments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const duplicate = Array.isArray(j.violations)
            ? j.violations.find((v: { code?: string }) => v.code === 'DUPLICATE_REQUEST')
            : null;
          if (duplicate?.message) {
            setTitleError(String(duplicate.message));
            setTitleDuplicateBlocked(true);
            return;
          }
          const contactViolation = Array.isArray(j.violations)
            ? j.violations.find((v: { code?: string }) => v.code === 'REQUESTER_CONTACT')
            : null;
          if (contactViolation?.message) {
            setFormError(String(contactViolation.message));
            return;
          }
          const justificationViolation = Array.isArray(j.violations)
            ? j.violations.find((v: { code?: string }) => v.code === 'JUSTIFICATION_REQUIRED')
            : null;
          if (justificationViolation?.message) {
            setFormError(String(justificationViolation.message));
            return;
          }
          const pendingViolation = Array.isArray(j.violations)
            ? j.violations.find((v: { code?: string }) => v.code === 'MAX_PENDING')
            : null;
          if (pendingViolation?.message) {
            setSlotError(String(pendingViolation.message));
            return;
          }
          const dateViolation = Array.isArray(j.violations)
            ? j.violations.find(
                (v: { code?: string; message?: string }) =>
                  v.code != null && isDatePolicyViolation(v.code)
              )
            : null;
          if (dateViolation?.message) {
            setDateError(String(dateViolation.message));
            return;
          }
          const violationMsg =
            Array.isArray(j.violations) && j.violations[0]?.message
              ? String(j.violations[0].message)
              : null;
          const apiMessage =
            typeof j.message === 'string' && j.message.trim()
              ? j.message
              : typeof j.details === 'string'
                ? j.details
                : null;
          toast({
            variant: 'destructive',
            title: 'Échec',
            description:
              violationMsg ??
              apiMessage ??
              (j.error === 'SCHEDULE_CONFLICT'
                ? 'Conflit de planning DGA.'
                : j.error === 'BUSINESS_RULE_VIOLATION'
                  ? 'Demande refusée par les règles métier.'
                  : j.error === 'VALIDATION_ERROR'
                    ? 'Données du formulaire invalides. Vérifiez les champs obligatoires.'
                    : j.error === 'START_IN_PAST'
                      ? 'Le créneau choisi est déjà passé.'
                      : j.error === 'INVALID_TIME_RANGE'
                        ? 'L’heure de fin doit être après l’heure de début.'
                        : res.status >= 500
                        ? 'Erreur serveur. Réessayez ou contactez l’administrateur.'
                        : String(j.error ?? 'Erreur')),
          });
          return;
        }

        if (isEditMode) {
          toast({
            title: 'Modifications enregistrées',
            description: 'Le rendez-vous a été mis à jour.',
          });
          options?.onSuccess?.();
          emitLiveRefresh(LIVE_TOPICS.appointments);
          return;
        }

        const warnMsg =
          Array.isArray(j.warnings) && j.warnings[0]?.message
            ? String(j.warnings[0].message)
            : null;

        if (autoApprove && j.id) {
          const { startTime, endTime } = resolvePlanningTimes(form);
          const approveRes = await fetch(`/api/appointments/${j.id}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'APPROVE',
              date: form.date,
              startTime,
              endTime,
              urgentOverride: form.urgentOverride && urgentAllowed,
            }),
          });
          const approveJson = await approveRes.json().catch(() => ({}));
          if (!approveRes.ok) {
            toast({
              variant: 'destructive',
              title: 'RDV créé mais validation échouée',
              description:
                approveJson.error === 'SCHEDULE_CONFLICT'
                  ? 'Conflit de planning.'
                  : approveJson.error ?? 'Erreur',
            });
            options?.onSuccess?.();
            emitLiveRefresh(LIVE_TOPICS.appointments);
            return;
          }
          toast({
            title: 'Rendez-vous planifié',
            description: role === 'DG' ? 'Ajouté à l’agenda du DGA.' : 'Ajouté à l’agenda DGA.',
          });
        } else {
          toast({
            title: 'Demande envoyée',
            description:
              role === 'ASSISTANT'
                ? 'Le DGA a été notifié par e-mail qu’un rendez-vous est prévu pour lui. Le créneau reste en attente de validation.'
                : (warnMsg ??
                  'Le rendez-vous reste en attente jusqu’à validation, refus ou replanification par l’assistante. Il n’apparaît sur l’agenda du DGA qu’après validation.'),
          });
        }

        resetForm();
        emitLiveRefresh(LIVE_TOPICS.appointments);
        options?.onSuccess?.();
      } finally {
        setLoading(false);
      }
    },
    [autoApprove, businessRules.urgencyJustification, checkConflict, dateError, directoryUsers, editId, form, isEditMode, requireValidation, resetForm, role, slotError, titleDuplicateBlocked, titleError, urgentAllowed, validateClientSide, verifyTitleDuplicate]
  );

  const handleTitleDuplicate = useCallback((message: string | null) => {
    setTitleError(message);
    setTitleDuplicateBlocked(Boolean(message));
  }, []);

  const handleRoomAvailability = useCallback((message: string | null) => {
    setRoomAvailabilityError(message);
  }, []);

  return {
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
    urgencyJustificationRule: businessRules.urgencyJustification,
    minSubmissionLead: businessRules.minSubmissionLead,
    urgentAllowed,
    autoApprove,
    role,
    isEditMode,
    checkConflict,
    submit,
    resetForm,
    handleTitleDuplicate,
    handleRoomAvailability,
  };
}
