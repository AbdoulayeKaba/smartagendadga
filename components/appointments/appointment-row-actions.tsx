'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  Check,
  Eye,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import { hasAnyOwnAction, ownAppointmentActions } from '@/lib/dg/appointment-own-access';
import {
  hasAnyReviewAction,
  reviewAppointmentActions,
} from '@/lib/dg/appointment-review-access';
import type { DgRole } from '@/lib/dg/rbac';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  mode?: 'review' | 'own';
  permissions?: Record<string, boolean>;
  variant: 'active' | 'trash';
  item: AppointmentReviewItem;
  actionLoading: boolean;
  editHref: string;
  onApprove: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onDetail: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  role?: DgRole;
};

type Tone =
  | 'approve'
  | 'reschedule'
  | 'reject'
  | 'edit'
  | 'detail'
  | 'requester'
  | 'trash'
  | 'restore';

function ActionsMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="admin-appt-row-actions-trigger" aria-label="Actions">
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="admin-appt-row-actions-menu"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconAction({
  icon: Icon,
  label,
  tone,
  disabled,
  href,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone: Tone;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    'admin-appt-row-menu-item',
    `admin-appt-row-menu-item--${tone === 'trash' ? 'danger' : tone}`
  );
  const content = (
    <>
      <Icon className="admin-appt-row-menu-icon" aria-hidden />
      {label}
    </>
  );

  if (href && !disabled) {
    return (
      <DropdownMenuItem asChild className={className}>
        <Link href={href}>{content}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className={className}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onSelect={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {content}
    </DropdownMenuItem>
  );
}

function TableIcon({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'restore' | 'trash' | 'detail';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('admin-appt-action-btn', `admin-appt-action-btn--${tone}`)}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon className="admin-appt-action-icon" aria-hidden />
    </button>
  );
}

function TrashActionIcons({ children }: { children: ReactNode }) {
  return (
    <div className="admin-appt-trash-actions" role="group" aria-label="Actions de la corbeille">
      {children}
    </div>
  );
}

function allowedShow(
  _canByStatus: boolean,
  permissions: Record<string, boolean>,
  permissionId: string
): boolean {
  return permissions[permissionId] === true;
}

export function AppointmentRowActions({
  mode = 'review',
  permissions = {},
  variant,
  item,
  actionLoading,
  editHref,
  onApprove,
  onReject,
  onReschedule,
  onDetail,
  onArchive,
  onRestore,
  onDelete,
  role,
}: Props) {
  if (mode === 'own') {
    const actions = ownAppointmentActions(permissions, item.status, variant);
    if (!hasAnyOwnAction(actions, variant)) return null;

    if (variant === 'trash') {
      return (
        <TrashActionIcons>
          {actions.canRestore ? (
            <TableIcon
              icon={RotateCcw}
              label="Restaurer"
              tone="restore"
              disabled={actionLoading}
              onClick={onRestore}
            />
          ) : null}
          {actions.canDetail ? (
            <TableIcon
              icon={Eye}
              label="Détail"
              tone="detail"
              disabled={actionLoading}
              onClick={onDetail}
            />
          ) : null}
          {actions.canDelete ? (
            <TableIcon
              icon={Trash2}
              label="Supprimer définitivement"
              tone="trash"
              disabled={actionLoading}
              onClick={onDelete}
            />
          ) : null}
        </TrashActionIcons>
      );
    }

    return (
      <ActionsMenu>
        {actions.canDetail ? (
          <IconAction
            icon={Eye}
            label="Détail"
            tone="detail"
            disabled={actionLoading}
            onClick={onDetail}
          />
        ) : null}
        {actions.canEdit ? (
          <IconAction
            icon={Pencil}
            label="Modifier"
            tone="edit"
            disabled={actionLoading}
            href={editHref}
          />
        ) : null}
        {actions.canArchive ? (
          <IconAction
            icon={Trash2}
            label="Mettre en corbeille"
            tone="trash"
            disabled={actionLoading}
            onClick={onArchive}
          />
        ) : null}
      </ActionsMenu>
    );
  }

  const actions = reviewAppointmentActions(permissions, item.status, variant, {
    role,
    startAt: item.startAt,
    endAt: item.endAt,
  });
  if (!hasAnyReviewAction(actions, variant)) return null;

  if (variant === 'trash') {
    return (
      <TrashActionIcons>
        {actions.canRestore ? (
          <TableIcon
            icon={RotateCcw}
            label="Restaurer"
            tone="restore"
            disabled={actionLoading}
            onClick={onRestore}
          />
        ) : null}
        {actions.canDetail ? (
          <TableIcon
            icon={Eye}
            label="Détail"
            tone="detail"
            disabled={actionLoading}
            onClick={onDetail}
          />
        ) : null}
        {actions.canDelete ? (
          <TableIcon
            icon={Trash2}
            label="Supprimer définitivement"
            tone="trash"
            disabled={actionLoading}
            onClick={onDelete}
          />
        ) : null}
      </TrashActionIcons>
    );
  }

  return (
    <ActionsMenu>
      {allowedShow(actions.canApprove, permissions, 'action.appointments.approve') ? (
        <IconAction
          icon={Check}
          label="Valider"
          tone="approve"
          disabled={!actions.canApprove || actionLoading}
          onClick={onApprove}
        />
      ) : null}
      {actions.canReschedule ? (
        <IconAction
          icon={CalendarClock}
          label="Replanifier"
          tone="reschedule"
          disabled={actionLoading}
          onClick={onReschedule}
        />
      ) : null}
      {actions.canReject ? (
        <IconAction
          icon={X}
          label={item.status === 'APPROVED' ? 'Annuler' : 'Refuser'}
          tone="reject"
          disabled={actionLoading}
          onClick={onReject}
        />
      ) : null}
      {permissions['action.appointments.edit'] === true && actions.canEdit ? (
        <IconAction
          icon={Pencil}
          label="Modifier"
          tone="edit"
          disabled={actionLoading}
          href={editHref}
        />
      ) : null}
      {permissions['action.appointments.detail'] === true ? (
        <IconAction
          icon={Eye}
          label="Détails"
          tone="detail"
          disabled={!actions.canDetail || actionLoading}
          onClick={onDetail}
        />
      ) : null}
      {permissions['action.appointments.archive'] === true ? (
        <IconAction
          icon={Trash2}
          label="Corbeille"
          tone="trash"
          disabled={!actions.canArchive || actionLoading}
          onClick={onArchive}
        />
      ) : null}
    </ActionsMenu>
  );
}
