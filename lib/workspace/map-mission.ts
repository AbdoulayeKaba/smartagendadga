import { parseDestinationsField } from '@/lib/workspace/mission-payload';
import type { DgMission, MissionOperationalState, MissionStatus } from '@/lib/workspace/types';

type MissionRow = {
  id: string;
  subject: string;
  missionType?: string | null;
  destination: string;
  destinations?: unknown;
  details?: string | null;
  departAt: Date;
  returnAt: Date;
  initialReturnAt?: Date | null;
  operationalState?: MissionOperationalState | null;
  prolongationCount?: number | null;
  status: MissionStatus;
  participants: string;
  documentCount: number;
  observations?: string | null;
  cancelReason?: string | null;
  cancelReasonDetail?: string | null;
  closureReport?: string | null;
  closureResults?: string | null;
  closureRecommendations?: string | null;
  closureComments?: string | null;
  completedAt?: Date | null;
  statusChangedAt?: Date | null;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapMission(row: MissionRow): DgMission {
  const destinations = parseDestinationsField(row.destinations, row.destination);
  const initialReturn = row.initialReturnAt ?? row.returnAt;
  return {
    id: row.id,
    subject: row.subject,
    missionType: row.missionType?.trim() || 'Mission officielle',
    destination: row.destination,
    destinations,
    details: row.details ?? null,
    departAt: row.departAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    initialReturnAt: initialReturn.toISOString(),
    operationalState: row.operationalState ?? 'NORMAL',
    prolongationCount: row.prolongationCount ?? 0,
    status: row.status,
    participants: row.participants,
    documentCount: row.documentCount,
    observations: row.observations ?? null,
    cancelReason: row.cancelReason ?? null,
    cancelReasonDetail: row.cancelReasonDetail ?? null,
    closureReport: row.closureReport ?? null,
    closureResults: row.closureResults ?? null,
    closureRecommendations: row.closureRecommendations ?? null,
    closureComments: row.closureComments ?? null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    statusChangedAt: row.statusChangedAt ? row.statusChangedAt.toISOString() : null,
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
