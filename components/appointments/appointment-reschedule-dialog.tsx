'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  Clock,
  LayoutList,
  Loader2,
  MapPin,
  Tag,
  UserRound,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { Switch } from '@/components/ui/switch';
import { AppointmentModalityTabs } from '@/components/appointments/appointment-modality-tabs';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_URGENCY_LABELS,
  appointmentUrgencyBadgeClass,
} from '@/lib/dg/appointments-review';
import {
  displayAppointmentType,
  displayLocation,
  displayMotif,
  displayRequesterName,
  isAppointmentOnlineMeeting,
} from '@/lib/dg/appointment-review-display';
import {
  parseAppointmentMeta,
  readPreRescheduleSlot,
} from '@/lib/dg/appointment-request-meta';
import { formatDateLong, formatIsoDate, formatIsoDateInAppTz, formatTimeInAppTz, formatTimeRange } from '@/lib/datetime';
import {
  DEFAULT_SCHEDULING_CONTEXT,
  isPlanningDateBlocked,
  normalizeSchedulingContext,
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
import { normalizeBusinessRules } from '@/lib/dg/appointment-business-rules';
import {
  PLANNING_URGENT_TOGGLE_DESC,
  PLANNING_URGENT_TOGGLE_TITLE,
} from '@/lib/dg/urgent-slot-priority';
import { cn } from '@/lib/utils';

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

function laterHhMm(a: string, b: string): string {
  return a > b ? a : b;
}

function nextSlotAfterNow(nowHhMm: string, stepMinutes = 15): string {
  return minutesToHhMm(Math.ceil((hhMmToMinutes(nowHhMm) + 1) / stepMinutes) * stepMinutes);
}

function slotFromIso(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return {
    date: formatIsoDateInAppTz(start),
    start: formatTimeInAppTz(start),
    end: formatTimeInAppTz(end),
  };
}

export type RescheduleSubmitPayload = {
  date: string;
  startTime: string;
  endTime: string;
  urgentOverride: boolean;
  isOnlineMeeting: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentReviewItem | null;
  mode: 'approve' | 'reschedule';
  /** Le créneau choisi est validé tout de suite (approbation ou report d’un RDV déjà approuvé). */
  validatesNow?: boolean;
  urgentAllowed?: boolean;
  loading?: boolean;
  onSubmit: (payload: RescheduleSubmitPayload) => void | Promise<void>;
};

const btnCancel =
  'admin-appt-detail-btn inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-45';

const btnConfirmApprove =
  'admin-appt-detail-btn inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-amber-600 bg-amber-500 px-3 text-xs font-semibold text-white transition-colors hover:border-amber-700 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5';

const btnConfirmReschedule =
  'admin-appt-detail-btn inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:border-emerald-800 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5';

function isSlotPickerTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-slot="popover-content"], [data-radix-popper-content-wrapper], .dg-plan-date-popover, .dg-plan-time-popover, .rdp-root'
      )
    )
  );
}

