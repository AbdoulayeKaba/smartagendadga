import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { notifyUser } from '@/lib/services/appointments';
import {
  isMissionAutoCompleteOnReturn,
  isMissionClosureReportRequired,
} from '@/lib/workspace/mission-settings';
import {
  MISSION_CANCEL_REASON_LABELS,
  type MissionClosureInput,
  type MissionStatusAction,
  validateCancelReason,
  validateCancelTransition,
  validateCloseTransition,
  validateStartTransition,
  validateReopenTransition,
  resolveReopenTargetStatus,
  isBeforeMissionStart,
  computeAutoStatus,
  missionAutoCloseAt,
  missionAutoStartAt,
  canEditMissionFields,
  canEditMissionObservations,
  canEditMissionReport,
  isMissionDepartingToday,
  isMissionDepartTodayVisualState,
} from '@/lib/workspace/mission-status-workflow';
import {
  isMissionReturningToday,
  missionNeedsClosePrompt,
} from '@/lib/workspace/mission-visual-state';
import { validateMissionReopen } from '@/lib/workspace/mission-operational-state';
import { mapMission } from '@/lib/workspace/map-mission';
import type { DgMission, DgMissionHistoryEntry, MissionStatus } from '@/lib/workspace/types';

export type MissionWorkflowResult =
  | { ok: true; mission: DgMission }
  | { ok: false; error: string };

type Actor = { userId: string; userName: string };

