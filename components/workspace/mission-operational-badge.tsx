'use client';

import { CalendarClock, CalendarMinus } from 'lucide-react';
import { prolongationLabel } from '@/lib/workspace/mission-operational-state';
import { MISSION_OPERATIONAL_STATE_LABELS } from '@/lib/workspace/mission-operational-state';
import type { DgMission } from '@/lib/workspace/types';
import { cn } from '@/lib/utils';

type Props = {
  mission: Pick<DgMission, 'operationalState' | 'initialReturnAt' | 'returnAt' | 'prolongationCount'>;
  className?: string;
};

export function MissionOperationalBadge({ mission, className }: Props) {
  if (mission.operationalState === 'NORMAL') return null;

  const prolongLabel = prolongationLabel(mission);
  const label =
    prolongLabel ??
    MISSION_OPERATIONAL_STATE_LABELS[mission.operationalState] ??
    mission.operationalState;

  const Icon =
    mission.operationalState === 'SHORTENED'
      ? CalendarMinus
      : mission.operationalState === 'PROLONGED'
        ? CalendarClock
        : CalendarClock;

  return (
    <span
      className={cn('mission-operational-badge', className)}
      data-operational={mission.operationalState}
      title={label}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
