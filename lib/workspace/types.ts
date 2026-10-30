/** Types métier — espace de travail assistante DG (ARPT) */

export type WorkspacePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type DgTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED';

export type DgProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type DgDecisionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CLOSED';

export type MailDirection = 'INCOMING' | 'OUTGOING';

/** Registre métier : départ (dispatch) vs coffre-fort (enregistrement). */
export type MailKind = 'DEPARTURE' | 'VAULT';

export type MailPriority = 'URGENT' | 'NORMAL';

export type MailViewMode = 'dga' | 'depart' | 'suivi';

export type MailWorkflowStatus =
  | 'RECEIVED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PROCESSED'
  | 'ARCHIVED'
  | 'SENT';

export type ContactCategory =
  | 'MINISTRY'
  | 'INSTITUTION'
  | 'PARTNER'
  | 'SUPPLIER'
  | 'EMBASSY'
  | 'INTERNATIONAL_ORG'
  | 'OTHER';

export type InvitationStatus = 'RECEIVED' | 'ACCEPTED' | 'REFUSED' | 'DELEGATED' | 'PENDING';

export type MissionStatus = 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export type MissionOperationalState = 'NORMAL' | 'PROLONGED' | 'SHORTENED' | 'CLOSED';

export type HotelReservationStatus =
  | 'TO_BOOK'
  | 'BOOKING_IN_PROGRESS'
  | 'BOOKED'
  | 'CONFIRMED'
  | 'CANCELLED';

export type HotelReservationAttachmentType = 'RECEIPT' | 'OTHER';

export type DeadlineKind = 'CONTRACT' | 'RENEWAL' | 'REPORT' | 'AUDIT' | 'PERIODIC_MEETING' | 'OTHER';

export type DeadlineStatus = 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';

export type DocumentCategory = 'CONTRACT' | 'MAIL' | 'DECISION' | 'REPORT' | 'MINUTES' | 'OTHER';

