import type { MissionImportRow } from '@/lib/dg/mission-excel-import';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockImportMissions } from '@/lib/mock/workspace-store';
import { prisma } from '@/lib/prisma';
import {
  findMissionDuplicate,
  isMissionSubjectConflict,
} from '@/lib/workspace/mission-duplicate';
import { missionDestinationLabel } from '@/lib/workspace/mission-payload';
import { buildImportedMissionDetails } from '@/lib/workspace/mission-import-meta';
import { normalizeMissionTypeLabel } from '@/lib/workspace/mission-types';
import type { MissionStatus } from '@/lib/workspace/types';

export type MissionImportRowError = {
  line: number;
  message: string;
};

export type MissionImportResult = {
  created: number;
  skipped: number;
  errors: MissionImportRowError[];
};

function dateToIsoStart(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function dateToIsoEnd(date: string): Date {
  return new Date(`${date}T23:59:59`);
}

function statusFields(status: MissionStatus, departAt: Date, returnAt: Date) {
  const changedAt = returnAt;
  switch (status) {
    case 'ONGOING':
      return { status, statusChangedAt: departAt, completedAt: null };
    case 'COMPLETED':
      return { status, statusChangedAt: changedAt, completedAt: returnAt };
    case 'CANCELLED':
      return {
        status,
        statusChangedAt: changedAt,
        completedAt: null,
        cancelReason: 'Import historique',
      };
    default:
      return { status: 'PLANNED' as const, statusChangedAt: new Date(), completedAt: null };
  }
}

export async function importHistoricalMissions(
  rows: MissionImportRow[],
  actorId: string
): Promise<MissionImportResult> {
  if (isMockDataEnabled()) {
    return mockImportMissions(rows, actorId);
  }

  const existing = await prisma.dgMission.findMany({
    where: { archived: false },
    select: { id: true, subject: true, archived: true, status: true },
  });

  const errors: MissionImportRowError[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const duplicate = findMissionDuplicate({ subject: row.subject }, existing);
    if (duplicate && isMissionSubjectConflict(duplicate)) {
      errors.push({
        line: row.line,
        message: `Mission déjà active avec le même objet : « ${row.subject} ».`,
      });
      skipped += 1;
      continue;
    }

    const departAt = dateToIsoStart(row.departAt);
    const returnAt = dateToIsoEnd(row.returnAt);
    let missionType: string;
    try {
      missionType = normalizeMissionTypeLabel(row.missionType);
    } catch {
      errors.push({ line: row.line, message: 'Type de mission invalide.' });
      skipped += 1;
      continue;
    }

    try {
      const mission = await prisma.dgMission.create({
        data: {
          subject: row.subject.slice(0, 300),
          missionType,
          destination: missionDestinationLabel(row.destinations),
          destinations: row.destinations,
          details: buildImportedMissionDetails(row.details),
          departAt,
          returnAt,
          initialReturnAt: returnAt,
          participants: row.participants.slice(0, 500),
          operationalState: 'NORMAL',
          ...statusFields(row.status, departAt, returnAt),
        },
      });
      existing.push({
        id: mission.id,
        subject: mission.subject,
        archived: false,
        status: mission.status,
      });
      created += 1;
    } catch {
      errors.push({ line: row.line, message: 'Erreur lors de l’enregistrement de la ligne.' });
      skipped += 1;
    }
  }

  if (created > 0) {
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'workspace.mission.import',
        meta: { created, skipped },
      },
    });
  }

  return { created, skipped, errors };
}
