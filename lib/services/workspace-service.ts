import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockAddTaskComment,
  mockBuildWorkspaceDashboard,
  mockCreateAudience,
  mockCreateContact,
  mockCreateDeadline,
  mockCreateDecision,
  mockCreateDocument,
  mockCreateInvitation,
  mockCreateMail,
  mockCreateHotelReservation,
  mockAssignTasksToProject,
  mockCreateMission,
  mockGetMissionDocument,
  mockListMissionDocuments,
  mockCreateProject,
  mockCreateTask,
  mockDeleteProject,
  mockGetProject,
  mockListProjects,
  mockUpdateProject,
  mockDeleteAudience,
  mockDeleteContact,
  mockCountContacts,
  mockEmptyContactsTrash,
  mockDeleteDeadline,
  mockDeleteDecision,
  mockDeleteDocument,
  mockCountDocuments,
  mockEmptyDocumentsTrash,
  mockDeleteInvitation,
  mockDeleteMail,
  mockCountMail,
  mockEmptyMailTrash,
  mockCountMissions,
  mockExtendMission,
  mockDeleteMission,
  mockEmptyMissionsTrash,
  mockDeleteTask,
  mockGetTask,
  mockListAudiences,
  mockListContacts,
  mockIncrementContactAppointmentCount,
  mockListDeadlines,
  mockListDecisions,
  mockListDocuments,
  mockGetHotelAttachment,
  mockListHotelReservations,
  mockListInvitations,
  mockListMail,
  mockGetMail,
  mockListMailStatusTrace,
  mockGetMission,
  mockListMissions,
  mockRunAutoMissionStatusTransitions,
  mockListTasks,
  mockUpdateAudience,
  mockUpdateContact,
  mockUpdateDeadline,
  mockUpdateDecision,
  mockUpdateDocument,
  mockUpdateInvitation,
  mockUpdateMail,
  mockGetMailAttachment,
  mockUpdateHotelReservation,
  mockUpdateMission,
  mockUpdateTask,
} from '@/lib/mock/workspace-store';
import * as db from '@/lib/services/workspace-db';
import { listAppointments, notifyUser } from '@/lib/services/appointments';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { findMissionDuplicate, MISSION_DUPLICATE_ERROR } from '@/lib/workspace/mission-duplicate';
import {
  canManageMissionHotel,
  MISSION_HOTEL_LOCKED_ERROR,
} from '@/lib/workspace/mission-hotel-status';
import { canArchiveMission } from '@/lib/workspace/mission-status-workflow';
import { normalizeMissionWrite } from '@/lib/workspace/mission-payload';
import { dateInYear, yearRange } from '@/lib/temporal/year-range';
import {
  filterAudiencesByYear,
  filterDeadlinesByYear,
  filterDecisionsByYear,
  filterDocumentsByYear,
  filterHotelReservationsByYear,
  filterInvitationsByYear,
  filterMailByYear,
  filterMissionsByYear,
  filterProjectsByYear,
  filterTasksByYear,
} from '@/lib/temporal/workspace-year-filters';
import {
  computeContactAppointmentStats,
  enrichContactAppointment,
} from '@/lib/workspace/contact-follow-up';
import type {
  AudienceRecord,
  DgDecision,
  DgMission,
  DgMissionHotelReservation,
  DgProject,
  DgTask,
  ImportantDeadline,
  MailItem,
  OfficialInvitation,
  StrategicContact,
  VaultDocument,
  WorkspaceDashboard,
} from '@/lib/workspace/types';

export type WorkspaceListYearFilter = { year?: number };

async function appointmentStats() {
  const pending = await listAppointments({ status: 'PENDING' });
  const approved = await listAppointments({ status: 'APPROVED' });
  const today = new Date();
  const todayAppointments = approved
    .filter((a) => {
      const d = a.startAt;
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt.toISOString(),
    }));
  return {
    appointmentsToday: todayAppointments.length,
    pendingAppointments: pending.length,
    todayAppointments,
  };
}

