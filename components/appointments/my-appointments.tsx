'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, isFuture } from 'date-fns';
import { DATE_FNS_LOCALE, formatDate, formatTime } from '@/lib/datetime';
import {
  AlertCircle,
  Calendar,
  CalendarCheck2,
  CalendarPlus,
  Clock,
  Eye,
  FileSpreadsheet,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AppointmentRequesterProfileDialog } from '@/components/appointments/appointment-requester-profile-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  APPOINTMENT_IMPORTED_LABEL,
  APPOINTMENT_PRIORITY_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_ONGOING_ARCHIVE_MESSAGE,
  appointmentPriorityBadgeClass,
  appointmentStatusBadgeClass,
  appointmentStatusDotClass,
  isApprovedAppointmentOngoing,
} from '@/lib/dg/appointments-review';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { ownAppointmentActions } from '@/lib/dg/appointment-own-access';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import { cn } from '@/lib/utils';

type MyAppointment = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  createdAt: string;
  status: AppointmentStatus;
  priority: string;
  type: string;
  location: string | null;
  rejectionReason: string | null;
};

type StatusFilter = AppointmentStatus | 'ALL';

type AppointmentSection = {
  id: string;
  label: string;
  hint: string;
  items: MyAppointment[];
};

const STATUS_FILTER: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvés' },
  { value: 'REJECTED', label: 'Refusés' },
];

function statusCount(items: MyAppointment[], status: StatusFilter) {
  if (status === 'ALL') return items.length;
  return items.filter((item) => item.status === status).length;
}