export type DgProject = {
  id: string;
  name: string;
  description: string | null;
  status: DgProjectStatus;
  ownerName: string;
  ownerUserId: string | null;
  phases: string[];
  startAt: string | null;
  dueAt: string | null;
  taskCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceAssigneeOption = {
  id: string;
  label: string;
  kind: 'user' | 'service';
  department?: string | null;
};

export type DgTask = {
  id: string;
  title: string;
  description: string | null;
  status: DgTaskStatus;
  priority: WorkspacePriority;
  projectId: string | null;
  projectName: string | null;
  projectPhase: string | null;
  assigneeName: string;
  assigneeUserId: string | null;
  startAt: string | null;
  dueAt: string | null;
  estimatedHours: number | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type DgTaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type DgTaskAttachment = {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
};

export type DgTaskHistoryEntry = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type DgDecision = {
  id: string;
  title: string;
  context: string | null;
  decisionText: string;
  status: DgDecisionStatus;
  priority: WorkspacePriority;
  ownerName: string;
  ownerUserId: string | null;
  appointmentId: string | null;
  dueAt: string | null;
  meetingDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type MailItem = {
  id: string;
  direction: MailDirection;
  /** DEPARTURE = Courriers départ · VAULT = Coffre-fort / enregistrement. */
  mailKind: MailKind;
  registrationNumber: number | null;
  reference: string;
  counterpart: string;
  subject: string;
  mailDate: string;
  priority: MailPriority;
  workflowStatus: MailWorkflowStatus;
  origin: string | null;
  dgaInstruction: string | null;
  executor: string | null;
  action: string | null;
  scSentAt: string | null;
  executionDeadline: string | null;
  followUp: string | null;
  courierName: string | null;
  assignedService: string | null;
  /** Date d'affectation au service / exécutant. */
  assignedAt: string | null;
  attachmentCount: number;
  attachments: DgMailAttachment[];
  notes: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailStatusTraceEntry = {
  status: MailWorkflowStatus;
  at: string;
  inferred: boolean;
};

export type DgMailAttachment = {
  id: string;
  mailId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: string;
};

export type StrategicContact = {
  id: string;
  category: ContactCategory;
  fullName: string;
  jobTitle: string | null;
  organization: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  interactionCount: number;
  /** Nombre total de rendez-vous liés au contact (hors archivés). */
  appointmentCount: number;
  /** Nombre de visites réalisées (RDV confirmés passés). */
  visitCount: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactAppointment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  location: string | null;
  visited?: boolean;
  upcoming?: boolean;
};

export type ContactAppointmentStats = {
  visits: number;
  upcoming: number;
  pending: number;
  rejected: number;
  total: number;
};

export type AudienceRecord = {
  id: string;
  heldAt: string;
  endAt: string | null;
  participants: string;
  subject: string;
  outcome: string | null;
  minutes: string | null;
  appointmentId: string | null;
  archived: boolean;
  createdAt: string;
};

export type OfficialInvitation = {
  id: string;
  organizer: string;
  eventTitle: string;
  eventDate: string;
  location: string | null;
  importance: WorkspacePriority;
  status: InvitationStatus;
  delegateName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DgMissionHotelReservationAttachment = {
  id: string;
  reservationId: string;
  attachmentType: HotelReservationAttachmentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: string;
};

export type DgMissionHotelReservation = {
  id: string;
  missionId: string;
  missionSubject: string;
  hotel: string;
  address: string | null;
  city: string;
  country: string;
  contact: string | null;
  roomCount: number;
  roomType: string | null;
  arrivalDate: string;
  departureDate: string;
  cost: number | null;
  currency: string;
  status: HotelReservationStatus;
  attachments: DgMissionHotelReservationAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type DgMission = {
  id: string;
  subject: string;
  missionType: string;
  /** Libellé affiché (pays avec drapeaux). */
  destination: string;
  /** Codes ISO pays sélectionnés. */
  destinations: string[];
  details: string | null;
  departAt: string;
  returnAt: string;
  initialReturnAt: string;
  operationalState: MissionOperationalState;
  prolongationCount: number;
  status: MissionStatus;
  participants: string;
  documentCount: number;
  observations: string | null;
  cancelReason: string | null;
  cancelReasonDetail: string | null;
  closureReport: string | null;
  closureResults: string | null;
  closureRecommendations: string | null;
  closureComments: string | null;
  completedAt: string | null;
  statusChangedAt: string | null;
  archived: boolean;
  archivedAt: string | null;
  /** Statut hôtel agrégé ; null = aucune réservation (affiché « À réserver »). */
  hotelStatus?: HotelReservationStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type MissionDocumentType = 'GENERAL' | 'REPORT';

export type DgMissionDocument = {
  id: string;
  missionId: string;
  documentType: MissionDocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedAt: string;
};

export type DgMissionHistoryEntry = {
  id: string;
  missionId: string;
  userId: string;
  userName: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
  createdAt: string;
};

export type ImportantDeadline = {
  id: string;
  title: string;
  kind: DeadlineKind;
  status: DeadlineStatus;
  dueAt: string;
  ownerName: string;
  description: string | null;
  alertDaysBefore: number;
  createdAt: string;
};

export type VaultDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  version: number;
  fileName: string;
  fileSize: number;
  storageKey: string;
  reportDate: string;
  bodyHtml: string | null;
  tags: string[];
  uploadedById: string;
  uploadedAt: string;
  restricted: boolean;
  archived: boolean;
  archivedAt: string | null;
};

export type WorkspaceDashboard = {
  period: { from: string; to: string };
  kpis: {
    appointmentsToday: number;
    pendingAppointments: number;
    mailPending: number;
    documentsToSign: number;
    urgentTasks: number;
    overdueDecisions: number;
    upcomingMissions: number;
    pendingInvitations: number;
    deadlinesSoon: number;
    missionsTotal: number;
    missionsPlanned: number;
    missionsOngoing: number;
    missionsCompleted: number;
    missionsCancelled: number;
    missionsThisMonth: number;
    missionsProlonged: number;
    missionsProlongationTotal: number;
  };
  charts: {
    tasksByStatus: { status: DgTaskStatus; count: number }[];
    decisionsByStatus: { status: DgDecisionStatus; count: number }[];
    mailByStatus: { status: MailWorkflowStatus; count: number }[];
    missionsByStatus: { status: MissionStatus; count: number }[];
    missionsByType: { type: string; count: number }[];
    missionsByDestination: { destination: string; count: number }[];
  };
  widgets: {
    todayAppointments: { id: string; title: string; startAt: string }[];
    urgentTasks: DgTask[];
    overdueDecisions: DgDecision[];
    mailQueue: MailItem[];
    upcomingDeadlines: ImportantDeadline[];
    ongoingMissions: DgMission[];
    upcomingMissionsList: DgMission[];
    attentionMissions: DgMission[];
    prolongedMissions: DgMission[];
  };
  missionAlerts: {
    hasDepartToday: boolean;
    hasReturnToday: boolean;
    departTodaySubjects: string[];
    returnTodaySubjects: string[];
  };
};