export async function getWorkspaceDashboard(year?: number): Promise<WorkspaceDashboard> {
  const stats = await appointmentStats();
  const dash = isMockDataEnabled()
    ? mockBuildWorkspaceDashboard(stats)
    : await db.dbBuildWorkspaceDashboard(stats);
  if (!year) return dash;

  const y = year;
  const period = yearRange(y);
  const widgets = dash.widgets;
  return {
    ...dash,
    period: { from: period.fromIso, to: period.toIso },
    widgets: {
      ...widgets,
      todayAppointments: widgets.todayAppointments.filter((a) => dateInYear(a.startAt, y)),
      urgentTasks: filterTasksByYear(widgets.urgentTasks, y),
      overdueDecisions: filterDecisionsByYear(widgets.overdueDecisions, y),
      mailQueue: filterMailByYear(widgets.mailQueue, y),
      upcomingDeadlines: filterDeadlinesByYear(widgets.upcomingDeadlines, y),
      ongoingMissions: filterMissionsByYear(widgets.ongoingMissions, y),
      upcomingMissionsList: filterMissionsByYear(widgets.upcomingMissionsList, y),
      attentionMissions: filterMissionsByYear(widgets.attentionMissions, y),
      prolongedMissions: filterMissionsByYear(widgets.prolongedMissions, y),
    },
  };
}

export async function listWorkspaceTasks(filters?: { status?: string; q?: string; year?: number }) {
  let items = isMockDataEnabled() ? mockListTasks(filters) : await db.dbListTasks(filters);
  if (filters?.year) items = filterTasksByYear(items, filters.year);
  return items;
}

export async function getWorkspaceTask(id: string) {
  if (isMockDataEnabled()) return mockGetTask(id);
  return db.dbGetTask(id);
}

export async function createWorkspaceTask(
  input: Parameters<typeof mockCreateTask>[0],
  userId: string,
  userName: string
): Promise<DgTask> {
  if (isMockDataEnabled()) return mockCreateTask(input, userId, userName);
  return db.dbCreateTask(input, userId, userName);
}

export async function updateWorkspaceTask(
  id: string,
  patch: Partial<DgTask>,
  userId: string,
  userName: string
) {
  if (isMockDataEnabled()) return mockUpdateTask(id, patch, userId, userName);
  return db.dbUpdateTask(id, patch, userId, userName);
}

export async function deleteWorkspaceTask(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteTask(id, userId);
  return db.dbDeleteTask(id, userId);
}

export async function addWorkspaceTaskComment(
  taskId: string,
  authorId: string,
  authorName: string,
  body: string
) {
  if (isMockDataEnabled()) return mockAddTaskComment(taskId, authorId, authorName, body);
  return db.dbAddTaskComment(taskId, authorId, authorName, body);
}

export async function listWorkspaceProjects(filters?: { year?: number }) {
  let items = isMockDataEnabled() ? mockListProjects() : await db.dbListProjects();
  if (filters?.year) items = filterProjectsByYear(items, filters.year);
  return items;
}

export async function getWorkspaceProject(id: string) {
  if (isMockDataEnabled()) return mockGetProject(id);
  return db.dbGetProject(id);
}

export async function createWorkspaceProject(
  input: Parameters<typeof mockCreateProject>[0],
  userId: string
): Promise<DgProject> {
  if (isMockDataEnabled()) return mockCreateProject(input, userId);
  return db.dbCreateProject(input, userId);
}

export async function updateWorkspaceProject(
  id: string,
  patch: Partial<DgProject> & { phases?: string[] },
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateProject(id, patch, userId);
  return db.dbUpdateProject(id, patch, userId);
}

export async function deleteWorkspaceProject(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteProject(id, userId);
  return db.dbDeleteProject(id, userId);
}

