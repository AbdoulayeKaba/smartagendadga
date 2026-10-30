import { mockWriteAuditJournal } from '@/lib/mock/audit-journal-store';
import { ReportDuplicateError } from '@/lib/workspace/report-errors';
import { findReportTitleConflict } from '@/lib/workspace/report-content';
import {
  formatMissionDestinations,
  parseLegacyDestination,
} from '@/lib/workspace/mission-countries';
import { DEFAULT_MISSION_TYPE } from '@/lib/workspace/mission-types';
import type { MissionImportRow } from '@/lib/dg/mission-excel-import';
import { buildImportedMissionDetails } from '@/lib/workspace/mission-import-meta';
import { normalizeMissionWrite, type MissionWriteInput } from '@/lib/workspace/mission-payload';
import {
  resolveOperationalStateAfterReturnChange,
  validateMissionExtend,
  type MissionExtendInput,
} from '@/lib/workspace/mission-operational-state';
import { resolveMissionHotelStatus } from '@/lib/workspace/mission-hotel-status';
import {
  computeAutoStatus,
  computeAutoStatusAfterDatePatch,
  missionAutoCloseAt,
  missionAutoStartAt,
} from '@/lib/workspace/mission-status-workflow';
import { computeMailExecutionDeadline, inferMailStatusTimestamps } from '@/lib/workspace/mail-utils';
import { computeContactAppointmentStats } from '@/lib/workspace/contact-follow-up';
import { contactMatchesSearchQuery } from '@/lib/workspace/contact-search';
import { mockListAppointmentsByContact } from '@/lib/mock/store';
import { DEMO_MAIL_RECORDS, demoMailToMailItem } from '@/lib/seed/mail-demo-data';
import { DEMO_REPORT_RECORDS, demoReportToVaultDocument } from '@/lib/seed/reports-demo-data';
import type {
  AudienceRecord,
  DgDecision,
  DgMission,
  DgMissionDocument,
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

/** Compteur au-delà des IDs statiques (task-4, mis-1, mail-3, …) pour éviter les doublons React. */
let seq = 10_000;
const id = (p: string) => `${p}-${seq++}`;
const iso = (d: Date) => d.toISOString();

function uniqById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
};

const projects: DgProject[] = [
  {
    id: 'proj-1',
    name: 'Conseil ARPT T2',
    description: 'Préparation du conseil trimestriel ARPT.',
    status: 'ACTIVE',
    ownerName: 'Direction Technique',
    ownerUserId: null,
    phases: ['Préparation', 'Validation DGA', 'Clôture'],
    startAt: iso(daysFromNow(-10)),
    dueAt: iso(daysFromNow(14)),
    taskCount: 1,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-12)),
    updatedAt: iso(daysFromNow(-1)),
  },
  {
    id: 'proj-2',
    name: 'Coordination Ministère',
    description: 'Suivi des échanges avec le ministère de tutelle.',
    status: 'ACTIVE',
    ownerName: 'Cabinet DGA',
    ownerUserId: null,
    phases: ['Validation DGA', 'Exécution'],
    startAt: iso(daysFromNow(-5)),
    dueAt: iso(daysFromNow(7)),
    taskCount: 1,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-8)),
    updatedAt: iso(daysFromNow(-2)),
  },
  {
    id: 'proj-3',
    name: 'Convention Partenaire X',
    description: null,
    status: 'ON_HOLD',
    ownerName: 'Service Juridique',
    ownerUserId: null,
    phases: ['Validation juridique', 'Signature'],
    startAt: null,
    dueAt: iso(daysFromNow(20)),
    taskCount: 1,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-15)),
    updatedAt: iso(daysFromNow(-4)),
  },
  {
    id: 'proj-4',
    name: 'Audience Ambassade UE',
    description: 'Compte rendu et archivage.',
    status: 'COMPLETED',
    ownerName: 'Assistante DGA',
    ownerUserId: 'mock-assistant',
    phases: ['Clôture'],
    startAt: iso(daysFromNow(-8)),
    dueAt: iso(daysFromNow(-2)),
    taskCount: 1,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-10)),
    updatedAt: iso(daysFromNow(-1)),
  },
];

function syncProjectTaskCounts() {
  for (const project of projects) {
    project.taskCount = tasks.filter((t) => t.projectId === project.id).length;
  }
}

function mapMockProject(row: DgProject): DgProject {
  return {
    ...row,
    taskCount: tasks.filter((t) => t.projectId === row.id).length,
  };
}

function resolveMockTaskProject(input: { projectId?: string | null; projectName?: string | null }) {
  if (input.projectId === null) {
    return { projectId: null, projectName: null };
  }
  if (input.projectId) {
    const project = projects.find((p) => p.id === input.projectId);
    if (project) return { projectId: project.id, projectName: project.name };
  }
  if (input.projectName) {
    const project = projects.find((p) => p.name === input.projectName.trim());
    if (project) return { projectId: project.id, projectName: project.name };
    return { projectId: null, projectName: input.projectName.trim() };
  }
  return {};
}

const tasks: DgTask[] = [
  {
    id: 'task-1',
    title: 'Préparer note de synthèse Conseil ARPT',
    description: 'Consolidation des indicateurs trimestriels.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    projectId: 'proj-1',
    projectName: 'Conseil ARPT T2',
    projectPhase: 'Préparation',
    assigneeName: 'Direction Technique',
    assigneeUserId: null,
    startAt: iso(daysFromNow(-4)),
    dueAt: iso(daysFromNow(3)),
    estimatedHours: 12,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-5)),
    updatedAt: iso(daysFromNow(-1)),
  },
  {
    id: 'task-2',
    title: 'Valider ordre du jour réunion ministère',
    status: 'PENDING',
    priority: 'HIGH',
    projectId: 'proj-2',
    projectName: 'Coordination Ministère',
    projectPhase: 'Validation DGA',
    assigneeName: 'Cabinet DGA',
    assigneeUserId: null,
    startAt: iso(daysFromNow(-1)),
    dueAt: iso(daysFromNow(1)),
    estimatedHours: 4,
    description: null,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-2)),
    updatedAt: iso(daysFromNow(-2)),
  },
  {
    id: 'task-3',
    title: 'Suivi signature convention partenaire',
    status: 'SUSPENDED',
    priority: 'MEDIUM',
    projectId: 'proj-3',
    projectName: 'Convention Partenaire X',
    projectPhase: 'Validation juridique',
    assigneeName: 'Service Juridique',
    assigneeUserId: null,
    startAt: iso(daysFromNow(-10)),
    dueAt: iso(daysFromNow(10)),
    estimatedHours: 16,
    description: 'En attente retour juridique.',
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-12)),
    updatedAt: iso(daysFromNow(-4)),
  },
  {
    id: 'task-4',
    title: 'Archiver compte rendu audience ambassade',
    status: 'COMPLETED',
    priority: 'LOW',
    projectId: 'proj-4',
    projectName: 'Audience Ambassade UE',
    projectPhase: 'Clôture',
    assigneeName: 'Assistante DGA',
    assigneeUserId: 'mock-assistant',
    startAt: iso(daysFromNow(-5)),
    dueAt: iso(daysFromNow(-2)),
    estimatedHours: 2,
    description: null,
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-8)),
    updatedAt: iso(daysFromNow(-1)),
  },
];

const taskComments: DgTaskComment[] = [
  {
    id: 'tc-1',
    taskId: 'task-1',
    authorId: 'mock-assistant',
    authorName: 'Aminata Diallo',
    body: 'Version provisoire transmise au DGA pour relecture.',
    createdAt: iso(daysFromNow(-1)),
  },
];

