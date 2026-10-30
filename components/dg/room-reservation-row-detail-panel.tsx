'use client';

import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Users,
  Wrench,
} from 'lucide-react';
import { ROOM_EQUIPMENT_OPTIONS } from '@/lib/dg/room-reservation-form';
import {
  isRoomAutoExpiredPendingReason,
} from '@/lib/dg/room-reservation-expiry';
import {
  roomReservationWasModified,
  type RoomReservationReviewItem,
} from '@/lib/dg/room-reservation-review';
import { formatDate, formatTimeInAppTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';

type Props = {
  item: RoomReservationReviewItem;
  canEdit?: boolean;
  onEdit?: () => void;
};

function equipmentLabel(value: string) {
  return ROOM_EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatStamp(date: Date) {
  return `${formatDate(date, 'EEE d MMM')} · ${formatTimeInAppTz(date)}`;
}

/** Détail déplié — infos absentes des colonnes, présentation pro. */
export function RoomReservationRowDetailPanel({ item, canEdit, onEdit }: Props) {
  const reviewed = item.reviewedAt ? new Date(item.reviewedAt) : null;
  const archived = item.archivedAt ? new Date(item.archivedAt) : null;
  const wasModified = item.source !== 'appointment' && roomReservationWasModified(item);
  const modifiedAt = wasModified ? new Date(item.updatedAt) : null;
  const autoExpired = isRoomAutoExpiredPendingReason(item.rejectionReason);

  const metaCards: Array<{
    key: string;
    label: string;
    value: string;
    icon: typeof CheckCircle2;
    tone: 'green' | 'amber' | 'slate' | 'blue';
  }> = [];

  if (item.participantCount != null) {
    metaCards.push({
      key: 'participants',
      label: 'Participants',
      value: String(item.participantCount),
      icon: Users,
      tone: 'blue',
    });
  }
  if (item.bookedByPhone) {
    metaCards.push({
      key: 'phone',
      label: 'Tél. demandeur',
      value: item.bookedByPhone,
      icon: Phone,
      tone: 'slate',
    });
  }
  if (reviewed) {
    metaCards.push({
      key: 'reviewed',
      label: autoExpired ? 'Expiration' : 'Validation',
      value: formatStamp(reviewed),
      icon: CheckCircle2,
      tone: autoExpired ? 'amber' : 'green',
    });
  }
  if (modifiedAt) {
    metaCards.push({
      key: 'modified',
      label: 'Dernière modification',
      value: formatStamp(modifiedAt),
      icon: Pencil,
      tone: 'amber',
    });
  }
  if (archived) {
    metaCards.push({
      key: 'archived',
      label: 'Archivée',
      value: formatStamp(archived),
      icon: Archive,
      tone: 'slate',
    });
  }

  const hasExtras =
    metaCards.length > 0 ||
    item.equipment.length > 0 ||
    Boolean(item.logisticsNotes) ||
    Boolean(item.assistantNote) ||
    Boolean(item.rejectionReason) ||
    Boolean(item.contactPhone) ||
    Boolean(item.contactEmail);

  return (
    <div className="dg-room-res-row-detail">
      <div className="dg-room-res-row-detail-inner">
        <header className="dg-room-res-row-detail-head">
          <span className="dg-room-res-row-detail-eyebrow">Détail de la réservation</span>
          {canEdit && onEdit ? (
            <button type="button" className="dg-room-res-row-detail-edit" onClick={onEdit}>
              <Pencil className="h-3 w-3" aria-hidden />
              Modifier
            </button>
          ) : null}
        </header>

        {!hasExtras ? (
          <p className="dg-room-res-row-detail-empty">Aucun détail supplémentaire.</p>
        ) : (
          <>
            {metaCards.length > 0 ? (
              <div className="dg-room-res-row-detail-cards">
                {metaCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.key}
                      className={cn(
                        'dg-room-res-row-detail-card',
                        `dg-room-res-row-detail-card--${card.tone}`
                      )}
                    >
                      <span className="dg-room-res-row-detail-card-icon" aria-hidden>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="dg-room-res-row-detail-card-text">
                        <span className="dg-room-res-row-detail-card-label">{card.label}</span>
                        <span className="dg-room-res-row-detail-card-value capitalize">
                          {card.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {item.equipment.length > 0 ? (
              <section className="dg-room-res-row-detail-section">
                <div className="dg-room-res-row-detail-section-title">
                  <Wrench className="h-3 w-3" aria-hidden />
                  Équipements
                </div>
                <div className="dg-room-res-row-detail-tags">
                  {item.equipment.map((eq) => (
                    <span key={eq} className="dg-room-res-row-detail-equip">
                      {equipmentLabel(eq)}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {item.logisticsNotes ? (
              <section className="dg-room-res-row-detail-section">
                <div className="dg-room-res-row-detail-section-title">
                  <ClipboardList className="h-3 w-3" aria-hidden />
                  Note
                </div>
                <p className="dg-room-res-row-detail-note">{item.logisticsNotes}</p>
              </section>
            ) : null}

            {item.assistantNote ? (
              <div className="dg-room-res-row-detail-callout dg-room-res-row-detail-callout--propose">
                <span className="dg-room-res-row-detail-callout-icon" aria-hidden>
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="dg-room-res-row-detail-callout-label">Créneau proposé</p>
                  <p className="dg-room-res-row-detail-callout-text">{item.assistantNote}</p>
                </div>
              </div>
            ) : null}

            {item.rejectionReason ? (
              <div
                className={cn(
                  'dg-room-res-row-detail-callout',
                  autoExpired
                    ? 'dg-room-res-row-detail-callout--expire'
                    : 'dg-room-res-row-detail-callout--reject'
                )}
              >
                <span className="dg-room-res-row-detail-callout-icon" aria-hidden>
                  <AlertCircle className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="dg-room-res-row-detail-callout-label">
                    {autoExpired ? 'Motif d’expiration' : 'Motif de refus'}
                  </p>
                  <p className="dg-room-res-row-detail-callout-text">{item.rejectionReason}</p>
                </div>
              </div>
            ) : null}

            {item.contactPhone || item.contactEmail ? (
              <section className="dg-room-res-row-detail-section">
                <div className="dg-room-res-row-detail-section-title">
                  <Mail className="h-3 w-3" aria-hidden />
                  Contact sur place
                </div>
                <div className="dg-room-res-row-detail-contact">
                  {item.contactPhone ? (
                    <span>
                      <Phone className="h-3 w-3" aria-hidden />
                      {item.contactPhone}
                    </span>
                  ) : null}
                  {item.contactEmail ? (
                    <span>
                      <Mail className="h-3 w-3" aria-hidden />
                      {item.contactEmail}
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
