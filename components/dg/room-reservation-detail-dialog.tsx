'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UserAvatar } from '@/components/admin/user-avatar';
import { ROOM_EQUIPMENT_OPTIONS } from '@/lib/dg/room-reservation-form';
import {
  ROOM_RESERVATION_STATUS_LABELS,
  ROOM_USAGE_LABELS,
  roomReservationWasModified,
  type RoomReservationReviewItem,
  type RoomReservationStatus,
} from '@/lib/dg/room-reservation-review';
import { formatDate, formatTimeInAppTz, DATE_FNS_LOCALE } from '@/lib/datetime';
import {
  roomActionVisible,
  roomReservationActions,
} from '@/lib/dg/room-reservation-review-access';
import { cn } from '@/lib/utils';

type DetailActions = {
  variant: 'active' | 'trash';
  permissions?: Record<string, boolean>;
  canReview: boolean;
  cancellable: boolean;
  editable: boolean;
  actionLoading: boolean;
  availabilityHref: string;
  onApprove: () => void;
  onReject: () => void;
  onPropose: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

type Props = {
  item: RoomReservationReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: DetailActions;
};

function equipmentLabel(value: string) {
  return ROOM_EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function statusBadgeClass(status: RoomReservationStatus) {
  switch (status) {
    case 'PENDING':
      return 'admin-appt-badge admin-appt-badge-pending';
    case 'CONFIRMED':
      return 'admin-appt-badge admin-appt-badge-approved';
    case 'REJECTED':
      return 'admin-appt-badge admin-appt-badge-rejected';
    case 'CANCELLED':
      return 'admin-appt-badge admin-appt-badge-auto-rejected';
    default:
      return 'admin-appt-badge';
  }
}

function isAppointmentOccupancy(item: RoomReservationReviewItem) {
  return item.source === 'appointment';
}

function statusLabel(item: RoomReservationReviewItem) {
  if (isAppointmentOccupancy(item)) {
    return item.status === 'CONFIRMED' ? 'Audience confirmée' : 'Audience en attente';
  }
  return ROOM_RESERVATION_STATUS_LABELS[item.status];
}

export function RoomReservationDetailDialog({ item, open, onOpenChange, actions }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="admin-theme dg-room-res-detail-sheet">
        {!item ? (
          <SheetTitle className="sr-only">Détail de la réservation</SheetTitle>
        ) : (
          <RoomReservationDetailContent item={item} actions={actions} onOpenChange={onOpenChange} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailActionButton({
  icon: Icon,
  label,
  tone = 'default',
  disabled,
  loading,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'approve' | 'reject' | 'propose' | 'primary' | 'edit' | 'danger' | 'restore';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'dg-room-res-detail-action-btn',
        tone !== 'default' && `dg-room-res-detail-action-btn--${tone}`
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      <span>{label}</span>
    </button>
  );
}

function RoomReservationDetailFooter({
  item,
  actions,
  onOpenChange,
}: {
  item: RoomReservationReviewItem;
  actions: DetailActions;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isAgenda = item.source === 'appointment';
  const {
    variant,
    permissions = {},
    canReview,
    cancellable,
    editable,
    actionLoading,
    availabilityHref,
    onApprove,
    onReject,
    onPropose,
    onCancel,
    onEdit,
    onArchive,
    onRestore,
    onDelete,
  } = actions;

  const perms = roomReservationActions(permissions, {
    status: item.status,
    variant,
    canReviewRole: canReview,
    cancellable,
    editable,
    isAppointment: isAgenda,
  });

  const appointmentHref = item.appointmentId
    ? `/dg/appointments?date=${encodeURIComponent(item.startAt.slice(0, 10))}`
    : '/dg/appointments';

  const openAgenda = () => {
    onOpenChange(false);
    router.push(isAgenda ? appointmentHref : availabilityHref);
  };

  if (variant === 'trash') {
    const showRestore = roomActionVisible(permissions, 'action.room_reservations.restore');
    const showDelete = roomActionVisible(permissions, 'action.room_reservations.delete');
    if (!showRestore && !showDelete) return null;
    return (
      <footer className="dg-room-res-detail-footer">
        <div className="dg-room-res-detail-footer-grid">
          {showRestore ? (
            <DetailActionButton
              icon={RotateCcw}
              label="Restaurer"
              tone="restore"
              loading={actionLoading}
              onClick={onRestore}
            />
          ) : null}
          {showDelete ? (
            <DetailActionButton
              icon={Trash2}
              label="Supprimer"
              tone="danger"
              loading={actionLoading}
              onClick={onDelete}
            />
          ) : null}
        </div>
      </footer>
    );
  }

  if (isAgenda) {
    if (!roomActionVisible(permissions, 'action.room_reservations.agenda')) return null;
    return (
      <footer className="dg-room-res-detail-footer">
        <div className="dg-room-res-detail-footer-grid dg-room-res-detail-footer-grid--1">
          <DetailActionButton
            icon={CalendarClock}
            label="Voir l'audience"
            tone="primary"
            loading={actionLoading}
            onClick={openAgenda}
          />
        </div>
      </footer>
    );
  }

  const showApprove = roomActionVisible(permissions, 'action.room_reservations.approve');
  const showReject = roomActionVisible(permissions, 'action.room_reservations.reject');
  const showPropose = roomActionVisible(permissions, 'action.room_reservations.propose');
  const showReviewRow =
    (showApprove || showReject || showPropose) && item.status === 'PENDING' && canReview;
  const showEdit = roomActionVisible(permissions, 'action.room_reservations.edit');
  const showAgenda = roomActionVisible(permissions, 'action.room_reservations.agenda');
  const showArchive = roomActionVisible(permissions, 'action.room_reservations.archive');
  const showCancel = roomActionVisible(permissions, 'action.room_reservations.cancel');

  const secondaryCount = [showEdit, showAgenda, showArchive, showCancel].filter(Boolean).length;

  if (!showReviewRow && secondaryCount === 0) return null;

  return (
    <footer className="dg-room-res-detail-footer">
      {showReviewRow ? (
        <div className="dg-room-res-detail-footer-grid dg-room-res-detail-footer-grid--3">
          {showApprove ? (
            <DetailActionButton
              icon={Check}
              label="Valider"
              tone="approve"
              disabled={!perms.canApprove || actionLoading}
              loading={actionLoading}
              onClick={onApprove}
            />
          ) : null}
          {showReject ? (
            <DetailActionButton
              icon={X}
              label="Refuser"
              tone="reject"
              disabled={!perms.canReject || actionLoading}
              loading={actionLoading}
              onClick={onReject}
            />
          ) : null}
          {showPropose ? (
            <DetailActionButton
              icon={CalendarClock}
              label="Proposer"
              tone="propose"
              disabled={!perms.canPropose || actionLoading}
              onClick={() => {
                onOpenChange(false);
                onPropose();
              }}
            />
          ) : null}
        </div>
      ) : null}

      {secondaryCount > 0 ? (
        <div
          className={cn(
            'dg-room-res-detail-footer-grid',
            secondaryCount >= 4
              ? 'dg-room-res-detail-footer-grid--4'
              : secondaryCount === 3
                ? 'dg-room-res-detail-footer-grid--3'
                : undefined
          )}
        >
          {showEdit ? (
            <DetailActionButton
              icon={Pencil}
              label="Modifier"
              tone="edit"
              disabled={!perms.canEdit || actionLoading}
              onClick={() => {
                if (!perms.canEdit) return;
                onOpenChange(false);
                onEdit();
              }}
            />
          ) : null}
          {showAgenda ? (
            <DetailActionButton
              icon={CalendarClock}
              label="Agenda"
              disabled={actionLoading}
              onClick={openAgenda}
            />
          ) : null}
          {showArchive ? (
            <DetailActionButton
              icon={Trash2}
              label="Corbeille"
              tone="danger"
              disabled={!perms.canArchive || actionLoading}
              loading={actionLoading}
              onClick={onArchive}
            />
          ) : null}
          {showCancel ? (
            <DetailActionButton
              icon={Ban}
              label="Annuler"
              tone="danger"
              disabled={!perms.canCancel || actionLoading}
              loading={actionLoading}
              onClick={onCancel}
            />
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}

function RoomReservationDetailContent({
  item,
  actions,
  onOpenChange,
}: {
  item: RoomReservationReviewItem;
  actions?: DetailActions;
  onOpenChange: (open: boolean) => void;
}) {
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const created = new Date(item.createdAt);
  const reviewed = item.reviewedAt ? new Date(item.reviewedAt) : null;
  const archived = item.archivedAt ? new Date(item.archivedAt) : null;
  const wasModified = item.source !== 'appointment' && roomReservationWasModified(item);
  const modifiedAt = wasModified ? new Date(item.updatedAt) : null;
  const nameParts = item.bookedByName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ') || firstName;
  const isAgenda = isAppointmentOccupancy(item);

  return (
    <div className="dg-room-res-detail-layout">
      <SheetHeader className="dg-room-res-detail-head">
        <div className="dg-room-res-detail-head-badges">
          <span className={cn(statusBadgeClass(item.status), 'dg-room-res-detail-status')}>
            {statusLabel(item)}
          </span>
          {isAgenda ? (
            <span className="dg-room-res-meta-tag dg-room-res-meta-tag--agenda">Audience DGA</span>
          ) : item.bookingOrigin === 'APPOINTMENT' ? (
            <span className="dg-room-res-meta-tag dg-room-res-meta-tag--from-rdv">Demande RDV</span>
          ) : (
            <span className="dg-room-res-meta-tag dg-room-res-meta-tag--from-slot">Créneau</span>
          )}
          {item.assistantNote ? (
            <span className="dg-room-res-meta-tag dg-room-res-meta-tag--proposed">Créneau proposé</span>
          ) : null}
          {item.archived ? (
            <span className="dg-room-res-meta-tag dg-room-res-meta-tag--trash">Corbeille</span>
          ) : null}
        </div>
        <div className="dg-room-res-detail-head-main">
          <div className="dg-room-res-detail-head-icon" aria-hidden>
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="dg-room-res-detail-title">{item.title}</SheetTitle>
            <SheetDescription className="dg-room-res-detail-sub">
              {item.roomName} · {ROOM_USAGE_LABELS[item.usageType]}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="dg-room-res-detail-body">
        <div className="dg-room-res-detail-cards">
          <div className="dg-room-res-detail-card dg-room-res-detail-card--slot">
            <CalendarClock className="dg-room-res-detail-card-inline-icon" aria-hidden />
            <div className="dg-room-res-detail-card-body min-w-0">
              <p className="dg-room-res-detail-card-value capitalize">
                {formatDate(start, 'EEE d MMM yyyy')} · {formatTimeInAppTz(start)}–{formatTimeInAppTz(end)}
              </p>
              <p className="dg-room-res-detail-card-relative">
                {formatDistanceToNow(start, { addSuffix: true, locale: DATE_FNS_LOCALE })}
              </p>
            </div>
          </div>

          {modifiedAt ? (
            <div className="dg-room-res-detail-card dg-room-res-detail-card--modified">
              <Pencil className="dg-room-res-detail-card-inline-icon" aria-hidden />
              <div className="dg-room-res-detail-card-body min-w-0">
                <p className="dg-room-res-detail-card-value capitalize">
                  Modif. {formatDate(modifiedAt, 'EEE d MMM')} · {formatTimeInAppTz(modifiedAt)}
                </p>
              </div>
              <span className="dg-room-res-detail-card-pill">
                {formatDistanceToNow(modifiedAt, { addSuffix: true, locale: DATE_FNS_LOCALE })}
              </span>
            </div>
          ) : null}
        </div>

        <div className="dg-room-res-detail-meta">
          <div className="dg-room-res-detail-meta-cell">
            <span className="dg-room-res-detail-meta-label">Département</span>
            <span className="dg-room-res-detail-meta-value">{item.organizerService}</span>
          </div>
          {item.participantCount != null ? (
            <div className="dg-room-res-detail-meta-cell">
              <span className="dg-room-res-detail-meta-label">Nombre de participants</span>
              <span className="dg-room-res-detail-meta-value dg-room-res-detail-meta-value--inline">
                <Users className="h-3 w-3" aria-hidden />
                {item.participantCount}
              </span>
            </div>
          ) : null}
          <div className="dg-room-res-detail-meta-cell">
            <span className="dg-room-res-detail-meta-label">Soumission</span>
            <span className="dg-room-res-detail-meta-value capitalize">
              {formatDate(created, 'EEE d MMM')} · {formatTimeInAppTz(created)}
            </span>
          </div>
          {reviewed ? (
            <div className="dg-room-res-detail-meta-cell">
              <span className="dg-room-res-detail-meta-label">Validation</span>
              <span className="dg-room-res-detail-meta-value capitalize">
                {formatDate(reviewed, 'EEE d MMM')} · {formatTimeInAppTz(reviewed)}
              </span>
            </div>
          ) : null}
          {archived ? (
            <div className="dg-room-res-detail-meta-cell">
              <span className="dg-room-res-detail-meta-label">Archivée</span>
              <span className="dg-room-res-detail-meta-value capitalize">
                {formatDate(archived, 'EEE d MMM')} · {formatTimeInAppTz(archived)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="dg-room-res-detail-person">
          <UserAvatar firstName={firstName} lastName={lastName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="dg-room-res-detail-person-name">{item.bookedByName}</p>
            <p className="dg-room-res-detail-person-meta">
              {[item.bookedByEmail, item.bookedByPhone].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {item.equipment.length > 0 ? (
          <div className="dg-room-res-detail-tags">
            {item.equipment.map((eq) => (
              <span key={eq} className="dg-room-res-meta-tag">
                {equipmentLabel(eq)}
              </span>
            ))}
          </div>
        ) : null}

        {item.logisticsNotes ? (
          <p className="dg-room-res-detail-notes-line">
            <ClipboardList className="h-3 w-3 shrink-0" aria-hidden />
            <span>{item.logisticsNotes}</span>
          </p>
        ) : null}

        {item.assistantNote ? (
          <div className="dg-room-res-detail-callout dg-room-res-detail-callout--propose">
            <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
            <p className="dg-room-res-detail-callout-text">{item.assistantNote}</p>
          </div>
        ) : null}

        {item.rejectionReason ? (
          <div className="dg-room-res-detail-callout dg-room-res-detail-callout--reject">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
            <p className="dg-room-res-detail-callout-text">{item.rejectionReason}</p>
          </div>
        ) : null}

        {(item.contactPhone || item.contactEmail) ? (
          <p className="dg-room-res-detail-notes-line dg-room-res-detail-notes-line--muted">
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            <span>{[item.contactPhone, item.contactEmail].filter(Boolean).join(' · ')}</span>
          </p>
        ) : null}
      </div>

      {actions ? (
        <RoomReservationDetailFooter item={item} actions={actions} onOpenChange={onOpenChange} />
      ) : null}
    </div>
  );
}