const taskHistory: DgTaskHistoryEntry[] = [
  {
    id: 'th-1',
    taskId: 'task-1',
    userId: 'mock-assistant',
    userName: 'Aminata Diallo',
    action: 'status.change',
    detail: 'En attente → En cours',
    createdAt: iso(daysFromNow(-3)),
  },
];

const decisions: DgDecision[] = [
  {
    id: 'dec-1',
    title: 'Renforcement contrôle qualité réseau',
    context: 'Suite à la réunion du comité technique.',
    decisionText: 'Lancer un audit ciblé sur 3 opérateurs d’ici fin du trimestre.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    ownerName: 'Direction Régulation',
    ownerUserId: null,
    appointmentId: null,
    dueAt: iso(daysFromNow(14)),
    meetingDate: iso(daysFromNow(-7)),
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-7)),
    updatedAt: iso(daysFromNow(-2)),
  },
  {
    id: 'dec-2',
    title: 'Report lancement plateforme e-services',
    context: 'Contraintes budgétaires.',
    decisionText: 'Reporter au T2 avec revue mensuelle d’avancement.',
    status: 'OVERDUE',
    priority: 'MEDIUM',
    ownerName: 'DSI',
    ownerUserId: null,
    appointmentId: null,
    dueAt: iso(daysFromNow(-3)),
    meetingDate: iso(daysFromNow(-20)),
    createdById: 'mock-assistant',
    createdAt: iso(daysFromNow(-20)),
    updatedAt: iso(daysFromNow(-5)),
  },
];

const mail: MailItem[] = DEMO_MAIL_RECORDS.map((row) => demoMailToMailItem(row, daysFromNow, iso));

const mailWorkflowEvents: Array<{
  mailId: string;
  status: MailItem['workflowStatus'];
  fromStatus: MailItem['workflowStatus'] | null;
  createdAt: string;
}> = mail.map((item) => ({
  mailId: item.id,
  status: item.direction === 'OUTGOING' ? 'SENT' : 'RECEIVED',
  fromStatus: null,
  createdAt: item.createdAt,
}));

function mockPushMailWorkflowEvent(
  mailId: string,
  status: MailItem['workflowStatus'],
  fromStatus: MailItem['workflowStatus'] | null = null
) {
  mailWorkflowEvents.push({
    mailId,
    status,
    fromStatus,
    createdAt: iso(new Date()),
  });
}

export function mockListMailStatusTrace(item: MailItem): MailStatusTraceEntry[] {
  const inferred = inferMailStatusTimestamps(item);
  const byStatus = new Map<MailItem['workflowStatus'], MailStatusTraceEntry>();
  for (const [status, at] of Object.entries(inferred) as [MailItem['workflowStatus'], string][]) {
    if (!at) continue;
    byStatus.set(status, { status, at, inferred: true });
  }
  for (const event of mailWorkflowEvents.filter((e) => e.mailId === item.id)) {
    byStatus.set(event.status, {
      status: event.status,
      at: event.createdAt,
      inferred: false,
    });
  }
  return [...byStatus.values()].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

const contacts: StrategicContact[] = [
  {
    id: 'ct-1',
    category: 'MINISTRY',
    fullName: 'M. Ibrahim Keita',
    jobTitle: 'Directeur de cabinet',
    organization: 'Ministère des PTN',
    phone: '+223 20 22 33 44',
    email: 'cabinet@mptn.gov.ml',
    notes: 'Contact privilégié pour convocations.',
    interactionCount: 12,
    appointmentCount: 0,
    visitCount: 0,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-90)),
    updatedAt: iso(daysFromNow(-5)),
  },
  {
    id: 'ct-2',
    category: 'EMBASSY',
    fullName: 'S.E. Marie Dupont',
    jobTitle: 'Ambassadrice',
    organization: 'Union Européenne',
    phone: '+223 20 11 22 33',
    email: 'delegation@eeas.europa.eu',
    notes: null,
    interactionCount: 4,
    appointmentCount: 0,
    visitCount: 0,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-60)),
    updatedAt: iso(daysFromNow(-10)),
  },
];

const audiences: AudienceRecord[] = [
  {
    id: 'aud-1',
    heldAt: iso(daysFromNow(-5)),
    endAt: iso(daysFromNow(-5)),
    participants: 'DGA, Directeur Régulation, Représentant opérateur',
    subject: 'Revue performance réseau mobile',
    outcome: 'Feuille de route validée sous 30 jours.',
    minutes: 'Points clés : couverture, QoS, pénalités.',
    appointmentId: null,
    archived: false,
    createdAt: iso(daysFromNow(-5)),
  },
];

const invitations: OfficialInvitation[] = [
  {
    id: 'inv-1',
    organizer: 'UIT — Bureau régional',
    eventTitle: 'Sommet régulateurs Afrique de l’Ouest',
    eventDate: iso(daysFromNow(21)),
    location: 'Dakar, Sénégal',
    importance: 'HIGH',
    status: 'PENDING',
    delegateName: null,
    notes: 'Prévoir délégation technique.',
    createdAt: iso(daysFromNow(-4)),
    updatedAt: iso(daysFromNow(-4)),
  },
];

const hotelReservations: DgMissionHotelReservation[] = [
  {
    id: 'hotel-1',
    missionId: 'mis-1',
    missionSubject: 'Mission de travail — harmonisation réglementaire',
    hotel: 'Hôtel du Plateau',
    address: 'Boulevard de la République',
    city: 'Abidjan',
    country: 'Côte d’Ivoire',
    contact: 'Réception — +225 27 20 00 00 00',
    roomCount: 2,
    roomType: 'Suite exécutive',
    arrivalDate: iso(daysFromNow(8)),
    departureDate: iso(daysFromNow(11)),
    cost: 450_000,
    currency: 'GNF',
    status: 'BOOKING_IN_PROGRESS',
    attachments: [
      {
        id: 'hotel-att-1',
        reservationId: 'hotel-1',
        attachmentType: 'RECEIPT',
        fileName: 'confirmation-plateau.pdf',
        fileSize: 245_000,
        mimeType: 'application/pdf',
        storageKey: 'missions/mis-1/pending/mock-confirmation-plateau.pdf',
        uploadedAt: iso(daysFromNow(-1)),
      },
    ],
    createdAt: iso(daysFromNow(-3)),
    updatedAt: iso(daysFromNow(-1)),
  },
];