export async function assignWorkspaceTasksToProject(
  projectId: string,
  taskIds: string[],
  projectPhase: string | null | undefined,
  userId: string
) {
  if (isMockDataEnabled()) return mockAssignTasksToProject(projectId, taskIds, projectPhase, userId);
  return db.dbAssignTasksToProject(projectId, taskIds, projectPhase, userId);
}

export async function listWorkspaceDecisions(filters?: { status?: string; q?: string; year?: number }) {
  let items = isMockDataEnabled() ? mockListDecisions(filters) : await db.dbListDecisions(filters);
  if (filters?.year) items = filterDecisionsByYear(items, filters.year);
  return items;
}

export async function createWorkspaceDecision(
  input: Parameters<typeof mockCreateDecision>[0],
  userId: string
): Promise<DgDecision> {
  if (isMockDataEnabled()) return mockCreateDecision(input, userId);
  return db.dbCreateDecision(input, userId);
}

export async function updateWorkspaceDecision(id: string, patch: Partial<DgDecision>, userId: string) {
  if (isMockDataEnabled()) return mockUpdateDecision(id, patch, userId);
  return db.dbUpdateDecision(id, patch, userId);
}

export async function deleteWorkspaceDecision(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteDecision(id, userId);
  return db.dbDeleteDecision(id, userId);
}

export async function listWorkspaceMail(filters?: {
  direction?: string;
  mailKind?: string;
  q?: string;
  year?: number;
  archived?: boolean;
}) {
  if (isMockDataEnabled()) {
    let items = mockListMail(filters);
    if (filters?.year) items = filterMailByYear(items, filters.year);
    return items;
  }
  return db.dbListMail(filters);
}

export async function getWorkspaceMail(id: string) {
  if (isMockDataEnabled()) return mockGetMail(id);
  return db.dbGetMail(id);
}

export async function listWorkspaceMailStatusTrace(id: string) {
  const mail = isMockDataEnabled() ? mockGetMail(id) : await db.dbGetMail(id);
  if (!mail) return null;
  if (isMockDataEnabled()) return mockListMailStatusTrace(mail);
  return db.dbListMailStatusTrace(mail);
}

export async function countWorkspaceMail(filters?: {
  direction?: string;
  mailKind?: string;
  year?: number;
}) {
  if (isMockDataEnabled()) return mockCountMail(filters);
  return db.dbCountMail(filters);
}

export async function createWorkspaceMail(
  input: Parameters<typeof mockCreateMail>[0],
  userId: string
): Promise<MailItem> {
  if (isMockDataEnabled()) return mockCreateMail(input, userId);
  return db.dbCreateMail(input, userId);
}

export async function updateWorkspaceMail(
  id: string,
  patch: Partial<MailItem> & {
    attachments?: Parameters<typeof db.dbUpdateMail>[1]['attachments'];
    hasAttachment?: boolean;
  },
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateMail(id, patch, userId);
  return db.dbUpdateMail(id, patch, userId);
}

export async function getWorkspaceMailAttachment(id: string) {
  if (isMockDataEnabled()) return mockGetMailAttachment(id);
  return db.dbGetMailAttachment(id);
}

export async function deleteWorkspaceMail(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteMail(id, userId);
  return db.dbDeleteMail(id, userId);
}

export async function emptyWorkspaceMailTrash(
  userId: string,
  filters?: { direction?: string; mailKind?: string; year?: number }
) {
  if (isMockDataEnabled()) return mockEmptyMailTrash(userId, filters);
  return db.dbEmptyMailTrash(userId, filters);
}

export async function listWorkspaceContacts(filters?: {
  category?: string;
  q?: string;
  archived?: boolean;
}) {
  if (isMockDataEnabled()) return mockListContacts(filters);
  return db.dbListContacts(filters);
}

export async function countWorkspaceContacts() {
  if (isMockDataEnabled()) return mockCountContacts();
  return db.dbCountContacts();
}

