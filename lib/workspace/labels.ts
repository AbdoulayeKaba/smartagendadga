import type {
  ContactCategory,
  DeadlineKind,
  DeadlineStatus,
  DgDecisionStatus,
  DgProjectStatus,
  DgTaskStatus,
  DocumentCategory,
  HotelReservationAttachmentType,
  HotelReservationStatus,
  InvitationStatus,
  MailPriority,
  MailViewMode,
  MailWorkflowStatus,
  MissionStatus,
  WorkspacePriority,
} from '@/lib/workspace/types';

export const TASK_STATUS_LABELS: Record<DgTaskStatus, string> = {
  PENDING: 'En attente',
  IN_PROGRESS: 'En cours',
  SUSPENDED: 'Suspendue',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export const PROJECT_STATUS_LABELS: Record<DgProjectStatus, string> = {
  PLANNED: 'Planifié',
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

export const DECISION_STATUS_LABELS: Record<DgDecisionStatus, string> = {
  NOT_STARTED: 'Non démarrée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Réalisée',
  OVERDUE: 'En retard',
  CLOSED: 'Clôturée',
};

export const MAIL_STATUS_LABELS: Record<MailWorkflowStatus, string> = {
  RECEIVED: 'Reçu',
  ASSIGNED: 'Affecté',
  IN_PROGRESS: 'En traitement',
  PROCESSED: 'Traité',
  ARCHIVED: 'Archivé',
  SENT: 'Envoyé',
};

export const MAIL_PRIORITY_LABELS: Record<MailPriority, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
};

export const MAIL_VIEW_LABELS: Record<MailViewMode, string> = {
  dga: 'Tableau de board',
  depart: 'Courriers départ',
  suivi: 'Suivi entrant',
};

export const MAIL_DIRECTION_LABELS: Record<'INCOMING' | 'OUTGOING', string> = {
  INCOMING: 'Entrant',
  OUTGOING: 'Sortant',
};

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  MINISTRY: 'Ministères',
  INSTITUTION: 'Institutions',
  PARTNER: 'Partenaires',
  SUPPLIER: 'Fournisseurs',
  EMBASSY: 'Ambassades',
  INTERNATIONAL_ORG: 'Organisations internationales',
  OTHER: 'Autre',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  RECEIVED: 'Reçue',
  ACCEPTED: 'Acceptée',
  REFUSED: 'Refusée',
  DELEGATED: 'Déléguée',
  PENDING: 'En attente',
};

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  PLANNED: 'Planifiée',
  ONGOING: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export const HOTEL_RESERVATION_STATUS_LABELS: Record<HotelReservationStatus, string> = {
  TO_BOOK: 'À réserver',
  BOOKING_IN_PROGRESS: 'Réservation en cours',
  BOOKED: 'Réservé',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
};

export const HOTEL_ATTACHMENT_TYPE_LABELS: Record<HotelReservationAttachmentType, string> = {
  RECEIPT: 'Reçu',
  OTHER: 'Autre',
};

export const HOTEL_ATTACHMENT_TYPE_ORDER: HotelReservationAttachmentType[] = ['RECEIPT', 'OTHER'];

export const HOTEL_RESERVATION_STATUS_ORDER: HotelReservationStatus[] = [
  'TO_BOOK',
  'BOOKING_IN_PROGRESS',
  'BOOKED',
  'CONFIRMED',
  'CANCELLED',
];

/** Statuts proposés dans le formulaire de réservation (saisie assistante). */
export const HOTEL_RESERVATION_FORM_STATUS_ORDER: HotelReservationStatus[] = ['BOOKED', 'CANCELLED'];

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  CONTRACT: 'Contrat',
  RENEWAL: 'Renouvellement',
  REPORT: 'Rapport',
  AUDIT: 'Audit',
  PERIODIC_MEETING: 'Réunion périodique',
  OTHER: 'Autre',
};

export const DEADLINE_STATUS_LABELS: Record<DeadlineStatus, string> = {
  UPCOMING: 'À venir',
  DUE_SOON: 'Échéance proche',
  OVERDUE: 'En retard',
  COMPLETED: 'Réalisée',
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contrats',
  MAIL: 'Courriers',
  DECISION: 'Décisions',
  REPORT: 'Rapports',
  MINUTES: 'Procès-verbaux',
  OTHER: 'Autre',
};

export const PRIORITY_LABELS: Record<WorkspacePriority, string> = {
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
};

export const TASK_STATUS_ORDER: DgTaskStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'SUSPENDED',
  'COMPLETED',
  'CANCELLED',
];