const missions: DgMission[] = [
  {
    id: 'mis-1',
    subject: 'Mission de représentation — sommet régional',
    missionType: 'Conférence',
    destination: formatMissionDestinations(['SN']),
    destinations: ['SN'],
    details: 'Sommet régional — coordination bilatérale.',
    departAt: iso(daysFromNow(5)),
    returnAt: iso(daysFromNow(8)),
    status: 'PLANNED',
    participants: 'DGA + conseiller technique',
    documentCount: 0,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-1)),
    updatedAt: iso(daysFromNow(-1)),
  },
  {
    id: 'mis-2',
    subject: 'Mission de travail — harmonisation réglementaire',
    missionType: 'Mission internationale',
    destination: formatMissionDestinations(['CI']),
    destinations: ['CI'],
    details: 'Coordination UEMOA et partenaires techniques.',
    departAt: iso(daysFromNow(8)),
    returnAt: iso(daysFromNow(11)),
    status: 'PLANNED',
    participants: 'DGA, 2 conseillers',
    documentCount: 3,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-6)),
    updatedAt: iso(daysFromNow(-2)),
  },
  {
    id: 'mis-3',
    subject: 'Audit qualité des opérateurs — tournée nationale',
    missionType: 'Inspection',
    destination: formatMissionDestinations(['GN']),
    destinations: ['GN'],
    details: 'Visites terrain et comités de suivi.',
    departAt: iso(daysFromNow(14)),
    returnAt: iso(daysFromNow(18)),
    status: 'ONGOING',
    participants: 'DGA, direction technique',
    documentCount: 2,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-10)),
    updatedAt: iso(daysFromNow(-3)),
  },
  {
    id: 'mis-4',
    subject: 'Forum annuel régulation numérique',
    missionType: 'Conférence',
    destination: formatMissionDestinations(['ET']),
    destinations: ['ET'],
    details: 'Addis-Abeba — panel régulateurs africains.',
    departAt: iso(daysFromNow(21)),
    returnAt: iso(daysFromNow(24)),
    status: 'PLANNED',
    participants: 'DGA',
    documentCount: 1,
    archived: false,
    archivedAt: null,
    createdAt: iso(daysFromNow(-4)),
    updatedAt: iso(daysFromNow(-4)),
  },
  {
    id: 'mis-archived-1',
    subject: 'Mission annulée — forum télécoms',
    missionType: 'Conférence',
    destination: formatMissionDestinations(['SN']),
    destinations: ['SN'],
    details: null,
    departAt: iso(daysFromNow(-20)),
    returnAt: iso(daysFromNow(-18)),
    status: 'CANCELLED',
    participants: 'DGA',
    documentCount: 0,
    archived: true,
    archivedAt: iso(daysFromNow(-5)),
    createdAt: iso(daysFromNow(-30)),
    updatedAt: iso(daysFromNow(-5)),
  },
  {
    id: 'mis-archived-2',
    subject: 'Mission reportée — salon innovation',
    missionType: 'Salon',
    destination: formatMissionDestinations(['MA']),
    destinations: ['MA'],
    details: 'Reportée pour contraintes agenda.',
    departAt: iso(daysFromNow(-12)),
    returnAt: iso(daysFromNow(-10)),
    status: 'CANCELLED',
    participants: 'DGA, attaché de presse',
    documentCount: 0,
    archived: true,
    archivedAt: iso(daysFromNow(-2)),
    createdAt: iso(daysFromNow(-25)),
    updatedAt: iso(daysFromNow(-2)),
  },
];

const missionDocuments: DgMissionDocument[] = [];

type MissionDocInput = {
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
};

function syncMockMissionDocuments(missionId: string, items: MissionDocInput[]) {
  const keepIds = new Set(items.filter((i) => i.id).map((i) => i.id!));
  for (let i = missionDocuments.length - 1; i >= 0; i--) {
    const doc = missionDocuments[i]!;
    if (
      doc.missionId === missionId &&
      doc.documentType !== 'REPORT' &&
      !keepIds.has(doc.id)
    ) {
      missionDocuments.splice(i, 1);
    }
  }
  for (const item of items) {
    if (item.id) continue;
    missionDocuments.push({
      id: id('mdoc'),
      missionId,
      documentType: 'GENERAL',
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      storageKey: item.storageKey,
      uploadedAt: iso(new Date()),
    });
  }
  const count = missionDocuments.filter((d) => d.missionId === missionId).length;
  const idx = missions.findIndex((m) => m.id === missionId);
  if (idx >= 0) missions[idx]!.documentCount = count;
}

export function mockListMissionDocuments(missionId: string) {
  return missionDocuments.filter((d) => d.missionId === missionId);
}

export function mockGetMissionDocument(docId: string) {
  const doc = missionDocuments.find((d) => d.id === docId);
  if (!doc) return null;
  return {
    id: doc.id,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    storageKey: doc.storageKey,
  };
}

const deadlines: ImportantDeadline[] = [
  {
    id: 'dl-1',
    title: 'Renouvellement licence opérateur B',
    kind: 'RENEWAL',
    status: 'DUE_SOON',
    dueAt: iso(daysFromNow(5)),
    ownerName: 'Service Juridique',
    description: 'Dossier complet requis 15 jours avant échéance.',
    alertDaysBefore: 15,
    createdAt: iso(daysFromNow(-30)),
  },
  {
    id: 'dl-2',
    title: 'Rapport annuel ARPT — transmission',
    kind: 'REPORT',
    status: 'UPCOMING',
    dueAt: iso(daysFromNow(28)),
    ownerName: 'Direction Générale Adjointe',
    description: null,
    alertDaysBefore: 7,
    createdAt: iso(daysFromNow(-60)),
  },
];

const documents: VaultDocument[] = DEMO_REPORT_RECORDS.map((row) =>
  demoReportToVaultDocument(row, daysFromNow)
);

export function mockListProjects() {
  syncProjectTaskCounts();
  return [...projects]
    .map(mapMockProject)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function mockGetProject(projectId: string) {
  const project = projects.find((p) => p.id === projectId);
  return project ? mapMockProject(project) : null;
}

export function mockCreateProject(
  input: Omit<DgProject, 'id' | 'createdAt' | 'updatedAt' | 'taskCount' | 'phases'> & {
    phases?: string[];
  },
  userId: string
) {
  const now = iso(new Date());
  const project: DgProject = {
    id: id('proj'),
    name: input.name.trim(),
    description: input.description,
    status: input.status,
    ownerName: input.ownerName,
    ownerUserId: input.ownerUserId,
    phases: input.phases ?? [],
    startAt: input.startAt,
    dueAt: input.dueAt,
    taskCount: 0,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
  };
  projects.unshift(project);
  mockWriteAuditJournal(userId, 'workspace.project.create', { target: project.id, resource: 'project' });
  return mapMockProject(project);
}

export function mockUpdateProject(projectId: string, patch: Partial<DgProject> & { phases?: string[] }, userId: string) {
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  const prev = projects[idx]!;
  const now = iso(new Date());
  projects[idx] = {
    ...prev,
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.phases !== undefined ? { phases: patch.phases } : {}),
    updatedAt: now,
  };
  if (patch.name && patch.name.trim() !== prev.name) {
    for (const task of tasks) {
      if (task.projectId === projectId) task.projectName = patch.name.trim();
    }
  }
  mockWriteAuditJournal(userId, 'workspace.project.update', { target: projectId, resource: 'project' });
  return mapMockProject(projects[idx]!);
}

export function mockDeleteProject(projectId: string, userId: string) {
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return false;
  for (const task of tasks) {
    if (task.projectId === projectId) {
      task.projectId = null;
    }
  }
  projects.splice(idx, 1);
  mockWriteAuditJournal(userId, 'workspace.project.delete', { target: projectId, resource: 'project' });
  return true;
}

export function mockAssignTasksToProject(
  projectId: string,
  taskIds: string[],
  projectPhase: string | null | undefined,
  userId: string
) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  const idSet = new Set(taskIds);
  for (const task of tasks) {
    if (idSet.has(task.id)) {
      task.projectId = project.id;
      task.projectName = project.name;
      if (projectPhase !== undefined) task.projectPhase = projectPhase;
      task.updatedAt = iso(new Date());
    }
  }
  mockWriteAuditJournal(userId, 'workspace.project.assign_tasks', { target: projectId, resource: 'project' });
  return mapMockProject(project);
}

export function mockListTasks(filters?: { status?: string; q?: string }) {
  let rows = [...tasks];
  if (filters?.status) rows = rows.filter((t) => t.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
}

export function mockGetTask(taskId: string) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return {
    task,
    comments: taskComments.filter((c) => c.taskId === taskId),
    history: taskHistory.filter((h) => h.taskId === taskId),
  };
}

export function mockCreateTask(
  input: Omit<DgTask, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: DgTask['status'] },
  userId: string,
  userName: string
) {
  const now = iso(new Date());
  const projectFields = resolveMockTaskProject({
    projectId: input.projectId,
    projectName: input.projectName,
  });
  const task: DgTask = {
    id: id('task'),
    status: input.status ?? 'PENDING',
    createdAt: now,
    updatedAt: now,
    ...input,
    ...projectFields,
    createdById: userId,
  };
  tasks.unshift(task);
  taskHistory.push({
    id: id('th'),
    taskId: task.id,
    userId,
    userName,
    action: 'task.create',
    detail: task.title,
    createdAt: now,
  });
  mockWriteAuditJournal(userId, 'workspace.task.create', { target: task.id, resource: 'task' });
  return task;
}

