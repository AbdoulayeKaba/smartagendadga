import type { AppointmentStatus } from '@prisma/client';
import { isAppointmentSlotPast } from '@/lib/dg/appointment-reschedule-access';

export const APPOINTMENT_OWN_PERMISSION_IDS = {
  detail: 'appointments.own.detail',
  edit: 'appointments.own.edit',
  delete: 'appointments.own.delete',
} as const;

export type OwnAppointmentActions = {
  canDetail: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
};

export function ownAppointmentActions(
  permissions: Record<string, boolean>,
  status: AppointmentStatus,
  variant: 'active' | 'trash' = 'active',
  slot?: { endAt?: string | Date | null; now?: Date }
): OwnAppointmentActions {
  const pending = status === 'PENDING';

  if (variant === 'trash') {
    return {
      canDetail: Boolean(permissions[APPOINTMENT_OWN_PERMISSION_IDS.detail]),
      canEdit: false,
      canArchive: false,
      canRestore: false,
      canDelete: false,
    };
  }

  return {
    canDetail: Boolean(permissions[APPOINTMENT_OWN_PERMISSION_IDS.detail]),
    canEdit:
      Boolean(permissions[APPOINTMENT_OWN_PERMISSION_IDS.edit]) &&
      pending &&
      !isAppointmentSlotPast({ endAt: slot?.endAt }, slot?.now ?? new Date()),
    canArchive: false,
    canRestore: false,
    canDelete: false,
  };
}

export function hasAnyOwnAction(
  actions: OwnAppointmentActions,
  variant: 'active' | 'trash'
): boolean {
  if (variant === 'trash') {
    return actions.canRestore || actions.canDelete || actions.canDetail;
  }
  return actions.canDetail || actions.canEdit || actions.canArchive;
}

export function canCancelOwnAppointmentStatus(status: AppointmentStatus): boolean {
  return status === 'PENDING' || status === 'REJECTED';
}
