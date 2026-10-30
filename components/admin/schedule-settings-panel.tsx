'use client';

import type { FormEvent, ReactNode } from 'react';
import {
  CalendarDays,
  Clock,
  Layers,
  Loader2,
  Save,
  Shield,
  ShieldCheck,
  Timer,
  Ban,
} from 'lucide-react';
import {
  AppointmentConstraintsFields,
  type AppointmentConstraintsVariant,
  getConstraintsPreviewLines,
  getConstraintsPreviewSummary,
} from '@/components/admin/appointment-constraints-fields';
import type { AppointmentBusinessRules } from '@/lib/dg/appointment-business-rules';
import { Button } from '@/components/ui/button';
import { FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { estimateScheduleCapacity, timeToMinutes } from '@/lib/dg/schedule-capacity';
import { AUTO_REJECT_BEFORE_START_PRESETS, DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES } from '@/lib/dg/appointment-expiry';
import { ALLOWED_APPOINTMENT_DURATIONS } from '@/lib/dg/referential-types';
import { WEEKDAY_OPTIONS, type WeekdayKey } from '@/lib/dg/platform-config';
import type { ScheduleSettings } from '@/lib/services/referentials-admin';
import { cn } from '@/lib/utils';

const WEEKDAY_PRESETS: { label: string; days: WeekdayKey[] }[] = [
  { label: 'Lun – Ven', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: 'Lun – Sam', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
  {
    label: 'Tous les jours',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },
];

export function ScheduleSettingsPanel({
  schedule,
  onChange,
  onToggleWeekday,
  businessRules,
  onBusinessRulesChange,
  showAside = true,
  saving = false,
  onSubmit,
  formId = 'schedule-form',
  title = 'Horaires & créneaux',
  description = "Définissez la plage d'ouverture, les paramètres de réservation des salles, les contraintes métier et les jours disponibles.",
  compact = false,
  variant = 'default',
}: {
  schedule: ScheduleSettings;
  onChange: (s: ScheduleSettings) => void;
  onToggleWeekday: (key: WeekdayKey) => void;
  businessRules?: AppointmentBusinessRules | null;
  onBusinessRulesChange?: (rules: AppointmentBusinessRules) => void;
  showAside?: boolean;
  saving?: boolean;
  onSubmit?: (e: FormEvent) => void;
  formId?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  variant?: AppointmentConstraintsVariant;
}) {
  const isReferentials = variant === 'referentials';
  const stepAutoReject = isReferentials ? 2 : null;
  const stepDurations = isReferentials ? 3 : 2;
  const stepWeekdays = isReferentials ? 4 : 5;
  const stepConstraints = isReferentials ? 5 : 6;

  const workingLabels = WEEKDAY_OPTIONS.filter((d) =>
    (schedule.workingDays ?? []).includes(d.key)
  ).map((d) => d.label);
  const { daily: dailySlots, weekly: weeklySlots } = estimateScheduleCapacity(schedule);
  const allowed = schedule.allowedDurationMinutes ?? [...ALLOWED_APPOINTMENT_DURATIONS];
  const autoRejectMinutes =
    schedule.autoRejectBeforeStartMinutes ?? DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES;

  const applyPreset = (days: WeekdayKey[]) => {
    onChange({ ...schedule, workingDays: [...days] });
  };

  const toggleAllowedDuration = (min: number) => {
    const set = new Set(allowed);
    if (set.has(min)) {
      if (set.size <= 1) return;
      set.delete(min);
    } else {
      set.add(min);
    }
    const next = [...set].sort((a, b) => a - b) as typeof allowed;
    const defaultDuration = next.includes(schedule.defaultAppointmentDurationMinutes)
      ? schedule.defaultAppointmentDurationMinutes
      : next[0]!;
    onChange({
      ...schedule,
      allowedDurationMinutes: next,
      defaultAppointmentDurationMinutes: defaultDuration,
      slotDurationMinutes: defaultDuration,
    });
  };

  const layoutClass = cn(
    showAside ? 'admin-schedule-layout' : 'admin-schedule-layout admin-schedule-layout-embedded',
    compact && 'admin-schedule-layout-compact'
  );

  const inner = (
    <>
      <div className={cn('admin-schedule-main', compact ? 'space-y-2.5' : 'space-y-4')}>
        <header className="admin-schedule-header">
          <h2 className="relative text-lg font-semibold tracking-tight text-[var(--admin-foreground)]">
            {title}
          </h2>
          <p className="relative mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <ScheduleDayTimeline schedule={schedule} />
        </header>

        <ScheduleSection step={1} icon={Clock} title="Plage horaire" compact={compact}>
          <div className="admin-schedule-time-grid">
            <ScheduleField label="Heure de début de travail" htmlFor="workDayStart" compact={compact}>
              <FrenchTimeField
                id="workDayStart"
                className="admin-field admin-schedule-time-input"
                value={schedule.workDayStart}
                onChange={(workDayStart) => onChange({ ...schedule, workDayStart })}
                stepMinutes={5}
              />
            </ScheduleField>
            <ScheduleField label="Heure de fin de travail" htmlFor="workDayEnd" compact={compact}>
              <FrenchTimeField
                id="workDayEnd"
                className="admin-field admin-schedule-time-input"
                value={schedule.workDayEnd}
                onChange={(workDayEnd) => onChange({ ...schedule, workDayEnd })}
                stepMinutes={5}
              />
            </ScheduleField>
          </div>
        </ScheduleSection>

        {isReferentials ? (
          <ScheduleSection step={stepAutoReject!} icon={Ban} title="Rejet automatique des rendez-vous">
            <p className="mb-3 text-xs text-muted-foreground">
              Si l&apos;assistante n&apos;a pas validé une demande, elle est refusée automatiquement avant le
              début du créneau, selon le délai configuré ci-dessous.
            </p>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {AUTO_REJECT_BEFORE_START_PRESETS.map((preset) => {
                  const active = autoRejectMinutes === preset.minutes;
                  return (
                    <button
                      key={preset.minutes}
                      type="button"
                      data-active={active}
                      className="admin-duration-chip"
                      onClick={() =>
                        onChange({ ...schedule, autoRejectBeforeStartMinutes: preset.minutes })
                      }
                    >
                      {preset.label} avant
                    </button>
                  );
                })}
              </div>
              <ScheduleField
                label="Délai avant le début du créneau"
                htmlFor="autoRejectBeforeStartMinutes"
              >
                <div className="admin-input-group w-full sm:max-w-xs">
                  <Input
                    id="autoRejectBeforeStartMinutes"
                    type="number"
                    min={0}
                    max={1440}
                    step={15}
                    className="admin-input-group-field"
                    value={autoRejectMinutes}
                    onChange={(e) =>
                      onChange({
                        ...schedule,
                        autoRejectBeforeStartMinutes: Math.max(
                          0,
                          Math.min(1440, Number(e.target.value) || 0)
                        ),
                      })
                    }
                  />
                  <span className="admin-input-group-suffix">min</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  0 = désactivé · 120 min = 2 h avant le début (valeur par défaut)
                </p>
              </ScheduleField>
            </div>
          </ScheduleSection>
        ) : null}

        <ScheduleSection
          step={stepDurations}
          icon={Timer}
          title="Durées & enchaînement des réservations de salles"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Ces réglages s&apos;appliquent uniquement à la grille de disponibilité et aux conflits entre
            réservations de salles — pas aux rendez-vous DGA.
          </p>
          <div className="space-y-4">
            <ScheduleField label="Durée par défaut d'une réservation" htmlFor="defaultDuration">
              <select
                id="defaultDuration"
                className="admin-field h-11 w-full rounded-lg border border-[var(--admin-border)] bg-card px-3 text-sm"
                value={schedule.defaultAppointmentDurationMinutes}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({
                    ...schedule,
                    defaultAppointmentDurationMinutes: n,
                    slotDurationMinutes: n,
                  });
                }}
              >
                {allowed.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </ScheduleField>
            <div>
              <p className="mb-2 text-sm font-medium">Durées autorisées</p>
              <div className="flex flex-wrap gap-2">
                {ALLOWED_APPOINTMENT_DURATIONS.map((m) => {
                  const on = allowed.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      data-active={on}
                      className="admin-duration-chip"
                      onClick={() => toggleAllowedDuration(m)}
                    >
                      {m} min
                    </button>
                  );
                })}
              </div>
            </div>
            <ScheduleField label="Temps tampon entre deux réservations" htmlFor="buffer">
              <div className="admin-input-group w-full sm:max-w-xs">
                <Input
                  id="buffer"
                  type="number"
                  min={0}
                  max={120}
                  className="admin-input-group-field"
                  value={schedule.bufferMinutes}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      bufferMinutes: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="admin-input-group-suffix">min</span>
              </div>
            </ScheduleField>
          </div>
        </ScheduleSection>

        {!isReferentials ? (
          <ScheduleSection step={3} icon={Layers} title="Plafonds de planification">
            <div className="grid gap-4 sm:grid-cols-2">
              <ScheduleField label="Nombre maximal de rendez-vous par jour" htmlFor="maxDay">
                <div className="admin-input-group">
                  <Input
                    id="maxDay"
                    type="number"
                    min={0}
                    max={99}
                    className="admin-input-group-field"
                    value={schedule.maxAppointmentsPerDay}
                    onChange={(e) =>
                      onChange({
                        ...schedule,
                        maxAppointmentsPerDay: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="admin-input-group-suffix">max</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">0 = illimité (capacité théorique)</p>
              </ScheduleField>
              <ScheduleField label="Nombre maximal de rendez-vous par semaine" htmlFor="maxWeek">
                <div className="admin-input-group">
                  <Input
                    id="maxWeek"
                    type="number"
                    min={0}
                    max={500}
                    className="admin-input-group-field"
                    value={schedule.maxAppointmentsPerWeek}
                    onChange={(e) =>
                      onChange({
                        ...schedule,
                        maxAppointmentsPerWeek: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="admin-input-group-suffix">max</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">0 = illimité</p>
              </ScheduleField>
            </div>
          </ScheduleSection>
        ) : null}

        {!isReferentials ? (
          <ScheduleSection step={4} icon={Shield} title="Restrictions">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Rendez-vous hors horaires</p>
                  <p className="text-xs text-muted-foreground">
                    Autoriser la planification en dehors de la plage horaire.
                  </p>
                </div>
                <Switch
                  checked={schedule.allowOutsideHours}
                  onCheckedChange={(v) => onChange({ ...schedule, allowOutsideHours: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Rendez-vous le week-end</p>
                  <p className="text-xs text-muted-foreground">
                    Autoriser samedi et dimanche même si non ouvrables.
                  </p>
                </div>
                <Switch
                  checked={schedule.allowWeekendAppointments}
                  onCheckedChange={(v) => onChange({ ...schedule, allowWeekendAppointments: v })}
                />
              </div>
            </div>
          </ScheduleSection>
        ) : null}

        <ScheduleSection
          step={stepWeekdays}
          icon={CalendarDays}
          title="Jours ouvrables"
          compact={compact}
        >
          <div className={cn('admin-weekday-picker', compact && 'admin-weekday-picker--compact')}>
            <p className="admin-weekday-picker-hint">
              Jours disponibles pour la planification des rendez-vous.
            </p>
            <div className="admin-schedule-quick">
              {WEEKDAY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="admin-schedule-quick-btn"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="admin-weekday-grid">
              {WEEKDAY_OPTIONS.map((d) => {
                const on = (schedule.workingDays ?? []).includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    data-active={on}
                    className="admin-weekday-pill"
                    onClick={() => onToggleWeekday(d.key)}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </ScheduleSection>

        {businessRules && onBusinessRulesChange ? (
          <ScheduleSection
            step={stepConstraints}
            icon={ShieldCheck}
            title="Contraintes métier — assistante de direction"
          >
            <AppointmentConstraintsFields
              rules={businessRules}
              onChange={onBusinessRulesChange}
              showIntro
              variant={variant}
            />
          </ScheduleSection>
        ) : null}
      </div>

      {showAside ? (
        <aside className="admin-schedule-aside">
          <SchedulePreviewAside
            schedule={schedule}
            allowed={allowed}
            workingLabels={workingLabels}
            dailySlots={dailySlots}
            weeklySlots={weeklySlots}
            businessRules={businessRules ?? undefined}
            variant={variant}
          />
          {onSubmit && !compact ? (
            <>
              <Button
                type="submit"
                className="h-11 w-full bg-[var(--admin-primary)] text-base font-medium shadow-md hover:bg-[var(--admin-primary-hover)]"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] leading-snug text-muted-foreground">
                Horaires, réservations de salles et contraintes métier appliqués immédiatement.
              </p>
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );

  if (onSubmit) {
    return (
      <form id={formId} onSubmit={onSubmit} className={layoutClass}>
        {inner}
      </form>
    );
  }

  return <div className={layoutClass}>{inner}</div>;
}

export function SchedulePreviewAside({
  schedule,
  allowed,
  workingLabels,
  dailySlots,
  weeklySlots,
  businessRules,
  variant = 'default',
}: {
  schedule: ScheduleSettings;
  allowed: number[];
  workingLabels: string[];
  dailySlots: number;
  weeklySlots: number;
  businessRules?: AppointmentBusinessRules;
  variant?: AppointmentConstraintsVariant;
}) {
  const isReferentials = variant === 'referentials';
  const autoRejectMinutes =
    schedule.autoRejectBeforeStartMinutes ?? DEFAULT_AUTO_REJECT_BEFORE_START_MINUTES;
  const constraintsSummary = businessRules ? getConstraintsPreviewSummary(businessRules, variant) : null;
  const constraintsLines = businessRules ? getConstraintsPreviewLines(businessRules, variant) : [];
  return (
    <div className="admin-schedule-preview">
      <div className="admin-schedule-preview-head">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-primary)]">
          Aperçu
        </p>
        <p className="mt-1 text-base font-semibold text-[var(--admin-foreground)]">Récapitulatif actuel</p>
      </div>
      <div className="admin-schedule-preview-body">
        <PreviewRow icon={Clock} label="Journée" value={`${schedule.workDayStart} → ${schedule.workDayEnd}`} />
        <PreviewRow
          icon={Timer}
          label="Durée salles (défaut)"
          value={`${schedule.defaultAppointmentDurationMinutes} min`}
        />
        <PreviewRow icon={Timer} label="Durées salles autorisées" value={`${allowed.join(', ')} min`} />
        <PreviewRow icon={Layers} label="Tampon salles" value={`${schedule.bufferMinutes} min`} />
        {!isReferentials ? (
          <PreviewRow
            icon={Layers}
            label="Plafonds"
            value={`${schedule.maxAppointmentsPerDay || '∞'} / j · ${schedule.maxAppointmentsPerWeek || '∞'} / sem.`}
          />
        ) : null}
        <PreviewRow
          icon={CalendarDays}
          label="Jours actifs"
          value={workingLabels.length > 0 ? workingLabels.join(' · ') : '—'}
        />
        {isReferentials ? (
          <PreviewRow
            icon={Ban}
            label="Rejet auto RDV"
            value={
              autoRejectMinutes > 0
                ? `${autoRejectMinutes} min avant le début`
                : 'Désactivé'
            }
          />
        ) : null}
        {constraintsSummary ? (
          <PreviewRow
            icon={ShieldCheck}
            label="Règles métier"
            value={`${constraintsSummary.active} / ${constraintsSummary.total} actives`}
          />
        ) : null}
      </div>
      {constraintsLines.length > 0 ? (
        <div className="mt-3 border-t border-[var(--admin-border)] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contraintes assistante
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {constraintsLines.map((line) => (
              <li key={line.label}>
                <span className="font-medium text-[var(--admin-foreground)]">{line.label}</span>
                <span className="block text-muted-foreground">{line.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="admin-schedule-preview-metric">
        <div className="admin-schedule-metric-box">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Créneaux salles / jour
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--admin-primary)]">{dailySlots}</p>
        </div>
        <div className="admin-schedule-metric-box">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Créneaux salles / semaine
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--admin-primary)]">{weeklySlots}</p>
        </div>
      </div>
    </div>
  );
}

function ScheduleDayTimeline({ schedule }: { schedule: ScheduleSettings }) {
  const start = timeToMinutes(schedule.workDayStart);
  const end = timeToMinutes(schedule.workDayEnd);
  const spanStart = start - 60;
  const spanEnd = end + 60;
  const range = Math.max(spanEnd - spanStart, 60);
  const toPct = (m: number) => Math.max(0, Math.min(100, ((m - spanStart) / range) * 100));

  const workLeft = toPct(start);
  const workRight = toPct(end);
  const invalid = end <= start;

  return (
    <div className="admin-schedule-timeline" role="img" aria-label="Visualisation de la journée type">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--admin-foreground)]">Journée type</p>
        {invalid ? (
          <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            Fin avant le début
          </span>
        ) : null}
      </div>
      <div className="admin-schedule-timeline-track">
        {!invalid ? (
          <div
            className="admin-schedule-timeline-work"
            style={{ left: `${workLeft}%`, width: `${Math.max(workRight - workLeft, 2)}%` }}
          />
        ) : null}
      </div>
      <div className="admin-schedule-timeline-labels">
        <span>{schedule.workDayStart}</span>
        <span>{schedule.workDayEnd}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-[var(--admin-primary)]/85" aria-hidden />
          Cabinet ouvert
        </span>
      </div>
    </div>
  );
}

function ScheduleSection({
  step,
  icon: Icon,
  title,
  children,
  compact = false,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={cn('admin-schedule-section pl-3', compact && 'admin-schedule-section--compact')}>
      <span className="admin-schedule-step" aria-hidden>
        {step}
      </span>
      <div className="admin-schedule-section-title">
        <span className="admin-schedule-section-icon">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </div>
      {children}
    </section>
  );
}

function ScheduleField({
  label,
  htmlFor,
  children,
  compact = false,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-1', compact && 'admin-schedule-field--compact')}>
      <Label
        htmlFor={htmlFor}
        className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="admin-schedule-preview-row">
      <span className="admin-schedule-preview-icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right font-medium tabular-nums text-[var(--admin-foreground)]">
        {value}
      </span>
    </div>
  );
}
