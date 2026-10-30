'use client';

import { Building2, Check, Laptop, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

type Modality = 'presentiel' | 'online' | 'hybrid';

type Props = {
  value: Modality;
  onChange: (value: Modality) => void;
  idPrefix?: string;
  compact?: boolean;
  /** Single-line control (no Teams subtitle / check) for tight dialogs. */
  dense?: boolean;
  className?: string;
  /** Affiche le format hybride (présentiel + lien Teams). */
  includeHybrid?: boolean;
  /** Désactive le présentiel (mission, congé, férié, week-end selon règles). */
  presentielDisabled?: boolean;
  /** Message affiché au survol / lecteurs d’écran quand le présentiel est indisponible. */
  presentielDisabledReason?: string | null;
};

const OPTIONS = [
  {
    value: 'presentiel' as const,
    label: 'Présentiel',
    hint: null as string | null,
    icon: Building2,
  },
  {
    value: 'online' as const,
    label: 'En ligne',
    hint: 'Microsoft Teams',
    icon: Video,
  },
  {
    value: 'hybrid' as const,
    label: 'Hybride',
    hint: null as string | null,
    icon: Laptop,
  },
];

export function AppointmentModalityTabs({
  value,
  onChange,
  idPrefix = 'plan',
  compact = false,
  dense = false,
  className,
  includeHybrid = false,
  presentielDisabled = false,
  presentielDisabledReason = null,
}: Props) {
  const options = includeHybrid ? OPTIONS : OPTIONS.filter((opt) => opt.value !== 'hybrid');
  return (
    <div
      className={cn(
        'plan-modality',
        compact && 'plan-modality--compact',
        dense && 'plan-modality--dense',
        className
      )}
      data-value={value}
    >
      <div
        className="plan-modality-track"
        role="tablist"
        aria-label="Format du rendez-vous"
      >
        <span className="plan-modality-thumb" aria-hidden />

        {options.map((opt) => {
          const active = value === opt.value;
          const disabled =
            (opt.value === 'presentiel' || opt.value === 'hybrid') && presentielDisabled;
          const Icon = opt.icon;
          const showHint = !dense && Boolean(opt.hint);
          const disabledTitle =
            disabled && presentielDisabledReason
              ? `${presentielDisabledReason} Seul le format en ligne est disponible pour cette date.`
              : disabled
                ? 'Le présentiel n’est pas disponible pour cette date. Choisissez « En ligne ».'
                : undefined;
          return (
            <button
              key={opt.value}
              id={`${idPrefix}-modality-${opt.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              tabIndex={active ? 0 : -1}
              data-active={active ? 'true' : 'false'}
              data-modality={opt.value}
              title={disabledTitle}
              className={cn(
                'plan-modality-option',
                active && 'is-active',
                disabled && 'is-disabled'
              )}
              onClick={() => {
                if (disabled) return;
                onChange(opt.value);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const order: Modality[] = includeHybrid
                  ? ['presentiel', 'online', 'hybrid']
                  : ['presentiel', 'online'];
                const current = order.indexOf(value);
                const next =
                  order[(current + (e.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length];
                if (!next || (next === 'presentiel' && presentielDisabled)) return;
                onChange(next);
                queueMicrotask(() => {
                  document.getElementById(`${idPrefix}-modality-${next}`)?.focus();
                });
              }}
            >
              <span className="plan-modality-option-icon-wrap" aria-hidden>
                <Icon className="plan-modality-option-icon" />
              </span>
              <span className="plan-modality-option-text">
                <span className="plan-modality-option-label">{opt.label}</span>
                {showHint ? (
                  <span className="plan-modality-option-hint">{opt.hint}</span>
                ) : null}
              </span>
              {!dense && !compact ? (
                <span
                  className={cn('plan-modality-option-check', active && 'is-visible')}
                  aria-hidden
                >
                  <Check strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