export async function emptyWorkspaceContactsTrash(userId: string) {
  if (isMockDataEnabled()) return mockEmptyContactsTrash(userId);
  return db.dbEmptyContactsTrash(userId);
}

export async function createWorkspaceContact(
  input: Parameters<typeof mockCreateContact>[0],
  userId: string
): Promise<StrategicContact> {
  if (isMockDataEnabled()) return mockCreateContact(input, userId);
  return db.dbCreateContact(input, userId);
}

export async function updateWorkspaceContact(
  id: string,
  patch: Partial<StrategicContact>,
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateContact(id, patch, userId);
  return db.dbUpdateContact(id, patch, userId);
}

export async function deleteWorkspaceContact(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteContact(id, userId);
  return db.dbDeleteContact(id, userId);
}

export async function getWorkspaceContact(id: string) {
  if (isMockDataEnabled()) return mockListContacts().find((c) => c.id === id) ?? null;
  return db.dbGetContact(id);
}

export async function listContactAppointments(contactId: string, year?: number) {
  let items = isMockDataEnabled()
    ? (await import('@/lib/mock/store')).mockListAppointmentsByContact(contactId)
    : await db.dbListContactAppointments(contactId);
  if (year) {
    items = items.filter((a) => dateInYear(a.startAt, year));
  }
  const now = new Date();
  return items.map((item) => enrichContactAppointment(item, now));
}

export async function getContactAppointmentStats(contactId: string, year?: number) {
  const items = await listContactAppointments(contactId, year);
  return computeContactAppointmentStats(items, new Date());
}

export async function incrementContactAppointmentCount(contactId: string, userId = 'system') {
  if (isMockDataEnabled()) return mockIncrementContactAppointmentCount(contactId, userId);
  return db.dbIncrementContactAppointmentCount(contactId);
}

export async function listWorkspaceAudiences(filters?: {
  q?: string;
  archived?: boolean;
  year?: number;
}) {
  let items = isMockDataEnabled() ? mockListAudiences(filters) : await db.dbListAudiences(filters);
  if (filters?.year) items = filterAudiencesByYear(items, filters.year);
  return items;
}

export async function createWorkspaceAudience(
  input: Parameters<typeof mockCreateAudience>[0],
  userId: string
): Promise<AudienceRecord> {
  if (isMockDataEnabled()) return mockCreateAudience(input, userId);
  return db.dbCreateAudience(input, userId);
}

export async function updateWorkspaceAudience(
  id: string,
  patch: Partial<AudienceRecord>,
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateAudience(id, patch, userId);
  return db.dbUpdateAudience(id, patch, userId);
}

export async function deleteWorkspaceAudience(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteAudience(id, userId);
  return db.dbDeleteAudience(id, userId);
}

export async function listWorkspaceInvitations(filters?: { year?: number }) {
  let items = isMockDataEnabled() ? mockListInvitations() : await db.dbListInvitations();
  if (filters?.year) items = filterInvitationsByYear(items, filters.year);
  return items;
}

export async function createWorkspaceInvitation(
  input: Parameters<typeof mockCreateInvitation>[0],
  userId: string
): Promise<OfficialInvitation> {
  if (isMockDataEnabled()) return mockCreateInvitation(input, userId);
  return db.dbCreateInvitation(input, userId);
}

export async function updateWorkspaceInvitation(
  id: string,
  patch: Partial<OfficialInvitation>,
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateInvitation(id, patch, userId);
  return db.dbUpdateInvitation(id, patch, userId);
}

export async function deleteWorkspaceInvitation(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteInvitation(id, userId);
  return db.dbDeleteInvitation(id, userId);
}

export async function listWorkspaceMissions(filters?: { archived?: boolean; year?: number }) {
  if (!filters?.archived) {
    if (isMockDataEnabled()) {
      mockRunAutoMissionStatusTransitions();
    } else {
      const { runAutoMissionStatusTransitions } = await import('@/lib/services/mission-workflow');
      await runAutoMissionStatusTransitions().catch(() => undefined);
    }
  }
  let items = isMockDataEnabled() ? mockListMissions(filters) : await db.dbListMissions(filters);
  if (filters?.year) items = filterMissionsByYear(items, filters.year);
  return items;
}

