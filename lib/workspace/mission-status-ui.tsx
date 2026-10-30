'use client';

import { AlertTriangle, Circle, CircleCheck, CircleX, Loader } from 'lucide-react';
import { MISSION_STATUS_LABELS } from '@/lib/workspace/labels';
import type { DgMission, MissionStatus } from '@/lib/workspace/types';
import {
  MISSION_VISUAL_LABELS,
  resolveMissionVisualState,
  type MissionVisualState,
} from '@/lib/workspace/mission-visual-state';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<MissionStatus, typeof Circle> = {
  PLANNED: Circle,
  ONGOING: Loader,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
};

const VISUAL_ICONS: Record<MissionVisualState, typeof Circle> = {
  PLANNED: Circle,
  DEPART_TODAY: AlertTriangle,
  ONGOING: Loader,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
};

type StatusProps = {
  status: MissionStatus;
  className?: string;
  showIcon?: boolean;
};

export function MissionStatusBadge({ status, className, showIcon = true }: StatusProps) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={cn('mission-status-badge', className)} data-status={status}>
      {showIcon ? <Icon className="mr-1 inline h-3 w-3" aria-hidden /> : null}
      {MISSION_STATUS_LABELS[status]}
    </span>
  );
}

type VisualProps = {
  mission: Pick<DgMission, 'status' | 'departAt' | 'returnAt'>;
  className?: string;
  showIcon?: boolean;
  now?: Date;
};

/** Badge contextuel selon dates + statut (PLANIFIÉ, DÉPART AUJOURD'HUI, EN COURS, etc.). */
export function MissionVisualBadge({ mission, className, showIcon = true, now }: VisualProps) {
  const visual = resolveMissionVisualState(mission, now);
  const Icon = VISUAL_ICONS[visual];
  return (
    <span className={cn('mission-status-badge', className)} data-visual={visual}>
      {showIcon ? <Icon className="mr-1 inline h-3 w-3" aria-hidden /> : null}
      {MISSION_VISUAL_LABELS[visual]}
    </span>
  );
}
