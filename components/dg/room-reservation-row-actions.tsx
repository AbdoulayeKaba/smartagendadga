'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  CalendarClock,
  Check,
  Eye,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RoomReservationReviewItem } from '@/lib/dg/room-reservation-review';
import {
  hasAnyRoomReservationAction,
  roomActionVisible,
  roomReservationActions,
} from '@/lib/dg/room-reservation-review-access';

type Props = {
  /** `own` = Mes réservations (pas d’actions de validation / corbeille). */
  mode?: 'review' | 'own';
  variant: 'active' | 'trash';
  item: RoomReservationReviewItem;
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
  onDetail: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

type MenuEntry =
  | {
      kind: 'item';
      key: string;
      label: string;
      icon: LucideIcon;
      destructive?: boolean;
      disabled?: boolean;
      href?: string;
      onSelect?: () => void;
    }
  | { kind: 'separator'; key: string };

function buildMenuEntries({
  mode,
  variant,
  item,
  permissions,
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
  onDetail,
  onArchive,
  onRestore,
  onDelete,
}: Props): MenuEntry[] {
  const isAppointment = item.source === 'appointment';
  const actions = roomReservationActions(permissions ?? {}, {
    status: item.status,
    variant,
    canReviewRole: canReview,
    cancellable,
    editable,
    isAppointment,
  });
  const canDetail = roomActionVisible(permissions ?? {}, 'action.room_reservations.detail');
  const canAgenda = roomActionVisible(permissions ?? {}, 'action.room_reservations.agenda');
  const entries: MenuEntry[] = [];

  if (mode === 'own') {
    if (canDetail) {
      entries.push({
        kind: 'item',
        key: 'detail',
        label: 'Détail',
        icon: Eye,
        disabled: actionLoading,
        onSelect: onDetail,
      });
    }
    if (actions.canEdit) {
      entries.push({
        kind: 'item',
        key: 'edit',
        label: 'Modifier',
        icon: Pencil,
        disabled: actionLoading,
        onSelect: onEdit,
      });
    }
    if (canAgenda) {
      entries.push({
        kind: 'item',
        key: 'agenda',
        label: 'Agenda',
        icon: CalendarClock,
        disabled: actionLoading,
        href: availabilityHref,
      });
    }
    return entries;
  }

  if (variant === 'trash') {
    if (actions.canRestore) {
      entries.push({
        kind: 'item',
        key: 'restore',
        label: 'Restaurer',
        icon: RotateCcw,
        disabled: actionLoading,
        onSelect: onRestore,
      });
    }
    if (canDetail) {
      entries.push({
        kind: 'item',
        key: 'detail',
        label: 'Détail',
        icon: Eye,
        disabled: actionLoading,
        onSelect: onDetail,
      });
    }
    if (actions.canDelete) {
      if (entries.length) entries.push({ kind: 'separator', key: 'sep-delete' });
      entries.push({
        kind: 'item',
        key: 'delete',
        label: 'Supprimer définitivement',
        icon: Trash2,
        destructive: true,
        disabled: actionLoading,
        onSelect: onDelete,
      });
    }
    return entries;
  }

  if (actions.canApprove) {
    entries.push({
      kind: 'item',
      key: 'approve',
      label: 'Valider',
      icon: Check,
      disabled: actionLoading,
      onSelect: onApprove,
    });
  }
  if (actions.canPropose) {
    entries.push({
      kind: 'item',
      key: 'propose',
      label: 'Proposer un créneau',
      icon: CalendarClock,
      disabled: actionLoading,
      onSelect: onPropose,
    });
  }
  if (actions.canReject) {
    entries.push({
      kind: 'item',
      key: 'reject',
      label: 'Refuser',
      icon: X,
      destructive: true,
      disabled: actionLoading,
      onSelect: onReject,
    });
  }

  const mid: MenuEntry[] = [];
  if (actions.canEdit) {
    mid.push({
      kind: 'item',
      key: 'edit',
      label: 'Modifier',
      icon: Pencil,
      disabled: actionLoading,
      onSelect: onEdit,
    });
  }
  if (canDetail && !isAppointment) {
    mid.push({
      kind: 'item',
      key: 'detail',
      label: 'Détail',
      icon: Eye,
      disabled: actionLoading,
      onSelect: onDetail,
    });
  }
  if (mid.length) {
    if (entries.length) entries.push({ kind: 'separator', key: 'sep-mid' });
    entries.push(...mid);
  }

  const danger: MenuEntry[] = [];
  if (actions.canCancel) {
    danger.push({
      kind: 'item',
      key: 'cancel',
      label: 'Annuler',
      icon: Ban,
      destructive: true,
      disabled: actionLoading,
      onSelect: onCancel,
    });
  }
  if (actions.canArchive) {
    danger.push({
      kind: 'item',
      key: 'archive',
      label: 'Mettre en corbeille',
      icon: Trash2,
      destructive: true,
      disabled: actionLoading,
      onSelect: onArchive,
    });
  }
  if (danger.length) {
    if (entries.length) entries.push({ kind: 'separator', key: 'sep-danger' });
    entries.push(...danger);
  }

  return entries;
}

export function RoomReservationRowActions(props: Props) {
  const { mode = 'review', variant, item, permissions = {}, canReview, cancellable, editable } =
    props;
  const isAppointment = item.source === 'appointment';
  const actions = roomReservationActions(permissions, {
    status: item.status,
    variant,
    canReviewRole: canReview,
    cancellable,
    editable,
    isAppointment,
  });

  if (mode === 'own') {
    const canDetail = roomActionVisible(permissions, 'action.room_reservations.detail');
    const canAgenda = roomActionVisible(permissions, 'action.room_reservations.agenda');
    if (!actions.canEdit && !canDetail && !canAgenda) return null;
  } else if (variant === 'trash') {
    const canDetail = roomActionVisible(permissions, 'action.room_reservations.detail');
    if (!actions.canRestore && !actions.canDelete && !canDetail) return null;
  } else if (!hasAnyRoomReservationAction(actions, variant)) {
    return null;
  }

  const entries = buildMenuEntries({ ...props, mode });
  if (entries.length === 0) return null;

  return (
    <div className="dg-room-res-actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="dg-room-res-actions-trigger"
            aria-label={`Actions — ${item.title}`}
            disabled={props.actionLoading}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dg-room-res-actions-menu">
          {entries.map((entry) => {
            if (entry.kind === 'separator') {
              return <DropdownMenuSeparator key={entry.key} />;
            }
            const Icon = entry.icon;
            if (entry.href) {
              return (
                <DropdownMenuItem key={entry.key} asChild disabled={entry.disabled}>
                  <Link href={entry.href}>
                    <Icon aria-hidden />
                    {entry.label}
                  </Link>
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuItem
                key={entry.key}
                disabled={entry.disabled}
                variant={entry.destructive ? 'destructive' : 'default'}
                onSelect={() => entry.onSelect?.()}
              >
                <Icon aria-hidden />
                {entry.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