export function mockUpdateTask(
  taskId: string,
  patch: Partial<DgTask>,
  userId: string,
  userName: string
) {
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;
  const prev = tasks[idx]!;
  const now = iso(new Date());
  const projectFields =
    patch.projectId !== undefined || patch.projectName !== undefined
      ? resolveMockTaskProject({ projectId: patch.projectId, projectName: patch.projectName })
      : {};
  tasks[idx] = { ...prev, ...patch, ...projectFields, updatedAt: now };
  if (patch.status && patch.status !== prev.status) {
    taskHistory.push({
      id: id('th'),
      taskId,
      userId,
      userName,
      action: 'status.change',
      detail: `${prev.status} → ${patch.status}`,
      createdAt: now,
    });
  }
  mockWriteAuditJournal(userId, 'workspace.task.update', { target: taskId, resource: 'task' });
  return tasks[idx]!;
}

export function mockAddTaskComment(taskId: string, authorId: string, authorName: string, body: string) {
  const c: DgTaskComment = {
    id: id('tc'),
    taskId,
    authorId,
    authorName,
    body,
    createdAt: iso(new Date()),
  };
  taskComments.push(c);
  return c;
}

export function mockListDecisions(filters?: { status?: string; q?: string }) {
  let rows = [...decisions];
  if (filters?.status) rows = rows.filter((d) => d.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q)
    );
  }
  return rows;
}

export function mockCreateDecision(
  input: Omit<DgDecision, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  userId: string
) {
  const now = iso(new Date());
  const row: DgDecision = {
    id: id('dec'),
    status: 'NOT_STARTED',
    createdAt: now,
    updatedAt: now,
    ...input,
    createdById: userId,
  };
  decisions.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.decision.create', { target: row.id, resource: 'decision' });
  return row;
}

export function mockUpdateDecision(decisionId: string, patch: Partial<DgDecision>, userId: string) {
  const idx = decisions.findIndex((d) => d.id === decisionId);
  if (idx < 0) return null;
  decisions[idx] = { ...decisions[idx]!, ...patch, updatedAt: iso(new Date()) };
  mockWriteAuditJournal(userId, 'workspace.decision.update', { target: decisionId, resource: 'decision' });
  return decisions[idx]!;
}

export function mockGetMail(id: string) {
  return mail.find((m) => m.id === id) ?? null;
}

export function mockListMail(filters?: {
  direction?: string;
  mailKind?: string;
  q?: string;
  archived?: boolean;
}) {
  const archived = filters?.archived ?? false;
  let rows = mail.filter((m) => Boolean(m.archived) === archived);
  if (filters?.direction) rows = rows.filter((m) => m.direction === filters.direction);
  if (filters?.mailKind) rows = rows.filter((m) => (m.mailKind ?? 'DEPARTURE') === filters.mailKind);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q) ||
        m.counterpart.toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) =>
    archived
      ? (b.archivedAt ?? b.updatedAt).localeCompare(a.archivedAt ?? a.updatedAt)
      : b.mailDate.localeCompare(a.mailDate)
  );
}

export function mockCountMail(filters?: { direction?: string; mailKind?: string; year?: number }) {
  let rows = [...mail];
  if (filters?.direction) rows = rows.filter((m) => m.direction === filters.direction);
  if (filters?.mailKind) rows = rows.filter((m) => (m.mailKind ?? 'DEPARTURE') === filters.mailKind);
  if (filters?.year) {
    rows = rows.filter((m) => Number(String(m.mailDate).slice(0, 4)) === filters.year);
  }
  return {
    active: rows.filter((m) => !m.archived).length,
    trash: rows.filter((m) => m.archived).length,
  };
}

