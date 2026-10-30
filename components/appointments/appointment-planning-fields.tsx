'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { InlineFieldError, inlineFieldErrorClass } from '@/components/ui/inline-field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  URGENCY_LEVEL_OPTIONS,
  isMinSubmissionLeadWaivedByUrgency,
  isSameDayOpenByJustifiedUrgency,
  urgencyRequiresJustification,
} from '@/lib/dg/appointment-business-rules';
import {
  PLANNING_URGENT_LABEL,
  PLANNING_URGENT_TOGGLE_DESC,
} from '@/lib/dg/urgent-slot-priority';
import {
  ONLINE_MEETING_LOCATION,
  REMINDER_SELECT_OPTIONS,
  planningDurationLabel,
  type AppointmentPlanningForm,
} from '@/lib/dg/appointment-planning';
import {
  DgPlanCompactDateField,
  DgPlanCompactSelect,
  DgPlanCompactTimeField,
} from '@/components/appointments/dg-plan-compact-fields';
import { CopyEmailsField } from '@/components/appointments/copy-emails-field';
import { ParticipantUsersMultiSelect } from '@/components/appointments/participant-users-multi-select';
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { AppointmentTitleSmartField } from '@/components/appointments/appointment-title-smart-field';
import { AppointmentModalityTabs } from '@/components/appointments/appointment-modality-tabs';
import type { AppointmentParticipantUser } from '@/lib/services/appointment-participant-users';
import type { UrgencyJustificationRule } from '@/lib/dg/appointment-business-rules';
import {
  DEFAULT_SCHEDULING_CONTEXT,
  isPlanningDateBlocked,
  validatePlanningDate,
  type AppointmentSchedulingContext,
} from '@/lib/dg/appointment-scheduling-context';
import {
  earliestSelectableStartTimeOnDate,
  isDateBlockedByMinSubmissionLead,
  normalizeMinSubmissionLeadRule,
  resolvePlanningSlotDefaultsForDate,
  type MinSubmissionLeadRule,
} from '@/lib/dg/min-submission-lead';
import { formatIsoDate, formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime/format';

function hhMmToMinutes(value: string): number {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHhMm(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 45));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Prochain créneau (pas de 15 min) strictement après l’heure courante. */
function nextSlotAfterNow(nowHhMm: string, stepMinutes = 15): string {
  return minutesToHhMm(Math.ceil((hhMmToMinutes(nowHhMm) + 1) / stepMinutes) * stepMinutes);
}

function laterHhMm(a: string, b: string): string {
  return a > b ? a : b;
}

type FieldClass = {
  input?: string;
  select?: string;
};

type ReferentialOption = { id: string; name: string };

function ReferentialSelectField({
  id,
  value,
  options,
  placeholder,
  onChange,
  isCompact,
  selectCls,
  selectMt,
}: {
  id: string;
  value: string;
  options: ReferentialOption[];
  placeholder: string;
  onChange: (value: string) => void;
  isCompact: boolean;
  selectCls: string;
  selectMt: string;
}) {
  const selectOptions = [
    { value: '', label: placeholder },
    ...options.map((o) => ({ value: o.id, label: o.name })),
  ];

  if (isCompact) {
    return (
      <DgPlanCompactSelect
        id={id}
        value={value}
        placeholder={placeholder}
        options={selectOptions}
        onChange={onChange}
      />
    );
  }

  return (
    <select
      id={id}
      className={`${selectCls} ${selectMt}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {selectOptions.map((opt) => (
        <option key={opt.value || '__empty__'} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

type Props = {
  form: AppointmentPlanningForm;
  onChange: (updater: (prev: AppointmentPlanningForm) => AppointmentPlanningForm) => void;
  onBlurCheckConflict?: () => void;
  titleError?: string | null;
  dateError?: string | null;
  slotError?: string | null;
  schedulingContext?: AppointmentSchedulingContext;
  /** Règle R1 — délai minimum de soumission (heures / jours). */
  minSubmissionLead?: MinSubmissionLeadRule;
  /** @deprecated Utiliser titleError et slotError */
  conflictMsg?: string | null;
  idPrefix?: string;
  classNames?: FieldClass;
  compact?: boolean;
  /** Formulaire réduit pour planification depuis un contact stratégique ou modal agenda */
  variant?: 'default' | 'contact' | 'dialog';
  urgencyJustificationRule?: UrgencyJustificationRule;
  justificationError?: string | null;
  /** Assistante / DGA : priorité ultra urgente à la planification */
  urgentAllowed?: boolean;
  /** En édition : exclure le RDV courant de la détection de doublon titre. */
  excludeAppointmentId?: string | null;
  onTitleDuplicate?: (message: string | null) => void;
  /** Libellés et ancres du parcours utilisateur externe. */
  presentation?: 'default' | 'external';
  /** L’assistante prévient le DGA par e-mail à la création. */
  notifyDg?: boolean;
};

export function AppointmentPlanningFields({
  form,
  onChange,
  onBlurCheckConflict,
  titleError,
  dateError,
  slotError,
  schedulingContext,
  minSubmissionLead,
  conflictMsg,
  idPrefix = 'plan',
  classNames,
  compact = false,
  variant = 'default',
  urgencyJustificationRule,
  justificationError,
  urgentAllowed = false,
  excludeAppointmentId = null,
  onTitleDuplicate,
  presentation = 'default',
  notifyDg = false,
}: Props) {
  const isExternal = presentation === 'external';
  const isContact = variant === 'contact';
  const isDialog = variant === 'dialog';
  const isCompact = compact || isContact || isDialog;
  const resolvedSchedulingContext = schedulingContext ?? DEFAULT_SCHEDULING_CONTEXT;
  const modalityValue = form.isOnlineMeeting ? 'online' : 'presentiel';

  const setModality = (next: 'presentiel' | 'online' | 'hybrid') => {
    const sameDayOpen =
      Boolean(form.date) &&
      urgencyJustificationRule != null &&
      isSameDayOpenByJustifiedUrgency(
        urgencyJustificationRule,
        form.urgencyLevel,
        form.justification,
        form.date
      );
    if (
      (next === 'presentiel' || next === 'hybrid') &&
      form.date &&
      !sameDayOpen &&
      isPlanningDateBlocked(resolvedSchedulingContext, form.date, { isOnlineMeeting: false })
    ) {
      return;
    }
    onChange((s) => {
      if (next === 'hybrid') {
        return {
          ...s,
          isOnlineMeeting: true,
          meetingFormat: 'HYBRID',
          location: s.reserveRoom && s.roomName.trim() ? s.roomName.trim() : ONLINE_MEETING_LOCATION,
        };
      }
      if (next === 'online') {
        return {
          ...s,
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
      }
      return {
        ...s,
        isOnlineMeeting: false,
        meetingFormat: 'PRESENTIEL',
        location:
          s.location.trim() === ONLINE_MEETING_LOCATION || s.location.trim().toLowerCase() === 'en ligne (teams)'
            ? ''
            : s.location,
        locationRef: s.location.trim() === ONLINE_MEETING_LOCATION ? '' : s.locationRef,
      };
    });
  };

  const inputCls = classNames?.input ?? '';
  const selectCls =
    classNames?.select ?? 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  const labelCls = isCompact ? 'dg-plan-label' : undefined;
  const fieldGap = isCompact ? 'dg-plan-fields' : 'grid gap-4';
  const rowGap = isCompact ? 'dg-plan-row' : 'grid gap-4';
  const inputMt = isCompact ? '' : 'mt-1';
  const selectMt = isCompact ? '' : 'mt-1';
  const sectionCls = isDialog ? 'grid gap-2' : compact ? 'dg-plan-section' : 'space-y-3';
  const sectionTitleCls = isDialog ? 'sr-only' : compact ? 'dg-plan-section-title' : 'sr-only';
  const dateFieldVariant = isCompact ? 'compact' : 'default';
  const dateFieldClass = isCompact ? undefined : inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt;

  const resolvedSlotError = slotError ?? conflictMsg ?? null;
  const dateInvalid = Boolean(dateError);
  const leadRule: MinSubmissionLeadRule = useMemo(
    () =>
      normalizeMinSubmissionLeadRule({
        enabled: minSubmissionLead?.enabled ?? false,
        minHours: minSubmissionLead?.minHours ?? 0,
        minDays: minSubmissionLead?.minDays ?? 0,
      }),
    [minSubmissionLead?.enabled, minSubmissionLead?.minHours, minSubmissionLead?.minDays]
  );
  const officeHoursRestricted =
    !resolvedSchedulingContext.allowOutsideHours && form.meetingFormat !== 'ONLINE';
  const sameDayOpenForSelection =
    Boolean(form.date) &&
    urgencyJustificationRule != null &&
    isSameDayOpenByJustifiedUrgency(
      urgencyJustificationRule,
      form.urgencyLevel,
      form.justification,
      form.date
    );
  const presentielBlockedForDate = Boolean(
    form.date &&
      !sameDayOpenForSelection &&
      isPlanningDateBlocked(resolvedSchedulingContext, form.date, { isOnlineMeeting: false })
  );
  const presentielDisabledReason = form.date
    ? validatePlanningDate(resolvedSchedulingContext, form.date, { isOnlineMeeting: false })
    : null;

  const modalityTabs = (
    <AppointmentModalityTabs
      idPrefix={idPrefix}
      compact={isCompact}
      dense={isCompact && !isExternal}
      className={isExternal ? 'plan-modality--external' : undefined}
      value={modalityValue}
      onChange={setModality}
      presentielDisabled={presentielBlockedForDate}
      presentielDisabledReason={presentielDisabledReason}
    />
  );

  const presentielHint =
    presentielBlockedForDate && presentielDisabledReason ? (
      <p className="plan-modality-presentiel-hint" role="status">
        {presentielDisabledReason} Seul le format <strong>En ligne</strong> est disponible pour cette
        date.
      </p>
    ) : null;

  const onlineHint = !isExternal && form.isOnlineMeeting ? (
    <p className="plan-modality-online-hint">
      Lien Microsoft Teams généré à la validation, puis envoyé par e-mail au demandeur, aux participants et au DGA.
    </p>
  ) : null;
  const workDayStart = resolvedSchedulingContext.workDayStart;
  const workDayEnd = resolvedSchedulingContext.workDayEnd;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [form.date, leadRule.enabled, leadRule.minHours, leadRule.minDays]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const leadWaived = useMemo(
    () =>
      urgencyJustificationRule != null &&
      isMinSubmissionLeadWaivedByUrgency(
        urgencyJustificationRule,
        form.urgencyLevel,
        form.justification
      ),
    [urgencyJustificationRule, form.urgencyLevel, form.justification]
  );
  const isDateDisabled = useCallback(
    (date: Date) => {
      const iso = formatIsoDate(date);
      if (iso < formatIsoDateInAppTz(now)) return true;
      const sameDayOpen =
        urgencyJustificationRule != null &&
        isSameDayOpenByJustifiedUrgency(
          urgencyJustificationRule,
          form.urgencyLevel,
          form.justification,
          iso,
          now
        );
      if (
        !sameDayOpen &&
        isPlanningDateBlocked(resolvedSchedulingContext, iso, {
          isOnlineMeeting: form.meetingFormat === 'ONLINE',
        })
      ) {
        return true;
      }
      if (!leadWaived && isDateBlockedByMinSubmissionLead(iso, now, leadRule)) return true;
      return false;
    },
    [
      resolvedSchedulingContext,
      leadRule,
      leadWaived,
      now,
      form.meetingFormat,
      form.urgencyLevel,
      form.justification,
      urgencyJustificationRule,
    ]
  );

  useEffect(() => {
    if (!form.date) return;
    if (isDateBlockedByMinSubmissionLead(form.date, now, leadRule)) return;
    if (!presentielBlockedForDate || form.meetingFormat === 'ONLINE') return;
    onChange((s) => {
      if (s.date !== form.date || s.meetingFormat === 'ONLINE') return s;
      return {
        ...s,
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
  }, [form.date, form.meetingFormat, presentielBlockedForDate, now, leadRule, onChange]);

  const isSelectedDateToday = Boolean(form.date) && form.date === formatIsoDateInAppTz(now);
  const leadStartMin =
    form.date && !leadWaived
      ? earliestSelectableStartTimeOnDate(form.date, now, leadRule)
      : undefined;
  const systemTodayMin =
    (!leadRule.enabled || leadWaived) && isSelectedDateToday
      ? nextSlotAfterNow(formatTimeInAppTz(now))
      : undefined;

  /** Plage cabinet + R1 (délai min) + heure système. */
  const officeMinTime = officeHoursRestricted ? workDayStart : undefined;
  const officeMaxTime = officeHoursRestricted ? workDayEnd : undefined;
  const startMinTime = [officeMinTime, leadStartMin, systemTodayMin]
    .filter((v): v is string => Boolean(v))
    .reduce<string | undefined>((acc, v) => (acc ? laterHhMm(acc, v) : v), undefined);
  const startMaxTime = officeMaxTime;
  /**
   * Fin : après le début (et donc après le délai R1 si le début le respecte),
   * jusqu’à la fin de service.
   */
  const endMinTime = form.startTime
    ? minutesToHhMm(hhMmToMinutes(form.startTime) + 15)
    : startMinTime
      ? minutesToHhMm(hhMmToMinutes(startMinTime) + 15)
      : officeMinTime;
  const endMaxTime = officeMaxTime;

  const handleDateChange = useCallback(
    (date: string) => {
      onChange((s) => {
        if (!date) return { ...s, date: '' };
        if (date === s.date) return s;
        const times = resolvePlanningSlotDefaultsForDate({
          date,
          now,
          rule: leadWaived ? { ...leadRule, enabled: false } : leadRule,
          workDayStart,
          workDayEnd,
          officeHoursRestricted,
        });
        return { ...s, date, ...times };
      });
    },
    [leadRule, leadWaived, now, officeHoursRestricted, onChange, workDayEnd, workDayStart]
  );

  const dateFieldClassWithError = useMemo(
    () => inlineFieldErrorClass(dateInvalid, isCompact ? undefined : dateFieldClass),
    [dateInvalid, isCompact, dateFieldClass]
  );
  const [motifs, setMotifs] = useState<ReferentialOption[]>([]);
  const [participantUsers, setParticipantUsers] = useState<AppointmentParticipantUser[]>([]);

  useEffect(() => {
    if (form.allDay) return;
    onChange((s) => {
      let startTime = s.startTime;
      let endTime = s.endTime;
      let changed = false;
      const minStart = startMinTime ?? (officeHoursRestricted ? workDayStart : '00:00');
      const maxTime = officeHoursRestricted ? workDayEnd : '23:45';

      if (startTime && (startTime < minStart || startTime > maxTime)) {
        startTime = minStart <= maxTime ? minStart : maxTime;
        changed = true;
      }
      if (endTime && endTime > maxTime) {
        endTime = maxTime;
        changed = true;
      }
      if (startTime && endTime && endTime <= startTime) {
        const next = Math.min(hhMmToMinutes(startTime) + 60, hhMmToMinutes(maxTime));
        endTime = minutesToHhMm(next);
        if (endTime <= startTime) endTime = minutesToHhMm(hhMmToMinutes(startTime) + 15);
        if (endTime > maxTime) endTime = maxTime;
        changed = true;
      }
      return changed ? { ...s, startTime, endTime } : s;
    });
  }, [
    officeHoursRestricted,
    workDayStart,
    workDayEnd,
    form.allDay,
    form.startTime,
    form.endTime,
    startMinTime,
    onChange,
  ]);

  useEffect(() => {
    if (!form.date || leadWaived) return;
    if (!isDateBlockedByMinSubmissionLead(form.date, now, leadRule)) return;
    onChange((s) => (s.date === form.date ? { ...s, date: '' } : s));
  }, [form.date, leadRule, leadWaived, now, onChange]);

  useEffect(() => {
    void fetch('/api/appointments/constraints')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.motifs) setMotifs(j.motifs);
        if (j?.participantUsers) setParticipantUsers(j.participantUsers);
      });
  }, []);

  const needsJustification =
    !isContact &&
    urgencyJustificationRule != null &&
    urgencyRequiresJustification(urgencyJustificationRule, form.urgencyLevel);
  const justificationAlert =
    needsJustification &&
    (form.urgencyLevel === 'URGENT' || form.urgencyLevel === 'TRES_URGENT');
  const justificationMinChars = urgencyJustificationRule?.minChars ?? 0;
  const justificationReady =
    (form.justification ?? '').trim().length >= Math.max(justificationMinChars, 1);
  const descLabel = isCompact ? 'Description' : 'Description complémentaire';
  const reminderLabel = isCompact ? 'Rappel' : 'Rappel par e-mail';

  const PlanDateField = isCompact ? DgPlanCompactDateField : FrenchDateField;
  const PlanTimeField = isCompact ? DgPlanCompactTimeField : FrenchTimeField;

  const allDayToggleCls = isCompact
    ? 'dg-plan-allday'
    : 'flex items-center justify-between rounded-lg border border-emerald-700/25 bg-emerald-700/5 px-3 py-2';

  const allDaySwitchCls =
    'appointment-allday-switch shrink-0 data-[state=checked]:!bg-[#008d4c] data-[state=unchecked]:!bg-[#ee3124] dark:data-[state=checked]:!bg-[#008d4c] dark:data-[state=unchecked]:!bg-[#ee3124]';

  if (isContact) {
    return (
      <div className={fieldGap}>
        <div>
          <Label htmlFor={`${idPrefix}-title`} className={labelCls}>
            Titre
          </Label>
          <AppointmentTitleSmartField
            id={`${idPrefix}-title`}
            className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
            value={form.title}
            onChange={(title) => onChange((s) => ({ ...s, title }))}
            onBlur={onBlurCheckConflict}
            placeholder="Objet du rendez-vous"
            error={titleError}
            errorId={`${idPrefix}-title-error`}
            excludeId={excludeAppointmentId}
            date={form.date}
            onBlockingDuplicate={onTitleDuplicate}
          />
        </div>

        <div className={`${rowGap} sm:grid-cols-2`}>
          <div>
            <Label htmlFor={`${idPrefix}-motif`} className={labelCls}>
              Motif
            </Label>
            <ReferentialSelectField
              id={`${idPrefix}-motif`}
              value={form.motifRef}
              options={motifs}
              placeholder="— Motif —"
              onChange={(motifRef) => onChange((s) => ({ ...s, motifRef }))}
              isCompact={isCompact}
              selectCls={selectCls}
              selectMt={selectMt}
            />
          </div>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-desc`} className={labelCls}>
            Description complémentaire
          </Label>
          <Input
            id={`${idPrefix}-desc`}
            className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
            value={form.description}
            onChange={(e) => onChange((s) => ({ ...s, description: e.target.value }))}
            placeholder="Optionnel"
          />
        </div>

        {modalityTabs}
        {presentielHint}
        {onlineHint}

        <div className={`${rowGap} ${form.allDay ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`}>
          <div>
            <Label htmlFor={`${idPrefix}-date`} className={labelCls}>
              Date
            </Label>
            <PlanDateField
              id={`${idPrefix}-date`}
              value={form.date}
              onChange={handleDateChange}
              onBlur={onBlurCheckConflict}
              isDateDisabled={isDateDisabled}
              {...(!isCompact
                ? {
                    variant: dateFieldVariant,
                    className: dateFieldClassWithError,
                  }
                : { className: dateFieldClassWithError })}
            />
            <InlineFieldError id={`${idPrefix}-date-error`} message={dateError} />
          </div>
          {!form.allDay ? (
            <>
              <div>
                <Label htmlFor={`${idPrefix}-start`} className={labelCls}>
                  Début
                </Label>
                <PlanTimeField
                  id={`${idPrefix}-start`}
                  value={form.startTime}
                  onChange={(startTime) =>
                    onChange((s) => {
                      const next = { ...s, startTime };
                      if (s.endTime && s.endTime <= startTime) {
                        const bumped = minutesToHhMm(hhMmToMinutes(startTime) + 60);
                        next.endTime =
                          officeHoursRestricted && bumped > workDayEnd ? workDayEnd : bumped;
                        if (next.endTime <= startTime) {
                          next.endTime = minutesToHhMm(hhMmToMinutes(startTime) + 15);
                        }
                      }
                      return next;
                    })
                  }
                  onBlur={onBlurCheckConflict}
                  minTime={startMinTime}
                  maxTime={startMaxTime}
                  {...(!isCompact ? { variant: dateFieldVariant, className: dateFieldClass } : {})}
                />
              </div>
              <div>
                <Label htmlFor={`${idPrefix}-end`} className={labelCls}>
                  Fin
                </Label>
                <PlanTimeField
                  id={`${idPrefix}-end`}
                  value={form.endTime}
                  onChange={(endTime) => onChange((s) => ({ ...s, endTime }))}
                  onBlur={onBlurCheckConflict}
                  minTime={endMinTime}
                  maxTime={endMaxTime}
                  {...(!isCompact ? { variant: dateFieldVariant, className: dateFieldClass } : {})}
                />
              </div>
            </>
          ) : null}
        </div>

        {resolvedSlotError ? <p className="dg-plan-conflict">{resolvedSlotError}</p> : null}

        <div>
          <Label htmlFor={`${idPrefix}-reminder`} className={labelCls}>
            Rappel
          </Label>
          <DgPlanCompactSelect
            id={`${idPrefix}-reminder`}
            value={form.reminderSelect}
            options={REMINDER_SELECT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            onChange={(reminderSelect) => onChange((s) => ({ ...s, reminderSelect }))}
          />
        </div>

        {urgentAllowed ? (
          <div className={allDayToggleCls}>
            <p className="dg-plan-label flex min-w-0 items-center gap-1">
              <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              <span className="truncate">{PLANNING_URGENT_LABEL}</span>
            </p>
            <Switch
              id={`${idPrefix}-urgent`}
              className={allDaySwitchCls}
              checked={form.urgentOverride}
              onCheckedChange={(urgentOverride) => {
                onChange((s) => ({ ...s, urgentOverride }));
                onBlurCheckConflict?.();
              }}
            />
          </div>
        ) : null}

      </div>
    );
  }

  const durationLabel = planningDurationLabel(form.startTime, form.endTime);
  const req = isExternal ? <span className="ext-plan-req"> *</span> : null;

  const requesterContactBlock = (
    <div className="dg-plan-requester-block">
      <label className="dg-plan-requester-toggle" htmlFor={`${idPrefix}-requester-toggle`}>
        <input
          id={`${idPrefix}-requester-toggle`}
          type="checkbox"
          checked={form.requesterContactEnabled}
          onChange={(e) => {
            const enabled = e.target.checked;
            onChange((s) => ({
              ...s,
              requesterContactEnabled: enabled,
              ...(enabled
                ? {}
                : { requesterFullName: '', requesterPhone: '', requesterEmail: '' }),
            }));
          }}
        />
        <span>Coordonnées du demandeur</span>
      </label>
      {form.requesterContactEnabled ? (
        <div className="dg-plan-requester">
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-requester-name`} className={labelCls}>
              Nom complet
              <span className="dg-plan-req"> *</span>
            </Label>
            <Input
              id={`${idPrefix}-requester-name`}
              className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
              value={form.requesterFullName}
              autoComplete="name"
              onChange={(e) => onChange((s) => ({ ...s, requesterFullName: e.target.value }))}
              placeholder="Prénom et nom"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-requester-phone`} className={labelCls}>
              Téléphone
              <span className="dg-plan-req"> *</span>
            </Label>
            <Input
              id={`${idPrefix}-requester-phone`}
              className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.requesterPhone}
              onChange={(e) => onChange((s) => ({ ...s, requesterPhone: e.target.value }))}
              placeholder="+224 …"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-requester-email`} className={labelCls}>
              Adresse e-mail
              <span className="dg-plan-req"> *</span>
            </Label>
            <Input
              id={`${idPrefix}-requester-email`}
              className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
              type="email"
              autoComplete="email"
              value={form.requesterEmail}
              onChange={(e) => onChange((s) => ({ ...s, requesterEmail: e.target.value }))}
              placeholder="nom@exemple.gov"
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  const guestParticipantsBlock = !isExternal ? (
    <div>
      <Label htmlFor={`${idPrefix}-guests`} className={labelCls}>
        Participants en copie
      </Label>
      <CopyEmailsField
        id={`${idPrefix}-guests`}
        value={form.copyEmails}
        onChange={(copyEmails) => onChange((s) => ({ ...s, copyEmails }))}
      />
      {notifyDg ? (
        <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
          Le DGA est notifié automatiquement par e-mail. Ce champ sert aux autres participants.
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={fieldGap}>
      <section className={sectionCls} id={isExternal ? 'plan-step-info' : undefined}>
        <p className={sectionTitleCls}>1. Informations essentielles</p>
        <div className={`${rowGap} grid-cols-2`}>
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-title`} className={labelCls}>
              {isExternal ? 'Objet du rendez-vous' : 'Titre'}
              {req}
            </Label>
            <AppointmentTitleSmartField
              id={`${idPrefix}-title`}
              className={inputCls ? `${inputCls} ${inputMt}`.trim() : inputMt}
              value={form.title}
              onChange={(title) => onChange((s) => ({ ...s, title }))}
              onBlur={onBlurCheckConflict}
              placeholder={
                isExternal
                  ? 'Ex. : Réunion stratégique, Présentation du projet…'
                  : 'Objet du rendez-vous'
              }
              error={titleError}
              errorId={`${idPrefix}-title-error`}
              excludeId={excludeAppointmentId}
              date={form.date}
              onBlockingDuplicate={onTitleDuplicate}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-motif`} className={labelCls}>
              Motif
              {req}
            </Label>
            <ReferentialSelectField
              id={`${idPrefix}-motif`}
              value={form.motifRef}
              options={motifs}
              placeholder={isDialog ? '— Motif —' : '— Sélectionner un motif —'}
              onChange={(motifRef) => onChange((s) => ({ ...s, motifRef }))}
              isCompact={isCompact}
              selectCls={selectCls}
              selectMt={selectMt || 'mt-1'}
            />
          </div>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-desc`} className={labelCls}>
            {descLabel}
          </Label>
          <Textarea
            id={`${idPrefix}-desc`}
            className={isCompact ? 'dg-plan-textarea' : 'mt-1'}
            rows={isExternal ? 1 : isCompact ? 2 : 3}
            maxLength={isExternal ? 500 : undefined}
            value={form.description}
            onChange={(e) => onChange((s) => ({ ...s, description: e.target.value }))}
            placeholder={
              isExternal
                ? 'Précisez le contexte, les points à aborder, les attentes…'
                : isCompact
                  ? 'Optionnel'
                  : 'Précisions optionnelles sur le rendez-vous'
            }
          />
          {isExternal ? (
            <p className="ext-plan-counter">{form.description.length}/500</p>
          ) : null}
        </div>
      </section>

      <section className={sectionCls} id={isExternal ? 'plan-step-slot' : undefined}>
        <p className={sectionTitleCls}>2. Créneau de rendez-vous</p>
        {modalityTabs}
        {presentielHint}
        {onlineHint}

        {isExternal ? (
          <div className="ext-plan-lead-row">
            <label className="ext-plan-urgent" htmlFor={`${idPrefix}-demande-urgente`}>
              <Switch
                id={`${idPrefix}-demande-urgente`}
                className={allDaySwitchCls}
                checked={form.urgencyLevel !== 'NORMAL'}
                onCheckedChange={(on) => {
                  onChange((s) => ({
                    ...s,
                    urgencyLevel: on ? (s.urgencyLevel === 'NORMAL' ? 'URGENT' : s.urgencyLevel) : 'NORMAL',
                    justification: on ? s.justification : '',
                  }));
                  onBlurCheckConflict?.();
                  if (on) {
                    window.setTimeout(() => {
                      const field = document.getElementById(`${idPrefix}-justification`);
                      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      field?.focus({ preventScroll: true });
                    }, 60);
                  }
                }}
              />
              <span>Demande urgente</span>
            </label>
          </div>
        ) : null}
        <div
          className={
            isExternal
              ? 'ext-plan-slot-grid'
              : `${rowGap} ${form.allDay ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`
          }
        >
          <div>
            <Label htmlFor={`${idPrefix}-date`} className={labelCls}>
              Date
              {req}
            </Label>
            <PlanDateField
              id={`${idPrefix}-date`}
              value={form.date}
              onChange={handleDateChange}
              onBlur={onBlurCheckConflict}
              variant={dateFieldVariant}
              className={dateFieldClassWithError}
              isDateDisabled={isDateDisabled}
            />
            <InlineFieldError id={`${idPrefix}-date-error`} message={dateError} />
          </div>
          {!form.allDay ? (
            <>
              <div>
                <Label htmlFor={`${idPrefix}-start`} className={labelCls}>
                  {isExternal ? 'Heure de début' : 'Début'}
                  {req}
                </Label>
                <PlanTimeField
                  id={`${idPrefix}-start`}
                  value={form.startTime}
                  onChange={(startTime) =>
                    onChange((s) => {
                      const next = { ...s, startTime };
                      if (s.endTime && s.endTime <= startTime) {
                        const bumped = minutesToHhMm(hhMmToMinutes(startTime) + 60);
                        next.endTime =
                          officeHoursRestricted && bumped > workDayEnd ? workDayEnd : bumped;
                        if (next.endTime <= startTime) {
                          next.endTime = minutesToHhMm(hhMmToMinutes(startTime) + 15);
                        }
                      }
                      return next;
                    })
                  }
                  onBlur={onBlurCheckConflict}
                  minTime={startMinTime}
                  maxTime={startMaxTime}
                  {...(!isCompact
                    ? { variant: dateFieldVariant, className: dateFieldClass }
                    : { className: dateFieldClass })}
                />
              </div>
              <div>
                <Label htmlFor={`${idPrefix}-end`} className={labelCls}>
                  {isExternal ? 'Heure de fin' : 'Fin'}
                  {req}
                </Label>
                <PlanTimeField
                  id={`${idPrefix}-end`}
                  value={form.endTime}
                  onChange={(endTime) => onChange((s) => ({ ...s, endTime }))}
                  onBlur={onBlurCheckConflict}
                  minTime={endMinTime}
                  maxTime={endMaxTime}
                  {...(!isCompact
                    ? { variant: dateFieldVariant, className: dateFieldClass }
                    : { className: dateFieldClass })}
                />
              </div>
              {isExternal ? (
                <div>
                  <Label className={labelCls}>Durée</Label>
                  <div className="dg-plan-input ext-plan-duration" aria-live="polite">
                    {durationLabel || '—'}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        {resolvedSlotError ? (
          <p className={isCompact ? 'dg-plan-conflict' : 'text-sm text-destructive'}>{resolvedSlotError}</p>
        ) : null}

        {isDialog ? (
          <>
            <div className={`${rowGap} sm:grid-cols-2`}>
              <div>
                <Label htmlFor={`${idPrefix}-urgency`} className={labelCls}>
                  Urgence
                </Label>
                <DgPlanCompactSelect
                  id={`${idPrefix}-urgency`}
                  value={form.urgencyLevel}
                  options={URGENCY_LEVEL_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  onChange={(urgencyLevel) => {
                    onChange((s) => ({
                      ...s,
                      urgencyLevel: urgencyLevel as AppointmentPlanningForm['urgencyLevel'],
                    }));
                    onBlurCheckConflict?.();
                  }}
                />
              </div>
              <div>
                <Label htmlFor={`${idPrefix}-reminder`} className={labelCls}>
                  {reminderLabel}
                </Label>
                <DgPlanCompactSelect
                  id={`${idPrefix}-reminder`}
                  value={form.reminderSelect}
                  options={REMINDER_SELECT_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(reminderSelect) => onChange((s) => ({ ...s, reminderSelect }))}
                />
              </div>
            </div>

            {needsJustification ? (
              <div className={cn('min-w-0', justificationAlert && 'dg-plan-justification--alert')}>
                <Label htmlFor={`${idPrefix}-justification`} className={labelCls}>
                  Justification ({justificationMinChars} car. min.)
                </Label>
                <Textarea
                  id={`${idPrefix}-justification`}
                  className={inlineFieldErrorClass(Boolean(justificationError), 'dg-plan-textarea')}
                  rows={2}
                  value={form.justification}
                  onChange={(e) => onChange((s) => ({ ...s, justification: e.target.value }))}
                  onBlur={onBlurCheckConflict}
                  required
                  aria-invalid={justificationError ? true : undefined}
                  aria-describedby={justificationError ? `${idPrefix}-justification-error` : undefined}
                  placeholder="Raison de l’urgence…"
                />
                <InlineFieldError
                  id={`${idPrefix}-justification-error`}
                  message={justificationError}
                />
              </div>
            ) : null}

            {urgentAllowed ? (
              <div className="rdv-plan-dialog-urgent">
                <p className="dg-plan-label flex min-w-0 items-center gap-1">
                  <Zap className="h-3 w-3 shrink-0 text-amber-600" aria-hidden />
                  <span className="truncate">{PLANNING_URGENT_LABEL}</span>
                </p>
                <Switch
                  id={`${idPrefix}-urgent`}
                  className={allDaySwitchCls}
                  checked={form.urgentOverride}
                  onCheckedChange={(urgentOverride) => {
                    onChange((s) => ({ ...s, urgentOverride }));
                    onBlurCheckConflict?.();
                  }}
                />
              </div>
            ) : null}

            {requesterContactBlock}
            {guestParticipantsBlock}
          </>
        ) : null}
      </section>

      {!isDialog ? (
      <section className={sectionCls} id={isExternal ? 'plan-step-participants' : undefined}>
        <p className={sectionTitleCls}>{isExternal ? '3. Participants' : '3. Paramètres complémentaires'}</p>
        {isExternal ? (
          <p className="ext-plan-section-sub">Personnes concernées par ce rendez-vous.</p>
        ) : null}

        <div className={`${rowGap} sm:grid-cols-2`}>
          <div>
            <Label htmlFor={`${idPrefix}-urgency`} className={labelCls}>
              Niveau d&apos;urgence
            </Label>
            {isCompact ? (
              <DgPlanCompactSelect
                id={`${idPrefix}-urgency`}
                value={form.urgencyLevel}
                options={URGENCY_LEVEL_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                onChange={(urgencyLevel) => {
                  onChange((s) => ({
                    ...s,
                    urgencyLevel: urgencyLevel as AppointmentPlanningForm['urgencyLevel'],
                  }));
                  onBlurCheckConflict?.();
                }}
              />
            ) : (
              <select
                id={`${idPrefix}-urgency`}
                className={`${selectCls} ${selectMt}`.trim()}
                value={form.urgencyLevel}
                onChange={(e) => {
                  onChange((s) => ({
                    ...s,
                    urgencyLevel: e.target.value as AppointmentPlanningForm['urgencyLevel'],
                  }));
                  onBlurCheckConflict?.();
                }}
              >
                {URGENCY_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label htmlFor={`${idPrefix}-reminder`} className={labelCls}>
              {reminderLabel}
            </Label>
            {isCompact ? (
              <DgPlanCompactSelect
                id={`${idPrefix}-reminder`}
                value={form.reminderSelect}
                options={REMINDER_SELECT_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(reminderSelect) => onChange((s) => ({ ...s, reminderSelect }))}
              />
            ) : (
              <select
                id={`${idPrefix}-reminder`}
                className={`${selectCls} ${selectMt}`.trim()}
                value={form.reminderSelect}
                onChange={(e) => onChange((s) => ({ ...s, reminderSelect: e.target.value }))}
              >
                {REMINDER_SELECT_OPTIONS.map((opt) => (
                  <option key={opt.value || 'default'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {needsJustification ? (
          <div
            className={cn(
              isExternal
                ? `ext-plan-justification min-w-0${justificationReady ? ' is-ready' : ''}`
                : 'min-w-0',
              justificationAlert && 'dg-plan-justification--alert'
            )}
          >
            <Label htmlFor={`${idPrefix}-justification`} className={labelCls}>
              Justification de l&apos;urgence (obligatoire, min. {justificationMinChars} car.)
            </Label>
            <Textarea
              id={`${idPrefix}-justification`}
              className={inlineFieldErrorClass(
                Boolean(justificationError),
                compact ? 'dg-plan-textarea' : 'mt-1'
              )}
              rows={compact ? 2 : 3}
              value={form.justification}
              onChange={(e) => onChange((s) => ({ ...s, justification: e.target.value }))}
              onBlur={onBlurCheckConflict}
              required
              aria-invalid={justificationError ? true : undefined}
              aria-describedby={justificationError ? `${idPrefix}-justification-error` : undefined}
              placeholder="Décrivez la raison de l’urgence (contexte, impact, délai…)"
            />
            <InlineFieldError
              id={`${idPrefix}-justification-error`}
              message={justificationError}
            />
          </div>
        ) : null}

        {urgentAllowed ? (
          <div className={isCompact ? 'dg-plan-allday' : 'admin-appt-reschedule-urgent'}>
            <div className={isCompact ? 'flex items-center justify-between gap-2' : 'admin-appt-reschedule-urgent-head'}>
              <p className={isCompact ? 'dg-plan-label flex min-w-0 items-center gap-1' : 'admin-appt-reschedule-urgent-title'}>
                <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                <span className="truncate">{PLANNING_URGENT_LABEL}</span>
              </p>
              <Switch
                id={`${idPrefix}-urgent`}
                className={isCompact ? allDaySwitchCls : 'admin-appt-reschedule-urgent-switch'}
                checked={form.urgentOverride}
                onCheckedChange={(urgentOverride) => {
                  onChange((s) => ({ ...s, urgentOverride }));
                  onBlurCheckConflict?.();
                }}
              />
            </div>
            {!isCompact ? (
              <p className="admin-appt-reschedule-urgent-desc">{PLANNING_URGENT_TOGGLE_DESC}</p>
            ) : null}
          </div>
        ) : null}

        {isExternal ? (
          <div>
            <Label htmlFor={`${idPrefix}-participant`} className={labelCls}>
              Participants
            </Label>
            <ParticipantUsersMultiSelect
              id={`${idPrefix}-participant`}
              users={participantUsers}
              value={form.participantUserIds}
              onChange={(participantUserIds) => onChange((s) => ({ ...s, participantUserIds }))}
              variant={isCompact ? 'compact' : 'default'}
              placeholder="Sélectionner un ou plusieurs participants…"
            />
          </div>
        ) : (
          <>
            {requesterContactBlock}
            {guestParticipantsBlock}
          </>
        )}

      </section>
      ) : null}
    </div>
  );
}