export async function countWorkspaceMissions() {
  if (isMockDataEnabled()) return mockCountMissions();
  return db.dbCountMissions();
}

export async function emptyWorkspaceMissionsTrash(userId: string) {
  if (isMockDataEnabled()) return mockEmptyMissionsTrash(userId);
  return db.dbEmptyMissionsTrash(userId);
}

export async function createWorkspaceMission(
  input: import('@/lib/workspace/mission-payload').MissionWriteInput,
  userId: string,
  userName?: string,
  documents: import('@/lib/services/workspace-db').MissionDocumentInput[] = []
): Promise<{ ok: true; mission: DgMission } | { ok: false; error: string }> {
  const data = normalizeMissionWrite(input);
  const existing = isMockDataEnabled()
    ? mockListMissions({ archived: false })
    : await db.dbListMissions({ archived: false });
  const duplicate = findMissionDuplicate({ subject: data.subject }, existing);
  if (duplicate) return { ok: false, error: MISSION_DUPLICATE_ERROR };

  const mission = isMockDataEnabled()
    ? mockCreateMission(input, userId, documents)
    : await db.dbCreateMission(input, userId, userName, documents);

  await notifyMissionCreated(mission).catch(() => undefined);

  return { ok: true, mission };
}

async function notifyMissionCreated(mission: DgMission) {
  const depart = format(new Date(mission.departAt), 'd MMM yyyy', { locale: fr });
  const retour = format(new Date(mission.returnAt), 'd MMM yyyy', { locale: fr });
  const message = `« ${mission.subject} » — du ${depart} au ${retour}. Visible sur l’agenda DGA.`;

  if (isMockDataEnabled()) {
    await notifyUser({
      userId: 'mock-dg',
      kind: 'MISSION_CREATED',
      title: 'Nouvelle mission planifiée',
      message,
    }).catch(() => undefined);
    await notifyUser({
      userId: 'mock-assistant',
      kind: 'MISSION_CREATED',
      title: 'Nouvelle mission planifiée',
      message,
    }).catch(() => undefined);
    return;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['DG', 'ASSISTANT'] }, active: true, archived: false },
    select: { id: true },
  });

  for (const user of users) {
    await notifyUser({
      userId: user.id,
      kind: 'MISSION_CREATED',
      title: 'Nouvelle mission planifiée',
      message,
    }).catch(() => undefined);
  }
}

export async function listWorkspaceMissionDocuments(missionId: string) {
  if (isMockDataEnabled()) return mockListMissionDocuments(missionId);
  return db.dbListMissionDocuments(missionId);
}

export async function getWorkspaceMissionDocument(id: string) {
  if (isMockDataEnabled()) return mockGetMissionDocument(id);
  return db.dbGetMissionDocument(id);
}

export async function attachWorkspaceMissionReportFile(
  missionId: string,
  file: { fileName: string; fileSize: number; mimeType: string; buffer: Buffer },
  userId: string,
  userName?: string
) {
  if (isMockDataEnabled()) {
    return { ok: false as const, error: 'NOT_SUPPORTED' };
  }
  return db.dbAttachMissionReportFile(missionId, file, userId, userName);
}

export async function deleteWorkspaceMissionReportFile(
  missionId: string,
  userId: string,
  userName?: string
) {
  if (isMockDataEnabled()) {
    return { ok: false as const, error: 'NOT_SUPPORTED' };
  }
  return db.dbDeleteMissionReportFile(missionId, userId, userName);
}