function shortRef(id: string) {
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

function MyAppointmentSkeleton() {
  return (
    <div className="my-appt-skeleton" aria-hidden>
      <div className="my-appt-skeleton-line my-appt-skeleton-line--title" />
      <div className="my-appt-skeleton-line my-appt-skeleton-line--desc" />
      <div className="my-appt-skeleton-row">
        <div className="my-appt-skeleton-pill" />
        <div className="my-appt-skeleton-pill my-appt-skeleton-pill--sm" />
      </div>
    </div>
  );
}

function MyAppointmentCard({
  appointment,
  permissions,
  onDetail,
  onDelete,
}: {
  appointment: MyAppointment;
  permissions: Record<string, boolean>;
  onDetail: (appointment: MyAppointment) => void;
  onDelete: (appointment: MyAppointment) => void;
}) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const created = new Date(appointment.createdAt);
  const { userText, meta } = parseAppointmentMeta(appointment.description);
  const priority = appointment.priority as Priority;
  const type = appointment.type as AppointmentType;
  const statusView = { status: appointment.status, autoRejected: meta.autoRejected };
  const upcoming = appointment.status === 'APPROVED' && isFuture(start);
  const actions = ownAppointmentActions(permissions, appointment.status, 'active', {
    endAt: appointment.endAt,
  });

  return (
    <article className="my-appt-card" data-status={appointment.status}>
      <div className="my-appt-card-accent" aria-hidden />

      <div className="my-appt-card-top">
        <div className="my-appt-card-identity">
          <div className="my-appt-card-title-row">
            <h2 className="my-appt-card-title">{appointment.title}</h2>
            <span className="my-appt-card-ref" title={`Réf. ${appointment.id}`}>
              #{shortRef(appointment.id)}
            </span>
          </div>
          {userText ? <p className="my-appt-card-desc">{userText}</p> : null}
        </div>

        <div className="my-appt-card-status">
          <span className={cn('admin-appt-status-dot', appointmentStatusDotClass(statusView))} />
          <span className={cn('admin-appt-badge', appointmentStatusBadgeClass(appointment.status))}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </span>
        </div>
      </div>

      <div className="my-appt-card-meta-row">
        <div className="my-appt-meta-chip my-appt-meta-chip--primary">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          <span className="my-appt-meta-chip-strong">
            {formatDate(start, 'EEE d MMM yyyy')}
          </span>
          <span className="my-appt-meta-chip-sep" aria-hidden />
          <span>
            {formatTime(start)} – {formatTime(end)}
          </span>
          <span className="my-appt-meta-chip-muted">
            {formatDistanceToNow(start, { addSuffix: true, locale: DATE_FNS_LOCALE })}
          </span>
        </div>

        {appointment.location ? (
          <div className="my-appt-meta-chip">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{appointment.location}</span>
          </div>
        ) : null}

        <div className="my-appt-meta-chip my-appt-meta-chip--ghost">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          <span>
            Demandé le {formatDate(created, 'd MMM yyyy')} · {formatTime(created)}
          </span>
        </div>
      </div>

      <div className="my-appt-card-foot">
        <div className="my-appt-card-tags">
          <span
            className={cn('admin-appt-type-pill', appointmentPriorityBadgeClass(priority))}
          >
            {APPOINTMENT_PRIORITY_LABELS[priority]}
          </span>
          <span className="admin-appt-type-pill">{APPOINTMENT_TYPE_LABELS[type]}</span>
          {upcoming ? (
            <span className="my-appt-upcoming-pill">
              <CalendarCheck2 className="h-3 w-3" aria-hidden />
              Confirmé
            </span>
          ) : null}
          {meta.excelImport ? (
            <span className="admin-appt-import-pill" title="Importé depuis un fichier Excel">
              <FileSpreadsheet className="h-3 w-3" aria-hidden />
              {APPOINTMENT_IMPORTED_LABEL}
            </span>
          ) : null}
        </div>

        <div className="my-appt-card-actions">
          {actions.canDetail ? (
            <button
              type="button"
              className="my-appt-card-action my-appt-card-action--detail"
              onClick={() => onDetail(appointment)}
            >
              <Eye className="h-3 w-3" aria-hidden />
              Détail
            </button>
          ) : null}
          {actions.canEdit ? (
            <Link
              href={`/dg/plan?editId=${encodeURIComponent(appointment.id)}`}
              className="my-appt-card-action my-appt-card-action--edit"
            >
              <Pencil className="h-3 w-3" aria-hidden />
              Modifier
            </Link>
          ) : null}
          {actions.canArchive ? (
            <button
              type="button"
              className="my-appt-card-action my-appt-card-action--delete"
              onClick={() => onDelete(appointment)}
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Corbeille
            </button>
          ) : null}
        </div>
      </div>

      {appointment.status === 'REJECTED' && appointment.rejectionReason ? (
        <div className="my-appt-card-reject" role="note">
          <AlertCircle className="my-appt-card-reject-icon" aria-hidden />
          <div>
            <p className="my-appt-card-reject-label">Motif du refus</p>
            <p className="my-appt-card-reject-text">{appointment.rejectionReason}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function buildSections(items: MyAppointment[], status: StatusFilter): AppointmentSection[] {
  const now = new Date();
  const sortAsc = (a: MyAppointment, b: MyAppointment) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  const sortDesc = (a: MyAppointment, b: MyAppointment) =>
    new Date(b.startAt).getTime() - new Date(a.startAt).getTime();

  if (status !== 'ALL') {
    const sorted = [...items].sort(status === 'PENDING' ? sortAsc : sortDesc);
    return sorted.length
      ? [
          {
            id: status,
            label: STATUS_FILTER.find((f) => f.value === status)?.label ?? '',
            hint: `${sorted.length} demande${sorted.length > 1 ? 's' : ''}`,
            items: sorted,
          },
        ]
      : [];
  }

  const pending = items.filter((i) => i.status === 'PENDING').sort(sortAsc);
  const upcoming = items
    .filter((i) => i.status === 'APPROVED' && new Date(i.startAt) >= now)
    .sort(sortAsc);
  const history = items
    .filter(
      (i) =>
        i.status === 'REJECTED' ||
        (i.status === 'APPROVED' && new Date(i.startAt) < now)
    )
    .sort(sortDesc);

  const sections: AppointmentSection[] = [];
  if (pending.length) {
    sections.push({
      id: 'pending',
      label: 'En attente de validation',
      hint: 'Soumises au cabinet — traitement en cours',
      items: pending,
    });
  }
  if (upcoming.length) {
    sections.push({
      id: 'upcoming',
      label: 'Prochains rendez-vous',
      hint: 'Créneaux confirmés par le cabinet',
      items: upcoming,
    });
  }
  if (history.length) {
    sections.push({
      id: 'history',
      label: 'Historique',
      hint: 'Demandes passées ou refusées',
      items: history,
    });
  }
  return sections;
}

export function MyAppointments() {
  const { permissions } = useApp();
  const [items, setItems] = useState<MyAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [detailItem, setDetailItem] = useState<AppointmentReviewItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MyAppointment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/appointments');
      if (!res.ok) {
        setItems([]);
        return;
      }
      const json = (await res.json()) as { items: MyAppointment[] };
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== 'ALL' && item.status !== status) return false;
      if (!q) return true;
      const { userText } = parseAppointmentMeta(item.description);
      const hay = [
        item.title,
        userText,
        item.status,
        item.priority,
        item.type,
        item.location,
        shortRef(item.id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchQ, status]);

  const sections = useMemo(() => buildSections(visible, status), [visible, status]);

  const openDetail = useCallback(async (appointment: MyAppointment) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/detail`);
      if (!res.ok) throw new Error('LOAD_FAILED');
      const json = (await res.json()) as { item: AppointmentReviewItem };
      setDetailItem(json.item);
    } catch {
      setDetailOpen(false);
      toast({
        title: 'Impossible d’ouvrir le détail',
        description: 'Réessayez ou contactez l’administrateur si le problème persiste.',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (isApprovedAppointmentOngoing(deleteTarget)) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/appointments/${deleteTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error('ARCHIVE_FAILED');
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({
        title: 'Demande déplacée en corbeille',
        description: 'Vous pourrez la restaurer ou la supprimer depuis la corbeille.',
      });
    } catch {
      toast({
        title: 'Mise en corbeille impossible',
        description: 'Seules les demandes en attente ou refusées peuvent être archivées.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget]);

  return (
    <div className="app-page admin-theme my-appt-page">
      <AdminPageHeader
        variant="flat"
        eyebrow="Mes demandes"
        title="Suivi de mes rendez-vous"
        actions={
          <Link
            href="/dg/plan"
            className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--plan"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Planifier un rendez-vous
          </Link>
        }
      />

      <section className="my-appt-toolbar" aria-label="Filtres et recherche">
        <div className="my-appt-toolbar-row">
          <div className="my-appt-filter-tabs" role="tablist" aria-label="Filtrer par statut">
            {STATUS_FILTER.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                data-active={status === filter.value}
                className="my-appt-filter-tab"
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
                <span className="my-appt-filter-tab-count">
                  {statusCount(items, filter.value)}
                </span>
              </button>
            ))}
          </div>

          <div className="my-appt-toolbar-actions">
            <div className="my-appt-search">
              <Search className="my-appt-search-icon" aria-hidden />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Rechercher par titre, motif, lieu…"
                className="my-appt-search-input"
                aria-label="Rechercher une demande"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="my-appt-refresh-btn"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Actualiser la liste"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="my-appt-list" aria-busy="true" aria-label="Chargement des demandes">
          {Array.from({ length: 4 }).map((_, i) => (
            <MyAppointmentSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="my-appt-empty">
          <div className="my-appt-empty-icon-wrap">
            <Inbox className="my-appt-empty-icon" aria-hidden />
          </div>
          <p className="my-appt-empty-title">
            {items.length === 0 ? 'Aucune demande pour le moment' : 'Aucun résultat'}
          </p>
          <p className="my-appt-empty-desc">
            {items.length === 0
              ? 'Soumettez votre première demande de rendez-vous auprès du cabinet du DGA.'
              : 'Affinez votre recherche ou changez le filtre de statut.'}
          </p>
          {items.length === 0 ? (
            <Link
              href="/dg/plan"
              className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--plan my-appt-empty-cta"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
              Planifier un rendez-vous
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearchQ('');
                setStatus('ALL');
              }}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="my-appt-results">
          <div className="my-appt-headbar">
            <p className="my-appt-headbar-count">
              <span className="my-appt-headbar-count-value">{visible.length}</span>
              {visible.length > 1 ? ' demandes affichées' : ' demande affichée'}
            </p>
            <p className="my-appt-headbar-hint">
              {status === 'ALL'
                ? 'Classées par priorité de suivi'
                : `Filtre : ${STATUS_FILTER.find((f) => f.value === status)?.label}`}
            </p>
          </div>

          {sections.map((section) => (
            <section key={section.id} className="my-appt-section" aria-labelledby={`my-appt-${section.id}`}>
              {status === 'ALL' && sections.length > 1 ? (
                <header className="my-appt-section-head">
                  <div>
                    <h2 id={`my-appt-${section.id}`} className="my-appt-section-title">
                      {section.label}
                    </h2>
                    <p className="my-appt-section-hint">{section.hint}</p>
                  </div>
                  <span className="my-appt-section-count">{section.items.length}</span>
                </header>
              ) : null}
              <div className="my-appt-list">
                {section.items.map((appointment) => (
                  <MyAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    permissions={permissions}
                    onDetail={openDetail}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <AppointmentRequesterProfileDialog
        appointment={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        loading={detailLoading}
      />

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null);
        }}
        intent={
          deleteTarget && isApprovedAppointmentOngoing(deleteTarget)
            ? 'blocked'
            : 'archive'
        }
        title={
          deleteTarget && isApprovedAppointmentOngoing(deleteTarget)
            ? 'Mise en corbeille impossible'
            : 'Mettre en corbeille ?'
        }
        message={
          deleteTarget ? (
            isApprovedAppointmentOngoing(deleteTarget) ? (
              <>
                La demande <span className="font-medium text-foreground">{deleteTarget.title}</span> est
                actuellement <span className="font-medium text-foreground">en cours</span>.{' '}
                {APPOINTMENT_ONGOING_ARCHIVE_MESSAGE}
              </>
            ) : (
              <>
                La demande <span className="font-medium text-foreground">{deleteTarget.title}</span> sera
                retirée de votre suivi actif. Vous pourrez la restaurer depuis la corbeille.
              </>
            )
          ) : (
            ''
          )
        }
        confirmLabel="Mettre en corbeille"
        hideConfirm={Boolean(deleteTarget && isApprovedAppointmentOngoing(deleteTarget))}
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