export function AppointmentRescheduleDialog({
  open,
  onOpenChange,
  appointment,
  mode,
  validatesNow = false,
  urgentAllowed = false,
  loading = false,
  onSubmit,
}: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [urgentOverride, setUrgentOverride] = useState(false);
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false);
  const [schedulingContext, setSchedulingContext] =
    useState<AppointmentSchedulingContext>(DEFAULT_SCHEDULING_CONTEXT);
  const [leadRule, setLeadRule] = useState<MinSubmissionLeadRule>({
    enabled: false,
    minHours: 0,
    minDays: 0,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open || !appointment) return;
    const slot = slotFromIso(appointment.startAt, appointment.endAt);
    setDate(slot.date);
    setStartTime(slot.start);
    setEndTime(slot.end);
    setUrgentOverride(appointment.urgentOverride);
    setIsOnlineMeeting(isAppointmentOnlineMeeting(appointment));
  }, [open, appointment]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch('/api/appointments/constraints')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        if (j.scheduling) setSchedulingContext(normalizeSchedulingContext(j.scheduling));
        if (j.rules) {
          const rules = normalizeBusinessRules(j.rules);
          setLeadRule(rules.minSubmissionLead);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open, date]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const normalizedLeadRule = useMemo(() => normalizeMinSubmissionLeadRule(leadRule), [leadRule]);
  const politenessWaived = Boolean(appointment && appointment.urgencyLevel !== 'NORMAL');
  const effectiveLeadRule = useMemo(
    () => (politenessWaived ? { ...normalizedLeadRule, enabled: false } : normalizedLeadRule),
    [politenessWaived, normalizedLeadRule]
  );
  const requestedSlot = useMemo(
    () => (appointment ? slotFromIso(appointment.startAt, appointment.endAt) : null),
    [appointment]
  );
  const tracedStart = useMemo(() => {
    if (!appointment) return null;
    const stored = readPreRescheduleSlot(parseAppointmentMeta(appointment.description).meta);
    return stored?.startAt ?? new Date(appointment.startAt);
  }, [appointment]);
  /** Le délai se mesure depuis la création de la demande, pas depuis l’ouverture de cette fenêtre. */
  const leadReference = useMemo(() => {
    if (!appointment?.createdAt) return now;
    const created = new Date(appointment.createdAt);
    return Number.isNaN(created.getTime()) ? now : created;
  }, [appointment?.createdAt, now]);

  const isDateDisabled = useCallback(
    (day: Date) => {
      const iso = formatIsoDate(day);
      if (iso < formatIsoDateInAppTz(now)) return true;
      if (isPlanningDateBlocked(schedulingContext, iso, { isOnlineMeeting })) return true;
      if (requestedSlot && iso === requestedSlot.date) return false;
      if (isDateBlockedByMinSubmissionLead(iso, leadReference, effectiveLeadRule)) return true;
      return false;
    },
    [schedulingContext, effectiveLeadRule, leadReference, isOnlineMeeting, requestedSlot, now]
  );

  const presentielBlockedForDate = Boolean(
    date && isPlanningDateBlocked(schedulingContext, date, { isOnlineMeeting: false })
  );
  const presentielDisabledReason = date
    ? validatePlanningDate(schedulingContext, date, { isOnlineMeeting: false })
    : null;

  const officeHoursRestricted = !schedulingContext.allowOutsideHours && !isOnlineMeeting;
  const workDayStart = schedulingContext.workDayStart;
  const workDayEnd = schedulingContext.workDayEnd;
  const officeMinTime = officeHoursRestricted ? workDayStart : undefined;
  const officeMaxTime = officeHoursRestricted ? workDayEnd : undefined;

  const leadStartMin = date
    ? earliestSelectableStartTimeOnDate(date, leadReference, effectiveLeadRule)
    : undefined;
  const isSelectedDateToday = Boolean(date) && date === formatIsoDateInAppTz(now);
  const systemTodayMin =
    !effectiveLeadRule.enabled && isSelectedDateToday
      ? nextSlotAfterNow(formatTimeInAppTz(now))
      : undefined;

  const startMinTime = [officeMinTime, leadStartMin, systemTodayMin]
    .filter((v): v is string => Boolean(v))
    .reduce<string | undefined>((acc, v) => (acc ? laterHhMm(acc, v) : v), undefined);
  const startMaxTime = officeMaxTime;
  const endMinTime = startTime
    ? minutesToHhMm(hhMmToMinutes(startTime) + 15)
    : startMinTime
      ? minutesToHhMm(hhMmToMinutes(startMinTime) + 15)
      : officeMinTime;
  const endMaxTime = officeMaxTime;

  useEffect(() => {
    if (!date) return;
    const keepsRequestedDate = Boolean(requestedSlot && date === requestedSlot.date);
    if (
      !keepsRequestedDate &&
      isDateBlockedByMinSubmissionLead(date, leadReference, effectiveLeadRule)
    ) {
      setDate('');
      return;
    }
    const blockedForPresentiel = isPlanningDateBlocked(schedulingContext, date, {
      isOnlineMeeting: false,
    });
    if (!blockedForPresentiel) return;
    if (isOnlineMeeting) return;
    setIsOnlineMeeting(true);
  }, [date, leadReference, effectiveLeadRule, schedulingContext, isOnlineMeeting, requestedSlot]);

  const handleDateChange = useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      if (!nextDate) return;
      if (requestedSlot && nextDate === requestedSlot.date) {
        setStartTime(requestedSlot.start);
        setEndTime(requestedSlot.end);
        return;
      }
      const times = resolvePlanningSlotDefaultsForDate({
        date: nextDate,
        now: leadReference,
        rule: effectiveLeadRule,
        workDayStart,
        workDayEnd,
        officeHoursRestricted,
      });
      setStartTime(times.startTime);
      setEndTime(times.endTime);
    },
    [leadReference, effectiveLeadRule, officeHoursRestricted, requestedSlot, workDayEnd, workDayStart]
  );

  useEffect(() => {
    if (
      requestedSlot &&
      date === requestedSlot.date &&
      startTime === requestedSlot.start &&
      endTime === requestedSlot.end
    ) {
      return;
    }
    const minStart = startMinTime ?? (officeHoursRestricted ? workDayStart : '00:00');
    const maxTime = officeHoursRestricted ? workDayEnd : '23:45';
    let nextStart = startTime;
    let nextEnd = endTime;
    let changed = false;

    if (nextStart && (nextStart < minStart || nextStart > maxTime)) {
      nextStart = minStart <= maxTime ? minStart : maxTime;
      changed = true;
    }
    if (nextEnd && nextEnd > maxTime) {
      nextEnd = maxTime;
      changed = true;
    }
    if (nextStart && nextEnd && nextEnd <= nextStart) {
      nextEnd = minutesToHhMm(Math.min(hhMmToMinutes(nextStart) + 60, hhMmToMinutes(maxTime)));
      if (nextEnd <= nextStart) nextEnd = minutesToHhMm(hhMmToMinutes(nextStart) + 15);
      if (nextEnd > maxTime) nextEnd = maxTime;
      changed = true;
    }
    if (!changed) return;
    setStartTime(nextStart);
    setEndTime(nextEnd);
  }, [
    startMinTime,
    officeHoursRestricted,
    workDayStart,
    workDayEnd,
    startTime,
    endTime,
    date,
    requestedSlot,
  ]);

  const handleStartChange = (next: string) => {
    setStartTime(next);
    setEndTime((prev) => {
      if (prev > next) return prev;
      const bumped = minutesToHhMm(hhMmToMinutes(next) + 60);
      const maxTime = officeMaxTime ?? '23:45';
      return bumped > maxTime ? maxTime : bumped;
    });
  };

  const handleSubmit = () => {
    if (!date) return;
    if (isDateDisabled(new Date(`${date}T12:00:00`))) return;
    void onSubmit({
      date,
      startTime,
      endTime,
      urgentOverride: urgentOverride && urgentAllowed,
      isOnlineMeeting,
    });
  };

  const isApproveMode = mode === 'approve';
  const title = validatesNow && isApproveMode
    ? 'Valider un autre créneau'
    : isApproveMode
      ? 'Proposer un nouveau créneau'
      : 'Reporter le rendez-vous';
  const subtitle = validatesNow
    ? 'Le nouveau créneau est validé immédiatement.'
    : isApproveMode
      ? 'La date ou le mode sont enregistrés. Le rendez-vous reste en attente de validation.'
      : 'Le rendez-vous repassera en attente de validation sur le nouveau créneau';
  const dateInvalid = Boolean(date) && isDateDisabled(new Date(`${date}T12:00:00`));

  const panel = (
    <>
        <header className="admin-appt-reschedule-header">
          <div className="admin-appt-reschedule-header-icon" aria-hidden>
            {isApproveMode ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 pr-6">
            <DialogTitle className="admin-appt-reschedule-title">{title}</DialogTitle>
            <DialogDescription className="admin-appt-reschedule-subtitle">{subtitle}</DialogDescription>
          </div>
        </header>

        {appointment ? (
          <div className="admin-appt-reschedule-body">
            <div className="admin-appt-reschedule-hero">
              <p className="admin-appt-reschedule-hero-title">{appointment.title}</p>
              <span
                className={cn(
                  'admin-appt-badge',
                  appointmentUrgencyBadgeClass(appointment.urgencyLevel)
                )}
              >
                {APPOINTMENT_URGENCY_LABELS[appointment.urgencyLevel]}
              </span>
            </div>

            <div className="admin-appt-reschedule-requested">
              <span className="admin-appt-reschedule-requested-label">
                Heure de début avant reprogrammation
              </span>
              <p className="admin-appt-reschedule-requested-value">
                {tracedStart ? formatTimeInAppTz(tracedStart) : '—'}
                {tracedStart ? (
                  <>
                    <span className="admin-appt-reschedule-requested-sep">·</span>
                    <span className="capitalize">{formatDateLong(tracedStart)}</span>
                  </>
                ) : null}
              </p>
              <span className="admin-appt-reschedule-requested-label">Créneau en place</span>
              <p className="admin-appt-reschedule-requested-value capitalize">
                {formatDateLong(appointment.startAt)}
                <span className="admin-appt-reschedule-requested-sep">·</span>
                <span>{formatTimeRange(appointment.startAt, appointment.endAt)}</span>
              </p>
            </div>

            <div className="admin-appt-reschedule-meta-grid">
              <div className="admin-appt-reschedule-meta-item">
                <span className="admin-appt-reschedule-meta-label">
                  <UserRound className="h-3 w-3" aria-hidden />
                  Demandeur
                </span>
                <span className="admin-appt-reschedule-meta-value">
                  {displayRequesterName(appointment)}
                </span>
              </div>
              <div className="admin-appt-reschedule-meta-item">
                <span className="admin-appt-reschedule-meta-label">
                  <LayoutList className="h-3 w-3" aria-hidden />
                  Type
                </span>
                <span className="admin-appt-reschedule-meta-value">
                  {displayAppointmentType(appointment)}
                </span>
              </div>
              <div className="admin-appt-reschedule-meta-item">
                <span className="admin-appt-reschedule-meta-label">
                  <MapPin className="h-3 w-3" aria-hidden />
                  Emplacement
                </span>
                <span className="admin-appt-reschedule-meta-value">
                  {isOnlineMeeting ? 'En ligne (Teams)' : displayLocation(appointment)}
                </span>
              </div>
              <div className="admin-appt-reschedule-meta-item">
                <span className="admin-appt-reschedule-meta-label">
                  <Tag className="h-3 w-3" aria-hidden />
                  Motif
                </span>
                <span className="admin-appt-reschedule-meta-value">{displayMotif(appointment)}</span>
              </div>
            </div>

            <section className="admin-appt-reschedule-form">
              <p className="admin-appt-reschedule-form-title">
                <Clock className="h-3 w-3" aria-hidden />
                Nouveau créneau
              </p>
              <AppointmentModalityTabs
                idPrefix="rs"
                compact
                dense
                value={isOnlineMeeting ? 'online' : 'presentiel'}
                onChange={(value) => {
                  if (value === 'presentiel' && presentielBlockedForDate) return;
                  setIsOnlineMeeting(value === 'online');
                }}
                presentielDisabled={presentielBlockedForDate}
                presentielDisabledReason={presentielDisabledReason}
                className="admin-appt-reschedule-modality"
              />
              {presentielBlockedForDate && presentielDisabledReason ? (
                <p className="plan-modality-presentiel-hint" role="status">
                  {presentielDisabledReason} Seul le format <strong>En ligne</strong> est disponible
                  pour cette date.
                </p>
              ) : null}
              <div className="admin-appt-reschedule-fields">
                <div className="admin-appt-reschedule-field admin-appt-reschedule-field--date">
                  <label htmlFor="rs-date" className="admin-appt-reschedule-field-label">
                    Date
                  </label>
                  <FrenchDateField
                    id="rs-date"
                    variant="compact"
                    className="admin-appt-reschedule-picker"
                    popoverClassName="z-[120]"
                    value={date}
                    onChange={handleDateChange}
                    isDateDisabled={isDateDisabled}
                  />
                </div>
                <div className="admin-appt-reschedule-field">
                  <label htmlFor="rs-start" className="admin-appt-reschedule-field-label">
                    Début
                  </label>
                  <FrenchTimeField
                    id="rs-start"
                    variant="compact"
                    className="admin-appt-reschedule-picker"
                    popoverClassName="z-[120]"
                    value={startTime}
                    onChange={handleStartChange}
                    minTime={startMinTime}
                    maxTime={startMaxTime}
                  />
                </div>
                <div className="admin-appt-reschedule-field">
                  <label htmlFor="rs-end" className="admin-appt-reschedule-field-label">
                    Fin
                  </label>
                  <FrenchTimeField
                    id="rs-end"
                    variant="compact"
                    className="admin-appt-reschedule-picker"
                    popoverClassName="z-[120]"
                    value={endTime}
                    onChange={setEndTime}
                    minTime={endMinTime}
                    maxTime={endMaxTime}
                  />
                </div>
              </div>
            </section>

            {urgentAllowed ? (
              <div className="admin-appt-reschedule-urgent">
                <div className="admin-appt-reschedule-urgent-head">
                  <p className="admin-appt-reschedule-urgent-title">
                    <Zap className="h-3 w-3 shrink-0" aria-hidden />
                    {PLANNING_URGENT_TOGGLE_TITLE}
                  </p>
                  <Switch
                    id="rs-urgent"
                    className="admin-appt-reschedule-urgent-switch"
                    checked={urgentOverride}
                    onCheckedChange={setUrgentOverride}
                  />
                </div>
                <p className="admin-appt-reschedule-urgent-desc">
                  {validatesNow
                    ? 'Le rendez-vous reste approuvé. Il est seulement signalé comme ultra urgent sur l’agenda.'
                    : PLANNING_URGENT_TOGGLE_DESC}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="admin-appt-reschedule-footer">
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
            className={isApproveMode && !validatesNow ? btnConfirmApprove : btnConfirmReschedule}
            disabled={loading || !date || dateInvalid}
            onClick={handleSubmit}
          >
            {loading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : isApproveMode ? (
              <CalendarClock aria-hidden />
            ) : (
              <Calendar aria-hidden />
            )}
            {validatesNow ? 'Valider ce créneau' : isApproveMode ? 'Enregistrer en attente' : 'Confirmer le report'}
          </button>
        </footer>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="admin-appt-reschedule-overlay"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          if (isSlotPickerTarget(event.target)) {
            event.preventDefault();
            return;
          }
          event.detail.originalEvent.preventDefault();
          event.detail.originalEvent.stopPropagation();
        }}
        onInteractOutside={(event) => {
          if (isSlotPickerTarget(event.target)) {
            event.preventDefault();
            return;
          }
          event.detail.originalEvent.preventDefault();
          event.detail.originalEvent.stopPropagation();
        }}
        onFocusOutside={(event) => {
          if (isSlotPickerTarget(event.target)) event.preventDefault();
        }}
        className={cn(
          'admin-theme admin-appt-reschedule-dialog admin-appt-reschedule-dialog--compact gap-0 border-[var(--admin-border)] p-0 sm:max-w-[27rem]',
          isApproveMode
            ? 'admin-appt-reschedule-dialog--approve'
            : 'admin-appt-reschedule-dialog--reschedule'
        )}
      >
        {panel}
      </DialogContent>
    </Dialog>
  );
}