export async function updateWorkspaceMission(
  id: string,
  patch: Partial<DgMission> & {
    destinations?: string[];
    documents?: import('@/lib/services/workspace-db').MissionDocumentInput[];
  },
  userId: string,
  userName?: string
) {
  const prev = isMockDataEnabled() ? mockGetMission(id) : await db.dbGetMission(id);
  if (!prev) return { ok: false as const, error: 'NOT_FOUND' };

  const { documents, ...restPatch } = patch;

  if (restPatch.archived === true && !canArchiveMission(prev)) {
    return { ok: false as const, error: 'MISSION_ONGOING_ARCHIVE_FORBIDDEN' };
  }
  const patchKeys = Object.keys(restPatch).filter(
    (key) => restPatch[key as keyof typeof restPatch] !== undefined
  );
  const documentsOnly = patchKeys.length === 0 && documents !== undefined;

  const subjectChanging = restPatch.subject !== undefined;
  const restoringFromTrash = restPatch.archived === false;
  if (!documentsOnly && (subjectChanging || restoringFromTrash)) {
    const activeMissions = isMockDataEnabled()
      ? mockListMissions({ archived: false })
      : await db.dbListMissions({ archived: false });
    const nextSubject =
      restPatch.subject !== undefined ? restPatch.subject.trim() : prev.subject;
    const duplicate = findMissionDuplicate({ subject: nextSubject }, activeMissions, {
      excludeId: id,
    });
    if (duplicate) return { ok: false as const, error: MISSION_DUPLICATE_ERROR };
  }

  if (isMockDataEnabled()) {
    const mission = mockUpdateMission(id, patch, userId);
    return mission ? { ok: true as const, mission } : { ok: false as const, error: 'NOT_FOUND' };
  }
  return db.dbUpdateMission(id, patch, userId, userName);
}

export {
  applyMissionStatusTransition,
  listMissionHistory,
  runAutoMissionStatusTransitions,
} from '@/lib/services/mission-workflow';

export async function extendWorkspaceMission(
  id: string,
  input: import('@/lib/workspace/mission-operational-state').MissionExtendInput,
  userId: string,
  userName?: string
) {
  if (isMockDataEnabled()) {
    return mockExtendMission(id, input, userId);
  }
  return db.dbExtendMission(id, input, userId, userName);
}

export async function deleteWorkspaceMission(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteMission(id, userId);
  return db.dbDeleteMission(id, userId);
}

export async function listWorkspaceHotelReservations(filters?: {
  missionId?: string;
  q?: string;
  year?: number;
}) {
  let items = isMockDataEnabled()
    ? mockListHotelReservations(filters)
    : await db.dbListHotelReservations(filters);
  if (filters?.year) items = filterHotelReservationsByYear(items, filters.year);
  return items;
}

export async function ensureMissionHotelWritable(missionId: string): Promise<string | null> {
  const mission = isMockDataEnabled() ? mockGetMission(missionId) : await db.dbGetMission(missionId);
  if (!mission) return 'NOT_FOUND';
  if (!canManageMissionHotel(mission)) return MISSION_HOTEL_LOCKED_ERROR;
  return null;
}

async function ensureHotelReservationWritable(reservationId: string): Promise<string | null> {
  const missionId = isMockDataEnabled()
    ? mockListHotelReservations({}).find((r) => r.id === reservationId)?.missionId ?? null
    : await db.dbGetHotelReservationMissionId(reservationId);
  if (!missionId) return 'NOT_FOUND';
  return ensureMissionHotelWritable(missionId);
}

export async function createWorkspaceHotelReservation(
  input: db.HotelReservationWriteInput,
  userId: string,
  userName?: string
): Promise<DgMissionHotelReservation | { error: string }> {
  const gate = await ensureMissionHotelWritable(input.missionId);
  if (gate) return { error: gate };
  if (isMockDataEnabled()) return mockCreateHotelReservation(input, userId);
  return db.dbCreateHotelReservation(input, userId, userName);
}

