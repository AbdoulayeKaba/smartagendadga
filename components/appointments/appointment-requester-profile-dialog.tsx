'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Building2,
  Calendar,
  CalendarClock,
  Check,
  FileText,
  LayoutList,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Tag,
  UserRound,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import { PLANNING_URGENT_LABEL } from '@/lib/dg/urgent-slot-priority';
import {
  APPOINTMENT_URGENCY_LABELS,
  appointmentStatusBadgeClassForItem,
  appointmentStatusLabel,
  appointmentUrgencyBadgeClass,
} from '@/lib/dg/appointments-review';
import {
  displayAppointmentModality,
  displayAppointmentRequester,
  displayAppointmentType,
  displayCopyParticipants,
  displayLocation,
  displayMotif,
  displayReservedRoom,
} from '@/lib/dg/appointment-review-display';
import { buildSlotTimeline, parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { ROOM_EQUIPMENT_OPTIONS, ROOM_USAGE_OPTIONS } from '@/lib/dg/room-reservation-form';
import { isAppointmentSlotPast } from '@/lib/dg/appointment-reschedule-access';
import { DATE_FNS_LOCALE, formatDateLong, formatTimeRange } from '@/lib/datetime';
import { AppointmentMailProof } from '@/components/appointments/appointment-mail-proof';
import {
  SLOT_ELAPSED_REMINDERS_LABEL,
  isAppointmentSlotElapsed,
} from '@/lib/dg/appointment-reminder-schedule';
import { cn } from '@/lib/utils';

type Props = {
  appointment: AppointmentReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onApprove?: (item: AppointmentReviewItem) => void;
  onReschedule?: (item: AppointmentReviewItem, mode: 'approve' | 'reschedule') => void;
  onReject?: (item: AppointmentReviewItem) => void;
};

function formatAccountDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy · HH:mm', { locale: fr });
}

function statusAccentClass(status: AppointmentReviewItem['status']) {
  if (status === 'APPROVED') return 'admin-appt-detail-dialog--approved';
  if (status === 'REJECTED') return 'admin-appt-detail-dialog--rejected';
  return 'admin-appt-detail-dialog--pending';
}

const detailBtnBase =
  'admin-appt-detail-btn inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border px-2.5 text-xs font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5';

const detailBtnClose =
  `${detailBtnBase} border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800`;

const detailBtnReject =
  `${detailBtnBase} border-red-500 bg-red-600 text-white hover:border-red-600 hover:bg-red-700`;

const detailBtnReschedule =
  `${detailBtnBase} admin-appt-detail-btn--reschedule border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100 hover:text-amber-900`;

const detailBtnApprove =
  `${detailBtnBase} admin-appt-detail-btn--approve border-emerald-700 bg-emerald-600 text-white hover:border-emerald-800 hover:bg-emerald-700`;

