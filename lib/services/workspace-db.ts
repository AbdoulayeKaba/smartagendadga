import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { yearRange } from '@/lib/temporal/year-range';
import { notifyUser, writeAudit } from '@/lib/services/appointments';
import {
  missionDestinationLabel,
  normalizeMissionWrite,
  parseDestinationsField,
  type MissionWriteInput,
} from '@/lib/workspace/mission-payload';
import { computeMailExecutionDeadline, inferMailStatusTimestamps } from '@/lib/workspace/mail-utils';
import { normalizeDestinationCodes } from '@/lib/workspace/mission-countries';
import { findReportTitleConflict } from '@/lib/workspace/report-content';
import { ReportDuplicateError } from '@/lib/workspace/report-errors';
import { attachHotelStatusToMissions } from '@/lib/workspace/mission-hotel-status';
import { mapMission } from '@/lib/workspace/map-mission';
import {
  canEditMissionReport,
  computeAutoStatusAfterDatePatch,
  isMissionDepartingToday,
  isMissionDepartTodayVisualState,
  missionAutoCloseAt,
} from '@/lib/workspace/mission-status-workflow';
import { isMissionReturningToday, sortMissionsByAttention } from '@/lib/workspace/mission-visual-state';
import { normalizeMissionTypeLabel } from '@/lib/workspace/mission-types';
import {
  formatMissionHistoryDate,
  resolveOperationalStateAfterReturnChange,
  validateMissionExtend,
  type MissionExtendInput,
} from '@/lib/workspace/mission-operational-state';
import { HOTEL_RESERVATION_STATUS_LABELS } from '@/lib/workspace/labels';
import { contactMatchesSearchQuery } from '@/lib/workspace/contact-search';
import {
  assertMissionFieldUpdate,
  writeMissionHistory,
} from '@/lib/services/mission-workflow';
import { parseProjectPhases, serializeProjectPhases } from '@/lib/workspace/assignee-utils';
import type {
  AudienceRecord,
  DgDecision,
  DgMission,
  DgMissionHotelReservation,
  DgMissionHotelReservationAttachment,
  HotelReservationAttachmentType,
  DgProject,
  DgTask,
  DgTaskComment,
  DgTaskHistoryEntry,
  ImportantDeadline,
  DgMailAttachment,
  MailItem,
  MailStatusTraceEntry,
  OfficialInvitation,
  StrategicContact,
  VaultDocument,
  WorkspaceDashboard,
} from '@/lib/workspace/types';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function mapTask(row: {
  id: string;
  title: string;
  description: string | null;
  status: DgTask['status'];
  priority: DgTask['priority'];
  projectId: string | null;
  projectName: string | null;
  projectPhase: string | null;
  assigneeName: string;
  assigneeUserId: string | null;
  startAt: Date | null;
  dueAt: Date | null;
  estimatedHours: number | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): DgTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    projectId: row.projectId,
    projectName: row.projectName,
    projectPhase: row.projectPhase,
    assigneeName: row.assigneeName,
    assigneeUserId: row.assigneeUserId,
    startAt: iso(row.startAt),
    dueAt: iso(row.dueAt),
    estimatedHours: row.estimatedHours,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProject(
  row: {
    id: string;
    name: string;
    description: string | null;
    status: DgProject['status'];
    ownerName: string;
    ownerUserId: string | null;
    phases: string | null;
    startAt: Date | null;
    dueAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  },
  taskCount = 0
): DgProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    ownerName: row.ownerName,
    ownerUserId: row.ownerUserId,
    phases: parseProjectPhases(row.phases),
    startAt: iso(row.startAt),
    dueAt: iso(row.dueAt),
    taskCount,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveTaskProjectData(patch: {
  projectId?: string | null;
  projectName?: string | null;
}) {
  if (patch.projectId === null) {
    return { projectId: null, projectName: null };
  }
  if (patch.projectId) {
    const project = await prisma.dgProject.findUnique({ where: { id: patch.projectId } });
    if (project) {
      return { projectId: project.id, projectName: project.name };
    }
  }
  if (patch.projectName !== undefined) {
    return { projectId: patch.projectId ?? null, projectName: patch.projectName };
  }
  return {};
}

function mapDecision(row: {
  id: string;
  title: string;
  context: string | null;
  decisionText: string;
  status: DgDecision['status'];
  priority: DgDecision['priority'];
  ownerName: string;
  ownerUserId: string | null;
  appointmentId: string | null;
  dueAt: Date | null;
  meetingDate: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): DgDecision {
  return {
    id: row.id,
    title: row.title,
    context: row.context,
    decisionText: row.decisionText,
    status: row.status,
    priority: row.priority,
    ownerName: row.ownerName,
    ownerUserId: row.ownerUserId,
    appointmentId: row.appointmentId,
    dueAt: iso(row.dueAt),
    meetingDate: iso(row.meetingDate),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMailAttachment(row: {
  id: string;
  mailId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: Date;
}): DgMailAttachment {
  return {
    id: row.id,
    mailId: row.mailId,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function mapMail(row: {
  id: string;
  direction: MailItem['direction'];
  mailKind?: MailItem['mailKind'] | null;
  registrationNumber: number | null;
  reference: string;
  counterpart: string;
  subject: string;
  mailDate: Date;
  priority: MailItem['priority'];
  workflowStatus: MailItem['workflowStatus'];
  origin: string | null;
  dgaInstruction: string | null;
  executor: string | null;
  action: string | null;
  scSentAt: Date | null;
  executionDeadline: Date | null;
  followUp: string | null;
  courierName: string | null;
  assignedService: string | null;
  assignedAt?: Date | null;
  attachmentCount: number;
  notes: string | null;
  archived?: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: {
    id: string;
    mailId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    uploadedAt: Date;
  }[];
}): MailItem {
  return {
    id: row.id,
    direction: row.direction,
    mailKind: row.mailKind === 'VAULT' ? 'VAULT' : 'DEPARTURE',
    registrationNumber: row.registrationNumber,
    reference: row.reference,
    counterpart: row.counterpart,
    subject: row.subject,
    mailDate: row.mailDate.toISOString(),
    priority: row.priority,
    workflowStatus: row.workflowStatus,
    origin: row.origin,
    dgaInstruction: row.dgaInstruction,
    executor: row.executor,
    action: row.action,
    scSentAt: row.scSentAt?.toISOString() ?? null,
    executionDeadline: row.executionDeadline?.toISOString() ?? null,
    followUp: row.followUp,
    courierName: row.courierName,
    assignedService: row.assignedService,
    assignedAt:
      'assignedAt' in row && row.assignedAt instanceof Date
        ? row.assignedAt.toISOString()
        : null,
    attachmentCount: row.attachmentCount,
    attachments: (row.attachments ?? []).map(mapMailAttachment),
    notes: row.notes,
    archived: Boolean(row.archived),
    archivedAt:
      'archivedAt' in row && row.archivedAt instanceof Date
        ? row.archivedAt.toISOString()
        : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapContact(row: {
  id: string;
  category: StrategicContact['category'];
  fullName: string;
  jobTitle: string | null;
  organization: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  interactionCount: number;
  appointmentCount: number;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StrategicContact {
  return {
    id: row.id,
    category: row.category,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    organization: row.organization,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    interactionCount: row.interactionCount,
    appointmentCount: row.appointmentCount,
    visitCount: row.appointmentCount,
    archived: row.archived,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAudience(row: {
  id: string;
  heldAt: Date;
  endAt: Date | null;
  participants: string;
  subject: string;
  outcome: string | null;
  minutes: string | null;
  appointmentId: string | null;
  archived: boolean;
  createdAt: Date;
}): AudienceRecord {
  return {
    id: row.id,
    heldAt: row.heldAt.toISOString(),
    endAt: iso(row.endAt),
    participants: row.participants,
    subject: row.subject,
    outcome: row.outcome,
    minutes: row.minutes,
    appointmentId: row.appointmentId,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapInvitation(row: {
  id: string;
  organizer: string;
  eventTitle: string;
  eventDate: Date;
  location: string | null;
  importance: OfficialInvitation['importance'];
  status: OfficialInvitation['status'];
  delegateName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OfficialInvitation {
  return {
    id: row.id,
    organizer: row.organizer,
    eventTitle: row.eventTitle,
    eventDate: row.eventDate.toISOString(),
    location: row.location,
    importance: row.importance,
    status: row.status,
    delegateName: row.delegateName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDeadline(row: {
  id: string;
  title: string;
  kind: ImportantDeadline['kind'];
  status: ImportantDeadline['status'];
  dueAt: Date;
  ownerName: string;
  description: string | null;
  alertDaysBefore: number;
  createdAt: Date;
}): ImportantDeadline {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    ownerName: row.ownerName,
    description: row.description,
    alertDaysBefore: row.alertDaysBefore,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapDocument(row: {
  id: string;
  title: string;
  category: VaultDocument['category'];
  version: number;
  fileName: string;
  fileSize: number;
  storageKey: string;
  reportDate: Date;
  bodyHtml: string | null;
  tags: unknown;
  restricted: boolean;
  archived: boolean;
  archivedAt: Date | null;
  uploadedById: string;
  uploadedAt: Date;
}): VaultDocument {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    version: row.version,
    fileName: row.fileName,
    fileSize: row.fileSize,
    storageKey: row.storageKey,
    reportDate: row.reportDate.toISOString(),
    bodyHtml: row.bodyHtml,
    tags,
    restricted: row.restricted,
    archived: row.archived,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    uploadedById: row.uploadedById,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function auditWorkspace(
  userId: string,
  action: string,
  target: string,
  resource: string
) {
  await writeAudit(userId, action, undefined, { target, resource }).catch((err) => {
    console.error('[auditWorkspace] skipped:', err);
  });
}

// ——— Dashboard ———

export async function dbBuildWorkspaceDashboard(stats: {
  appointmentsToday: number;
  pendingAppointments: number;
  todayAppointments: { id: string; title: string; startAt: string }[];
}): Promise<WorkspaceDashboard> {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setDate(to.getDate() + 30);

  const [tasks, decisions, mail, invitations, missions, deadlines, documents] =
    await Promise.all([
      prisma.dgTask.findMany(),
      prisma.dgDecision.findMany(),
      prisma.mailRecord.findMany(),
      prisma.officialInvitation.findMany(),
      prisma.dgMission.findMany(),
      prisma.importantDeadline.findMany(),
      prisma.vaultDocument.findMany(),
    ]);

  const mappedTasks = tasks.map(mapTask);
  const mappedDecisions = decisions.map(mapDecision);
  const mappedMail = mail.map(mapMail);
  const mappedInvitations = invitations.map(mapInvitation);
  const mappedMissions = missions.map(mapMission);
  const mappedDeadlines = deadlines.map(mapDeadline);

  const urgentTasks = mappedTasks.filter(
    (t) => t.priority === 'HIGH' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
  );
  const overdueDecisions = mappedDecisions.filter((d) => d.status === 'OVERDUE');
  const mailPending = mappedMail.filter(
    (m) =>
      !m.archived &&
      m.direction === 'INCOMING' &&
      (m.workflowStatus === 'RECEIVED' || m.workflowStatus === 'ASSIGNED')
  );
  const pendingInvitations = mappedInvitations.filter(
    (i) => i.status === 'PENDING' || i.status === 'RECEIVED'
  );
  const activeMissions = mappedMissions.filter((m) => !m.archived);
  const upcomingMissions = activeMissions.filter(
    (m) => m.status === 'PLANNED' || m.status === 'ONGOING'
  );
  const ongoingMissions = activeMissions.filter((m) => m.status === 'ONGOING');
  const now = new Date();
  const deadlinesSoon = mappedDeadlines.filter(
    (d) => d.status === 'DUE_SOON' || d.status === 'OVERDUE'
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const missionsThisMonth = activeMissions.filter((m) => {
    const depart = new Date(m.departAt);
    return depart >= monthStart && depart < monthEnd;
  });

  const countMissionsByStatus = (status: DgMission['status']) =>
    activeMissions.filter((m) => m.status === status).length;

  const countByType = () => {
    const map = new Map<string, number>();
    for (const m of activeMissions) {
      map.set(m.missionType, (map.get(m.missionType) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const countByDestination = () => {
    const map = new Map<string, number>();
    for (const m of activeMissions) {
      for (const code of m.destinations) {
        map.set(code, (map.get(code) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const countByStatus = <T extends string>(items: { status: T }[]) => {
    const map = new Map<T, number>();
    for (const i of items) map.set(i.status, (map.get(i.status) ?? 0) + 1);
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  };

  const countMailByWorkflow = () => {
    const map = new Map<string, number>();
    for (const m of mappedMail) {
      if (m.archived) continue;
      map.set(m.workflowStatus, (map.get(m.workflowStatus) ?? 0) + 1);
    }
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  };

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: {
      appointmentsToday: stats.appointmentsToday,
      pendingAppointments: stats.pendingAppointments,
      mailPending: mailPending.length,
      documentsToSign: documents.filter((d) => d.restricted).length,
      urgentTasks: urgentTasks.length,
      overdueDecisions: overdueDecisions.length,
      upcomingMissions: upcomingMissions.length,
      pendingInvitations: pendingInvitations.length,
      deadlinesSoon: deadlinesSoon.length,
      missionsTotal: activeMissions.length,
      missionsPlanned: countMissionsByStatus('PLANNED'),
      missionsOngoing: countMissionsByStatus('ONGOING'),
      missionsCompleted: countMissionsByStatus('COMPLETED'),
      missionsCancelled: countMissionsByStatus('CANCELLED'),
      missionsThisMonth: missionsThisMonth.length,
      missionsProlonged: activeMissions.filter((m) => m.operationalState === 'PROLONGED').length,
      missionsProlongationTotal: activeMissions.reduce((sum, m) => sum + (m.prolongationCount ?? 0), 0),
    },
    charts: {
      tasksByStatus: countByStatus(mappedTasks) as WorkspaceDashboard['charts']['tasksByStatus'],
      decisionsByStatus: countByStatus(mappedDecisions) as WorkspaceDashboard['charts']['decisionsByStatus'],
      mailByStatus: countMailByWorkflow() as WorkspaceDashboard['charts']['mailByStatus'],
      missionsByStatus: countByStatus(activeMissions) as WorkspaceDashboard['charts']['missionsByStatus'],
      missionsByType: countByType(),
      missionsByDestination: countByDestination(),
    },
    widgets: {
      todayAppointments: stats.todayAppointments,
      urgentTasks: urgentTasks.slice(0, 5),
      overdueDecisions: overdueDecisions.slice(0, 5),
      mailQueue: mailPending.slice(0, 5),
      upcomingDeadlines: deadlinesSoon.slice(0, 5),
      ongoingMissions: ongoingMissions.slice(0, 5),
      upcomingMissionsList: activeMissions
        .filter((m) => m.status === 'PLANNED')
        .sort((a, b) => new Date(a.departAt).getTime() - new Date(b.departAt).getTime())
        .slice(0, 5),
      attentionMissions: sortMissionsByAttention(
        activeMissions.filter((m) => m.status !== 'CANCELLED')
      ).slice(0, 8),
      prolongedMissions: activeMissions
        .filter((m) => m.operationalState === 'PROLONGED' || m.prolongationCount > 0)
        .sort((a, b) => b.prolongationCount - a.prolongationCount)
        .slice(0, 5),
    },
    missionAlerts: {
      hasDepartToday: activeMissions.some(
        (m) =>
          m.status !== 'CANCELLED' &&
          (m.status === 'PLANNED'
            ? isMissionDepartTodayVisualState(m.departAt, now)
            : isMissionDepartingToday(m.departAt, now))
      ),
      hasReturnToday: activeMissions.some(
        (m) => m.status === 'ONGOING' && isMissionReturningToday(m.returnAt, now)
      ),
      departTodaySubjects: activeMissions
        .filter(
          (m) =>
            m.status !== 'CANCELLED' &&
            (m.status === 'PLANNED'
              ? isMissionDepartTodayVisualState(m.departAt, now)
              : isMissionDepartingToday(m.departAt, now))
        )
        .map((m) => m.subject),
      returnTodaySubjects: activeMissions
        .filter((m) => m.status === 'ONGOING' && isMissionReturningToday(m.returnAt, now))
        .map((m) => m.subject),
    },
  };
}

// ——— Tasks ———

export async function dbListTasks(filters?: { status?: string; q?: string }) {
  const rows = await prisma.dgTask.findMany({ orderBy: { dueAt: 'asc' } });
  let items = rows.map(mapTask);
  if (filters?.status) items = items.filter((t) => t.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (t) => t.title.toLowerCase().includes(q) || t.assigneeName.toLowerCase().includes(q)
    );
  }
  return items;
}

export async function dbGetTask(taskId: string) {
  const task = await prisma.dgTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  const [comments, history] = await Promise.all([
    prisma.dgTaskComment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } }),
    prisma.dgTaskHistory.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } }),
  ]);
  return {
    task: mapTask(task),
    comments: comments.map(
      (c): DgTaskComment => ({
        id: c.id,
        taskId: c.taskId,
        authorId: c.authorId,
        authorName: c.authorName,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })
    ),
    history: history.map(
      (h): DgTaskHistoryEntry => ({
        id: h.id,
        taskId: h.taskId,
        userId: h.userId,
        userName: h.userName,
        action: h.action,
        detail: h.detail,
        createdAt: h.createdAt.toISOString(),
      })
    ),
  };
}

export async function dbCreateTask(
  input: Omit<DgTask, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: DgTask['status'] },
  userId: string,
  userName: string
): Promise<DgTask> {
  const projectFields = await resolveTaskProjectData({
    projectId: input.projectId,
    projectName: input.projectName,
  });
  const row = await prisma.dgTask.create({
    data: {
      title: input.title,
      description: input.description,
      status: input.status ?? 'PENDING',
      priority: input.priority,
      projectId: projectFields.projectId ?? input.projectId ?? null,
      projectName: projectFields.projectName ?? input.projectName ?? null,
      projectPhase: input.projectPhase,
      assigneeName: input.assigneeName,
      assigneeUserId: input.assigneeUserId,
      startAt: parseDateInput(input.startAt ?? undefined),
      dueAt: parseDateInput(input.dueAt ?? undefined),
      estimatedHours: input.estimatedHours,
      createdById: userId,
    },
  });
  await prisma.dgTaskHistory.create({
    data: {
      taskId: row.id,
      userId,
      userName,
      action: 'task.create',
      detail: row.title,
    },
  });
  await auditWorkspace(userId, 'workspace.task.create', row.id, 'task');
  return mapTask(row);
}

export async function dbUpdateTask(
  taskId: string,
  patch: Partial<DgTask>,
  userId: string,
  userName: string
) {
  const prev = await prisma.dgTask.findUnique({ where: { id: taskId } });
  if (!prev) return null;

  const projectFields = await resolveTaskProjectData({
    projectId: patch.projectId,
    projectName: patch.projectName,
  });
  const row = await prisma.dgTask.update({
    where: { id: taskId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.projectId !== undefined || patch.projectName !== undefined
        ? {
            projectId: projectFields.projectId ?? patch.projectId ?? null,
            projectName: projectFields.projectName ?? patch.projectName ?? null,
          }
        : {}),
      ...(patch.projectPhase !== undefined ? { projectPhase: patch.projectPhase } : {}),
      ...(patch.assigneeName !== undefined ? { assigneeName: patch.assigneeName } : {}),
      ...(patch.assigneeUserId !== undefined ? { assigneeUserId: patch.assigneeUserId } : {}),
      ...(patch.startAt !== undefined ? { startAt: parseDateInput(patch.startAt) } : {}),
      ...(patch.dueAt !== undefined ? { dueAt: parseDateInput(patch.dueAt) } : {}),
      ...(patch.estimatedHours !== undefined ? { estimatedHours: patch.estimatedHours } : {}),
    },
  });

  if (patch.status && patch.status !== prev.status) {
    await prisma.dgTaskHistory.create({
      data: {
        taskId,
        userId,
        userName,
        action: 'status.change',
        detail: `${prev.status} → ${patch.status}`,
      },
    });
  }
  await auditWorkspace(userId, 'workspace.task.update', taskId, 'task');
  return mapTask(row);
}

export async function dbDeleteTask(taskId: string, userId: string) {
  try {
    await prisma.dgTask.delete({ where: { id: taskId } });
    await auditWorkspace(userId, 'workspace.task.delete', taskId, 'task');
    return true;
  } catch {
    return false;
  }
}

// ——— Projects ———

export async function dbListProjects() {
  const rows = await prisma.dgProject.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { tasks: true } } },
  });
  return rows.map((row) => mapProject(row, row._count.tasks));
}

export async function dbGetProject(projectId: string) {
  const row = await prisma.dgProject.findUnique({
    where: { id: projectId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!row) return null;
  return mapProject(row, row._count.tasks);
}

export async function dbCreateProject(
  input: Omit<DgProject, 'id' | 'createdAt' | 'updatedAt' | 'taskCount' | 'phases'> & {
    phases?: string[];
  },
  userId: string
): Promise<DgProject> {
  const row = await prisma.dgProject.create({
    data: {
      name: input.name.trim(),
      description: input.description,
      status: input.status,
      ownerName: input.ownerName,
      ownerUserId: input.ownerUserId,
      phases: serializeProjectPhases(input.phases ?? []),
      startAt: parseDateInput(input.startAt ?? undefined),
      dueAt: parseDateInput(input.dueAt ?? undefined),
      createdById: userId,
    },
  });
  await auditWorkspace(userId, 'workspace.project.create', row.id, 'project');
  return mapProject(row, 0);
}

export async function dbUpdateProject(
  projectId: string,
  patch: Partial<DgProject> & { phases?: string[] },
  userId: string
) {
  const prev = await prisma.dgProject.findUnique({ where: { id: projectId } });
  if (!prev) return null;

  const row = await prisma.dgProject.update({
    where: { id: projectId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.ownerName !== undefined ? { ownerName: patch.ownerName } : {}),
      ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
      ...(patch.phases !== undefined ? { phases: serializeProjectPhases(patch.phases) } : {}),
      ...(patch.startAt !== undefined ? { startAt: parseDateInput(patch.startAt) } : {}),
      ...(patch.dueAt !== undefined ? { dueAt: parseDateInput(patch.dueAt) } : {}),
    },
    include: { _count: { select: { tasks: true } } },
  });

  if (patch.name !== undefined && patch.name.trim() !== prev.name) {
    await prisma.dgTask.updateMany({
      where: { projectId },
      data: { projectName: patch.name.trim() },
    });
  }

  await auditWorkspace(userId, 'workspace.project.update', projectId, 'project');
  return mapProject(row, row._count.tasks);
}

export async function dbDeleteProject(projectId: string, userId: string) {
  try {
    await prisma.dgTask.updateMany({
      where: { projectId },
      data: { projectId: null },
    });
    await prisma.dgProject.delete({ where: { id: projectId } });
    await auditWorkspace(userId, 'workspace.project.delete', projectId, 'project');
    return true;
  } catch {
    return false;
  }
}

export async function dbAssignTasksToProject(
  projectId: string,
  taskIds: string[],
  projectPhase: string | null | undefined,
  userId: string
) {
  const project = await prisma.dgProject.findUnique({ where: { id: projectId } });
  if (!project) return null;

  await prisma.dgTask.updateMany({
    where: { id: { in: taskIds } },
    data: {
      projectId: project.id,
      projectName: project.name,
      ...(projectPhase !== undefined ? { projectPhase } : {}),
    },
  });

  await auditWorkspace(userId, 'workspace.project.assign_tasks', projectId, 'project');
  return dbGetProject(projectId);
}

export async function dbAddTaskComment(
  taskId: string,
  authorId: string,
  authorName: string,
  body: string
): Promise<DgTaskComment> {
  const row = await prisma.dgTaskComment.create({
    data: { taskId, authorId, authorName, body },
  });
  return {
    id: row.id,
    taskId: row.taskId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

// ——— Decisions ———

export async function dbListDecisions(filters?: { status?: string; q?: string }) {
  const rows = await prisma.dgDecision.findMany({ orderBy: { updatedAt: 'desc' } });
  let items = rows.map(mapDecision);
  if (filters?.status) items = items.filter((d) => d.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (d) => d.title.toLowerCase().includes(q) || d.ownerName.toLowerCase().includes(q)
    );
  }
  return items;
}

export async function dbCreateDecision(
  input: Omit<DgDecision, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  userId: string
) {
  const row = await prisma.dgDecision.create({
    data: {
      title: input.title,
      context: input.context,
      decisionText: input.decisionText,
      priority: input.priority,
      ownerName: input.ownerName,
      ownerUserId: input.ownerUserId,
      appointmentId: input.appointmentId,
      dueAt: parseDateInput(input.dueAt ?? undefined),
      meetingDate: parseDateInput(input.meetingDate ?? undefined),
      createdById: userId,
    },
  });
  await auditWorkspace(userId, 'workspace.decision.create', row.id, 'decision');
  return mapDecision(row);
}

export async function dbUpdateDecision(
  id: string,
  patch: Partial<DgDecision>,
  userId: string
) {
  try {
    const row = await prisma.dgDecision.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.context !== undefined ? { context: patch.context } : {}),
        ...(patch.decisionText !== undefined ? { decisionText: patch.decisionText } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.ownerName !== undefined ? { ownerName: patch.ownerName } : {}),
        ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: parseDateInput(patch.dueAt) } : {}),
        ...(patch.meetingDate !== undefined ? { meetingDate: parseDateInput(patch.meetingDate) } : {}),
      },
    });
    await auditWorkspace(userId, 'workspace.decision.update', id, 'decision');
    return mapDecision(row);
  } catch {
    return null;
  }
}

export async function dbDeleteDecision(id: string, userId: string) {
  try {
    await prisma.dgDecision.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.decision.delete', id, 'decision');
    return true;
  } catch {
    return false;
  }
}

// ——— Mail ———

const mailInclude = {
  attachments: { orderBy: { uploadedAt: 'asc' as const } },
};

export type MailAttachmentInput = {
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
};

async function syncMailAttachments(mailId: string, items: MailAttachmentInput[]) {
  const { deleteWorkspaceFile, finalizeMailAttachmentKey } = await import(
    '@/lib/storage/workspace-uploads'
  );

  const existing = await prisma.dgMailAttachment.findMany({
    where: { mailId },
    select: { id: true, storageKey: true },
  });
  const nextKeys = new Set(items.map((a) => a.storageKey));

  for (const old of existing) {
    if (!nextKeys.has(old.storageKey)) {
      await deleteWorkspaceFile(old.storageKey);
    }
  }

  await prisma.dgMailAttachment.deleteMany({ where: { mailId } });

  if (items.length === 0) return;

  for (const item of items) {
    const storageKey = await finalizeMailAttachmentKey(mailId, item.storageKey);
    await prisma.dgMailAttachment.create({
      data: {
        mailId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        storageKey,
      },
    });
  }
}

export async function dbGetMailAttachment(id: string) {
  const row = await prisma.dgMailAttachment.findUnique({ where: { id } });
  return row ? mapMailAttachment(row) : null;
}

/**
 * Ids des courriers en corbeille, lus en SQL brut : le client Prisma généré peut
 * encore ignorer la colonne `archived` tant qu'il n'a pas été régénéré.
 */
async function archivedMailIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM dg_mail_records WHERE archived = true
  `;
  return new Set(rows.map((r) => r.id));
}

export async function dbGetMail(id: string) {
  try {
    const row = await prisma.mailRecord.findUnique({
      where: { id },
      include: mailInclude,
    });
    return row ? mapMail(row) : null;
  } catch {
    return null;
  }
}

export async function dbListMail(filters?: {
  direction?: string;
  mailKind?: string;
  q?: string;
  year?: number;
  archived?: boolean;
}) {
  const archived = filters?.archived ?? false;
  const where: Prisma.MailRecordWhereInput = { archived };

  if (filters?.direction) {
    where.direction = filters.direction as Prisma.MailRecordWhereInput['direction'];
  }
  if (filters?.mailKind) {
    where.mailKind = filters.mailKind as Prisma.MailRecordWhereInput['mailKind'];
  }

  if (filters?.year) {
    const { from, to } = yearRange(filters.year);
    where.mailDate = { gte: from, lte: to };
  }

  let rows;
  let fallbackArchivedIds: Set<string> | null = null;
  try {
    rows = await prisma.mailRecord.findMany({
      where,
      orderBy: archived ? { archivedAt: 'desc' } : { mailDate: 'desc' },
      include: mailInclude,
    });
  } catch {
    const { archived: _ignored, mailKind: kindFilter, ...whereWithoutArchived } = where as typeof where & {
      archived?: boolean;
      mailKind?: Prisma.MailRecordWhereInput['mailKind'];
    };
    const [allRows, archivedIds] = await Promise.all([
      prisma.mailRecord.findMany({
        where: whereWithoutArchived,
        orderBy: { mailDate: 'desc' },
        include: mailInclude,
      }),
      archivedMailIds(),
    ]);
    fallbackArchivedIds = archivedIds;
    rows = allRows.filter((r) => archivedIds.has(r.id) === archived);
    if (kindFilter) {
      rows = rows.filter((r) => {
        const kind = (r as { mailKind?: string }).mailKind ?? 'DEPARTURE';
        return kind === kindFilter;
      });
    }
  }

  let items = rows.map(mapMail);

  if (fallbackArchivedIds) {
    const archivedIds = fallbackArchivedIds;
    items = items.map((m) => (archivedIds.has(m.id) ? { ...m, archived: true } : m));
  }

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q) ||
        m.counterpart.toLowerCase().includes(q)
    );
  }

  // Filet de sécurité si le client Prisma ignore encore mailKind
  if (filters?.mailKind) {
    items = items.filter((m) => m.mailKind === filters.mailKind);
  }

  return items;
}

export async function dbCountMail(filters?: {
  direction?: string;
  mailKind?: string;
  year?: number;
}) {
  const base: Prisma.MailRecordWhereInput = {};
  if (filters?.direction) {
    base.direction = filters.direction as Prisma.MailRecordWhereInput['direction'];
  }
  if (filters?.mailKind) {
    base.mailKind = filters.mailKind as Prisma.MailRecordWhereInput['mailKind'];
  }
  if (filters?.year) {
    const { from, to } = yearRange(filters.year);
    base.mailDate = { gte: from, lte: to };
  }

  try {
    const [active, trash] = await Promise.all([
      prisma.mailRecord.count({ where: { ...base, archived: false } }),
      prisma.mailRecord.count({ where: { ...base, archived: true } }),
    ]);
    return { active, trash };
  } catch {
    const [rows, archivedIds] = await Promise.all([
      prisma.mailRecord.findMany({
        where: {
          direction: base.direction,
          ...(filters?.year ? { mailDate: base.mailDate } : {}),
        },
        select: { id: true, mailKind: true },
      }).catch(async () => {
        const all = await prisma.mailRecord.findMany({
          where: {
            direction: base.direction,
            ...(filters?.year ? { mailDate: base.mailDate } : {}),
          },
          select: { id: true },
        });
        return all.map((r) => ({ ...r, mailKind: 'DEPARTURE' as const }));
      }),
      archivedMailIds(),
    ]);
    const scoped = filters?.mailKind
      ? rows.filter((r) => ((r as { mailKind?: string }).mailKind ?? 'DEPARTURE') === filters.mailKind)
      : rows;
    const trash = scoped.filter((r) => archivedIds.has(r.id)).length;
    return { active: scoped.length - trash, trash };
  }
}

export async function dbNextMailRegistrationNumber(mailDateIso: string): Promise<number> {
  const year = Number(mailDateIso.slice(0, 4));
  const safeYear = Number.isFinite(year) && year >= 2000 ? year : new Date().getFullYear();
  const from = new Date(`${safeYear}-01-01T00:00:00.000Z`);
  const to = new Date(`${safeYear + 1}-01-01T00:00:00.000Z`);

  const agg = await prisma.mailRecord.aggregate({
    _max: { registrationNumber: true },
    where: {
      registrationNumber: { not: null },
      mailDate: { gte: from, lt: to },
    },
  });
  return (agg._max.registrationNumber ?? 0) + 1;
}

export async function dbCreateMail(
  input: Omit<MailItem, 'id' | 'createdAt' | 'updatedAt' | 'workflowStatus' | 'attachments'> & {
    attachments?: MailAttachmentInput[];
    hasAttachment?: boolean;
  },
  userId: string
) {
  const uploadedCount = input.attachments?.length ?? 0;
  const attachmentCount = input.hasAttachment === false
    ? 0
    : uploadedCount > 0
      ? uploadedCount
      : input.hasAttachment
        ? 1
        : input.attachmentCount ?? 0;

  const registrationNumber =
    input.direction === 'INCOMING' ? await dbNextMailRegistrationNumber(input.mailDate) : null;

  const priority = input.priority ?? 'NORMAL';
  // Tout courrier entrant doit porter un délai : sinon les alertes d'échéance seraient aveugles.
  const executionDeadline =
    input.direction === 'INCOMING'
      ? (input.executionDeadline ?? computeMailExecutionDeadline(input.mailDate, priority))
      : null;

  const createData = {
    direction: input.direction,
    mailKind: input.mailKind ?? 'DEPARTURE',
    registrationNumber,
    reference: input.reference,
    counterpart: input.counterpart,
    subject: input.subject,
    mailDate: new Date(input.mailDate),
    priority,
    workflowStatus: (input.direction === 'OUTGOING' ? 'SENT' : 'RECEIVED') as MailItem['workflowStatus'],
    origin: input.origin,
    dgaInstruction: input.dgaInstruction,
    executor: input.executor,
    action: input.action,
    scSentAt: input.scSentAt ? new Date(input.scSentAt) : null,
    executionDeadline: executionDeadline ? new Date(executionDeadline) : null,
    followUp: input.followUp,
    courierName: input.courierName,
    assignedService: input.assignedService,
    notes: input.notes,
    attachmentCount,
  };

  let row;
  try {
    row = await prisma.mailRecord.create({
      data: { ...createData, assignedAt: null },
      include: mailInclude,
    });
  } catch {
    const { mailKind: _kind, ...withoutKind } = createData;
    try {
      row = await prisma.mailRecord.create({
        data: { ...withoutKind, assignedAt: null },
        include: mailInclude,
      });
    } catch {
      row = await prisma.mailRecord.create({
        data: withoutKind,
        include: mailInclude,
      });
    }
  }

  if (input.attachments?.length) {
    await syncMailAttachments(row.id, input.attachments);
  }

  await auditWorkspace(userId, 'workspace.mail.create', row.id, 'mail');
  await writeMailWorkflowEvent({
    mailId: row.id,
    status: row.workflowStatus,
    userId,
  });
  const refreshed = await prisma.mailRecord.findUnique({
    where: { id: row.id },
    include: mailInclude,
  });
  return mapMail(refreshed ?? row);
}

async function writeMailWorkflowEvent(input: {
  mailId: string;
  status: MailItem['workflowStatus'];
  fromStatus?: MailItem['workflowStatus'] | null;
  userId: string;
}) {
  const id = `mwf_${crypto.randomUUID().replace(/-/g, '').slice(0, 22)}`;
  const fromStatus = input.fromStatus ?? null;
  try {
    await prisma.$executeRaw`
      INSERT INTO dg_mail_workflow_events (id, mail_id, status, from_status, user_id, created_at)
      VALUES (${id}, ${input.mailId}, ${input.status}, ${fromStatus}, ${input.userId}, ${new Date()})
    `;
  } catch (err) {
    console.error('[writeMailWorkflowEvent]', input.mailId, err);
  }
}

export async function dbListMailStatusTrace(mail: MailItem): Promise<MailStatusTraceEntry[]> {
  const inferred = inferMailStatusTimestamps(mail);
  const byStatus = new Map<MailItem['workflowStatus'], MailStatusTraceEntry>();
  for (const [status, at] of Object.entries(inferred) as [MailItem['workflowStatus'], string][]) {
    if (!at) continue;
    byStatus.set(status, { status, at, inferred: true });
  }

  try {
    const events = await prisma.$queryRaw<
      Array<{ status: MailItem['workflowStatus']; createdAt: Date }>
    >`
      SELECT status, created_at AS createdAt
      FROM dg_mail_workflow_events
      WHERE mail_id = ${mail.id}
      ORDER BY created_at ASC
    `;
    for (const event of events) {
      byStatus.set(event.status, {
        status: event.status,
        at: new Date(event.createdAt).toISOString(),
        inferred: false,
      });
    }
  } catch (err) {
    console.error('[dbListMailStatusTrace]', mail.id, err);
  }

  return [...byStatus.values()].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

export async function dbUpdateMail(
  id: string,
  patch: Partial<MailItem> & {
    attachments?: MailAttachmentInput[];
    hasAttachment?: boolean;
  },
  userId: string
) {
  try {
    const previous = await prisma.mailRecord.findUnique({
      where: { id },
      select: { workflowStatus: true },
    });
    if (!previous) return null;

    let attachmentCount = patch.attachmentCount;
    if (patch.hasAttachment !== undefined || patch.attachments !== undefined) {
      const hasAttachment = patch.hasAttachment ?? (patch.attachments?.length ?? 0) > 0;
      if (!hasAttachment) {
        attachmentCount = 0;
        await syncMailAttachments(id, []);
      } else {
        const uploaded = patch.attachments ?? [];
        attachmentCount = uploaded.length > 0 ? uploaded.length : 1;
        if (patch.attachments !== undefined) {
          await syncMailAttachments(id, uploaded);
        }
      }
    }

    const assignAtValue =
      patch.workflowStatus === 'ASSIGNED'
        ? patch.assignedAt
          ? new Date(patch.assignedAt)
          : new Date()
        : patch.assignedAt !== undefined
          ? patch.assignedAt
            ? new Date(patch.assignedAt)
            : null
          : undefined;

    const data = {
      ...(patch.reference !== undefined ? { reference: patch.reference } : {}),
      ...(patch.counterpart !== undefined ? { counterpart: patch.counterpart } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.mailDate !== undefined ? { mailDate: new Date(patch.mailDate) } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.workflowStatus !== undefined ? { workflowStatus: patch.workflowStatus } : {}),
      ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
      ...(patch.dgaInstruction !== undefined ? { dgaInstruction: patch.dgaInstruction } : {}),
      ...(patch.executor !== undefined ? { executor: patch.executor } : {}),
      ...(patch.action !== undefined ? { action: patch.action } : {}),
      ...(patch.scSentAt !== undefined
        ? { scSentAt: patch.scSentAt ? new Date(patch.scSentAt) : null }
        : {}),
      ...(patch.executionDeadline !== undefined
        ? { executionDeadline: patch.executionDeadline ? new Date(patch.executionDeadline) : null }
        : {}),
      ...(patch.followUp !== undefined ? { followUp: patch.followUp } : {}),
      ...(patch.courierName !== undefined ? { courierName: patch.courierName } : {}),
      ...(patch.assignedService !== undefined ? { assignedService: patch.assignedService } : {}),
      ...(assignAtValue !== undefined ? { assignedAt: assignAtValue } : {}),
      ...(patch.archived !== undefined
        ? {
            archived: patch.archived,
            archivedAt: patch.archived ? new Date() : null,
          }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(attachmentCount !== undefined ? { attachmentCount } : {}),
    };

    let row;
    try {
      row = await prisma.mailRecord.update({
        where: { id },
        data,
        include: mailInclude,
      });
    } catch {
      const dataAny = data as typeof data & {
        assignedAt?: Date | null;
        archived?: boolean;
        archivedAt?: Date | null;
      };
      const {
        assignedAt: _ignoredAssign,
        archived: archivedFlag,
        archivedAt: _ignoredArchivedAt,
        ...dataWithoutArchiveFields
      } = dataAny;
      row = await prisma.mailRecord.update({
        where: { id },
        data: dataWithoutArchiveFields,
        include: mailInclude,
      });
      if (assignAtValue instanceof Date) {
        await prisma.$executeRaw`
          UPDATE dg_mail_records
          SET assigned_at = ${assignAtValue}
          WHERE id = ${id}
        `;
      }
      if (archivedFlag !== undefined) {
        await prisma.$executeRaw`
          UPDATE dg_mail_records
          SET archived = ${archivedFlag},
              archived_at = ${archivedFlag ? new Date() : null}
          WHERE id = ${id}
        `;
      }
      const refreshed = await prisma.mailRecord.findUnique({
        where: { id },
        include: mailInclude,
      });
      if (refreshed) row = refreshed;
    }
    await auditWorkspace(userId, 'workspace.mail.update', id, 'mail');
    if (patch.workflowStatus && patch.workflowStatus !== previous.workflowStatus) {
      await writeMailWorkflowEvent({
        mailId: id,
        status: patch.workflowStatus,
        fromStatus: previous.workflowStatus,
        userId,
      });
    }
    return mapMail(row);
  } catch (err) {
    console.error('[dbUpdateMail]', id, err);
    return null;
  }
}

export async function dbDeleteMail(id: string, userId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ archived: number | boolean }>>`
      SELECT archived FROM dg_mail_records WHERE id = ${id} LIMIT 1
    `;
    const existing = rows[0];
    if (!existing || !Boolean(existing.archived)) return false;

    const attachments = await prisma.dgMailAttachment.findMany({
      where: { mailId: id },
      select: { storageKey: true },
    });
    const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
    for (const att of attachments) {
      await deleteWorkspaceFile(att.storageKey).catch(() => undefined);
    }

    await prisma.mailRecord.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.mail.delete', id, 'mail');
    return true;
  } catch {
    return false;
  }
}

export async function dbEmptyMailTrash(
  userId: string,
  filters?: { direction?: string; mailKind?: string; year?: number }
) {
  try {
    const where: Prisma.MailRecordWhereInput = { archived: true };
    if (filters?.direction) {
      where.direction = filters.direction as Prisma.MailRecordWhereInput['direction'];
    }
    if (filters?.mailKind) {
      where.mailKind = filters.mailKind as Prisma.MailRecordWhereInput['mailKind'];
    }
    if (filters?.year) {
      const { from, to } = yearRange(filters.year);
      where.mailDate = { gte: from, lte: to };
    }

    let trash: Array<{ id: string; attachments: Array<{ storageKey: string }> }>;
    try {
      trash = await prisma.mailRecord.findMany({
        where,
        select: { id: true, attachments: { select: { storageKey: true } } },
      });
    } catch {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; direction: string; mail_date: Date }>
      >`SELECT id, direction, mail_date FROM dg_mail_records WHERE archived = true`;
      let filtered = rows;
      if (filters?.direction) {
        filtered = filtered.filter((r) => r.direction === filters.direction);
      }
      if (filters?.year) {
        const { from, to } = yearRange(filters.year);
        filtered = filtered.filter((r) => r.mail_date >= from && r.mail_date <= to);
      }
      trash = await Promise.all(
        filtered.map(async (r) => ({
          id: r.id,
          attachments: await prisma.dgMailAttachment.findMany({
            where: { mailId: r.id },
            select: { storageKey: true },
          }),
        }))
      );
    }

    if (trash.length === 0) return { purged: 0 };

    const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
    for (const row of trash) {
      for (const att of row.attachments) {
        await deleteWorkspaceFile(att.storageKey).catch(() => undefined);
      }
    }

    await prisma.mailRecord.deleteMany({ where: { id: { in: trash.map((t) => t.id) } } });
    await auditWorkspace(userId, 'workspace.mail.trash.empty', undefined, 'mail');
    return { purged: trash.length };
  } catch (err) {
    console.error('[dbEmptyMailTrash]', err);
    return { purged: 0 };
  }
}

// ——— Contacts ———

export async function dbListContacts(filters?: { category?: string; q?: string; archived?: boolean }) {
  const now = new Date();
  const archived = filters?.archived ?? false;
  const rows = await prisma.strategicContact.findMany({
    where: { archived },
    orderBy: archived ? { archivedAt: 'desc' } : { fullName: 'asc' },
  });

  const [appointmentGroups, visitGroups] = await Promise.all([
    prisma.appointment.groupBy({
      by: ['strategicContactId'],
      where: {
        strategicContactId: { not: null },
        archived: false,
      },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['strategicContactId'],
      where: {
        strategicContactId: { not: null },
        status: 'APPROVED',
        archived: false,
        endAt: { lt: now },
      },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(
    appointmentGroups.map((group) => [group.strategicContactId as string, group._count._all])
  );
  const visitMap = new Map(
    visitGroups.map((group) => [group.strategicContactId as string, group._count._all])
  );

  let items = rows.map((row) => {
    const contact = mapContact(row);
    return {
      ...contact,
      appointmentCount: totalMap.get(row.id) ?? 0,
      visitCount: visitMap.get(row.id) ?? 0,
    };
  });
  if (filters?.category) items = items.filter((c) => c.category === filters.category);
  if (filters?.q) {
    items = items.filter((c) => contactMatchesSearchQuery(c, filters.q!));
  }
  return items;
}

export async function dbCreateContact(
  input: Omit<StrategicContact, 'id' | 'createdAt' | 'updatedAt' | 'interactionCount' | 'appointmentCount'>,
  userId: string
) {
  const row = await prisma.strategicContact.create({ data: input });
  await auditWorkspace(userId, 'workspace.contact.create', row.id, 'contact');
  return mapContact(row);
}

export async function dbUpdateContact(id: string, patch: Partial<StrategicContact>, userId: string) {
  try {
    const row = await prisma.strategicContact.update({
      where: { id },
      data: {
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
        ...(patch.organization !== undefined ? { organization: patch.organization } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.interactionCount !== undefined
          ? { interactionCount: patch.interactionCount }
          : {}),
        ...(patch.appointmentCount !== undefined
          ? { appointmentCount: patch.appointmentCount }
          : {}),
        ...(patch.archived !== undefined
          ? {
              archived: patch.archived,
              archivedAt: patch.archived ? new Date() : null,
            }
          : {}),
      },
    });
    await auditWorkspace(userId, 'workspace.contact.update', id, 'contact');
    return mapContact(row);
  } catch {
    return null;
  }
}

export async function dbDeleteContact(id: string, userId: string) {
  try {
    const contact = await prisma.strategicContact.findUnique({
      where: { id },
      select: { archived: true },
    });
    if (!contact?.archived) return false;
    await prisma.strategicContact.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.contact.delete', id, 'contact');
    return true;
  } catch {
    return false;
  }
}

export async function dbCountContacts() {
  const [active, trash] = await Promise.all([
    prisma.strategicContact.count({ where: { archived: false } }),
    prisma.strategicContact.count({ where: { archived: true } }),
  ]);
  return { active, trash };
}

export async function dbEmptyContactsTrash(userId: string) {
  const trash = await prisma.strategicContact.findMany({
    where: { archived: true },
    select: { id: true },
  });
  if (trash.length === 0) return { purged: 0 };

  await prisma.strategicContact.deleteMany({ where: { archived: true } });
  await auditWorkspace(userId, 'workspace.contacts.trash.empty', undefined, 'contact');
  return { purged: trash.length };
}

export async function dbGetContact(id: string) {
  const row = await prisma.strategicContact.findUnique({ where: { id } });
  if (!row) return null;
  const now = new Date();
  const [total, visits] = await Promise.all([
    prisma.appointment.count({
      where: { strategicContactId: id, archived: false },
    }),
    prisma.appointment.count({
      where: {
        strategicContactId: id,
        status: 'APPROVED',
        archived: false,
        endAt: { lt: now },
      },
    }),
  ]);
  return {
    ...mapContact(row),
    appointmentCount: total,
    visitCount: visits,
  };
}

export async function dbListContactAppointments(contactId: string) {
  const rows = await prisma.appointment.findMany({
    where: { strategicContactId: contactId, archived: false },
    orderBy: { startAt: 'desc' },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      status: true,
      location: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    status: r.status,
    location: r.location,
  }));
}

export async function dbReconcileContactAppointmentCount(contactId: string) {
  const total = await prisma.appointment.count({
    where: {
      strategicContactId: contactId,
      archived: false,
    },
  });

  try {
    await prisma.strategicContact.update({
      where: { id: contactId },
      data: { appointmentCount: total },
    });
    return total;
  } catch {
    return null;
  }
}

export async function dbIncrementContactAppointmentCount(contactId: string) {
  try {
    const visits = await dbReconcileContactAppointmentCount(contactId);
    if (visits == null) return false;
    await prisma.strategicContact.update({
      where: { id: contactId },
      data: { interactionCount: { increment: 1 } },
    });
    return true;
  } catch {
    return false;
  }
}

// ——— Audiences ———

export async function dbListAudiences(filters?: { q?: string; archived?: boolean }) {
  const rows = await prisma.audienceRecord.findMany({ orderBy: { heldAt: 'desc' } });
  let items = rows.map(mapAudience);
  if (filters?.archived !== undefined) items = items.filter((a) => a.archived === filters.archived);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    items = items.filter((a) => a.subject.toLowerCase().includes(q));
  }
  return items;
}

export async function dbCreateAudience(
  input: Omit<AudienceRecord, 'id' | 'createdAt' | 'archived'>,
  userId: string
) {
  const row = await prisma.audienceRecord.create({
    data: {
      heldAt: new Date(input.heldAt),
      endAt: input.endAt ? new Date(input.endAt) : null,
      participants: input.participants,
      subject: input.subject,
      outcome: input.outcome,
      minutes: input.minutes,
      appointmentId: input.appointmentId,
    },
  });
  await auditWorkspace(userId, 'workspace.audience.create', row.id, 'audience');
  return mapAudience(row);
}

export async function dbUpdateAudience(id: string, patch: Partial<AudienceRecord>, userId: string) {
  try {
    const row = await prisma.audienceRecord.update({
      where: { id },
      data: {
        ...(patch.heldAt !== undefined ? { heldAt: new Date(patch.heldAt) } : {}),
        ...(patch.endAt !== undefined
          ? { endAt: patch.endAt ? new Date(patch.endAt) : null }
          : {}),
        ...(patch.participants !== undefined ? { participants: patch.participants } : {}),
        ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.minutes !== undefined ? { minutes: patch.minutes } : {}),
        ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
      },
    });
    await auditWorkspace(userId, 'workspace.audience.update', id, 'audience');
    return mapAudience(row);
  } catch {
    return null;
  }
}

export async function dbDeleteAudience(id: string, userId: string) {
  try {
    await prisma.audienceRecord.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.audience.delete', id, 'audience');
    return true;
  } catch {
    return false;
  }
}

// ——— Invitations ———

export async function dbListInvitations() {
  const rows = await prisma.officialInvitation.findMany({ orderBy: { eventDate: 'asc' } });
  return rows.map(mapInvitation);
}

export async function dbCreateInvitation(
  input: Omit<OfficialInvitation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'delegateName'>,
  userId: string
) {
  const row = await prisma.officialInvitation.create({
    data: {
      organizer: input.organizer,
      eventTitle: input.eventTitle,
      eventDate: new Date(input.eventDate),
      location: input.location,
      importance: input.importance,
      notes: input.notes,
    },
  });
  await auditWorkspace(userId, 'workspace.invitation.create', row.id, 'invitation');
  return mapInvitation(row);
}

export async function dbUpdateInvitation(
  id: string,
  patch: Partial<OfficialInvitation>,
  userId: string
) {
  try {
    const row = await prisma.officialInvitation.update({
      where: { id },
      data: {
        ...(patch.organizer !== undefined ? { organizer: patch.organizer } : {}),
        ...(patch.eventTitle !== undefined ? { eventTitle: patch.eventTitle } : {}),
        ...(patch.eventDate !== undefined ? { eventDate: new Date(patch.eventDate) } : {}),
        ...(patch.location !== undefined ? { location: patch.location } : {}),
        ...(patch.importance !== undefined ? { importance: patch.importance } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.delegateName !== undefined ? { delegateName: patch.delegateName } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    });
    await auditWorkspace(userId, 'workspace.invitation.update', id, 'invitation');
    return mapInvitation(row);
  } catch {
    return null;
  }
}

export async function dbDeleteInvitation(id: string, userId: string) {
  try {
    await prisma.officialInvitation.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.invitation.delete', id, 'invitation');
    return true;
  } catch {
    return false;
  }
}

// ——— Missions ———

export type MissionDocumentInput = {
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
};

function mapMissionDocument(row: {
  id: string;
  missionId: string;
  documentType?: 'GENERAL' | 'REPORT';
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: Date;
}): import('@/lib/workspace/types').DgMissionDocument {
  return {
    id: row.id,
    missionId: row.missionId,
    documentType: row.documentType ?? 'GENERAL',
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

async function syncMissionDocuments(missionId: string, items: MissionDocumentInput[]) {
  const { deleteWorkspaceFile, finalizeMissionDocumentKey } = await import(
    '@/lib/storage/workspace-uploads'
  );

  const existing = await prisma.dgMissionDocument.findMany({
    where: { missionId, documentType: 'GENERAL' },
    select: { id: true, storageKey: true },
  });
  const nextIds = new Set(items.filter((d) => d.id).map((d) => d.id!));

  for (const old of existing) {
    if (!nextIds.has(old.id)) {
      await prisma.dgMissionDocument.delete({ where: { id: old.id } });
      await deleteWorkspaceFile(old.storageKey);
    }
  }

  for (const item of items) {
    if (item.id) continue;
    const storageKey = await finalizeMissionDocumentKey(missionId, item.storageKey);
    await prisma.dgMissionDocument.create({
      data: {
        missionId,
        documentType: 'GENERAL',
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        storageKey,
      },
    });
  }

  const count = await prisma.dgMissionDocument.count({ where: { missionId } });
  await prisma.dgMission.update({
    where: { id: missionId },
    data: { documentCount: count },
  });
}

export async function dbListMissionDocuments(missionId: string) {
  const rows = await prisma.dgMissionDocument.findMany({
    where: { missionId },
    orderBy: { uploadedAt: 'asc' },
  });
  return rows.map(mapMissionDocument);
}

export async function dbGetMissionDocument(id: string) {
  const row = await prisma.dgMissionDocument.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
  };
}

export async function dbAttachMissionReportFile(
  missionId: string,
  file: { fileName: string; fileSize: number; mimeType: string; buffer: Buffer },
  userId: string,
  userName = 'Assistante'
): Promise<
  | { ok: true; document: import('@/lib/workspace/types').DgMissionDocument; mission: DgMission }
  | { ok: false; error: string }
> {
  const prev = await prisma.dgMission.findUnique({ where: { id: missionId } });
  if (!prev) return { ok: false, error: 'NOT_FOUND' };
  if (!canEditMissionReport(mapMission(prev), 'ASSISTANT')) {
    return { ok: false, error: 'MISSION_LOCKED' };
  }

  const { deleteWorkspaceFile, saveWorkspaceFile, sanitizeWorkspaceFileName } = await import(
    '@/lib/storage/workspace-uploads'
  );
  const { randomUUID } = await import('crypto');

  const existingReports = await prisma.dgMissionDocument.findMany({
    where: { missionId, documentType: 'REPORT' },
    select: { id: true, storageKey: true },
  });
  for (const old of existingReports) {
    await prisma.dgMissionDocument.delete({ where: { id: old.id } });
    await deleteWorkspaceFile(old.storageKey);
  }

  const storageKey = `missions/${missionId}/report/${randomUUID()}-${sanitizeWorkspaceFileName(file.fileName)}`;
  await saveWorkspaceFile(storageKey, file.buffer);

  const row = await prisma.dgMissionDocument.create({
    data: {
      missionId,
      documentType: 'REPORT',
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      storageKey,
    },
  });

  const count = await prisma.dgMissionDocument.count({ where: { missionId } });
  const refreshed = await prisma.dgMission.update({
    where: { id: missionId },
    data: { documentCount: count },
  });

  await writeMissionHistory(missionId, { userId, userName }, {
    action: 'update',
    fieldName: 'reportFile',
    detail: file.fileName,
  });

  return {
    ok: true,
    document: mapMissionDocument(row),
    mission: {
      ...mapMission(refreshed),
      documentCount: count,
    },
  };
}

export async function dbDeleteMissionReportFile(
  missionId: string,
  userId: string,
  userName = 'Assistante'
): Promise<{ ok: true; mission: DgMission } | { ok: false; error: string }> {
  const prev = await prisma.dgMission.findUnique({ where: { id: missionId } });
  if (!prev) return { ok: false, error: 'NOT_FOUND' };
  if (!canEditMissionReport(mapMission(prev), 'ASSISTANT')) {
    return { ok: false, error: 'MISSION_LOCKED' };
  }

  const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
  const reports = await prisma.dgMissionDocument.findMany({
    where: { missionId, documentType: 'REPORT' },
    select: { id: true, storageKey: true },
  });
  if (reports.length === 0) {
    return { ok: true, mission: { ...mapMission(prev), documentCount: prev.documentCount } };
  }

  for (const doc of reports) {
    await prisma.dgMissionDocument.delete({ where: { id: doc.id } });
    await deleteWorkspaceFile(doc.storageKey);
  }

  const count = await prisma.dgMissionDocument.count({ where: { missionId } });
  const refreshed = await prisma.dgMission.update({
    where: { id: missionId },
    data: { documentCount: count },
  });

  await writeMissionHistory(missionId, { userId, userName }, {
    action: 'update',
    fieldName: 'reportFile',
    detail: 'Rapport joint supprimé',
  });

  return {
    ok: true,
    mission: {
      ...mapMission(refreshed),
      documentCount: count,
    },
  };
}

export async function dbHasMissionReportFile(missionId: string): Promise<boolean> {
  const count = await prisma.dgMissionDocument.count({
    where: { missionId, documentType: 'REPORT' },
  });
  return count > 0;
}

export async function dbListMissions(filters?: { archived?: boolean }) {
  const archived = filters?.archived ?? false;
  const rows = await prisma.dgMission.findMany({
    where: { archived },
    orderBy: archived ? { archivedAt: 'desc' } : { createdAt: 'desc' },
    include: { _count: { select: { documents: true } } },
  });
  const missionIds = rows.map((row) => row.id);
  const hotelRows =
    missionIds.length > 0
      ? await prisma.dgMissionHotelReservation.findMany({
          where: { missionId: { in: missionIds } },
          select: { missionId: true, status: true },
        })
      : [];
  const missions = rows.map((row) => ({
    ...mapMission(row),
    documentCount: row._count.documents,
  }));
  return attachHotelStatusToMissions(missions, hotelRows);
}

export async function dbGetMission(id: string): Promise<DgMission | null> {
  const row = await prisma.dgMission.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!row) return null;
  const hotelRows = await prisma.dgMissionHotelReservation.findMany({
    where: { missionId: id },
    select: { missionId: true, status: true },
  });
  return attachHotelStatusToMissions(
    [{ ...mapMission(row), documentCount: row._count.documents }],
    hotelRows
  )[0]!;
}

export async function dbCountMissions() {
  const [active, trash] = await Promise.all([
    prisma.dgMission.count({ where: { archived: false } }),
    prisma.dgMission.count({ where: { archived: true } }),
  ]);
  return { active, trash };
}

export async function dbCreateMission(
  input: MissionWriteInput,
  userId: string,
  userName = 'Assistante',
  documents: MissionDocumentInput[] = []
) {
  const data = normalizeMissionWrite(input);
  const row = await prisma.dgMission.create({
    data: {
      subject: data.subject,
      missionType: data.missionType,
      destination: data.destination,
      destinations: data.destinations,
      details: data.details,
      departAt: new Date(data.departAt),
      returnAt: new Date(data.returnAt),
      initialReturnAt: new Date(data.returnAt),
      participants: data.participants,
      statusChangedAt: new Date(),
    },
  });
  if (documents.length > 0) {
    await syncMissionDocuments(row.id, documents);
  }
  await auditWorkspace(userId, 'workspace.mission.create', row.id, 'mission');
  await writeMissionHistory(row.id, { userId, userName }, {
    action: 'create',
    fieldName: 'status',
    newValue: 'PLANNED',
    detail: data.subject,
  });
  const refreshed = await prisma.dgMission.findUnique({
    where: { id: row.id },
    include: { _count: { select: { documents: true } } },
  });
  return {
    ...mapMission(refreshed ?? row),
    documentCount: refreshed?._count.documents ?? 0,
  };
}

export async function dbUpdateMission(
  id: string,
  patch: Partial<DgMission> & { destinations?: string[]; documents?: MissionDocumentInput[] },
  userId: string,
  userName = 'Assistante'
): Promise<{ ok: true; mission: DgMission } | { ok: false; error: string }> {
  try {
    const prev = await prisma.dgMission.findUnique({ where: { id } });
    if (!prev) return { ok: false, error: 'NOT_FOUND' };

    const { documents, ...restPatch } = patch;
    const patchKeys = Object.keys(restPatch).filter(
      (k) => restPatch[k as keyof typeof restPatch] !== undefined
    );
    const documentsOnly = patchKeys.length === 0 && documents !== undefined;

    if (!documentsOnly) {
      const lockErr = assertMissionFieldUpdate(
        mapMission(prev),
        restPatch as Record<string, unknown>
      );
      if (lockErr) return { ok: false, error: lockErr };
    }

    const updateData: Prisma.DgMissionUpdateInput = {
      ...(restPatch.subject !== undefined ? { subject: restPatch.subject } : {}),
      ...(restPatch.missionType !== undefined
        ? { missionType: normalizeMissionTypeLabel(restPatch.missionType) }
        : {}),
      ...(restPatch.details !== undefined ? { details: restPatch.details } : {}),
      ...(restPatch.departAt !== undefined ? { departAt: new Date(restPatch.departAt) } : {}),
      ...(restPatch.returnAt !== undefined ? { returnAt: new Date(restPatch.returnAt) } : {}),
      ...(restPatch.participants !== undefined ? { participants: restPatch.participants } : {}),
      ...(restPatch.observations !== undefined ? { observations: restPatch.observations } : {}),
      ...(restPatch.closureReport !== undefined
        ? { closureReport: restPatch.closureReport?.trim() || null }
        : {}),
      ...(restPatch.closureResults !== undefined
        ? { closureResults: restPatch.closureResults?.trim() || null }
        : {}),
      ...(restPatch.closureRecommendations !== undefined
        ? { closureRecommendations: restPatch.closureRecommendations?.trim() || null }
        : {}),
      ...(restPatch.closureComments !== undefined
        ? { closureComments: restPatch.closureComments?.trim() || null }
        : {}),
      ...(restPatch.archived !== undefined
        ? {
            archived: restPatch.archived,
            archivedAt: restPatch.archived ? new Date() : null,
          }
        : {}),
    };

    if (restPatch.destinations !== undefined) {
      const destinations = normalizeDestinationCodes(restPatch.destinations);
      if (destinations.length === 0) {
        return { ok: false, error: 'VALIDATION_ERROR' };
      }
      updateData.destinations = destinations as Prisma.InputJsonValue;
      updateData.destination = missionDestinationLabel(destinations);
    }

    let statusAutoChange: { from: DgMission['status']; to: DgMission['status'] } | null = null;
    const autoStatus = computeAutoStatusAfterDatePatch(mapMission(prev), {
      departAt: restPatch.departAt,
      returnAt: restPatch.returnAt,
    });
    if (autoStatus && autoStatus !== prev.status) {
      updateData.status = autoStatus;
      updateData.statusChangedAt = new Date();
      if (autoStatus === 'COMPLETED') {
        updateData.completedAt = missionAutoCloseAt(restPatch.returnAt ?? prev.returnAt);
        updateData.operationalState = 'CLOSED';
      }
      statusAutoChange = { from: prev.status as DgMission['status'], to: autoStatus };
    }

    if (documentsOnly) {
      if (prev.archived) return { ok: false, error: 'MISSION_LOCKED' };
      await syncMissionDocuments(id, documents);
      await writeMissionHistory(id, { userId, userName }, {
        action: 'update',
        fieldName: 'documents',
        detail: `${documents.length} document(s) mis à jour`,
      });
      const refreshed = await prisma.dgMission.findUnique({
        where: { id },
        include: { _count: { select: { documents: true } } },
      });
      if (!refreshed) return { ok: false, error: 'NOT_FOUND' };
      return {
        ok: true,
        mission: {
          ...mapMission(refreshed),
          documentCount: refreshed._count.documents,
        },
      };
    }

    const row = await prisma.dgMission.update({
      where: { id },
      data: updateData,
    });

    if (documents !== undefined) {
      await syncMissionDocuments(id, documents);
    }
    await auditWorkspace(userId, 'workspace.mission.update', id, 'mission');

    const actor = { userId, userName };
    if (restPatch.archived !== undefined && restPatch.archived !== prev.archived) {
      await writeMissionHistory(id, actor, {
        action: restPatch.archived ? 'archive' : 'restore',
        fieldName: 'archived',
        detail: restPatch.archived ? 'Mission déplacée dans la corbeille' : 'Mission restaurée',
      });
    }
    if (restPatch.subject !== undefined && restPatch.subject !== prev.subject) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'subject',
        oldValue: prev.subject,
        newValue: restPatch.subject,
      });
    }
    if (restPatch.missionType !== undefined && restPatch.missionType !== prev.missionType) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'missionType',
        oldValue: prev.missionType,
        newValue: restPatch.missionType,
      });
    }
    if (restPatch.destinations !== undefined) {
      const prevDest = parseDestinationsField(prev.destinations);
      const nextDest = normalizeDestinationCodes(restPatch.destinations);
      if (JSON.stringify(prevDest) !== JSON.stringify(nextDest)) {
        await writeMissionHistory(id, actor, {
          action: 'update',
          fieldName: 'destinations',
          oldValue: missionDestinationLabel(prevDest),
          newValue: missionDestinationLabel(nextDest),
        });
      }
    }
    if (restPatch.departAt !== undefined) {
      const nextDepart = new Date(restPatch.departAt).toISOString();
      if (prev.departAt.toISOString() !== nextDepart) {
        await writeMissionHistory(id, actor, {
          action: 'update',
          fieldName: 'departAt',
          oldValue: formatMissionHistoryDate(prev.departAt),
          newValue: formatMissionHistoryDate(restPatch.departAt),
        });
      }
    }
    if (restPatch.returnAt !== undefined) {
      const nextReturn = new Date(restPatch.returnAt).toISOString();
      if (prev.returnAt.toISOString() !== nextReturn) {
        await writeMissionHistory(id, actor, {
          action: 'update',
          fieldName: 'returnAt',
          oldValue: formatMissionHistoryDate(prev.returnAt),
          newValue: formatMissionHistoryDate(restPatch.returnAt),
        });
      }
    }
    if (restPatch.details !== undefined && restPatch.details !== prev.details) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'details',
        detail: 'Détails de la mission mis à jour',
      });
    }
    if (restPatch.participants !== undefined && restPatch.participants !== prev.participants) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'participants',
        oldValue: prev.participants,
        newValue: restPatch.participants,
      });
    }
    if (restPatch.observations !== undefined && restPatch.observations !== prev.observations) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'observations',
        oldValue: prev.observations,
        newValue: restPatch.observations,
      });
    }
    if (restPatch.closureReport !== undefined && restPatch.closureReport !== prev.closureReport) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'closureReport',
        detail: 'Rapport de mission mis à jour',
      });
    }
    if (documents !== undefined) {
      await writeMissionHistory(id, actor, {
        action: 'update',
        fieldName: 'documents',
        detail: `${documents.length} document(s) mis à jour`,
      });
    }
    if (statusAutoChange) {
      await writeMissionHistory(id, actor, {
        action: 'status.auto',
        fieldName: 'status',
        oldValue: statusAutoChange.from,
        newValue: statusAutoChange.to,
        detail: 'Passage automatique suite à la modification des dates',
      });
    }

    const refreshed = await prisma.dgMission.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    const mapped = mapMission(refreshed ?? row);
    return {
      ok: true,
      mission: {
        ...mapped,
        documentCount: refreshed?._count.documents ?? mapped.documentCount,
      },
    };
  } catch (err) {
    console.error('[dbUpdateMission] UPDATE_FAILED', {
      missionId: id,
      patchKeys: Object.keys(patch),
      err,
    });
    if (err instanceof Error) {
      if (err.message === 'MISSION_TYPE_REQUIRED' || err.message === 'MISSION_TYPE_TOO_LONG') {
        return { ok: false, error: err.message };
      }
    }
    return { ok: false, error: 'UPDATE_FAILED' };
  }
}

async function syncHotelReservationsAfterMissionExtend(missionId: string, newReturnAt: Date) {
  const reservations = await prisma.dgMissionHotelReservation.findMany({
    where: { missionId, status: { not: 'CANCELLED' } },
  });
  for (const reservation of reservations) {
    const departure = new Date(reservation.departureDate);
    if (departure.getTime() < newReturnAt.getTime()) {
      await prisma.dgMissionHotelReservation.update({
        where: { id: reservation.id },
        data: { departureDate: newReturnAt },
      });
    }
  }
}

export async function dbExtendMission(
  id: string,
  input: MissionExtendInput,
  userId: string,
  userName = 'Assistante'
): Promise<{ ok: true; mission: DgMission } | { ok: false; error: string }> {
  try {
    const prev = await prisma.dgMission.findUnique({ where: { id } });
    if (!prev) return { ok: false, error: 'NOT_FOUND' };

    const mapped = mapMission(prev);
    const validationError = validateMissionExtend(mapped, input);
    if (validationError) return { ok: false, error: validationError };

    const newReturnAt = new Date(input.returnAt);
    const oldReturnIso = prev.returnAt.toISOString();
    const initialReturn = prev.initialReturnAt ?? prev.returnAt;
    const operationalState = resolveOperationalStateAfterReturnChange(
      initialReturn,
      newReturnAt,
      prev.returnAt
    );
    const isProlongation = newReturnAt.getTime() > prev.returnAt.getTime();

    const row = await prisma.dgMission.update({
      where: { id },
      data: {
        returnAt: newReturnAt,
        operationalState,
        prolongationCount: isProlongation ? { increment: 1 } : prev.prolongationCount,
        completedAt: null,
        status: 'ONGOING',
      },
    });

    const actor = { userId, userName };
    const historyDetail = [
      `Motif : ${input.reason.trim()}`,
      input.comment?.trim() ? `Commentaire : ${input.comment.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await writeMissionHistory(id, actor, {
      action: isProlongation ? 'extend' : 'shorten',
      fieldName: 'returnAt',
      oldValue: formatMissionHistoryDate(oldReturnIso),
      newValue: formatMissionHistoryDate(newReturnAt),
      detail: historyDetail,
    });

    await syncHotelReservationsAfterMissionExtend(id, newReturnAt);
    await auditWorkspace(userId, 'workspace.mission.extend', id, 'mission');

    const assistants = await prisma.user.findMany({
      where: { role: 'ASSISTANT', active: true, archived: false },
      select: { id: true },
    });
    for (const assistant of assistants) {
      await notifyUser({
        userId: assistant.id,
        kind: 'MISSION_EXTENDED',
        title: isProlongation ? 'Mission prolongée' : 'Mission écourtée',
        message: `« ${row.subject} » — Retour : ${formatMissionHistoryDate(newReturnAt)}. [${row.id}]`,
      }).catch(() => undefined);
    }

    const refreshed = await prisma.dgMission.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    return {
      ok: true,
      mission: {
        ...mapMission(refreshed ?? row),
        documentCount: refreshed?._count.documents ?? 0,
      },
    };
  } catch {
    return { ok: false, error: 'UPDATE_FAILED' };
  }
}

export async function dbDeleteMission(id: string, userId: string) {
  try {
    const mission = await prisma.dgMission.findUnique({
      where: { id },
      select: { archived: true },
    });
    if (!mission?.archived) return false;
    await prisma.dgMission.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.mission.delete', id, 'mission');
    return true;
  } catch {
    return false;
  }
}

export async function dbEmptyMissionsTrash(userId: string) {
  const trash = await prisma.dgMission.findMany({
    where: { archived: true },
    select: { id: true },
  });
  if (trash.length === 0) return { purged: 0 };

  await prisma.dgMission.deleteMany({ where: { archived: true } });
  await auditWorkspace(userId, 'workspace.missions.trash.empty', undefined, 'mission');
  return { purged: trash.length };
}

// ——— Deadlines ———

export async function dbListDeadlines() {
  const rows = await prisma.importantDeadline.findMany({ orderBy: { dueAt: 'asc' } });
  return rows.map(mapDeadline);
}

export async function dbCreateDeadline(
  input: Omit<ImportantDeadline, 'id' | 'createdAt' | 'status'>,
  userId: string
) {
  const row = await prisma.importantDeadline.create({
    data: {
      title: input.title,
      kind: input.kind,
      dueAt: new Date(input.dueAt),
      ownerName: input.ownerName,
      description: input.description,
      alertDaysBefore: input.alertDaysBefore,
    },
  });
  await auditWorkspace(userId, 'workspace.deadline.create', row.id, 'deadline');
  return mapDeadline(row);
}

export async function dbUpdateDeadline(
  id: string,
  patch: Partial<ImportantDeadline>,
  userId: string
) {
  try {
    const row = await prisma.importantDeadline.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: new Date(patch.dueAt) } : {}),
        ...(patch.ownerName !== undefined ? { ownerName: patch.ownerName } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.alertDaysBefore !== undefined
          ? { alertDaysBefore: patch.alertDaysBefore }
          : {}),
      },
    });
    await auditWorkspace(userId, 'workspace.deadline.update', id, 'deadline');
    return mapDeadline(row);
  } catch {
    return null;
  }
}

export async function dbDeleteDeadline(id: string, userId: string) {
  try {
    await prisma.importantDeadline.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.deadline.delete', id, 'deadline');
    return true;
  } catch {
    return false;
  }
}

// ——— Documents ———

export async function dbListDocuments(filters?: {
  category?: string;
  q?: string;
  archived?: boolean;
}) {
  const archived = filters?.archived ?? false;
  const rows = await prisma.vaultDocument.findMany({
    where: { category: 'REPORT', archived },
    orderBy: archived ? { archivedAt: 'desc' } : { reportDate: 'desc' },
  });
  let items = rows.map(mapDocument);
  if (filters?.category) items = items.filter((d) => d.category === filters.category);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    const { stripReportHtml } = await import('@/lib/workspace/report-content');
    items = items.filter((d) => {
      const haystack = `${d.title} ${d.fileName} ${stripReportHtml(d.bodyHtml ?? '')}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  return items;
}

export async function dbCountDocuments() {
  const [active, trash] = await Promise.all([
    prisma.vaultDocument.count({ where: { category: 'REPORT', archived: false } }),
    prisma.vaultDocument.count({ where: { category: 'REPORT', archived: true } }),
  ]);
  return { active, trash };
}

export async function dbCreateDocument(
  input: Omit<VaultDocument, 'id' | 'uploadedAt' | 'version' | 'category' | 'tags' | 'restricted'>,
  userId: string
) {
  const { finalizeReportDocumentKey } = await import('@/lib/storage/workspace-uploads');
  const {
    INLINE_REPORT_FILE_NAME,
    INLINE_REPORT_STORAGE_KEY,
    hasReportWrittenContent,
    isInlineReportStorageKey,
  } = await import('@/lib/workspace/report-content');
  const reportDate = new Date(`${input.reportDate.slice(0, 10)}T12:00:00`);
  const written = hasReportWrittenContent(input.bodyHtml);
  const hasFile =
    Boolean(input.storageKey?.trim()) && !isInlineReportStorageKey(input.storageKey);

  const existingRows = await prisma.vaultDocument.findMany({
    where: { category: 'REPORT', archived: false },
    select: { id: true, title: true },
  });
  if (findReportTitleConflict(existingRows, { title: input.title })) {
    throw new ReportDuplicateError();
  }

  const row = await prisma.vaultDocument.create({
    data: {
      title: input.title,
      category: 'REPORT',
      fileName: hasFile ? input.fileName : INLINE_REPORT_FILE_NAME,
      fileSize: hasFile ? input.fileSize : Buffer.byteLength(input.bodyHtml ?? '', 'utf8'),
      storageKey: hasFile ? input.storageKey : INLINE_REPORT_STORAGE_KEY,
      reportDate,
      bodyHtml: written ? input.bodyHtml : null,
      tags: [] as Prisma.InputJsonValue,
      restricted: false,
      uploadedById: userId,
    },
  });

  if (!hasFile) {
  await auditWorkspace(userId, 'workspace.document.create', row.id, 'document');
  return mapDocument(row);
  }

  const storageKey = await finalizeReportDocumentKey(row.id, input.storageKey);
  const updated =
    storageKey === row.storageKey
      ? row
      : await prisma.vaultDocument.update({
          where: { id: row.id },
          data: { storageKey },
        });
  await auditWorkspace(userId, 'workspace.document.create', row.id, 'document');
  return mapDocument(updated);
}

export async function dbGetDocument(id: string) {
  const row = await prisma.vaultDocument.findFirst({
    where: { id, category: 'REPORT' },
  });
  return row ? mapDocument(row) : null;
}

export async function dbUpdateDocument(id: string, patch: Partial<VaultDocument>, userId: string) {
  try {
    const existing = await prisma.vaultDocument.findFirst({
      where: { id, category: 'REPORT' },
      select: { id: true, title: true, reportDate: true, storageKey: true, bodyHtml: true },
    });
    if (!existing) return null;

    const nextTitle = patch.title ?? existing.title;

    const reportRows = await prisma.vaultDocument.findMany({
      where: { category: 'REPORT', archived: false },
      select: { id: true, title: true },
    });
    if (findReportTitleConflict(reportRows, { title: nextTitle }, id)) {
      throw new ReportDuplicateError();
    }

    const {
      INLINE_REPORT_FILE_NAME,
      INLINE_REPORT_STORAGE_KEY,
      hasReportWrittenContent,
      isInlineReportStorageKey,
    } = await import('@/lib/workspace/report-content');

    let storageKey = patch.storageKey;
    const nextBodyHtml = patch.bodyHtml !== undefined ? patch.bodyHtml : existing.bodyHtml;
    const written = hasReportWrittenContent(nextBodyHtml);
    const incomingFile =
      patch.storageKey !== undefined &&
      Boolean(patch.storageKey?.trim()) &&
      !isInlineReportStorageKey(patch.storageKey);

    if (incomingFile && storageKey && storageKey !== existing.storageKey) {
      const { finalizeReportDocumentKey, deleteWorkspaceFile } = await import(
        '@/lib/storage/workspace-uploads'
      );
      if (!isInlineReportStorageKey(existing.storageKey)) {
        await deleteWorkspaceFile(existing.storageKey).catch(() => undefined);
      }
      storageKey = await finalizeReportDocumentKey(id, storageKey);
    } else if (written && patch.bodyHtml !== undefined && !isInlineReportStorageKey(existing.storageKey)) {
      const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
      await deleteWorkspaceFile(existing.storageKey).catch(() => undefined);
      storageKey = INLINE_REPORT_STORAGE_KEY;
    }

    const row = await prisma.vaultDocument.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.reportDate !== undefined
          ? { reportDate: new Date(`${patch.reportDate.slice(0, 10)}T12:00:00`) }
          : {}),
        ...(patch.bodyHtml !== undefined
          ? {
              bodyHtml: written ? patch.bodyHtml : null,
              ...(written && !incomingFile
                ? {
                    storageKey: INLINE_REPORT_STORAGE_KEY,
                    fileName: INLINE_REPORT_FILE_NAME,
                    fileSize: Buffer.byteLength(patch.bodyHtml ?? '', 'utf8'),
                  }
                : {}),
            }
          : {}),
        ...(incomingFile
          ? {
              fileName: patch.fileName,
              fileSize: patch.fileSize,
              storageKey,
              bodyHtml: null,
            }
          : {}),
        ...(patch.archived !== undefined
          ? {
              archived: patch.archived,
              archivedAt: patch.archived ? new Date() : null,
            }
          : {}),
      },
    });
    await auditWorkspace(
      userId,
      patch.archived !== undefined
        ? patch.archived
          ? 'workspace.document.archive'
          : 'workspace.document.restore'
        : 'workspace.document.update',
      id,
      'document'
    );
    return mapDocument(row);
  } catch (err) {
    if (err instanceof ReportDuplicateError) throw err;
    return null;
  }
}

export async function dbDeleteDocument(id: string, userId: string) {
  try {
    const existing = await prisma.vaultDocument.findFirst({
      where: { id, category: 'REPORT' },
      select: { storageKey: true, archived: true },
    });
    if (!existing?.archived) return false;
    await prisma.vaultDocument.delete({ where: { id } });
    const { isInlineReportStorageKey } = await import('@/lib/workspace/report-content');
    if (!isInlineReportStorageKey(existing.storageKey)) {
      const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
      await deleteWorkspaceFile(existing.storageKey).catch(() => undefined);
    }
    await auditWorkspace(userId, 'workspace.document.delete', id, 'document');
    return true;
  } catch {
    return false;
  }
}

export async function dbEmptyDocumentsTrash(userId: string) {
  const trash = await prisma.vaultDocument.findMany({
    where: { category: 'REPORT', archived: true },
    select: { id: true, storageKey: true },
  });
  if (trash.length === 0) return { purged: 0 };

  const { isInlineReportStorageKey } = await import('@/lib/workspace/report-content');
  const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');
  for (const doc of trash) {
    if (!isInlineReportStorageKey(doc.storageKey)) {
      await deleteWorkspaceFile(doc.storageKey).catch(() => undefined);
    }
  }
  await prisma.vaultDocument.deleteMany({ where: { category: 'REPORT', archived: true } });
  await auditWorkspace(userId, 'workspace.documents.trash.empty', undefined, 'document');
  return { purged: trash.length };
}

// ——— Réservations hôtel (missions) ———

export type HotelReservationAttachmentInput = {
  attachmentType: HotelReservationAttachmentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
};

export type HotelReservationWriteInput = {
  missionId: string;
  status?: DgMissionHotelReservation['status'];
  hotel: string;
  address?: string | null;
  city: string;
  country: string;
  contact?: string | null;
  roomCount: number;
  roomType?: string | null;
  arrivalDate: string;
  departureDate: string;
  cost?: number | null;
  currency: string;
  attachments?: HotelReservationAttachmentInput[];
};

function mapHotelAttachment(row: {
  id: string;
  reservationId: string;
  attachmentType: HotelReservationAttachmentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: Date;
}): DgMissionHotelReservationAttachment {
  return {
    id: row.id,
    reservationId: row.reservationId,
    attachmentType: row.attachmentType,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function mapHotelReservation(row: {
  id: string;
  missionId: string;
  hotel: string;
  address: string | null;
  city: string;
  country: string;
  contact: string | null;
  roomCount: number;
  roomType: string | null;
  arrivalDate: Date;
  departureDate: Date;
  cost: number | null;
  currency: string;
  status: DgMissionHotelReservation['status'];
  createdAt: Date;
  updatedAt: Date;
  mission: { subject: string };
  attachments: {
    id: string;
    reservationId: string;
    attachmentType: HotelReservationAttachmentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    uploadedAt: Date;
  }[];
}): DgMissionHotelReservation {
  return {
    id: row.id,
    missionId: row.missionId,
    missionSubject: row.mission.subject,
    hotel: row.hotel,
    address: row.address,
    city: row.city,
    country: row.country,
    contact: row.contact,
    roomCount: row.roomCount,
    roomType: row.roomType,
    arrivalDate: row.arrivalDate.toISOString(),
    departureDate: row.departureDate.toISOString(),
    cost: row.cost,
    currency: row.currency,
    status: row.status,
    attachments: row.attachments.map(mapHotelAttachment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const hotelReservationInclude = {
  mission: { select: { subject: true } },
  attachments: { orderBy: { uploadedAt: 'asc' as const } },
};

async function syncHotelAttachments(
  reservationId: string,
  _missionId: string,
  items: HotelReservationAttachmentInput[]
) {
  const { deleteWorkspaceFile } = await import('@/lib/storage/workspace-uploads');

  const existing = await prisma.dgMissionHotelReservationAttachment.findMany({
    where: { reservationId },
    select: { storageKey: true },
  });
  const nextKeys = new Set(items.map((a) => a.storageKey));

  await prisma.dgMissionHotelReservationAttachment.deleteMany({ where: { reservationId } });

  for (const old of existing) {
    if (!nextKeys.has(old.storageKey)) {
      await deleteWorkspaceFile(old.storageKey);
    }
  }

  if (items.length === 0) return;
  await prisma.dgMissionHotelReservationAttachment.createMany({
    data: items.map((a) => ({
      reservationId,
      attachmentType: a.attachmentType,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
    })),
  });
}

export async function dbGetHotelAttachment(id: string) {
  const row = await prisma.dgMissionHotelReservationAttachment.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
  };
}

export async function dbListHotelReservations(filters?: {
  missionId?: string;
  q?: string;
}) {
  const where: Prisma.DgMissionHotelReservationWhereInput = {};
  if (filters?.missionId) where.missionId = filters.missionId;
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { hotel: { contains: q } },
      { city: { contains: q } },
      { country: { contains: q } },
      { mission: { subject: { contains: q } } },
    ];
  }
  const rows = await prisma.dgMissionHotelReservation.findMany({
    where,
    include: hotelReservationInclude,
    orderBy: { arrivalDate: 'asc' },
  });
  return rows.map(mapHotelReservation);
}

export async function dbGetHotelReservationMissionId(id: string): Promise<string | null> {
  const row = await prisma.dgMissionHotelReservation.findUnique({
    where: { id },
    select: { missionId: true },
  });
  return row?.missionId ?? null;
}

export async function dbCreateHotelReservation(
  input: HotelReservationWriteInput,
  userId: string,
  userName = 'Assistante'
) {
  const row = await prisma.dgMissionHotelReservation.create({
    data: {
      missionId: input.missionId,
      hotel: input.hotel.trim(),
      address: input.address?.trim() || null,
      city: input.city.trim(),
      country: input.country.trim(),
      contact: input.contact?.trim() || null,
      roomCount: input.roomCount,
      roomType: input.roomType?.trim() || null,
      arrivalDate: new Date(input.arrivalDate),
      departureDate: new Date(input.departureDate),
      cost: input.cost ?? null,
      currency: input.currency.toUpperCase(),
      status: input.status ?? 'BOOKED',
    },
    include: hotelReservationInclude,
  });
  if (input.attachments?.length) {
    await syncHotelAttachments(row.id, input.missionId, input.attachments);
  }
  const full = await prisma.dgMissionHotelReservation.findUniqueOrThrow({
    where: { id: row.id },
    include: hotelReservationInclude,
  });
  await auditWorkspace(userId, 'workspace.hotel-reservation.create', row.id, 'hotel-reservation');
  await writeMissionHistory(input.missionId, { userId, userName }, {
    action: 'hotel.create',
    fieldName: 'hotel',
    newValue: full.hotel,
    detail: `${full.hotel} — ${full.city} (${HOTEL_RESERVATION_STATUS_LABELS[full.status]})`,
  });
  return mapHotelReservation(full);
}

export async function dbUpdateHotelReservation(
  id: string,
  patch: Partial<HotelReservationWriteInput> & {
    status?: DgMissionHotelReservation['status'];
  },
  userId: string,
  userName = 'Assistante'
) {
  try {
    const existing = await prisma.dgMissionHotelReservation.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await prisma.dgMissionHotelReservation.update({
      where: { id },
      data: {
        ...(patch.missionId !== undefined ? { missionId: patch.missionId } : {}),
        ...(patch.hotel !== undefined ? { hotel: patch.hotel.trim() } : {}),
        ...(patch.address !== undefined ? { address: patch.address?.trim() || null } : {}),
        ...(patch.city !== undefined ? { city: patch.city.trim() } : {}),
        ...(patch.country !== undefined ? { country: patch.country.trim() } : {}),
        ...(patch.contact !== undefined ? { contact: patch.contact?.trim() || null } : {}),
        ...(patch.roomCount !== undefined ? { roomCount: patch.roomCount } : {}),
        ...(patch.roomType !== undefined ? { roomType: patch.roomType?.trim() || null } : {}),
        ...(patch.arrivalDate !== undefined ? { arrivalDate: new Date(patch.arrivalDate) } : {}),
        ...(patch.departureDate !== undefined
          ? { departureDate: new Date(patch.departureDate) }
          : {}),
        ...(patch.cost !== undefined ? { cost: patch.cost } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency.toUpperCase() } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
      include: hotelReservationInclude,
    });

    if (patch.attachments !== undefined) {
      await syncHotelAttachments(
        id,
        patch.missionId ?? existing.missionId,
        patch.attachments
      );
    }

    const full = await prisma.dgMissionHotelReservation.findUniqueOrThrow({
      where: { id },
      include: hotelReservationInclude,
    });
    await auditWorkspace(userId, 'workspace.hotel-reservation.update', id, 'hotel-reservation');

    const actor = { userId, userName };
    const hotelLabel = full.hotel;
    if (patch.status !== undefined && patch.status !== existing.status) {
      await writeMissionHistory(existing.missionId, actor, {
        action: 'hotel.update',
        fieldName: 'hotelStatus',
        oldValue: existing.status,
        newValue: patch.status,
        detail: `${hotelLabel} — ${HOTEL_RESERVATION_STATUS_LABELS[patch.status]}`,
      });
    } else if (patch.hotel !== undefined && patch.hotel.trim() !== existing.hotel) {
      await writeMissionHistory(existing.missionId, actor, {
        action: 'hotel.update',
        fieldName: 'hotel',
        oldValue: existing.hotel,
        newValue: patch.hotel.trim(),
        detail: hotelLabel,
      });
    } else {
      await writeMissionHistory(existing.missionId, actor, {
        action: 'hotel.update',
        fieldName: 'hotel',
        detail: `${hotelLabel} — réservation modifiée`,
      });
    }

    return mapHotelReservation(full);
  } catch {
    return null;
  }
}

export async function dbDeleteHotelReservation(
  id: string,
  userId: string,
  userName = 'Assistante'
) {
  try {
    const existing = await prisma.dgMissionHotelReservation.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.dgMissionHotelReservation.delete({ where: { id } });
    await auditWorkspace(userId, 'workspace.hotel-reservation.delete', id, 'hotel-reservation');
    await writeMissionHistory(existing.missionId, { userId, userName }, {
      action: 'hotel.delete',
      fieldName: 'hotel',
      oldValue: existing.hotel,
      detail: `${existing.hotel} — ${existing.city}`,
    });
    return true;
  } catch {
    return false;
  }
}
