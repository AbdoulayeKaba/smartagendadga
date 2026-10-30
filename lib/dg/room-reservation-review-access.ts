import type { RoomReservationStatus } from '@/lib/dg/room-reservation-review';

export type RoomReservationActions = {
  canApprove: boolean;
  canReject: boolean;
  canPropose: boolean;
  canCancel: boolean;
  canAgenda: boolean;
  canEdit: boolean;
  canDetail: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
};

function allowed(permissions: Record<string, boolean>, id: string): boolean {
  return permissions[id] === true;
}

/** Droits d’affichage des actions (liste / corbeille des réservations salles). */
export function roomReservationActions(
  permissions: Record<string, boolean>,
  opts: {
    status: RoomReservationStatus;
    variant: 'active' | 'trash';
    canReviewRole: boolean;
    cancellable: boolean;
    editable: boolean;
    isAppointment: boolean;
  }
): RoomReservationActions {
  const { status, variant, canReviewRole, cancellable, editable, isAppointment } = opts;
  const pending = status === 'PENDING';

  if (variant === 'trash') {
    return {
      canApprove: false,
      canReject: false,
      canPropose: false,
      canCancel: false,
      canAgenda: false,
      canEdit: false,
      canDetail: allowed(permissions, 'action.room_reservations.detail'),
      canArchive: false,
      canRestore: allowed(permissions, 'action.room_reservations.restore'),
      canDelete: allowed(permissions, 'action.room_reservations.delete'),
    };
  }

  if (isAppointment) {
    return {
      canApprove: false,
      canReject: false,
      canPropose: false,
      canCancel: false,
      canAgenda: allowed(permissions, 'action.room_reservations.agenda'),
      canEdit: false,
      canDetail: false,
      canArchive: false,
      canRestore: false,
      canDelete: false,
    };
  }

  return {
    canApprove:
      canReviewRole &&
      pending &&
      allowed(permissions, 'action.room_reservations.approve'),
    canReject:
      canReviewRole &&
      pending &&
      allowed(permissions, 'action.room_reservations.reject'),
    canPropose:
      canReviewRole &&
      pending &&
      allowed(permissions, 'action.room_reservations.propose'),
    canCancel: cancellable && allowed(permissions, 'action.room_reservations.cancel'),
    canAgenda: allowed(permissions, 'action.room_reservations.agenda'),
    canEdit: editable && allowed(permissions, 'action.room_reservations.edit'),
    canDetail: allowed(permissions, 'action.room_reservations.detail'),
    canArchive:
      canReviewRole && allowed(permissions, 'action.room_reservations.archive'),
    canRestore: false,
    canDelete: false,
  };
}

export function hasAnyRoomReservationAction(
  actions: RoomReservationActions,
  variant: 'active' | 'trash'
): boolean {
  if (variant === 'trash') {
    return actions.canRestore || actions.canDelete || actions.canDetail;
  }
  return (
    actions.canApprove ||
    actions.canReject ||
    actions.canPropose ||
    actions.canCancel ||
    actions.canAgenda ||
    actions.canEdit ||
    actions.canDetail ||
    actions.canArchive
  );
}

/** Affiche l’entrée si la permission existe ; l’état métier peut encore la griser. */
export function roomActionVisible(
  permissions: Record<string, boolean>,
  permissionId: string
): boolean {
  return permissions[permissionId] === true;
}
