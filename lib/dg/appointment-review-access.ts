import type { AppointmentStatus } from '@prisma/client';
import {
  canReviewerEditAppointment,
  isAppointmentSlotPast,
} from '@/lib/dg/appointment-reschedule-access';
import type { DgRole } from '@/lib/dg/rbac';

export type ReviewAppointmentActions = {
  canApprove: boolean;
  canReschedule: boolean;
  canReject: boolean;
  canEdit: boolean;
  canDetail: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
};

export type ReviewAppointmentContext = {
  role?: DgRole;
  startAt?: string;
  endAt?: string;
  now?: Date;
};

function allowed(permissions: Record<string, boolean>, id: string): boolean {
  return permissions[id] === true;
}

/** Droits d’affichage des boutons d’action (liste des rendez-vous / corbeille). */
export function reviewAppointmentActions(
  permissions: Record<string, boolean>,
  status: AppointmentStatus,
  variant: 'active' | 'trash',
  context: ReviewAppointmentContext = {}
): ReviewAppointmentActions {
  const pending = status === 'PENDING';
  const approved = status === 'APPROVED';

  if (variant === 'trash') {
    return {
      canApprove: false,
      canReschedule: false,
      canReject: false,
      canEdit: false,
      canDetail: allowed(permissions, 'action.appointments.detail'),
      canArchive: false,
      canRestore: allowed(permissions, 'action.appointments.restore'),
      canDelete: allowed(permissions, 'action.appointments.delete'),
    };
  }

  return {
    canApprove: pending && allowed(permissions, 'action.appointments.approve'),
    canReschedule:
      (pending || approved) &&
      allowed(permissions, 'action.appointments.reschedule') &&
      !isAppointmentSlotPast(
        { endAt: context.endAt },
        context.now ?? new Date()
      ),
    canReject:
      (pending || approved) &&
      allowed(permissions, 'action.appointments.reject') &&
      !isAppointmentSlotPast(
        { endAt: context.endAt },
        context.now ?? new Date()
      ),
    canEdit: canReviewerEditAppointment(context.role, permissions, status, {
      startAt: context.startAt,
      endAt: context.endAt,
      now: context.now,
    }),
    canDetail: allowed(permissions, 'action.appointments.detail'),
    canArchive: allowed(permissions, 'action.appointments.archive'),
    canRestore: false,
    canDelete: false,
  };
}

export function hasAnyReviewAction(
  actions: ReviewAppointmentActions,
  variant: 'active' | 'trash'
): boolean {
  if (variant === 'trash') {
    return actions.canRestore || actions.canDelete || actions.canDetail;
  }
  return (
    actions.canApprove ||
    actions.canReschedule ||
    actions.canReject ||
    actions.canEdit ||
    actions.canDetail ||
    actions.canArchive
  );
}