function mapHistory(row: {
  id: string;
  missionId: string;
  userId: string;
  userName: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
  createdAt: Date;
}): DgMissionHistoryEntry {
  return {
    id: row.id,
    missionId: row.missionId,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    fieldName: row.fieldName,
    oldValue: row.oldValue,
    newValue: row.newValue,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function writeMissionHistory(
  missionId: string,
  actor: Actor,
  input: {
    action: string;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    detail?: string | null;
  }
) {
  if (isMockDataEnabled()) return;
  await prisma.dgMissionHistory
    .create({
      data: {
        missionId,
        userId: actor.userId,
        userName: actor.userName,
        action: input.action,
        fieldName: input.fieldName ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        detail: input.detail ?? null,
      },
    })
    .catch((err) => {
      console.error('[writeMissionHistory] skipped:', err);
    });
}

async function cancelMissionHotelReservations(missionId: string) {
  await prisma.dgMissionHotelReservation.updateMany({
    where: { missionId, status: { not: 'CANCELLED' } },
    data: { status: 'CANCELLED' },
  });
}

async function notifyMissionStakeholders(
  mission: Pick<DgMission, 'id' | 'subject' | 'participants'>,
  kind: 'MISSION_CANCELLED' | 'MISSION_COMPLETED',
  message: string
) {
  const users = await prisma.user.findMany({
    where: { role: { in: ['DG', 'ASSISTANT'] }, active: true, archived: false },
    select: { id: true },
  });
  for (const user of users) {
    await notifyUser({
      userId: user.id,
      kind,
      title: kind === 'MISSION_CANCELLED' ? 'Mission annulée' : 'Mission terminée',
      message: `« ${mission.subject} » — ${message}`,
    }).catch(() => undefined);
  }
}

export async function listMissionHistory(missionId: string): Promise<DgMissionHistoryEntry[]> {
  if (isMockDataEnabled()) return [];
  const rows = await prisma.dgMissionHistory.findMany({
    where: { missionId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(mapHistory);
}

export async function applyMissionStatusTransition(
  missionId: string,
  action: MissionStatusAction,
  actor: Actor,
  payload?: {
    cancelReason?: string;
    cancelReasonDetail?: string | null;
    closure?: MissionClosureInput;
    returnAt?: string;
    reopenReason?: string | null;
  }
): Promise<MissionWorkflowResult> {
  const prev = await prisma.dgMission.findUnique({ where: { id: missionId } });
  if (!prev) return { ok: false, error: 'NOT_FOUND' };

  const now = new Date();
  let nextStatus: MissionStatus;
  const updateData: Prisma.DgMissionUpdateInput = {
    statusChangedAt: now,
  };

  if (action === 'close') {
    return { ok: false, error: 'MANUAL_CLOSE_FORBIDDEN' };
  }

  if (action === 'start') {
    const err = validateStartTransition(prev, now);
    if (err) return { ok: false, error: err };
    nextStatus = 'ONGOING';
  } else if (action === 'cancel') {
    const err = validateCancelTransition(prev, now);
    if (err) return { ok: false, error: err };
    const reasonErr = validateCancelReason(payload?.cancelReason, payload?.cancelReasonDetail);
    if (reasonErr) return { ok: false, error: reasonErr };
    nextStatus = 'CANCELLED';
    updateData.cancelReason = payload!.cancelReason!;
    updateData.cancelReasonDetail = payload?.cancelReasonDetail?.trim() || null;
  } else if (action === 'reopen') {
    const reopenErr = validateMissionReopen(mapMission(prev), {
      returnAt: payload?.returnAt ?? null,
      reason: payload?.reopenReason ?? null,
    }, now);
    if (reopenErr) return { ok: false, error: reopenErr };
    const err = validateReopenTransition(prev, now, payload?.returnAt);
    if (err) return { ok: false, error: err };
    nextStatus = resolveReopenTargetStatus(mapMission(prev), now, payload?.returnAt);
    updateData.completedAt = null;
    updateData.operationalState = 'NORMAL';
    if (prev.status === 'CANCELLED') {
      updateData.cancelReason = null;
      updateData.cancelReasonDetail = null;
    }
    if (payload?.returnAt) {
      updateData.returnAt = new Date(payload.returnAt);
    }
  } else {
    return { ok: false, error: 'INVALID_ACTION' };
  }

  updateData.status = nextStatus;

  const row = await prisma.dgMission.update({ where: { id: missionId }, data: updateData });
  const mission = mapMission(row);

  await writeMissionHistory(missionId, actor, {
    action:
      action === 'cancel' ? 'cancel' : action === 'reopen' ? 'reopen' : 'status.change',
    fieldName: 'status',
    oldValue: prev.status,
    newValue: nextStatus,
    detail:
      action === 'cancel'
        ? MISSION_CANCEL_REASON_LABELS[payload!.cancelReason as keyof typeof MISSION_CANCEL_REASON_LABELS]
        : action === 'reopen'
          ? payload?.reopenReason?.trim() || 'Mission rouverte'
          : null,
  });

  if (action === 'reopen' && payload?.returnAt) {
    await writeMissionHistory(missionId, actor, {
      action: 'extend',
      fieldName: 'returnAt',
      oldValue: prev.returnAt.toISOString(),
      newValue: payload.returnAt,
      detail: 'Nouvelle date de retour lors de la réouverture',
    });
  }

  if (action === 'cancel') {
    await cancelMissionHotelReservations(missionId);
    await notifyMissionStakeholders(
      mission,
      'MISSION_CANCELLED',
      `Motif : ${MISSION_CANCEL_REASON_LABELS[payload!.cancelReason as keyof typeof MISSION_CANCEL_REASON_LABELS]}`
    );
  }

  if (action === 'reopen') {
    const assistants = await prisma.user.findMany({
      where: { role: 'ASSISTANT', active: true, archived: false },
      select: { id: true },
    });
    for (const assistant of assistants) {
      await notifyUser({
        userId: assistant.id,
        kind: 'MISSION_REOPENED',
        title: 'Mission rouverte',
        message: `« ${mission.subject} » — La mission est de nouveau en cours. [${mission.id}]`,
      }).catch(() => undefined);
    }
  }

  return { ok: true, mission };
}

async function notifyAssistantsOnceToday(input: {
  kind: 'MISSION_DEPART_TODAY' | 'MISSION_RETURN_TODAY' | 'MISSION_CLOSE_SUGGESTED';
  title: string;
  message: string;
  dedupeKey: string;
}) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const assistants = await prisma.user.findMany({
    where: { role: 'ASSISTANT', active: true, archived: false },
    select: { id: true },
  });

  for (const assistant of assistants) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: assistant.id,
        kind: input.kind,
        message: { contains: input.dedupeKey },
        createdAt: { gte: dayStart },
      },
    });
    if (existing) continue;

    await notifyUser({
      userId: assistant.id,
      kind: input.kind,
      title: input.title,
      message: input.message,
    }).catch(() => undefined);
  }
}

export async function runMissionDailyAlerts(): Promise<{
  departAlerts: number;
  returnAlerts: number;
  closeSuggestions: number;
}> {
  const now = new Date();
  const missions = await prisma.dgMission.findMany({
    where: { archived: false, status: { in: ['PLANNED', 'ONGOING'] } },
  });

  let departAlerts = 0;
  let returnAlerts = 0;
  let closeSuggestions = 0;

  for (const mission of missions) {
    const mapped = {
      status: mission.status,
      departAt: mission.departAt.toISOString(),
      returnAt: mission.returnAt.toISOString(),
    };

    if (
      mission.status === 'PLANNED'
        ? isMissionDepartTodayVisualState(mapped.departAt, now)
        : isMissionDepartingToday(mapped.departAt, now)
    ) {
      await notifyAssistantsOnceToday({
        kind: 'MISSION_DEPART_TODAY',
        title: 'Départ de mission aujourd\'hui',
        message: `« ${mission.subject} » — Le DGA est en mission aujourd'hui. [${mission.id}]`,
        dedupeKey: mission.id,
      });
      departAlerts++;
    }

    if (mission.status === 'ONGOING' && isMissionReturningToday(mapped.returnAt, now)) {
      await notifyAssistantsOnceToday({
        kind: 'MISSION_RETURN_TODAY',
        title: 'Retour de mission aujourd\'hui',
        message: `« ${mission.subject} » — Retour prévu aujourd'hui. [${mission.id}]`,
        dedupeKey: mission.id,
      });
      returnAlerts++;
    }

    if (missionNeedsClosePrompt(mapped, now)) {
      const autoComplete = await isMissionAutoCompleteOnReturn();
      if (!autoComplete) {
        await notifyAssistantsOnceToday({
          kind: 'MISSION_CLOSE_SUGGESTED',
          title: 'Clôture de mission suggérée',
          message: `« ${mission.subject} » — La date de retour est dépassée. Clôturez la mission. [${mission.id}]`,
          dedupeKey: mission.id,
        });
        closeSuggestions++;
      }
    }
  }

  return { departAlerts, returnAlerts, closeSuggestions };
}

