import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';

export type AppointmentReviewStatus = AppointmentStatus | 'ALL';

export type AppointmentUrgencyFilter = 'NORMAL' | 'URGENT' | 'ALL';

export type AppointmentReviewItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  priority: Priority;
  type: AppointmentType;
  location: string | null;
  locationRef: string | null;
  motifRef: string | null;
  appointmentTypeRef: string | null;
  locationLabel: string | null;
  motifLabel: string | null;
  appointmentTypeLabel: string | null;
  urgentOverride: boolean;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    department: string | null;
    role: string;
    active: boolean;
    createdAt: string;
    avatarUrl: string | null;
  };
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  participants: {
    id: string;
    email: string;
    name: string;
    isExternal: boolean;
  }[];
  businessScore: number;
  urgencyLevel: UrgencyLevel;
  workflowSteps: string[];
  autoRejected: boolean;
  archived: boolean;
  archivedAt: string | null;
  importedFromExcel: boolean;
  isOnlineMeeting: boolean;
  teamsMeetingUrl: string | null;
  roomReserved: boolean;
  reservedRoomName: string | null;
  roomReservationId: string | null;
  requesterFullName: string | null;
  requesterPhone: string | null;
  requesterEmail: string | null;
  /** Créneaux successifs, du demandé jusqu’au créneau en place. */
  slotTimeline?: { startAt: string; endAt: string }[];
};

export type AppointmentsReviewStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pendingHighPriority: number;
  upcomingApproved: number;
  priorityQueue: number;
  urgentQueue: number;
  blockedQueue: number;
  autoRejectedCount: number;
  trash: number;
};

export const APPOINTMENT_IMPORTED_LABEL = 'Importé';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
};

export const AUTO_REJECTED_STATUS_LABEL = 'Rejet automatique';

export type AppointmentStatusView = {
  status: AppointmentStatus;
  autoRejected?: boolean;
};

export function isAutoRejectedAppointment(item: AppointmentStatusView) {
  return item.status === 'REJECTED' && Boolean(item.autoRejected);
}

export function appointmentStatusLabel(item: AppointmentStatusView) {
  if (isAutoRejectedAppointment(item)) return AUTO_REJECTED_STATUS_LABEL;
  return APPOINTMENT_STATUS_LABELS[item.status];
}

export function appointmentStatusDotClass(item: AppointmentStatusView) {
  if (isAutoRejectedAppointment(item)) return 'admin-appt-status-dot--auto-rejected';
  if (item.status === 'PENDING') return 'admin-appt-status-dot--pending';
  if (item.status === 'APPROVED') return 'admin-appt-status-dot--approved';
  return 'admin-appt-status-dot--rejected';
}

export function appointmentStatusBadgeClass(status: AppointmentStatus) {
  switch (status) {
    case 'PENDING':
      return 'admin-appt-badge-pending';
    case 'APPROVED':
      return 'admin-appt-badge-approved';
    case 'REJECTED':
      return 'admin-appt-badge-rejected';
    default:
      return 'admin-appt-badge-pending';
  }
}

export function appointmentStatusBadgeClassForItem(item: AppointmentStatusView) {
  if (isAutoRejectedAppointment(item)) return 'admin-appt-badge-auto-rejected';
  return appointmentStatusBadgeClass(item.status);
}

export const APPOINTMENT_PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
};

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  INTERNAL: 'Interne',
  EXTERNAL: 'Externe',
  MINISTRY: 'Ministère',
  PERSONAL: 'Personnel',
};

export const APPOINTMENT_URGENCY_LABELS: Record<UrgencyLevel, string> = {
  NORMAL: 'Normal',
  URGENT: 'Urgent',
  TRES_URGENT: 'Très urgent',
  CRITIQUE: 'Critique',
};

export function appointmentUrgencyBadgeClass(level: UrgencyLevel) {
  switch (level) {
    case 'CRITIQUE':
      return 'admin-appt-urgency-critique';
    case 'TRES_URGENT':
      return 'admin-appt-urgency-tres-urgent';
    case 'URGENT':
      return 'admin-appt-urgency-urgent';
    default:
      return 'admin-appt-urgency-normal';
  }
}

export function appointmentPriorityBadgeClass(priority: Priority) {
  switch (priority) {
    case 'HIGH':
      return 'admin-appt-priority-high';
    case 'MEDIUM':
      return 'admin-appt-priority-medium';
    default:
      return 'admin-appt-priority-low';
  }
}

export type ApprovedAppointmentPhase = 'upcoming' | 'ongoing' | 'past';

export function getApprovedAppointmentPhase(
  item: { status: AppointmentStatus; startAt: string; endAt: string },
  now: Date = new Date()
): ApprovedAppointmentPhase | null {
  if (item.status !== 'APPROVED') return null;
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (now < start) return 'upcoming';
  if (now <= end) return 'ongoing';
  return 'past';
}

export function approvedAppointmentPhaseLabel(phase: ApprovedAppointmentPhase): string {
  switch (phase) {
    case 'upcoming':
      return 'À venir';
    case 'ongoing':
      return 'En cours';
    case 'past':
      return 'Passé';
  }
}

export function approvedAppointmentPhaseBadgeClass(phase: ApprovedAppointmentPhase): string {
  switch (phase) {
    case 'upcoming':
      return 'admin-appt-badge-approved-upcoming';
    case 'ongoing':
      return 'admin-appt-badge-approved-live';
    case 'past':
      return 'admin-appt-badge-approved-past';
  }
}

export const APPOINTMENT_ONGOING_ARCHIVE_MESSAGE =
  'Ce rendez-vous est actuellement en cours. La mise en corbeille sera possible une fois le créneau terminé.';

export function isApprovedAppointmentOngoing(
  item: { status: AppointmentStatus; startAt: string; endAt: string },
  now: Date = new Date()
): boolean {
  if (item.status !== 'APPROVED') return false;
  return getApprovedAppointmentPhase(item, now) === 'ongoing';
}