export function AppointmentRequesterProfileDialog({
  appointment,
  open,
  onOpenChange,
  loading = false,
  onApprove,
  onReschedule,
  onReject,
}: Props) {
  const { userText, meta } = parseAppointmentMeta(appointment?.description ?? null);
  const description = userText.trim();
  const justification = meta.justification?.trim();
  const reservedRoom =
    appointment != null
      ? displayReservedRoom(appointment) ??
        (meta.roomReserved ? meta.roomName?.trim() || displayLocation(appointment) : null)
      : null;
  const roomUsageLabel = meta.roomUsageType
    ? ROOM_USAGE_OPTIONS.find((o) => o.value === meta.roomUsageType)?.label ?? meta.roomUsageType
    : null;
  const roomEquipmentLabels = (meta.roomEquipment ?? []).map(
    (value) => ROOM_EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
  const modality = appointment ? displayAppointmentModality(appointment) : null;
  const ModalityIcon = modality?.online ? Video : Building2;
  const teamsUrl = appointment?.teamsMeetingUrl?.trim() || null;
  const appointmentTypeLabel = appointment ? displayAppointmentType(appointment) : '—';
  const locationLabel = appointment ? displayLocation(appointment) : '—';
  const motifLabel = appointment ? displayMotif(appointment) : '—';
  const slotTimeline =
    appointment == null
      ? []
      : appointment.slotTimeline && appointment.slotTimeline.length > 0
        ? appointment.slotTimeline
        : buildSlotTimeline({
            description: appointment.description,
            currentStart: appointment.startAt,
            currentEnd: appointment.endAt,
          });
  const slotChanged = slotTimeline.length > 1;
  const slotPast = appointment ? isAppointmentSlotPast(appointment) : false;
  const statedRequester = appointment ? displayAppointmentRequester(appointment) : null;
  const copyParticipants = appointment ? displayCopyParticipants(appointment) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'admin-theme admin-appt-detail-dialog admin-appt-detail-sheet gap-0 border-[var(--admin-border)] p-0',
          appointment ? statusAccentClass(appointment.status) : null
        )}
      >
        <div className="admin-appt-detail-shell">
          <SheetHeader className="admin-appt-detail-header">
            <div className="admin-appt-detail-header-main">
              <div className="admin-appt-detail-header-icon" aria-hidden>
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="admin-appt-detail-header-title">Détail du rendez-vous</SheetTitle>
                <SheetDescription className="sr-only">
                  Consultation de la demande, du créneau et du profil demandeur.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {loading && !appointment ? (
            <div className="admin-appt-detail-body flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="sr-only">Chargement du rendez-vous</span>
            </div>
          ) : null}

          {appointment?.requestedBy ? (
            <>
              <div className="admin-appt-detail-body">
                <section className="admin-appt-detail-hero">
                  <div className="admin-appt-detail-hero-top">
                    <h2 className="admin-appt-detail-title">{appointment.title}</h2>
                    <div className="admin-appt-detail-badges">
                      <span
                        className={cn('admin-appt-badge', appointmentStatusBadgeClassForItem(appointment))}
                      >
                        {appointmentStatusLabel(appointment)}
                      </span>
                      <span
                        className={cn(
                          'admin-appt-badge',
                          appointmentUrgencyBadgeClass(appointment.urgencyLevel)
                        )}
                      >
                        {APPOINTMENT_URGENCY_LABELS[appointment.urgencyLevel]}
                      </span>
                      {appointment.urgentOverride ? (
                        <span className="admin-appt-urgent-pill">
                          <Zap className="h-3 w-3" aria-hidden />
                          {PLANNING_URGENT_LABEL}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {appointment.createdAt ? (
                    <p className="admin-appt-detail-hero-meta">
                      Demande{' '}
                      {formatDistanceToNow(new Date(appointment.createdAt), {
                        addSuffix: true,
                        locale: DATE_FNS_LOCALE,
                      })}
                    </p>
                  ) : null}
                </section>

                {appointment.status === 'APPROVED' &&
                !appointment.archived &&
                isAppointmentSlotElapsed(new Date(appointment.startAt)) ? (
                  <p className="admin-appt-slot-elapsed" role="status">
                    <CalendarClock className="admin-appt-slot-elapsed-icon" aria-hidden />
                    {SLOT_ELAPSED_REMINDERS_LABEL}
                  </p>
                ) : null}

                {(appointment.status === 'APPROVED' || appointment.status === 'REJECTED') &&
                !appointment.archived ? (
                  <AppointmentMailProof appointmentId={appointment.id} />
                ) : null}

                {justification ? (
                  <section className="admin-appt-detail-callout admin-appt-detail-callout--urgency">
                    <p className="admin-appt-detail-label">
                      <Zap className="admin-appt-detail-label-icon" aria-hidden />
                      Justification de l&apos;urgence
                    </p>
                    <p className="admin-appt-detail-desc admin-appt-detail-desc--urgency">
                      {justification}
                    </p>
                  </section>
                ) : null}

                <section className="admin-appt-detail-meta-grid">
                  <div className="admin-appt-detail-meta-item">
                    <p className="admin-appt-detail-label">
                      <ModalityIcon className="admin-appt-detail-label-icon" aria-hidden />
                      Choix
                    </p>
                    <p className="admin-appt-detail-meta-value">
                      {modality ? (
                        <span
                          className={cn(
                            'admin-appt-detail-modality',
                            modality.online
                              ? 'admin-appt-detail-modality--online'
                              : 'admin-appt-detail-modality--onsite'
                          )}
                        >
                          <strong>{modality.label}</strong>
                          <span className="admin-appt-detail-modality-hint">{modality.hint}</span>
                        </span>
                      ) : (
                        <span className="admin-appt-detail-meta-empty">—</span>
                      )}
                    </p>
                  </div>
                  <div className="admin-appt-detail-meta-item">
                    <p className="admin-appt-detail-label">
                      <LayoutList className="admin-appt-detail-label-icon" aria-hidden />
                      Type de rendez-vous
                    </p>
                    <p className="admin-appt-detail-meta-value">
                      {appointmentTypeLabel !== '—' ? (
                        appointmentTypeLabel
                      ) : (
                        <span className="admin-appt-detail-meta-empty">—</span>
                      )}
                    </p>
                  </div>
                  <div className="admin-appt-detail-meta-item">
                    <p className="admin-appt-detail-label">
                      <MapPin className="admin-appt-detail-label-icon" aria-hidden />
                      Emplacement
                    </p>
                    <p className="admin-appt-detail-meta-value">
                      {locationLabel !== '—' ? (
                        locationLabel
                      ) : (
                        <span className="admin-appt-detail-meta-empty">—</span>
                      )}
                    </p>
                  </div>
                  <div className="admin-appt-detail-meta-item">
                    <p className="admin-appt-detail-label">
                      <Tag className="admin-appt-detail-label-icon" aria-hidden />
                      Motif
                    </p>
                    <p className="admin-appt-detail-meta-value">
                      {motifLabel !== '—' ? (
                        motifLabel
                      ) : (
                        <span className="admin-appt-detail-meta-empty">—</span>
                      )}
                    </p>
                  </div>
                  {modality?.online && teamsUrl ? (
                    <a
                      href={teamsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-appt-detail-teams-link admin-appt-detail-teams-note"
                    >
                      Rejoindre Microsoft Teams
                    </a>
                  ) : modality?.online ? (
                    <p className="admin-appt-detail-teams-pending admin-appt-detail-teams-note">
                      Lien Teams généré à la validation
                    </p>
                  ) : null}
                </section>

                {reservedRoom && reservedRoom !== '—' ? (
                  <section className="admin-appt-detail-room">
                    <div className="admin-appt-detail-room-head">
                      <Building2 className="admin-appt-detail-room-icon" aria-hidden />
                      <div className="admin-appt-detail-room-main">
                        <span className="admin-appt-detail-room-kicker">Salle réservée</span>
                        <strong className="admin-appt-detail-room-name">{reservedRoom}</strong>
                      </div>
                      <div className="admin-appt-detail-room-tags">
                        <span className="admin-appt-detail-room-badge">Demande de salle</span>
                        {roomUsageLabel ? (
                          <span className="admin-appt-detail-room-badge admin-appt-detail-room-badge--muted">
                            {roomUsageLabel}
                          </span>
                        ) : null}
                      </div>
                      <span className="admin-appt-detail-room-hint">
                        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                        {formatTimeRange(appointment.startAt, appointment.endAt)}
                      </span>
                    </div>
                    {roomEquipmentLabels.length > 0 ? (
                      <div className="admin-appt-detail-room-equip" aria-label="Équipements">
                        {roomEquipmentLabels.map((label) => (
                          <span key={label} className="admin-appt-detail-room-equip-tag">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {slotChanged ? (
                  <section className="admin-appt-detail-slot-panel" aria-label="Historique des créneaux">
                    <p className="admin-appt-detail-label">
                      <Calendar className="admin-appt-detail-label-icon" aria-hidden />
                      Créneau
                    </p>
                    <ol className="admin-appt-detail-slot-change admin-appt-detail-slot-change--scroll">
                      {slotTimeline.slice(0, -1).map((slot, index) => (
                        <li key={`${slot.startAt}-${slot.endAt}-${index}`} className="admin-appt-detail-slot-change-row">
                          <span className="admin-appt-detail-slot-change-kicker">
                            {index === 0 ? 'Créneau demandé' : `Report ${index}`}
                          </span>
                          <span className="admin-appt-detail-slot-change-initial capitalize">
                            {formatDateLong(slot.startAt)}
                            <span className="admin-appt-detail-side-sep" aria-hidden>
                              ·
                            </span>
                            {formatTimeRange(slot.startAt, slot.endAt)}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {slotTimeline[slotTimeline.length - 1] ? (
                      <div className="admin-appt-detail-slot-change-row admin-appt-detail-slot-change-row--current">
                        <span className="admin-appt-detail-slot-change-kicker admin-appt-detail-slot-change-kicker--kept">
                          En place
                        </span>
                        <span className="admin-appt-detail-side-value capitalize">
                          {formatDateLong(slotTimeline[slotTimeline.length - 1].startAt)}
                          <span className="admin-appt-detail-side-sep" aria-hidden>
                            ·
                          </span>
                          <span className="admin-appt-detail-side-muted">
                            {formatTimeRange(
                              slotTimeline[slotTimeline.length - 1].startAt,
                              slotTimeline[slotTimeline.length - 1].endAt
                            )}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section
                  className={cn(
                    'admin-appt-detail-side-grid',
                    slotChanged && 'admin-appt-detail-side-grid--single'
                  )}
                >
                  {slotChanged ? null : (
                  <div className="admin-appt-detail-side-item">
                    <p className="admin-appt-detail-label">
                      <Calendar className="admin-appt-detail-label-icon" aria-hidden />
                      Créneau
                    </p>
                    <p className="admin-appt-detail-side-value capitalize">
                      {formatDateLong(appointment.startAt)}
                      <span className="admin-appt-detail-side-sep" aria-hidden>
                        ·
                      </span>
                      <span className="admin-appt-detail-side-muted">
                        {formatTimeRange(appointment.startAt, appointment.endAt)}
                      </span>
                    </p>
                  </div>
                  )}
                  <div className="admin-appt-detail-side-item">
                    <p className="admin-appt-detail-label">
                      <UserRound className="admin-appt-detail-label-icon" aria-hidden />
                      Demandeur
                    </p>
                    {statedRequester ? (
                      <>
                        <p className="admin-appt-detail-side-value">{statedRequester.name}</p>
                        <div className="admin-appt-detail-side-contacts">
                          {statedRequester.email ? (
                            <p className="admin-appt-detail-side-sub">
                              <Mail className="admin-appt-detail-side-icon" aria-hidden />
                              <a href={`mailto:${statedRequester.email}`} className="hover:underline">
                                {statedRequester.email}
                              </a>
                            </p>
                          ) : null}
                          {statedRequester.phone ? (
                            <p className="admin-appt-detail-side-sub">
                              <Phone className="admin-appt-detail-side-icon" aria-hidden />
                              <a href={`tel:${statedRequester.phone}`} className="hover:underline">
                                {statedRequester.phone}
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="admin-appt-detail-side-value admin-appt-detail-side-muted">
                        Coordonnées non renseignées.
                      </p>
                    )}
                  </div>
                </section>

                <section className="admin-appt-detail-card admin-appt-detail-card--desc">
                  <p className="admin-appt-detail-label">
                    <FileText className="admin-appt-detail-label-icon" aria-hidden />
                    Description
                  </p>
                  <div className="admin-appt-detail-desc-panel">
                    {description ? (
                      <p className="admin-appt-detail-desc">{description}</p>
                    ) : (
                      <p className="admin-appt-detail-desc admin-appt-detail-desc--empty">
                        Aucune description fournie.
                      </p>
                    )}
                  </div>
                </section>

                <section className="admin-appt-detail-card">
                  <p className="admin-appt-detail-label">
                    <Users className="admin-appt-detail-label-icon" aria-hidden />
                    Participants ({copyParticipants.length})
                  </p>
                  {copyParticipants.length > 0 ? (
                    <ul className="admin-appt-detail-participants">
                      {copyParticipants.map((p) => (
                        <li key={p.id}>
                          <a href={`mailto:${p.email}`} className="admin-appt-detail-participant">
                            <Mail className="admin-appt-detail-participant-icon" aria-hidden />
                            <span>{p.email}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-appt-detail-desc admin-appt-detail-desc--empty">
                      Aucun participant en copie.
                    </p>
                  )}
                </section>

                {appointment.status === 'REJECTED' && appointment.rejectionReason ? (
                  <section className="admin-appt-detail-reject">
                    <p className="admin-appt-detail-label">Motif du refus</p>
                    <p className="admin-appt-detail-desc">{appointment.rejectionReason}</p>
                  </section>
                ) : null}

                {appointment.archived && appointment.archivedAt ? (
                  <section className="admin-appt-detail-card admin-appt-detail-card--muted">
                    <p className="admin-appt-detail-label">
                      <Building2 className="admin-appt-detail-label-icon" aria-hidden />
                      Corbeille
                    </p>
                    <p className="admin-appt-detail-value tabular-nums">
                      Mis en corbeille le {formatAccountDate(appointment.archivedAt)}
                    </p>
                  </section>
                ) : null}
              </div>

              {appointment.status === 'PENDING' && !appointment.archived && onApprove ? (
                <footer className="admin-appt-detail-footer">
                  <button
                    type="button"
                    className={detailBtnClose}
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Fermer
                  </button>
                  <div className="admin-appt-detail-footer-actions">
                    {onReject && !slotPast ? (
                      <button
                        type="button"
                        className={detailBtnReject}
                        disabled={loading}
                        onClick={() => onReject(appointment)}
                      >
                        {loading ? <Loader2 className="animate-spin" /> : null}
                        Refuser
                      </button>
                    ) : null}
                    {onReschedule && !slotPast ? (
                      <button
                        type="button"
                        className={detailBtnReschedule}
                        disabled={loading}
                        onClick={() => onReschedule(appointment, 'approve')}
                      >
                        <CalendarClock />
                        Changer le créneau
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={detailBtnApprove}
                      disabled={loading}
                      onClick={() => onApprove?.(appointment)}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Check />}
                      Approuver
                    </button>
                  </div>
                </footer>
              ) : appointment.status === 'APPROVED' && !appointment.archived ? (
                <footer className="admin-appt-detail-footer">
                  <button
                    type="button"
                    className={detailBtnClose}
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Fermer
                  </button>
                  <div className="admin-appt-detail-footer-actions">
                    {onReject && !slotPast ? (
                      <button
                        type="button"
                        className={detailBtnReject}
                        disabled={loading}
                        onClick={() => onReject(appointment)}
                      >
                        Annuler
                      </button>
                    ) : null}
                    {onReschedule && !slotPast ? (
                      <button
                        type="button"
                        className={detailBtnReschedule}
                        disabled={loading}
                        onClick={() => onReschedule(appointment, 'reschedule')}
                      >
                        <CalendarClock />
                        Reporter
                      </button>
                    ) : null}
                  </div>
                </footer>
              ) : (
                <footer className="admin-appt-detail-footer">
                  <button
                    type="button"
                    className={detailBtnClose}
                    onClick={() => onOpenChange(false)}
                  >
                    Fermer
                  </button>
                </footer>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