export function mockCreateMail(
  input: Omit<MailItem, 'id' | 'createdAt' | 'updatedAt' | 'workflowStatus' | 'attachments'> & {
    attachments?: DgMailAttachment[];
    hasAttachment?: boolean;
  },
  userId: string
) {
  const now = iso(new Date());
  const uploaded = input.attachments ?? [];
  const attachmentCount =
    input.hasAttachment === false
      ? 0
      : uploaded.length > 0
        ? uploaded.length
        : input.hasAttachment
          ? 1
          : input.attachmentCount ?? 0;

  const registrationNumber =
    input.direction === 'INCOMING'
      ? (() => {
          const year = Number(String(input.mailDate).slice(0, 4));
          const safeYear = Number.isFinite(year) && year >= 2000 ? year : new Date().getFullYear();
          const max = mail.reduce((acc, m) => {
            if (m.registrationNumber == null) return acc;
            const y = Number(String(m.mailDate).slice(0, 4));
            if (y !== safeYear) return acc;
            return Math.max(acc, m.registrationNumber);
          }, 0);
          return max + 1;
        })()
      : null;

  const priority = input.priority ?? 'NORMAL';
  // Tout courrier entrant doit porter un délai : sinon les alertes d'échéance seraient aveugles.
  const executionDeadline =
    input.direction === 'INCOMING'
      ? (input.executionDeadline ?? computeMailExecutionDeadline(input.mailDate, priority))
      : null;

  const row: MailItem = {
    ...input,
    id: id('mail'),
    mailKind: input.mailKind ?? (input.direction === 'OUTGOING' ? 'DEPARTURE' : 'DEPARTURE'),
    workflowStatus: input.direction === 'OUTGOING' ? 'SENT' : 'RECEIVED',
    attachmentCount,
    attachments: uploaded.map((a, index) => ({
      ...a,
      id: a.id ?? id('mail-att'),
      mailId: '',
      uploadedAt: a.uploadedAt ?? now,
    })),
    priority,
    registrationNumber,
    origin: input.origin ?? null,
    dgaInstruction: input.dgaInstruction ?? null,
    executor: input.executor ?? null,
    action: input.action ?? null,
    scSentAt: input.scSentAt ?? null,
    executionDeadline,
    followUp: input.followUp ?? null,
    courierName: input.courierName ?? null,
    assignedService: input.assignedService ?? null,
    assignedAt: null,
    archived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  row.attachments = row.attachments.map((a) => ({ ...a, mailId: row.id }));
  mail.unshift(row);
  mockPushMailWorkflowEvent(row.id, row.workflowStatus);
  mockWriteAuditJournal(userId, 'workspace.mail.create', { target: row.id, resource: 'mail' });
  return row;
}

function withLiveContactCounts(contact: StrategicContact): StrategicContact {
  const stats = computeContactAppointmentStats(mockListAppointmentsByContact(contact.id));
  return {
    ...contact,
    appointmentCount: stats.total,
    visitCount: stats.visits,
  };
}

export function mockListContacts(filters?: { category?: string; q?: string; archived?: boolean }) {
  const archived = filters?.archived ?? false;
  let rows = contacts
    .filter((c) => (c.archived ?? false) === archived)
    .map(withLiveContactCounts);
  if (filters?.category) rows = rows.filter((c) => c.category === filters.category);
  if (filters?.q) {
    rows = rows.filter((c) => contactMatchesSearchQuery(c, filters.q!));
  }
  return rows;
}

export function mockCreateContact(input: Omit<StrategicContact, 'id' | 'createdAt' | 'updatedAt' | 'interactionCount' | 'appointmentCount'>, userId: string) {
  const now = iso(new Date());
  const row: StrategicContact = {
    id: id('ct'),
    interactionCount: 0,
    appointmentCount: 0,
    visitCount: 0,
    archived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  contacts.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.contact.create', { target: row.id, resource: 'contact' });
  return row;
}

export function mockListAudiences(filters?: { q?: string; archived?: boolean }) {
  let rows = [...audiences];
  if (filters?.archived !== undefined) rows = rows.filter((a) => a.archived === filters.archived);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((a) => a.subject.toLowerCase().includes(q));
  }
  return rows.sort((a, b) => b.heldAt.localeCompare(a.heldAt));
}

export function mockCreateAudience(input: Omit<AudienceRecord, 'id' | 'createdAt' | 'archived'>, userId: string) {
  const row: AudienceRecord = {
    id: id('aud'),
    archived: false,
    createdAt: iso(new Date()),
    ...input,
  };
  audiences.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.audience.create', { target: row.id, resource: 'audience' });
  return row;
}

export function mockListInvitations() {
  return [...invitations].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export function mockUpdateInvitation(id: string, patch: Partial<OfficialInvitation>, userId: string) {
  const idx = invitations.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  invitations[idx] = { ...invitations[idx]!, ...patch, updatedAt: iso(new Date()) };
  mockWriteAuditJournal(userId, 'workspace.invitation.update', { target: id, resource: 'invitation' });
  return invitations[idx]!;
}

export function mockCreateInvitation(
  input: Omit<OfficialInvitation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'delegateName'>,
  userId: string
) {
  const now = iso(new Date());
  const row: OfficialInvitation = {
    id: id('inv'),
    status: 'RECEIVED',
    delegateName: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  invitations.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.invitation.create', { target: row.id, resource: 'invitation' });
  return row;
}

function hydrateMission(m: DgMission): DgMission {
  const destinations = Array.isArray(m.destinations) && m.destinations.length > 0
    ? m.destinations
    : parseLegacyDestination(m.destination);
  return {
    ...m,
    destinations,
    details: m.details ?? null,
    observations: m.observations ?? null,
    cancelReason: m.cancelReason ?? null,
    cancelReasonDetail: m.cancelReasonDetail ?? null,
    closureReport: m.closureReport ?? null,
    closureResults: m.closureResults ?? null,
    closureRecommendations: m.closureRecommendations ?? null,
    closureComments: m.closureComments ?? null,
    completedAt: m.completedAt ?? null,
    statusChangedAt: m.statusChangedAt ?? null,
    initialReturnAt: m.initialReturnAt ?? m.returnAt,
    operationalState: m.operationalState ?? 'NORMAL',
    prolongationCount: m.prolongationCount ?? 0,
  };
}

export function mockRunAutoMissionStatusTransitions(): { plannedToOngoing: number; ongoingToCompleted: number } {
  const now = new Date();
  let plannedToOngoing = 0;
  let ongoingToCompleted = 0;

  for (const mission of missions) {
    if (mission.archived) continue;
    const next = computeAutoStatus(mission, now);
    if (!next || next === mission.status) continue;

    mission.status = next;
    mission.statusChangedAt =
      next === 'COMPLETED'
        ? iso(missionAutoCloseAt(mission.returnAt))
        : next === 'ONGOING'
          ? iso(missionAutoStartAt(mission.departAt))
          : iso(now);
    if (next === 'COMPLETED') {
      mission.completedAt = iso(missionAutoCloseAt(mission.returnAt));
      ongoingToCompleted++;
    }
    if (next === 'ONGOING') plannedToOngoing++;
  }

  return { plannedToOngoing, ongoingToCompleted };
}

function withMissionHotelStatus(mission: DgMission): DgMission {
  const statuses = hotelReservations
    .filter((r) => r.missionId === mission.id)
    .map((r) => r.status);
  return { ...mission, hotelStatus: resolveMissionHotelStatus(statuses) };
}

export function mockListMissions(filters?: { archived?: boolean }) {
  const archived = filters?.archived ?? false;
  return uniqById([...missions])
    .filter((m) => (m.archived ?? false) === archived)
    .map((m) => withMissionHotelStatus(hydrateMission(m)))
    .sort((a, b) => {
      const aKey = archived ? a.archivedAt ?? a.createdAt : a.createdAt;
      const bKey = archived ? b.archivedAt ?? b.createdAt : b.createdAt;
      return bKey.localeCompare(aKey);
    });
}

export function mockGetMission(id: string): DgMission | null {
  const mission = missions.find((m) => m.id === id);
  return mission ? withMissionHotelStatus(hydrateMission(mission)) : null;
}

export function mockCountMissions() {
  const active = missions.filter((m) => !m.archived).length;
  const trash = missions.filter((m) => m.archived).length;
  return { active, trash };
}

export function mockCreateMission(
  input: MissionWriteInput,
  userId: string,
  documents: MissionDocInput[] = []
) {
  const now = iso(new Date());
  const data = normalizeMissionWrite(input);
  const row: DgMission = {
    id: id('mis'),
    status: 'PLANNED',
    documentCount: documents.length,
    archived: false,
    archivedAt: null,
    observations: null,
    cancelReason: null,
    cancelReasonDetail: null,
    closureReport: null,
    closureResults: null,
    closureRecommendations: null,
    closureComments: null,
    completedAt: null,
    statusChangedAt: now,
    details: data.details,
    destinations: data.destinations,
    destination: data.destination,
    subject: data.subject,
    missionType: data.missionType,
    departAt: data.departAt,
    returnAt: data.returnAt,
    initialReturnAt: data.returnAt,
    operationalState: 'NORMAL',
    prolongationCount: 0,
    participants: data.participants,
    createdAt: now,
    updatedAt: now,
  };
  missions.unshift(row);
  if (documents.length > 0) syncMockMissionDocuments(row.id, documents);
  mockWriteAuditJournal(userId, 'workspace.mission.create', { target: row.id, resource: 'mission' });
  return missions.find((m) => m.id === row.id) ?? row;
}

export function mockImportMissions(
  rows: MissionImportRow[],
  actorId: string
): { created: number; skipped: number; errors: { line: number; message: string }[] } {
  const errors: { line: number; message: string }[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const duplicate = missions.find(
      (m) =>
        !m.archived &&
        m.status !== 'CANCELLED' &&
        m.status !== 'COMPLETED' &&
        m.subject.trim().toLowerCase() === row.subject.trim().toLowerCase()
    );
    if (duplicate) {
      errors.push({
        line: row.line,
        message: `Mission déjà active avec le même objet : « ${row.subject} ».`,
      });
      skipped += 1;
      continue;
    }

    const departAt = new Date(`${row.departAt}T00:00:00`).toISOString();
    const returnAt = new Date(`${row.returnAt}T23:59:59`).toISOString();
    const now = iso(new Date());

    const mission: DgMission = {
      id: id('mis'),
      subject: row.subject,
      missionType: row.missionType || DEFAULT_MISSION_TYPE,
      destination: formatMissionDestinations(row.destinations),
      destinations: row.destinations,
      details: buildImportedMissionDetails(row.details),
      departAt,
      returnAt,
      initialReturnAt: returnAt,
      operationalState: 'NORMAL',
      prolongationCount: 0,
      participants: row.participants,
      status: row.status,
      documentCount: 0,
      archived: false,
      archivedAt: null,
      observations: null,
      cancelReason: row.status === 'CANCELLED' ? 'Import historique' : null,
      cancelReasonDetail: null,
      closureReport: null,
      closureResults: null,
      closureRecommendations: null,
      closureComments: null,
      completedAt: row.status === 'COMPLETED' ? returnAt : null,
      statusChangedAt: row.status === 'PLANNED' ? now : returnAt,
      createdAt: now,
      updatedAt: now,
    };
    missions.unshift(mission);
    created += 1;
  }

  if (created > 0) {
    mockWriteAuditJournal(actorId, 'workspace.mission.import', { created, skipped });
  }

  return { created, skipped, errors };
}

export function mockListDeadlines() {
  return [...deadlines].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function mockCreateDeadline(input: Omit<ImportantDeadline, 'id' | 'createdAt' | 'status'>, userId: string) {
  const row: ImportantDeadline = {
    id: id('dl'),
    status: 'UPCOMING',
    createdAt: iso(new Date()),
    ...input,
  };
  deadlines.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.deadline.create', { target: row.id, resource: 'deadline' });
  return row;
}

export function mockListDocuments(filters?: { category?: string; q?: string; archived?: boolean }) {
  const archived = filters?.archived ?? false;
  let rows = documents.filter((d) => d.category === 'REPORT' && d.archived === archived);
  if (filters?.category) rows = rows.filter((d) => d.category === filters.category);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((d) => {
      const haystack = `${d.title} ${d.fileName} ${stripReportHtml(d.bodyHtml ?? '')}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  return rows;
}

export function mockCountDocuments() {
  const active = documents.filter((d) => d.category === 'REPORT' && !d.archived).length;
  const trash = documents.filter((d) => d.category === 'REPORT' && d.archived).length;
  return { active, trash };
}

export function mockEmptyDocumentsTrash(userId: string) {
  const trash = documents.filter((d) => d.category === 'REPORT' && d.archived);
  if (trash.length === 0) return { purged: 0 };
  for (let i = documents.length - 1; i >= 0; i--) {
    if (documents[i]!.category === 'REPORT' && documents[i]!.archived) {
      documents.splice(i, 1);
    }
  }
  mockWriteAuditJournal(userId, 'workspace.documents.trash.empty', {
    target: undefined,
    resource: 'document',
  });
  return { purged: trash.length };
}

export function mockCreateDocument(
  input: Omit<VaultDocument, 'id' | 'uploadedAt' | 'version' | 'category' | 'tags' | 'restricted'>,
  userId: string
) {
  const duplicate = findReportTitleConflict(
    documents.filter((row) => row.category === 'REPORT' && !row.archived),
    { title: input.title }
  );
  if (duplicate) throw new ReportDuplicateError();

  const row: VaultDocument = {
    id: id('doc'),
    version: 1,
    category: 'REPORT',
    tags: [],
    restricted: false,
    archived: false,
    archivedAt: null,
    uploadedAt: iso(new Date()),
    uploadedById: userId,
    ...input,
    storageKey: input.storageKey || `reports/pending/${input.fileName}`,
    bodyHtml: input.bodyHtml ?? null,
  };
  documents.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.document.create', { target: row.id, resource: 'document' });
  return row;
}

function removeById<T extends { id: string }>(arr: T[], itemId: string) {
  const idx = arr.findIndex((x) => x.id === itemId);
  if (idx < 0) return false;
  arr.splice(idx, 1);
  return true;
}

export function mockDeleteTask(taskId: string, userId: string) {
  if (!removeById(tasks, taskId)) return false;
  for (let i = taskComments.length - 1; i >= 0; i--) {
    if (taskComments[i]!.taskId === taskId) taskComments.splice(i, 1);
  }
  for (let i = taskHistory.length - 1; i >= 0; i--) {
    if (taskHistory[i]!.taskId === taskId) taskHistory.splice(i, 1);
  }
  mockWriteAuditJournal(userId, 'workspace.task.delete', { target: taskId, resource: 'task' });
  return true;
}

export function mockDeleteDecision(decisionId: string, userId: string) {
  if (!removeById(decisions, decisionId)) return false;
  mockWriteAuditJournal(userId, 'workspace.decision.delete', { target: decisionId, resource: 'decision' });
  return true;
}

export function mockUpdateMail(
  mailId: string,
  patch: Partial<MailItem> & {
    attachments?: Array<Omit<DgMailAttachment, 'id' | 'mailId' | 'uploadedAt'> & { id?: string }>;
    hasAttachment?: boolean;
  },
  userId: string
) {
  const idx = mail.findIndex((m) => m.id === mailId);
  if (idx < 0) return null;

  const prev = mail[idx]!;
  let attachmentCount = patch.attachmentCount;
  let attachments = prev.attachments;

  if (patch.hasAttachment === false) {
    attachmentCount = 0;
    attachments = [];
  } else if (patch.hasAttachment !== undefined || patch.attachments !== undefined) {
    const hasAttachment = patch.hasAttachment ?? (patch.attachments?.length ?? 0) > 0;
    if (!hasAttachment) {
      attachmentCount = 0;
      attachments = [];
    } else if (patch.attachments !== undefined) {
      const now = iso(new Date());
      attachments = patch.attachments.map((a) => ({
        id: a.id ?? id('mail-att'),
        mailId,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        storageKey: a.storageKey,
        uploadedAt: now,
      }));
      attachmentCount = attachments.length > 0 ? attachments.length : 1;
    } else {
      attachmentCount = 1;
    }
  }

  mail[idx] = {
    ...prev,
    ...patch,
    registrationNumber: prev.registrationNumber,
    assignedAt:
      patch.workflowStatus === 'ASSIGNED'
        ? patch.assignedAt ?? iso(new Date())
        : patch.assignedAt !== undefined
          ? patch.assignedAt
          : prev.assignedAt,
    archived: patch.archived !== undefined ? patch.archived : prev.archived,
    archivedAt:
      patch.archived !== undefined
        ? patch.archived
          ? iso(new Date())
          : null
        : prev.archivedAt,
    attachmentCount: attachmentCount ?? prev.attachmentCount,
    attachments,
    updatedAt: iso(new Date()),
  };
  if (patch.workflowStatus && patch.workflowStatus !== prev.workflowStatus) {
    mockPushMailWorkflowEvent(mailId, patch.workflowStatus, prev.workflowStatus);
  }
  mockWriteAuditJournal(userId, 'workspace.mail.update', { target: mailId, resource: 'mail' });
  return mail[idx]!;
}

export function mockGetMailAttachment(attachmentId: string) {
  for (const item of mail) {
    const found = item.attachments.find((a) => a.id === attachmentId);
    if (found) return found;
  }
  return null;
}

export function mockDeleteMail(mailId: string, userId: string) {
  const item = mail.find((m) => m.id === mailId);
  if (!item?.archived) return false;
  if (!removeById(mail, mailId)) return false;
  mockWriteAuditJournal(userId, 'workspace.mail.delete', { target: mailId, resource: 'mail' });
  return true;
}

export function mockEmptyMailTrash(
  userId: string,
  filters?: { direction?: string; mailKind?: string; year?: number }
) {
  let trash = mail.filter((m) => m.archived);
  if (filters?.direction) trash = trash.filter((m) => m.direction === filters.direction);
  if (filters?.mailKind) trash = trash.filter((m) => (m.mailKind ?? 'DEPARTURE') === filters.mailKind);
  if (filters?.year) {
    trash = trash.filter((m) => Number(String(m.mailDate).slice(0, 4)) === filters.year);
  }
  if (trash.length === 0) return { purged: 0 };
  for (const item of trash) {
    const idx = mail.findIndex((x) => x.id === item.id);
    if (idx >= 0) mail.splice(idx, 1);
  }
  mockWriteAuditJournal(userId, 'workspace.mail.trash.empty', { resource: 'mail' });
  return { purged: trash.length };
}

export function mockIncrementContactAppointmentCount(contactId: string, userId: string) {
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) return false;
  contact.interactionCount += 1;
  const stats = computeContactAppointmentStats(mockListAppointmentsByContact(contactId));
  contact.appointmentCount = stats.total;
  contact.visitCount = stats.visits;
  contact.updatedAt = iso(new Date());
  mockWriteAuditJournal(userId, 'workspace.contact.appointment', { target: contactId, resource: 'contact' });
  return true;
}

export function mockUpdateContact(contactId: string, patch: Partial<StrategicContact>, userId: string) {
  const idx = contacts.findIndex((c) => c.id === contactId);
  if (idx < 0) return null;
  const prev = contacts[idx]!;
  const nextArchived = patch.archived !== undefined ? patch.archived : prev.archived;
  contacts[idx] = {
    ...prev,
    ...patch,
    archived: nextArchived,
    archivedAt:
      patch.archived === true
        ? iso(new Date())
        : patch.archived === false
          ? null
          : prev.archivedAt,
    updatedAt: iso(new Date()),
  };
  mockWriteAuditJournal(userId, 'workspace.contact.update', { target: contactId, resource: 'contact' });
  return contacts[idx]!;
}

export function mockCountContacts() {
  const active = contacts.filter((c) => !c.archived).length;
  const trash = contacts.filter((c) => c.archived).length;
  return { active, trash };
}

export function mockDeleteContact(contactId: string, userId: string) {
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact?.archived) return false;
  if (!removeById(contacts, contactId)) return false;
  mockWriteAuditJournal(userId, 'workspace.contact.delete', { target: contactId, resource: 'contact' });
  return true;
}

export function mockEmptyContactsTrash(userId: string) {
  const trash = contacts.filter((c) => c.archived);
  if (trash.length === 0) return { purged: 0 };
  for (const c of trash) {
    const idx = contacts.findIndex((x) => x.id === c.id);
    if (idx >= 0) contacts.splice(idx, 1);
  }
  mockWriteAuditJournal(userId, 'workspace.contacts.trash.empty', { resource: 'contact' });
  return { purged: trash.length };
}

export function mockUpdateAudience(audienceId: string, patch: Partial<AudienceRecord>, userId: string) {
  const idx = audiences.findIndex((a) => a.id === audienceId);
  if (idx < 0) return null;
  audiences[idx] = { ...audiences[idx]!, ...patch };
  mockWriteAuditJournal(userId, 'workspace.audience.update', { target: audienceId, resource: 'audience' });
  return audiences[idx]!;
}

export function mockDeleteAudience(audienceId: string, userId: string) {
  if (!removeById(audiences, audienceId)) return false;
  mockWriteAuditJournal(userId, 'workspace.audience.delete', { target: audienceId, resource: 'audience' });
  return true;
}

export function mockDeleteInvitation(invitationId: string, userId: string) {
  if (!removeById(invitations, invitationId)) return false;
  mockWriteAuditJournal(userId, 'workspace.invitation.delete', { target: invitationId, resource: 'invitation' });
  return true;
}

export function mockUpdateMission(
  missionId: string,
  patch: Partial<DgMission> & { destinations?: string[]; documents?: MissionDocInput[] },
  userId: string
) {
  const idx = missions.findIndex((m) => m.id === missionId);
  if (idx < 0) return null;
  const prev = missions[idx]!;
  let next: DgMission = { ...prev, ...patch, updatedAt: iso(new Date()) };
  if (patch.archived !== undefined) {
    next.archived = patch.archived;
    next.archivedAt = patch.archived ? iso(new Date()) : null;
  }
  if (patch.destinations !== undefined) {
    const data = normalizeMissionWrite({
      subject: patch.subject ?? prev.subject,
      missionType: patch.missionType ?? prev.missionType,
      destinations: patch.destinations,
      details: patch.details !== undefined ? patch.details : prev.details,
      departAt: patch.departAt ?? prev.departAt,
      returnAt: patch.returnAt ?? prev.returnAt,
      participants: patch.participants ?? prev.participants,
    });
    next = {
      ...next,
      missionType: data.missionType,
      destinations: data.destinations,
      destination: data.destination,
      details: data.details,
    };
  }
  const autoStatus = computeAutoStatusAfterDatePatch(prev, {
    departAt: patch.departAt,
    returnAt: patch.returnAt,
  });
  if (autoStatus && autoStatus !== prev.status) {
    next = {
      ...next,
      status: autoStatus,
      statusChangedAt: iso(new Date()),
    };
  }
  missions[idx] = next;
  if (patch.documents !== undefined) {
    syncMockMissionDocuments(missionId, patch.documents);
  }
  mockWriteAuditJournal(userId, 'workspace.mission.update', { target: missionId, resource: 'mission' });
  return missions[idx]!;
}

export function mockExtendMission(
  missionId: string,
  input: MissionExtendInput,
  userId: string
): { ok: true; mission: DgMission } | { ok: false; error: string } {
  const idx = missions.findIndex((m) => m.id === missionId);
  if (idx < 0) return { ok: false, error: 'NOT_FOUND' };
  const prev = hydrateMission(missions[idx]!);
  const validationError = validateMissionExtend(prev, input);
  if (validationError) return { ok: false, error: validationError };

  const newReturnIso = new Date(input.returnAt).toISOString();
  const isProlongation = new Date(newReturnIso).getTime() > new Date(prev.returnAt).getTime();
  const operationalState = resolveOperationalStateAfterReturnChange(
    prev.initialReturnAt,
    newReturnIso,
    prev.returnAt
  );

  missions[idx] = {
    ...prev,
    returnAt: newReturnIso,
    operationalState,
    prolongationCount: isProlongation ? prev.prolongationCount + 1 : prev.prolongationCount,
    status: 'ONGOING',
    completedAt: null,
    updatedAt: iso(new Date()),
  };
  mockWriteAuditJournal(userId, 'workspace.mission.extend', { target: missionId, resource: 'mission' });
  return { ok: true, mission: hydrateMission(missions[idx]!) };
}

export function mockDeleteMission(missionId: string, userId: string) {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission?.archived) return false;
  if (!removeById(missions, missionId)) return false;
  for (let i = hotelReservations.length - 1; i >= 0; i--) {
    if (hotelReservations[i]!.missionId === missionId) hotelReservations.splice(i, 1);
  }
  mockWriteAuditJournal(userId, 'workspace.mission.delete', { target: missionId, resource: 'mission' });
  return true;
}

export function mockEmptyMissionsTrash(userId: string) {
  const trash = missions.filter((m) => m.archived);
  if (trash.length === 0) return { purged: 0 };
  for (const m of trash) {
    const idx = missions.findIndex((x) => x.id === m.id);
    if (idx >= 0) missions.splice(idx, 1);
  }
  for (let i = hotelReservations.length - 1; i >= 0; i--) {
    if (!missions.some((m) => m.id === hotelReservations[i]!.missionId)) {
      hotelReservations.splice(i, 1);
    }
  }
  mockWriteAuditJournal(userId, 'workspace.missions.trash.empty', { resource: 'mission' });
  return { purged: trash.length };
}

function missionSubject(missionId: string) {
  return missions.find((m) => m.id === missionId)?.subject ?? 'Mission';
}

export function mockListHotelReservations(filters?: { missionId?: string; q?: string }) {
  let rows = [...hotelReservations].map((r) => ({
    ...r,
    missionSubject: missionSubject(r.missionId),
  }));
  if (filters?.missionId) rows = rows.filter((r) => r.missionId === filters.missionId);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.hotel.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.missionSubject.toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
}

export function mockCreateHotelReservation(
  input: {
    missionId: string;
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
    status?: DgMissionHotelReservation['status'];
    attachments?: {
      attachmentType: HotelReservationAttachmentType;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageKey: string;
    }[];
  },
  userId: string
) {
  const now = iso(new Date());
  const reservationId = id('hotel');
  const attachments: DgMissionHotelReservationAttachment[] = (input.attachments ?? []).map((a) => ({
    id: id('hotel-att'),
    reservationId,
    attachmentType: a.attachmentType,
    fileName: a.fileName,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    storageKey: a.storageKey,
    uploadedAt: now,
  }));
  const row: DgMissionHotelReservation = {
    id: reservationId,
    missionId: input.missionId,
    missionSubject: missionSubject(input.missionId),
    hotel: input.hotel,
    address: input.address ?? null,
    city: input.city,
    country: input.country,
    contact: input.contact ?? null,
    roomCount: input.roomCount,
    roomType: input.roomType ?? null,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    cost: input.cost ?? null,
    currency: input.currency,
    status: input.status ?? 'BOOKED',
    attachments,
    createdAt: now,
    updatedAt: now,
  };
  hotelReservations.unshift(row);
  mockWriteAuditJournal(userId, 'workspace.hotel-reservation.create', {
    target: row.id,
    resource: 'hotel-reservation',
  });
  return row;
}

export function mockUpdateHotelReservation(
  reservationId: string,
  patch: Partial<DgMissionHotelReservation> & {
    attachments?: {
      attachmentType: HotelReservationAttachmentType;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageKey: string;
    }[];
  },
  userId: string
) {
  const idx = hotelReservations.findIndex((r) => r.id === reservationId);
  if (idx < 0) return null;
  const prev = hotelReservations[idx]!;
  const now = iso(new Date());
  let attachments = prev.attachments;
  if (patch.attachments !== undefined) {
    attachments = patch.attachments.map((a) => ({
      id: id('hotel-att'),
      reservationId,
      attachmentType: a.attachmentType as HotelReservationAttachmentType,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
      uploadedAt: now,
    }));
  }
  const next: DgMissionHotelReservation = {
    ...prev,
    ...patch,
    missionSubject: patch.missionId
      ? missionSubject(patch.missionId)
      : prev.missionSubject,
    attachments,
    updatedAt: now,
  };
  hotelReservations[idx] = next;
  mockWriteAuditJournal(userId, 'workspace.hotel-reservation.update', {
    target: reservationId,
    resource: 'hotel-reservation',
  });
  return next;
}

export function mockGetHotelAttachment(attachmentId: string) {
  for (const reservation of hotelReservations) {
    const attachment = reservation.attachments.find((a) => a.id === attachmentId);
    if (attachment) {
      return {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        storageKey: attachment.storageKey,
      };
    }
  }
  return null;
}

export function mockDeleteHotelReservation(reservationId: string, userId: string) {
  if (!removeById(hotelReservations, reservationId)) return false;
  mockWriteAuditJournal(userId, 'workspace.hotel-reservation.delete', {
    target: reservationId,
    resource: 'hotel-reservation',
  });
  return true;
}

export function mockUpdateDeadline(deadlineId: string, patch: Partial<ImportantDeadline>, userId: string) {
  const idx = deadlines.findIndex((d) => d.id === deadlineId);
  if (idx < 0) return null;
  deadlines[idx] = { ...deadlines[idx]!, ...patch };
  mockWriteAuditJournal(userId, 'workspace.deadline.update', { target: deadlineId, resource: 'deadline' });
  return deadlines[idx]!;
}

export function mockDeleteDeadline(deadlineId: string, userId: string) {
  if (!removeById(deadlines, deadlineId)) return false;
  mockWriteAuditJournal(userId, 'workspace.deadline.delete', { target: deadlineId, resource: 'deadline' });
  return true;
}

export function mockUpdateDocument(documentId: string, patch: Partial<VaultDocument>, userId: string) {
  const idx = documents.findIndex((d) => d.id === documentId);
  if (idx < 0) return null;
  const current = documents[idx]!;
  const nextTitle = patch.title ?? current.title;
  const duplicate = findReportTitleConflict(
    documents.filter((row) => row.category === 'REPORT' && !row.archived),
    { title: nextTitle },
    documentId
  );
  if (duplicate) throw new ReportDuplicateError();

  const archived =
    patch.archived !== undefined ? patch.archived : current.archived;
  documents[idx] = {
    ...current,
    ...patch,
    archived,
    archivedAt:
      patch.archived === true
        ? iso(new Date())
        : patch.archived === false
          ? null
          : current.archivedAt,
  };
  mockWriteAuditJournal(
    userId,
    patch.archived === true
      ? 'workspace.document.archive'
      : patch.archived === false
        ? 'workspace.document.restore'
        : 'workspace.document.update',
    { target: documentId, resource: 'document' }
  );
  return documents[idx]!;
}

export function mockDeleteDocument(documentId: string, userId: string) {
  const idx = documents.findIndex((d) => d.id === documentId);
  if (idx < 0 || !documents[idx]!.archived) return false;
  documents.splice(idx, 1);
  mockWriteAuditJournal(userId, 'workspace.document.delete', { target: documentId, resource: 'document' });
  return true;
}

export function mockBuildWorkspaceDashboard(stats: {
  appointmentsToday: number;
  pendingAppointments: number;
  todayAppointments: { id: string; title: string; startAt: string }[];
}): WorkspaceDashboard {
  const from = iso(daysFromNow(-30));
  const to = iso(daysFromNow(30));
  const urgentTasks = tasks.filter(
    (t) => t.priority === 'HIGH' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
  );
  const overdueDecisions = decisions.filter((d) => d.status === 'OVERDUE');
  const mailPending = mail.filter(
    (m) =>
      !m.archived &&
      m.direction === 'INCOMING' &&
      (m.workflowStatus === 'RECEIVED' || m.workflowStatus === 'ASSIGNED')
  );
  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING' || i.status === 'RECEIVED');
  const activeMissions = missions.filter((m) => !m.archived).map(hydrateMission);
  const upcomingMissions = activeMissions.filter(
    (m) => m.status === 'PLANNED' || m.status === 'ONGOING'
  );
  const ongoingMissions = activeMissions.filter((m) => m.status === 'ONGOING');
  const deadlinesSoon = deadlines.filter((d) => d.status === 'DUE_SOON' || d.status === 'OVERDUE');
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

  const countByStatus = <T extends string>(items: { status: T }[]) => {
    const map = new Map<T, number>();
    for (const i of items) map.set(i.status, (map.get(i.status) ?? 0) + 1);
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  };

  const countMailByWorkflow = () => {
    const map = new Map<string, number>();
    for (const m of mail) {
      if (m.archived) continue;
      map.set(m.workflowStatus, (map.get(m.workflowStatus) ?? 0) + 1);
    }
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  };

  return {
    period: { from, to },
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
      tasksByStatus: countByStatus(tasks) as WorkspaceDashboard['charts']['tasksByStatus'],
      decisionsByStatus: countByStatus(decisions) as WorkspaceDashboard['charts']['decisionsByStatus'],
      mailByStatus: countMailByWorkflow() as WorkspaceDashboard['charts']['mailByStatus'],
      missionsByStatus: countByStatus(activeMissions) as WorkspaceDashboard['charts']['missionsByStatus'],
      missionsByType: [...new Map(activeMissions.map((m) => [m.missionType, 0])).keys()].map((type) => ({
        type,
        count: activeMissions.filter((m) => m.missionType === type).length,
      })),
      missionsByDestination: [],
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
        .slice(0, 5),
      attentionMissions: activeMissions.filter((m) => m.status !== 'CANCELLED').slice(0, 8),
      prolongedMissions: activeMissions
        .filter((m) => m.operationalState === 'PROLONGED' || (m.prolongationCount ?? 0) > 0)
        .slice(0, 5),
    },
    missionAlerts: {
      hasDepartToday: false,
      hasReturnToday: false,
      departTodaySubjects: [],
      returnTodaySubjects: [],
    },
  };
}