export async function runAutoMissionStatusTransitions(): Promise<{
  plannedToOngoing: number;
  ongoingToCompleted: number;
}> {
  const now = new Date();
  const autoComplete = await isMissionAutoCompleteOnReturn();
  const missions = await prisma.dgMission.findMany({
    where: { archived: false, status: { in: ['PLANNED', 'ONGOING'] } },
  });
  const systemActor = await prisma.user.findFirst({
    where: { role: 'ASSISTANT', active: true },
    select: { id: true, firstName: true, lastName: true },
  });

  let plannedToOngoing = 0;
  let ongoingToCompleted = 0;

  for (const mission of missions) {
    let next = computeAutoStatus(
      {
        status: mission.status,
        departAt: mission.departAt.toISOString(),
        returnAt: mission.returnAt.toISOString(),
      },
      now
    );
    if (next === 'COMPLETED' && !autoComplete) {
      next = null;
    }
    if (!next || next === mission.status) continue;

    await prisma.dgMission.update({
      where: { id: mission.id },
      data: {
        status: next,
        statusChangedAt:
          next === 'COMPLETED'
            ? missionAutoCloseAt(mission.returnAt)
            : next === 'ONGOING'
              ? missionAutoStartAt(mission.departAt)
              : now,
        ...(next === 'COMPLETED'
          ? {
              completedAt: missionAutoCloseAt(mission.returnAt),
              operationalState: 'CLOSED',
            }
          : {}),
      },
    });

    if (systemActor) {
      await writeMissionHistory(
        mission.id,
        {
          userId: systemActor.id,
          userName: `${systemActor.firstName} ${systemActor.lastName}`.trim() || 'Système',
        },
        {
          action: 'status.auto',
          fieldName: 'status',
          oldValue: mission.status,
          newValue: next,
          detail:
            next === 'COMPLETED'
              ? 'Clôture automatique à 23h59 (jour du retour)'
              : next === 'ONGOING'
                ? 'Démarrage automatique à 22h59 (jour du départ)'
                : 'Transition automatique quotidienne',
        }
      );
    }

    if (next === 'ONGOING') plannedToOngoing++;
    if (next === 'COMPLETED') ongoingToCompleted++;
  }

  return { plannedToOngoing, ongoingToCompleted };
}

export function assertMissionFieldUpdate(
  mission: Pick<DgMission, 'status' | 'archived' | 'departAt'>,
  patch: Record<string, unknown>,
  now = new Date()
): string | null {
  const fieldKeys = ['subject', 'missionType', 'destinations', 'details', 'departAt', 'returnAt', 'participants', 'status'];
  const touchesLocked = fieldKeys.some((k) => patch[k] !== undefined);
  if (patch.status !== undefined) return 'STATUS_CHANGE_FORBIDDEN';

  if (mission.status === 'ONGOING') {
    const blockedOnOngoing = ['subject', 'missionType', 'destinations', 'details', 'participants'];
    if (blockedOnOngoing.some((k) => patch[k] !== undefined)) return 'MISSION_LOCKED';
    if (patch.returnAt !== undefined) return 'USE_EXTEND_WORKFLOW';
    if (patch.departAt !== undefined && !isBeforeMissionStart(now, mission.departAt)) {
      return 'DEPART_DATE_LOCKED';
    }
    if (patch.departAt !== undefined) return null;
  }

  if (touchesLocked && !canEditMissionFields(mission, 'ASSISTANT')) return 'MISSION_LOCKED';
  if (patch.observations !== undefined && !canEditMissionObservations(mission, 'ASSISTANT')) {
    return 'MISSION_LOCKED';
  }
  const closureKeys = [
    'closureReport',
    'closureResults',
    'closureRecommendations',
    'closureComments',
  ];
  if (closureKeys.some((k) => patch[k] !== undefined) && !canEditMissionReport(mission, 'ASSISTANT')) {
    return 'MISSION_LOCKED';
  }
  return null;
}
