'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatIsoDate, formatIsoDateInAppTz, formatTimeInAppTz, formatTimeRange } from '@/lib/datetime';
import { CalendarClock, ExternalLink, MapPin, Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { AppointmentApproveDialog } from '@/components/appointments/appointment-approve-dialog';
import { AppointmentRejectDialog } from '@/components/appointments/appointment-reject-dialog';
import {
  AppointmentRescheduleDialog,
  type RescheduleSubmitPayload,
} from '@/components/appointments/appointment-reschedule-dialog';
import { ContactDossierPanel } from '@/components/workspace/contact-dossier-panel';
import { ContactAppointmentDialog } from '@/components/workspace/contact-appointment-dialog';
import { ContactAppointmentPendingActions } from '@/components/workspace/contact-appointment-pending-actions';
import { useTemporalQueryParams } from '@/components/temporal/temporal-navigation-context';
import { useApp } from '@/lib/app-context';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canReviewAppointments, canUseUrgentOverride } from '@/lib/dg/rbac';
import {
  canReviewerEditAppointment,
} from '@/lib/dg/appointment-reschedule-access';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import {
  isContactVisit,
  isUpcomingContactAppointment,
} from '@/lib/workspace/contact-follow-up';
import { toast } from '@/hooks/use-toast';
import type {
  ContactAppointment,
  ContactAppointmentStats,
  StrategicContact,
} from '@/lib/workspace/types';

const STATUS_LABELS: Record<ContactAppointment['status'], string> = {
  PENDING: 'En attente',
  APPROVED: 'Confirmé',
  REJECTED: 'Refusé',
};

const STATUS_CLASS: Record<ContactAppointment['status'], string> = {
  PENDING: 'workspace-contact-rdv-badge--pending',
  APPROVED: 'workspace-contact-rdv-badge--approved',
  REJECTED: 'workspace-contact-rdv-badge--rejected',
};

type DossierTab = 'overview' | 'upcoming' | 'history' | 'documents' | 'notes';
type ListFocus = 'upcoming' | 'pending' | 'done' | 'rejected' | 'all';