export async function updateWorkspaceHotelReservation(
  id: string,
  patch: Partial<db.HotelReservationWriteInput> & {
    status?: DgMissionHotelReservation['status'];
  },
  userId: string,
  userName?: string
) {
  const gate = await ensureHotelReservationWritable(id);
  if (gate) return { error: gate } as const;
  if (patch.missionId) {
    const missionGate = await ensureMissionHotelWritable(patch.missionId);
    if (missionGate) return { error: missionGate } as const;
  }
  if (isMockDataEnabled()) return mockUpdateHotelReservation(id, patch, userId);
  const row = await db.dbUpdateHotelReservation(id, patch, userId, userName);
  return row ?? { error: 'NOT_FOUND' as const };
}

export async function deleteWorkspaceHotelReservation(
  id: string,
  userId: string,
  userName?: string
): Promise<boolean | { error: string }> {
  const gate = await ensureHotelReservationWritable(id);
  if (gate) return { error: gate };
  if (isMockDataEnabled()) return mockDeleteHotelReservation(id, userId);
  return db.dbDeleteHotelReservation(id, userId, userName);
}

export async function getWorkspaceHotelAttachment(id: string) {
  if (isMockDataEnabled()) return mockGetHotelAttachment(id);
  return db.dbGetHotelAttachment(id);
}

export async function listWorkspaceDeadlines(filters?: { year?: number }) {
  let items = isMockDataEnabled() ? mockListDeadlines() : await db.dbListDeadlines();
  if (filters?.year) items = filterDeadlinesByYear(items, filters.year);
  return items;
}

export async function createWorkspaceDeadline(
  input: Parameters<typeof mockCreateDeadline>[0],
  userId: string
): Promise<ImportantDeadline> {
  if (isMockDataEnabled()) return mockCreateDeadline(input, userId);
  return db.dbCreateDeadline(input, userId);
}

export async function updateWorkspaceDeadline(
  id: string,
  patch: Partial<ImportantDeadline>,
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateDeadline(id, patch, userId);
  return db.dbUpdateDeadline(id, patch, userId);
}

export async function deleteWorkspaceDeadline(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteDeadline(id, userId);
  return db.dbDeleteDeadline(id, userId);
}

export async function listWorkspaceDocuments(filters?: {
  category?: string;
  q?: string;
  year?: number;
  archived?: boolean;
}) {
  let items = isMockDataEnabled() ? mockListDocuments(filters) : await db.dbListDocuments(filters);
  if (filters?.year) items = filterDocumentsByYear(items, filters.year);
  return items;
}

export async function countWorkspaceDocuments() {
  if (isMockDataEnabled()) return mockCountDocuments();
  return db.dbCountDocuments();
}

export async function emptyWorkspaceDocumentsTrash(userId: string) {
  if (isMockDataEnabled()) return mockEmptyDocumentsTrash(userId);
  return db.dbEmptyDocumentsTrash(userId);
}

export async function createWorkspaceDocument(
  input: Omit<VaultDocument, 'id' | 'uploadedAt' | 'version' | 'category' | 'tags' | 'restricted'>,
  userId: string
): Promise<VaultDocument> {
  if (isMockDataEnabled()) return mockCreateDocument(input, userId);
  return db.dbCreateDocument(input, userId);
}

export async function getWorkspaceDocument(id: string) {
  if (isMockDataEnabled()) {
    const items = mockListDocuments({ category: 'REPORT' });
    return items.find((d) => d.id === id) ?? null;
  }
  return db.dbGetDocument(id);
}

export async function updateWorkspaceDocument(
  id: string,
  patch: Partial<VaultDocument>,
  userId: string
) {
  if (isMockDataEnabled()) return mockUpdateDocument(id, patch, userId);
  return db.dbUpdateDocument(id, patch, userId);
}

export async function deleteWorkspaceDocument(id: string, userId: string) {
  if (isMockDataEnabled()) return mockDeleteDocument(id, userId);
  return db.dbDeleteDocument(id, userId);
}