type Props = {
  contact: StrategicContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanClick?: () => void;
  refreshTrigger?: number;
  canReview?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onContactsRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function ContactAppointmentsSheet({
  contact,
  open,
  onOpenChange,
  onPlanClick,
  refreshTrigger = 0,
  canReview = false,
  canEdit = false,
  canDelete = false,
  onContactsRefresh,
  onEdit,
  onDelete,
}: Props) {
  const role = useDgRole();
  const { permissions } = useApp();
  const urgentAllowed = canUseUrgentOverride(role);
  const canReviewPending = canReview || canReviewAppointments(role);
  const canEditAppointment = canReviewerEditAppointment(role, permissions, 'PENDING');
  const temporalParams = useTemporalQueryParams();
  const [items, setItems] = useState<ContactAppointment[]>([]);
  const [stats, setStats] = useState<ContactAppointmentStats | null>(null);
  const [contactSnapshot, setContactSnapshot] = useState<StrategicContact | null>(contact);
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<DossierTab>('overview');
  const [listFocus, setListFocus] = useState<ListFocus>('upcoming');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [consultedAt, setConsultedAt] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<AppointmentReviewItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AppointmentReviewItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentReviewItem | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<'approve' | 'reschedule'>('reschedule');
  const [editAppointmentId, setEditAppointmentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contact) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspace/contacts/${contact.id}/appointments?${new URLSearchParams(temporalParams)}`
      );
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.items)) {
        const loadedItems = j.items as ContactAppointment[];
        const loadedStats = (j.stats as ContactAppointmentStats | undefined) ?? null;
        setItems(loadedItems);
        setStats(loadedStats);
        if (j.contact) setContactSnapshot(j.contact as StrategicContact);
      } else {
        setItems([]);
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  }, [contact, temporalParams]);

  useEffect(() => {
    if (open && contact) void load();
  }, [open, contact, load, refreshTrigger]);

  useEffect(() => {
    if (contact) setContactSnapshot(contact);
  }, [contact]);

  useEffect(() => {
    if (!open || !contact) return;
    setDossier('overview');
    setListFocus('upcoming');
    setConsultedAt(new Date());
    setNoteDraft(contact.notes ?? '');
  }, [open, contact]);

  const refreshAll = useCallback(async () => {
    await load();
    onContactsRefresh?.();
  }, [load, onContactsRefresh]);

  const fetchReviewItem = useCallback(async (appointmentId: string) => {
    const res = await fetch(`/api/dg/appointments/${appointmentId}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Impossible de charger le rendez-vous',
        description: j.error === 'FORBIDDEN' ? 'Action non autorisée.' : 'Réessayez.',
      });
      return null;
    }
    return j.item as AppointmentReviewItem;
  }, []);

  const openReviewAction = useCallback(
    async (appointmentId: string, action: 'approve' | 'reject' | 'reschedule') => {
      setActionTargetId(appointmentId);
      try {
        const item = await fetchReviewItem(appointmentId);
        if (!item) return;
        if (action === 'approve') setApproveTarget(item);
        else if (action === 'reject') setRejectTarget(item);
        else {
          setRescheduleMode(item.status === 'APPROVED' ? 'reschedule' : 'approve');
          setRescheduleTarget(item);
        }
      } finally {
        setActionTargetId(null);
      }
    },
    [fetchReviewItem]
  );

  const approve = useCallback(
    async (item: AppointmentReviewItem, slot?: RescheduleSubmitPayload) => {
      setActionLoading(true);
      try {
        const start = new Date(item.startAt);
        const body: Record<string, unknown> = {
          action: 'APPROVE',
          date: slot?.date ?? formatIsoDateInAppTz(start),
          startTime: slot?.startTime ?? formatTimeInAppTz(start),
          endTime: slot?.endTime ?? formatTimeInAppTz(item.endAt),
        };
        if (slot?.urgentOverride) body.urgentOverride = true;
        if (slot && typeof slot.isOnlineMeeting === 'boolean') {
          body.isOnlineMeeting = slot.isOnlineMeeting;
        }

        const res = await fetch(`/api/appointments/${item.id}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Validation échouée',
            description:
              j.error === 'SCHEDULE_CONFLICT'
                ? 'Conflit de planning sur ce créneau.'
                : 'Impossible de valider le rendez-vous.',
          });
          return false;
        }
        toast({
          title: 'Rendez-vous validé',
          description: 'Le créneau est confirmé dans l’agenda DGA.',
        });
        return true;
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  const reject = useCallback(async (item: AppointmentReviewItem, reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Refus échoué',
          description: 'Impossible de refuser ce rendez-vous.',
        });
        return false;
      }
      toast({ title: 'Demande refusée', description: 'Le demandeur sera notifié.' });
      return true;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const reschedule = useCallback(async (item: AppointmentReviewItem, slot: RescheduleSubmitPayload) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          urgentOverride: slot.urgentOverride,
          isOnlineMeeting: slot.isOnlineMeeting,
          keepApproved: item.status === 'APPROVED',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Replanification échouée',
          description:
            j.error === 'SCHEDULE_CONFLICT'
              ? 'Conflit de planning sur ce créneau.'
              : 'Impossible de replanifier.',
        });
        return false;
      }
      toast({
        title: 'Rendez-vous reporté',
        description:
          item.status === 'APPROVED'
            ? 'Le nouveau créneau est validé. Le demandeur a été notifié.'
            : 'Le demandeur a été notifié par e-mail.',
      });
      return true;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const onConfirmApprove = useCallback(async () => {
    if (!approveTarget) return;
    const ok = await approve(approveTarget);
    if (ok) {
      setApproveTarget(null);
      await refreshAll();
    }
  }, [approve, approveTarget, refreshAll]);

  const onRejectSubmit = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      const ok = await reject(rejectTarget, reason);
      if (ok) {
        setRejectTarget(null);
        await refreshAll();
      }
    },
    [reject, rejectTarget, refreshAll]
  );

  const onRescheduleSubmit = useCallback(
    async (slot: RescheduleSubmitPayload) => {
      if (!rescheduleTarget) return;
      const ok = await reschedule(rescheduleTarget, slot);
      if (ok) {
        setRescheduleTarget(null);
        await refreshAll();
      }
    },
    [reschedule, rescheduleTarget, refreshAll]
  );

  const displayContact = contactSnapshot ?? contact;

  const upcomingItems = useMemo(
    () => items.filter((item) => isUpcomingContactAppointment(item)),
    [items]
  );
  const pendingItems = useMemo(
    () => items.filter((item) => item.status === 'PENDING'),
    [items]
  );
  const doneItems = useMemo(() => items.filter((item) => isContactVisit(item)), [items]);
  const rejectedItems = useMemo(
    () => items.filter((item) => item.status === 'REJECTED'),
    [items]
  );
  const listedItems = useMemo(() => {
    if (dossier === 'upcoming') return listFocus === 'pending' ? pendingItems : upcomingItems;
    if (dossier === 'history') {
      if (listFocus === 'done') return doneItems;
      if (listFocus === 'rejected') return rejectedItems;
      return items;
    }
    return [];
  }, [dossier, listFocus, pendingItems, upcomingItems, doneItems, rejectedItems, items]);

  const activities = useMemo(() => {
    if (!displayContact) return [];
    const rows: { id: string; title: string; detail: string; at: string }[] = [];
    if (consultedAt) {
      rows.push({
        id: 'consulted',
        title: 'Contact consulté',
        detail: 'Fiche du contact consultée.',
        at: consultedAt.toISOString(),
      });
    }
    rows.push({
      id: 'created',
      title: 'Contact ajouté',
      detail: "Contact ajouté dans l'annuaire.",
      at: displayContact.createdAt,
    });
    const created = new Date(displayContact.createdAt).getTime();
    const updated = new Date(displayContact.updatedAt).getTime();
    if (Number.isFinite(updated) && updated - created > 60_000) {
      rows.push({
        id: 'updated',
        title: 'Contact modifié',
        detail: 'Fiche du contact mise à jour.',
        at: displayContact.updatedAt,
      });
    }
    for (const item of items) {
      rows.push({
        id: item.id,
        title:
          item.status === 'PENDING'
            ? 'Demande de rendez-vous'
            : item.status === 'REJECTED'
              ? 'Rendez-vous refusé'
              : 'Rendez-vous',
        detail: item.title,
        at: item.startAt,
      });
    }
    return rows
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
  }, [consultedAt, displayContact, items]);

  const openList = (next: DossierTab, focus: ListFocus) => {
    setDossier(next);
    setListFocus(focus);
  };

  const saveNote = async () => {
    if (!displayContact || !canEdit) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/workspace/contacts/${displayContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteDraft.trim() ? noteDraft.trim() : null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Note non enregistrée',
          description: 'Vérifiez le texte puis réessayez.',
        });
        return;
      }
      if (json.contact) setContactSnapshot(json.contact as StrategicContact);
      onContactsRefresh?.();
      toast({ title: 'Note enregistrée' });
    } finally {
      setNoteSaving(false);
    }
  };

  if (!displayContact) return null;

  const renderAppointments = (rows: ContactAppointment[], emptyTitle: string) => {
    if (rows.length === 0) {
  return (
        <div className="workspace-contact-rdv-empty">
          <div className="workspace-contact-rdv-empty-icon" aria-hidden>
            <CalendarClock className="h-6 w-6" />
          </div>
          <p className="workspace-contact-rdv-empty-title">{emptyTitle}</p>
            </div>
      );
    }
    return (
      <ul className="workspace-contact-rdv-timeline">
        {rows.map((item) => {
              const start = new Date(item.startAt);
              const end = new Date(item.endAt);
              const sameDay = formatIsoDate(start) === formatIsoDate(end);
          const dateLabel = formatDate(start, 'd MMM yyyy');
          const timeLabel = sameDay
            ? formatTimeRange(start, end)
            : `${formatDate(start, 'd MMM HH:mm')} – ${formatDate(end, 'd MMM HH:mm')}`;
          const showPendingActions = canReviewPending && item.status === 'PENDING';
          const canEditThis = canEditAppointment && item.status === 'PENDING';
              return (
            <li key={item.id}>
              <article
                className={`workspace-contact-rdv-card${
                  item.status === 'PENDING' ? ' workspace-contact-rdv-card--pending' : ''
                }`}
              >
                <div className="workspace-contact-rdv-card-head">
                  <div className="workspace-contact-rdv-card-date">
                    <span className="workspace-contact-rdv-card-date-day">{formatDate(start, 'd')}</span>
                    <span className="workspace-contact-rdv-card-date-month">{formatDate(start, 'MMM')}</span>
                  </div>
                  <div className="workspace-contact-rdv-card-main">
                    <div className="workspace-contact-rdv-card-title-row">
                      <h3 className="workspace-contact-rdv-card-title">{item.title}</h3>
                      {!showPendingActions ? (
                    <span className={`workspace-contact-rdv-badge ${STATUS_CLASS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                      ) : null}
                  </div>
                    <p className="workspace-contact-rdv-card-when">
                      <span className="capitalize">{dateLabel}</span>
                      <span className="workspace-contact-rdv-card-when-sep">·</span>
                      <span>{timeLabel}</span>
                    </p>
                    {item.location ? (
                      <p className="workspace-contact-rdv-card-location">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        {item.location}
                      </p>
                    ) : null}
                    {!showPendingActions ? (
                      <div className="workspace-contact-rdv-card-links">
                        {canEditThis ? (
                          <button
                            type="button"
                            className="workspace-contact-rdv-edit-btn"
                            onClick={() => setEditAppointmentId(item.id)}
                          >
                            <Pencil className="h-3 w-3 shrink-0" aria-hidden />
                            Modifier
                          </button>
                        ) : null}
                        <Link
                          href={`/dg/appointments?open=${encodeURIComponent(item.id)}`}
                          className="workspace-contact-rdv-detail-link"
                        >
                          Voir le rendez-vous
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  {showPendingActions ? (
                    <div className="workspace-contact-rdv-card-aside">
                      <span className={`workspace-contact-rdv-badge ${STATUS_CLASS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      <ContactAppointmentPendingActions
                        loading={actionTargetId === item.id || actionLoading}
                        canEdit={canEditThis}
                        onApprove={() => void openReviewAction(item.id, 'approve')}
                        onReschedule={() => void openReviewAction(item.id, 'reschedule')}
                        onReject={() => void openReviewAction(item.id, 'reject')}
                        onEdit={() => setEditAppointmentId(item.id)}
                      />
                    </div>
                  ) : null}
                </div>
                </article>
            </li>
          );
        })}
      </ul>
    );
  };

  const listTitle =
    dossier === 'history'
      ? listFocus === 'done'
        ? 'Rendez-vous réalisés'
        : listFocus === 'rejected'
          ? 'Rendez-vous annulés'
          : 'Historique'
      : listFocus === 'pending'
        ? 'Rendez-vous en attente'
        : 'Prochains rendez-vous';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="workspace-contact-rdv-sheet workspace-contact-dossier admin-theme"
      >
        <SheetTitle className="sr-only">
          Suivi des rendez-vous de {displayContact.fullName}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Fiche, rendez-vous et notes de {displayContact.fullName}.
        </SheetDescription>
        <ContactDossierPanel
          contact={displayContact}
          stats={stats}
          loading={loading}
          dossier={dossier}
          listTitle={listTitle}
          upcomingCount={upcomingItems.length}
          activities={activities}
          upcomingList={renderAppointments(upcomingItems.slice(0, 3), 'Aucun rendez-vous à venir')}
          list={renderAppointments(
            listedItems,
            listFocus === 'pending'
              ? 'Aucun rendez-vous en attente'
              : listFocus === 'done'
                ? 'Aucun rendez-vous réalisé'
                : listFocus === 'rejected'
                  ? 'Aucun rendez-vous annulé'
                  : 'Aucun rendez-vous lié'
          )}
          canPlan={Boolean(onPlanClick)}
          canEdit={canEdit}
          canDelete={canDelete}
          noteDraft={noteDraft}
          noteSaving={noteSaving}
          onDossier={(next) => {
            setDossier(next);
            if (next === 'upcoming') setListFocus('upcoming');
            if (next === 'history') setListFocus('all');
          }}
          onOpenList={openList}
          onPlan={onPlanClick}
          onEdit={onEdit}
          onDelete={onDelete}
          onNoteChange={setNoteDraft}
          onSaveNote={() => void saveNote()}
        />
      </SheetContent>

      <AppointmentApproveDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        appointment={approveTarget}
        loading={actionLoading}
        onConfirm={() => void onConfirmApprove()}
      />

      <AppointmentRejectDialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        appointment={rejectTarget}
        loading={actionLoading}
        onSubmit={(reason) => void onRejectSubmit(reason)}
      />

      <AppointmentRescheduleDialog
        open={!!rescheduleTarget}
        onOpenChange={(o) => !o && setRescheduleTarget(null)}
        appointment={rescheduleTarget}
        mode={rescheduleMode}
        validatesNow={rescheduleTarget?.status === 'APPROVED'}
        urgentAllowed={urgentAllowed}
        loading={actionLoading}
        onSubmit={(slot) => void onRescheduleSubmit(slot)}
      />

      <ContactAppointmentDialog
        contact={displayContact}
        open={Boolean(editAppointmentId)}
        editAppointmentId={editAppointmentId}
        onOpenChange={(o) => {
          if (!o) setEditAppointmentId(null);
        }}
        onSuccess={() => {
          setEditAppointmentId(null);
          void refreshAll();
        }}
      />
    </Sheet>
  );
}
