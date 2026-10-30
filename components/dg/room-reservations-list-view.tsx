'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  Clock,
  Download,
  Eye,
  EyeOff,
  LayoutList,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import { RoomReservationEditDialog } from '@/components/dg/room-reservation-edit-dialog';
import { RoomReservationProposeDialog } from '@/components/dg/room-reservation-propose-dialog';
import { RoomReservationRejectDialog } from '@/components/dg/room-reservation-reject-dialog';
import { RoomReservationRowActions } from '@/components/dg/room-reservation-row-actions';
import { RoomReservationRowDetailPanel } from '@/components/dg/room-reservation-row-detail-panel';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_MY_RESERVATIONS_LINK_LABEL,
  DG_ROOM_RESERVATIONS_LINK_LABEL,
  DG_ROOM_SLOTS_LABEL,
} from '@/lib/dg/meeting-room-config';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { ExportFormatMenuContent } from '@/components/ui/export-format-menu';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  downloadRoomReservationsExcel,
  printRoomReservationsPdf,
} from '@/lib/dg/room-reservations-export-utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { formatDate, formatIsoDateInAppTz, formatTimeInAppTz, DATE_FNS_LOCALE } from '@/lib/datetime';
import {
  ROOM_BOOKING_ORIGIN_LABELS,
  ROOM_RESERVATION_AUTO_EXPIRED_LABEL,
  ROOM_RESERVATION_STATUS_LABELS,
  ROOM_USAGE_LABELS,
  roomReservationWasModified,
  type RoomReservationReviewItem,
  type RoomReservationStatus,
} from '@/lib/dg/room-reservation-review';
import {
  buildRoomLiveStatusFingerprint,
  collectRoomReservationTransitionTimes,
  isRoomAutoExpiredPendingReason,
  resolveLiveRoomReservationStatus,
  resolveRoomLiveClockIntervalMs,
  ROOM_AUTO_EXPIRE_PENDING_REASON,
} from '@/lib/dg/room-reservation-expiry';
import { canEditRoomReservation } from '@/lib/dg/room-reservation-form';
import { canReviewRoomReservations } from '@/lib/dg/rbac';
import { computeRoomReservationAnalytics } from '@/lib/dg/room-reservation-analytics';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { rangeOverlapsYear } from '@/lib/temporal/year-range';
import { useLiveClock, useScheduledRefresh } from '@/lib/dg/live-refresh';
import { cn } from '@/lib/utils';

const RoomReservationsChartsPanel = dynamic(
  () =>
    import('@/components/dg/room-reservations-charts-panel').then(
      (mod) => mod.RoomReservationsChartsPanel
    ),
  { ssr: false }
);

const RoomReservationsOwnChartsPanel = dynamic(
  () =>
    import('@/components/dg/room-reservations-own-charts-panel').then(
      (mod) => mod.RoomReservationsOwnChartsPanel
    ),
  { ssr: false }
);

type StatusFilter = 'ALL' | RoomReservationStatus;
type ListTab = 'active' | 'trash';

const CHARTS_VISIBILITY_KEY = 'dg.room-res.charts.panel.visible';

function readChartsVisible(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(CHARTS_VISIBILITY_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

type ConfirmAction =
  | { type: 'approve'; item: RoomReservationReviewItem }
  | { type: 'cancel'; item: RoomReservationReviewItem }
  | { type: 'archive'; item: RoomReservationReviewItem }
  | { type: 'restore'; item: RoomReservationReviewItem }
  | { type: 'delete'; item: RoomReservationReviewItem };

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Toutes' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'CONFIRMED', label: 'Confirmées' },
  { id: 'COMPLETED', label: 'Terminées' },
  { id: 'REJECTED', label: 'Refusées' },
  { id: 'CANCELLED', label: 'Annulées' },
];

function shortAppointmentRef(id: string) {
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

function formatSlot(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return {
    date: formatDate(start, 'EEE d MMM yyyy'),
    time: `${formatTimeInAppTz(start)} – ${formatTimeInAppTz(end)}`,
    relative: formatDistanceToNow(start, { addSuffix: true, locale: DATE_FNS_LOCALE }),
  };
}

function formatSubmitted(createdAt: string) {
  const at = new Date(createdAt);
  return {
    date: formatDate(at, 'EEE d MMM yyyy'),
    time: formatTimeInAppTz(at),
    relative: formatDistanceToNow(at, { addSuffix: true, locale: DATE_FNS_LOCALE }),
  };
}

function formatModified(updatedAt: string) {
  const at = new Date(updatedAt);
  return {
    date: formatDate(at, 'EEE d MMM yyyy'),
    time: formatTimeInAppTz(at),
    relative: formatDistanceToNow(at, { addSuffix: true, locale: DATE_FNS_LOCALE }),
  };
}

function statusBadgeClass(status: RoomReservationStatus, autoExpired?: boolean) {
  if (autoExpired) return 'admin-appt-badge admin-appt-badge-auto-rejected';
  switch (status) {
    case 'PENDING':
      return 'admin-appt-badge admin-appt-badge-pending';
    case 'CONFIRMED':
      return 'admin-appt-badge admin-appt-badge-approved';
    case 'COMPLETED':
      return 'admin-appt-badge admin-appt-badge-approved-past';
    case 'REJECTED':
      return 'admin-appt-badge admin-appt-badge-rejected';
    case 'CANCELLED':
      return 'admin-appt-badge admin-appt-badge-auto-rejected';
    default:
      return 'admin-appt-badge';
  }
}

function resolveItemLiveStatus(item: RoomReservationReviewItem, now: Date) {
  return resolveLiveRoomReservationStatus(item, now);
}

function statusLabel(item: RoomReservationReviewItem, liveStatus?: RoomReservationStatus, autoExpired?: boolean) {
  if (isAppointmentOccupancy(item)) {
    const status = liveStatus ?? item.status;
    if (status === 'COMPLETED') return 'Audience terminée';
    return status === 'CONFIRMED' ? 'Audience confirmée' : 'Audience en attente';
  }
  if (
    autoExpired ||
    (liveStatus === 'REJECTED' && isRoomAutoExpiredPendingReason(item.rejectionReason))
  ) {
    return ROOM_RESERVATION_AUTO_EXPIRED_LABEL;
  }
  return ROOM_RESERVATION_STATUS_LABELS[liveStatus ?? item.status];
}

function matchesSearch(item: RoomReservationReviewItem, q: string) {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return [
    item.title,
    item.roomName,
    item.bookedByName,
    item.organizerService,
    item.source === 'appointment' ? 'audience dga agenda' : 'réservation',
    item.bookingOrigin === 'APPOINTMENT'
      ? 'demande rdv rendez-vous'
      : item.bookingOrigin === 'SLOT'
        ? 'créneau salle'
        : '',
    ROOM_USAGE_LABELS[item.usageType],
    ROOM_RESERVATION_STATUS_LABELS[item.status],
    ROOM_RESERVATION_AUTO_EXPIRED_LABEL,
  ].some((v) => v.toLowerCase().includes(needle));
}

function isAppointmentOccupancy(item: RoomReservationReviewItem) {
  return item.source === 'appointment';
}

function buildAvailabilityHref(item: RoomReservationReviewItem) {
  const date = item.startAt.slice(0, 10);
  return `/dg/availability?roomId=${encodeURIComponent(item.roomId)}&date=${date}`;
}

function isCancellable(status: RoomReservationStatus) {
  return status === 'PENDING' || status === 'CONFIRMED';
}

function isReservationRow(item: RoomReservationReviewItem) {
  return item.source !== 'appointment';
}

function formatPeriodDay(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function slotDayInPeriod(startAt: string, from: string, to: string) {
  const day = formatIsoDateInAppTz(startAt);
  const start = from && to ? (from > to ? to : from) : from || to;
  const end = from && to ? (from > to ? from : to) : from || to;
  return day >= start && day <= end;
}

function periodLabel(dateFrom: string, dateTo: string, todayOnly: boolean) {
  if (todayOnly) return "Aujourd'hui";
  if (!dateFrom && !dateTo) return null;
  if (dateFrom && dateTo && dateFrom !== dateTo) {
    const start = dateFrom > dateTo ? dateTo : dateFrom;
    const end = dateFrom > dateTo ? dateFrom : dateTo;
    return `${formatPeriodDay(start)} – ${formatPeriodDay(end)}`;
  }
  return formatPeriodDay(dateFrom || dateTo);
}

export function RoomReservationsListView({
  scope = 'review',
}: {
  /** `own` = réservations de l’utilisateur connecté uniquement. */
  scope?: 'review' | 'own';
}) {
  const isOwnScope = scope === 'own';
  const { currentUser, permissions } = useApp();
  const role = useDgRole();
  const { year } = useTemporalNavigation();
  const canReviewRole = canReviewRoomReservations(role);
  const canReview = canReviewRole && !isOwnScope;
  const canDeletePermanent = !isOwnScope && permissions['action.room_reservations.delete'] === true;
  const [allItems, setAllItems] = useState<RoomReservationReviewItem[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [listTab, setListTab] = useState<ListTab>('active');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RoomReservationReviewItem | null>(null);
  const [proposeTarget, setProposeTarget] = useState<RoomReservationReviewItem | null>(null);
  const [editTarget, setEditTarget] = useState<RoomReservationReviewItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [exportedAt, setExportedAt] = useState('');

  useEffect(() => {
    setChartsVisible(readChartsVisible());
  }, []);

  const toggleChartsVisible = () => {
    setChartsVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CHARTS_VISIBILITY_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'ALL' });
      if (isOwnScope) {
        params.set('mine', '1');
      } else {
        params.set('archived', listTab === 'trash' ? 'true' : 'false');
      }
      const res = await fetch(`/api/dg/room-reservations?${params}`);
      if (!res.ok) {
        setAllItems([]);
        setTrashCount(0);
        return;
      }
      const json = (await res.json()) as {
        items: RoomReservationReviewItem[];
        stats?: { trash: number };
      };
      // Mes réservations : uniquement les réservations salles du compte connecté
      // (jamais les occupations agenda / créneaux issus des RDV).
      const items = isOwnScope
        ? json.items.filter(
            (item) =>
              item.source !== 'appointment' &&
              Boolean(item.bookedById) &&
              item.bookedById === currentUser.id
          )
        : json.items.filter((item) => item.source !== 'appointment');
      setAllItems(items);
      setTrashCount(isOwnScope ? 0 : (json.stats?.trash ?? 0));
    } finally {
      setLoading(false);
    }
  }, [listTab, isOwnScope, currentUser.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!expandedId) return;
    if (!loading && !allItems.some((i) => i.id === expandedId)) {
      setExpandedId(null);
    }
  }, [allItems, expandedId, loading]);

  useEffect(() => {
    setExpandedId(null);
  }, [listTab, statusFilter, q, dateFrom, dateTo, todayOnly]);

  const toggleDetail = (item: RoomReservationReviewItem) => {
    setExpandedId((id) => (id === item.id ? null : item.id));
  };

  const transitionTimes = useMemo(
    () => collectRoomReservationTransitionTimes(allItems),
    [allItems]
  );
  const liveClockIntervalMs = useMemo(
    () => resolveRoomLiveClockIntervalMs(allItems),
    [allItems]
  );
  const liveNow = useLiveClock({ intervalMs: liveClockIntervalMs });
  useScheduledRefresh(() => void load(), transitionTimes);

  const liveStatusFingerprint = useMemo(
    () => buildRoomLiveStatusFingerprint(allItems, liveNow),
    [allItems, liveNow]
  );

  const yearItems = useMemo(() => {
    const mapLive = (item: RoomReservationReviewItem) => {
      const live = resolveItemLiveStatus(item, liveNow);
      return {
        ...item,
        status: live.status,
        rejectionReason:
          live.autoExpired && !item.rejectionReason
            ? ROOM_AUTO_EXPIRE_PENDING_REASON
            : item.rejectionReason,
        liveStatus: live.status,
        autoExpired: live.autoExpired,
      };
    };
    return isOwnScope
      ? allItems.map(mapLive)
      : allItems
          .filter((item) => rangeOverlapsYear(item.startAt, item.endAt, year))
          .map(mapLive);
    // liveStatusFingerprint stabilise le recalcul : pas de re-render graphe si rien n’a changé
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveNow lu via fingerprint
  }, [allItems, year, isOwnScope, liveStatusFingerprint]);

  const todayIso = formatIsoDateInAppTz(liveNow);
  const datedItems = useMemo(() => {
    if (todayOnly) {
      return yearItems.filter((item) => formatIsoDateInAppTz(item.startAt) === todayIso);
    }
    if (!dateFrom && !dateTo) return yearItems;
    return yearItems.filter((item) => slotDayInPeriod(item.startAt, dateFrom, dateTo));
  }, [yearItems, dateFrom, dateTo, todayOnly, todayIso]);

  const reservationItems = useMemo(
    () => (listTab === 'trash' ? datedItems : datedItems.filter(isReservationRow)),
    [datedItems, listTab]
  );

  const stats = useMemo(
    () => ({
      total: reservationItems.length,
      pending: reservationItems.filter((i) => i.status === 'PENDING').length,
      confirmed: reservationItems.filter((i) => i.status === 'CONFIRMED').length,
      completed: reservationItems.filter((i) => i.status === 'COMPLETED').length,
      rejected: reservationItems.filter((i) => i.status === 'REJECTED').length,
      cancelled: reservationItems.filter((i) => i.status === 'CANCELLED').length,
    }),
    [reservationItems]
  );

  const dateFilterActive = Boolean(dateFrom || dateTo || todayOnly);

  const filteredItems = useMemo(() => {
    const items = datedItems
      .filter((item) => (isOwnScope || listTab === 'active' ? isReservationRow(item) : true))
      .filter((item) =>
        listTab === 'trash' ? true : statusFilter === 'ALL' ? true : item.status === statusFilter
      )
      .filter((item) => matchesSearch(item, q));
    return items.sort((a, b) => {
      const delta = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return dateFilterActive ? delta : -delta;
    });
  }, [datedItems, statusFilter, q, listTab, isOwnScope, dateFilterActive]);

  useEffect(() => {
    if (!loading) {
      setExportedAt(format(new Date(), 'd MMM yyyy à HH:mm', { locale: DATE_FNS_LOCALE }));
    }
  }, [filteredItems.length, loading]);

  const tabCounts = useMemo(
    () => ({
      ALL: reservationItems.length,
      PENDING: stats.pending,
      CONFIRMED: stats.confirmed,
      COMPLETED: stats.completed,
      REJECTED: stats.rejected,
      CANCELLED: stats.cancelled,
    }),
    [reservationItems.length, stats]
  );

  const analytics = useMemo(
    () => computeRoomReservationAnalytics(yearItems, isOwnScope ? undefined : year),
    [yearItems, isOwnScope, year]
  );
  const postDecision = async (
    item: RoomReservationReviewItem,
    action: 'APPROVE' | 'REJECT' | 'CANCEL',
    reason?: string
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dg/room-reservations/${item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason || undefined }),
      });
      const raw = await res.text();
      let json: { message?: string } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as { message?: string };
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) {
        toast({
          title: 'Action impossible',
          description: json.message ?? 'La demande n’a pas pu être traitée.',
          variant: 'destructive',
        });
        return false;
      }
      const labels = {
        APPROVE: 'Réservation confirmée',
        REJECT: 'Demande refusée',
        CANCEL: 'Réservation annulée',
      } as const;
      toast({ title: labels[action], description: item.title });
      await load();
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const runReject = async (reason: string) => {
    if (!rejectTarget) return;
    if (reason.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Motif requis',
        description: 'Indiquez le motif du refus (3 caractères minimum).',
      });
      return;
    }
    const ok = await postDecision(rejectTarget, 'REJECT', reason);
    if (ok) setRejectTarget(null);
  };

  const patchArchived = async (item: RoomReservationReviewItem, archived: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dg/room-reservations/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: archived ? 'Mise en corbeille impossible' : 'Restauration impossible',
          description:
            j.error === 'NOT_ARCHIVED'
              ? 'La réservation doit d’abord être dans la corbeille.'
              : j.error === 'ALREADY_ARCHIVED'
                ? 'Cette réservation est déjà dans la corbeille.'
                : 'Action non effectuée.',
        });
        return false;
      }
      toast({
        title: archived ? 'Réservation déplacée dans la corbeille' : 'Réservation restaurée',
        description: item.title,
      });
      await load();
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const deletePermanent = async (item: RoomReservationReviewItem) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dg/room-reservations/${item.id}`, { method: 'DELETE' });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Suppression impossible',
          description:
            j.error === 'NOT_ARCHIVED'
              ? 'La réservation doit d’abord être dans la corbeille.'
              : 'Action non effectuée.',
        });
        return false;
      }
      toast({ title: 'Réservation supprimée définitivement', description: item.title });
      await load();
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const emptyTrash = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/dg/room-reservations/trash', { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { purged?: number };
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Impossible de vider la corbeille' });
        return;
      }
      toast({
        title: 'Corbeille vidée',
        description: `${j.purged ?? 0} réservation${(j.purged ?? 0) > 1 ? 's' : ''} supprimée${(j.purged ?? 0) > 1 ? 's' : ''}.`,
      });
      setEmptyTrashOpen(false);
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const runConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'approve' || confirmAction.type === 'cancel') {
      const action = confirmAction.type === 'approve' ? 'APPROVE' : 'CANCEL';
      const ok = await postDecision(confirmAction.item, action);
      if (ok) setConfirmAction(null);
      return;
    }
    if (confirmAction.type === 'archive') {
      const ok = await patchArchived(confirmAction.item, true);
      if (ok) setConfirmAction(null);
      return;
    }
    if (confirmAction.type === 'restore') {
      const ok = await patchArchived(confirmAction.item, false);
      if (ok) setConfirmAction(null);
      return;
    }
    if (confirmAction.type === 'delete') {
      const ok = await deletePermanent(confirmAction.item);
      if (ok) setConfirmAction(null);
    }
  };

  const confirmDialogMeta = (() => {
    if (!confirmAction) return null;
    const slot = formatSlot(confirmAction.item.startAt, confirmAction.item.endAt);
    const detail = (
      <>
        <span className="font-medium text-foreground">{confirmAction.item.title}</span>
        <br />
        {confirmAction.item.roomName} · {slot.date} {slot.time}
      </>
    );
    switch (confirmAction.type) {
      case 'approve':
        return { title: 'Confirmer la réservation ?', confirmLabel: 'Valider', intent: 'success' as const, message: detail };
      case 'cancel':
        return { title: 'Annuler la réservation ?', confirmLabel: 'Annuler', intent: 'destructive' as const, message: detail };
      case 'archive':
        return {
          title: 'Déplacer dans la corbeille ?',
          confirmLabel: 'Corbeille',
          intent: 'destructive' as const,
          message: (
            <>
              {detail}
              <br />
              <span className="text-muted-foreground">La réservation pourra être restaurée depuis la corbeille.</span>
            </>
          ),
        };
      case 'restore':
        return { title: 'Restaurer la réservation ?', confirmLabel: 'Restaurer', intent: 'success' as const, message: detail };
      case 'delete':
        return {
          title: 'Supprimer définitivement ?',
          confirmLabel: 'Supprimer',
          intent: 'destructive' as const,
          message: (
            <>
              {detail}
              <br />
              <span className="text-muted-foreground">Cette action est irréversible.</span>
            </>
          ),
        };
    }
  })();

  const handleExportExcel = async () => {
    if (!filteredItems.length || exportBusy) return;
    setExportBusy(true);
    try {
      await downloadRoomReservationsExcel(filteredItems);
      toast({
        variant: 'success',
        title: 'Export Excel généré',
        description: `${filteredItems.length} réservation${filteredItems.length > 1 ? 's' : ''} exportée${filteredItems.length > 1 ? 's' : ''}.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export impossible',
        description: 'La génération du fichier Excel a échoué.',
      });
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPdf = () => {
    if (!filteredItems.length) return;
    printRoomReservationsPdf(filteredItems);
  };

  return (
    <div className="admin-appt-page-inner admin-appt-page--compact dg-room-res-list-page">
      {isOwnScope ? null : (
        <Link href={DG_ROOM_AVAILABILITY_HREF} className="dg-room-res-list-back">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Retour aux créneaux salles
        </Link>
      )}

      <AdminPageHeader
        variant="flat"
        eyebrow={isOwnScope ? 'Mon espace' : DG_ROOM_SLOTS_LABEL}
        title={
          isOwnScope || !canReview
            ? DG_ROOM_MY_RESERVATIONS_LINK_LABEL
            : DG_ROOM_RESERVATIONS_LINK_LABEL
        }
        description={
          isOwnScope
            ? 'Réservations de salles effectuées avec votre compte — suivi et historique.'
            : canReview
              ? 'Suivi et validation des demandes de réservation de salles.'
              : 'Historique de vos demandes et réservations confirmées.'
        }
        actions={
          <div className="admin-appt-header-actions">
            {!loading && analytics.total > 0 ? (
              <button
                type="button"
                className="admin-appt-filter-btn admin-appt-header-btn"
                onClick={toggleChartsVisible}
                aria-pressed={chartsVisible}
                aria-label={chartsVisible ? 'Masquer les graphiques' : 'Afficher les graphiques'}
                title={chartsVisible ? 'Masquer les graphiques' : 'Afficher les graphiques'}
              >
                {chartsVisible ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
                {chartsVisible ? 'Masquer' : 'Afficher'}
              </button>
            ) : null}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="admin-appt-filter-btn admin-appt-header-btn"
                  disabled={!filteredItems.length || exportBusy}
                  aria-label="Exporter la liste des réservations"
                  title="Exporter la liste des réservations"
                >
                  {exportBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Exporter
                </button>
              </PopoverTrigger>
              <ExportFormatMenuContent
                count={filteredItems.length}
                summary={
                  <>
                    réservation{filteredItems.length > 1 ? 's' : ''} · détails complets
                  </>
                }
                busy={exportBusy}
                onExcel={() => void handleExportExcel()}
                onPdf={handleExportPdf}
              />
            </Popover>
            <button
              type="button"
              className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Actualiser"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </button>
          </div>
        }
      />

      {!loading && analytics.total > 0 && chartsVisible ? (
        isOwnScope ? (
          <RoomReservationsOwnChartsPanel analytics={analytics} />
        ) : (
          <RoomReservationsChartsPanel analytics={analytics} year={year} />
        )
      ) : null}

      <section
        className={cn(
          'admin-appt-toolbar',
          listTab === 'trash' && 'admin-trash-toolbar'
        )}
      >
        <div className="admin-appt-filters dg-room-res-list-filters">
          <div className="admin-appt-filters-top dg-room-res-list-filters-row">
            {listTab === 'active' ? (
              <div className="admin-appt-tabs" role="tablist" aria-label="Filtrer par statut">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.id}
                    data-active={statusFilter === tab.id}
                    className="admin-appt-tab"
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    {tab.label}
                    <span className="admin-appt-tab-count">{tabCounts[tab.id]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <AdminTrashBanner
                count={trashCount}
                emptyHint="Aucun élément — espace prêt pour les réservations archivées"
                filledHint={`${trashCount} élément${trashCount > 1 ? 's' : ''} — restaurables avant suppression définitive`}
              />
            )}

            {canReview ? (
              <AdminTrashScopeTabs
                value={listTab}
                onChange={setListTab}
                activeLabel="Actives"
                trashCount={trashCount}
              />
            ) : null}

            {canReview && listTab === 'trash' && trashCount > 0 && canDeletePermanent ? (
              <AdminEmptyTrashButton
                onClick={() => setEmptyTrashOpen(true)}
                disabled={actionLoading}
              />
            ) : null}

            <div className="dg-room-res-list-tools">
              <div className="dg-room-res-date-filters" role="group" aria-label="Filtrer par date">
                <button
                  type="button"
                  className={cn('admin-appt-today-btn', todayOnly && 'is-active')}
                  aria-pressed={todayOnly}
                  title="Afficher uniquement les réservations dont le créneau est à la date du jour"
                  onClick={() => {
                    setTodayOnly((on) => {
                      if (!on) {
                        setDateFrom('');
                        setDateTo('');
                      }
                      return !on;
                    });
                  }}
                >
                  <CalendarDays className="admin-appt-filter-icon" aria-hidden />
                  Aujourd&apos;hui
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'admin-appt-filter-icon-btn admin-appt-filter-icon-btn--period',
                        (dateFrom || dateTo) && 'admin-appt-filter-icon-btn--active'
                      )}
                      data-active={Boolean(dateFrom || dateTo)}
                      aria-label="Période"
                      title="Période"
                    >
                      <Calendar className="admin-appt-filter-icon" aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="admin-appt-period-popover" align="end">
                    <div className="admin-appt-period-row">
                      <div className="admin-appt-period-field">
                        <Label htmlFor="room-res-date-from" className="admin-appt-period-label">
                          Du
                        </Label>
                        <FrenchDateField
                          id="room-res-date-from"
                          className="admin-appt-period-input"
                          value={dateFrom}
                          onChange={(value) => {
                            setTodayOnly(false);
                            setDateFrom(value);
                          }}
                        />
                      </div>
                      <div className="admin-appt-period-field">
                        <Label htmlFor="room-res-date-to" className="admin-appt-period-label">
                          Au
                        </Label>
                        <FrenchDateField
                          id="room-res-date-to"
                          className="admin-appt-period-input"
                          value={dateTo}
                          onChange={(value) => {
                            setTodayOnly(false);
                            setDateTo(value);
                          }}
                        />
                      </div>
                      {dateFrom || dateTo ? (
                        <button
                          type="button"
                          className="admin-appt-period-clear"
                          onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                          }}
                          aria-label="Effacer les dates"
                          title="Effacer"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="admin-appt-search dg-room-res-list-search">
                <Search className="admin-appt-search-icon" aria-hidden />
                <Input
                  className="admin-settings-input admin-appt-search-input"
                  placeholder={
                    listTab === 'trash'
                      ? 'Rechercher dans la corbeille…'
                      : 'Rechercher salle, objet, demandeur…'
                  }
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <span className="admin-appt-loading-hint">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                MAJ…
              </span>
            ) : (
              <span className="admin-appt-results-hint">
                <strong>{filteredItems.length}</strong> affiché{filteredItems.length > 1 ? 's' : ''}
                {' · '}
                {listTab === 'trash'
                  ? 'Corbeille'
                  : (periodLabel(dateFrom, dateTo, todayOnly) ??
                    STATUS_TABS.find((t) => t.id === statusFilter)?.label)}
              </span>
            )}
          </div>
        </div>
      </section>

      <div
        className={cn(
          'admin-appt-table-wrap',
          listTab === 'trash' && 'admin-trash-table-wrap'
        )}
      >
        {loading && allItems.length === 0 ? (
          <div className="dg-room-res-loading">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des réservations…
          </div>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div
            className={cn(
              'dg-room-res-empty',
              listTab === 'trash' && 'dg-room-res-empty--trash',
              q.trim() && 'dg-room-res-empty--search'
            )}
          >
            <div className="dg-room-res-empty-glow" aria-hidden />
            <div className="dg-room-res-empty-icon" aria-hidden>
              {listTab === 'trash' ? (
                <Trash2 className="h-6 w-6" strokeWidth={1.75} />
              ) : q.trim() ? (
                <Search className="h-6 w-6" strokeWidth={1.75} />
              ) : (
                <CalendarClock className="h-6 w-6" strokeWidth={1.75} />
              )}
            </div>
            <p className="dg-room-res-empty-title">
              {listTab === 'trash'
                ? 'Corbeille vide'
                : q.trim()
                  ? 'Aucun résultat'
                  : dateFilterActive
                    ? 'Aucune réservation sur cette période'
                  : statusFilter === 'PENDING'
                    ? 'Aucune demande en attente'
                    : isOwnScope
                      ? 'Aucune réservation de votre part'
                      : 'Aucune réservation'}
            </p>
            <p className="dg-room-res-empty-desc">
              {q.trim()
                ? 'Essayez un autre mot-clé ou réinitialisez la recherche.'
                : listTab === 'trash'
                  ? 'Les réservations mises en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement.'
                  : isOwnScope
                    ? 'Réservez un créneau depuis les disponibilités salles : vos demandes apparaîtront ici.'
                    : 'Les nouvelles demandes apparaîtront ici dès leur soumission.'}
            </p>

            {listTab === 'trash' && !q.trim() ? (
              <ul className="dg-room-res-empty-tips">
                <li>
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Restauration en un clic
                </li>
                <li>
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Suppression définitive sécurisée
                </li>
                <li>
                  <Trash2 className="h-3 w-3" aria-hidden />
                  Historique isolé des actives
                </li>
              </ul>
            ) : null}

            <div className="dg-room-res-empty-actions">
              {listTab === 'trash' ? (
                <button
                  type="button"
                  className="dg-room-res-empty-btn dg-room-res-empty-btn--primary"
                  onClick={() => setListTab('active')}
                >
                  <LayoutList className="h-3.5 w-3.5" aria-hidden />
                  Retour aux actives
                </button>
              ) : null}
              {q.trim() ? (
                <button
                  type="button"
                  className="dg-room-res-empty-btn"
                  onClick={() => setQ('')}
                >
                  Effacer la recherche
                </button>
              ) : null}
              {isOwnScope && listTab === 'active' && !q.trim() ? (
                <Link
                  href={DG_ROOM_AVAILABILITY_HREF}
                  className="dg-room-res-empty-btn dg-room-res-empty-btn--primary"
                >
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  Réserver une salle
                </Link>
              ) : null}
              {canReview && listTab === 'active' && stats.pending > 0 && statusFilter !== 'PENDING' ? (
                <button
                  type="button"
                  className="dg-room-res-empty-btn dg-room-res-empty-btn--primary"
                  onClick={() => setStatusFilter('PENDING')}
                >
                  Voir {stats.pending} en attente
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {filteredItems.length > 0 ? (
          <>
            <div className="admin-appt-table-scroll">
              <table className="admin-appt-table">
              <thead>
                <tr>
                  <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                  <th className="admin-appt-th-main">Réservation</th>
                  <th>Salle</th>
                  <th>Type d&apos;usage</th>
                  <th>Créneau</th>
                  <th>Soumission</th>
                  <th className="dg-room-res-th-status">Statut</th>
                  <th className="admin-appt-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const liveStatus = item.liveStatus ?? item.status;
                  const autoExpired = Boolean(item.autoExpired);
                  const slot = formatSlot(item.startAt, item.endAt);
                  const submitted = formatSubmitted(item.createdAt);
                  const modified =
                    !isAppointmentOccupancy(item) && roomReservationWasModified(item)
                      ? formatModified(item.updatedAt)
                      : null;
                  const cancellable =
                    !isOwnScope &&
                    isCancellable(liveStatus) &&
                    !isAppointmentOccupancy(item);
                  const editable =
                    listTab === 'active' &&
                    liveStatus !== 'COMPLETED' &&
                    liveStatus !== 'REJECTED' &&
                    liveStatus !== 'CANCELLED' &&
                    canEditRoomReservation(
                      { ...item, status: liveStatus === 'COMPLETED' ? 'CONFIRMED' : liveStatus },
                      { canReview, userId: currentUser.id }
                    ) &&
                    (liveStatus === 'PENDING' || liveStatus === 'CONFIRMED');
                  const expanded = expandedId === item.id;
                  const colSpan = 8;

                  return (
                    <Fragment key={item.id}>
                      <tr
                        data-status={liveStatus}
                        data-selected={expanded ? 'true' : undefined}
                        className={cn(
                          'dg-room-res-table-row',
                          index % 2 === 1 && 'admin-appt-row-alt',
                          liveStatus === 'PENDING' && 'dg-room-res-row--pending',
                          expanded && 'dg-room-res-row--expanded'
                        )}
                        onClick={() => toggleDetail(item)}
                      >
                        <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                        <td className="admin-appt-td-main">
                          <div className="admin-appt-cell-main">
                            <p className="admin-appt-title">{item.title}</p>
                            {item.bookingOrigin === 'APPOINTMENT' && item.appointmentId ? (
                              <span
                                className="dg-room-res-origin-ref"
                                title={`Référence rendez-vous ${item.appointmentId}`}
                              >
                                Réf. #{shortAppointmentRef(item.appointmentId)}
                              </span>
                            ) : null}
                            <div className="admin-appt-meta">
                              {isAppointmentOccupancy(item) ? (
                                <span className="dg-room-res-meta-tag dg-room-res-meta-tag--agenda">
                                  Audience DGA
                                </span>
                              ) : item.bookingOrigin === 'APPOINTMENT' ? (
                                <span className="dg-room-res-meta-tag dg-room-res-meta-tag--from-rdv">
                                  {ROOM_BOOKING_ORIGIN_LABELS.APPOINTMENT}
                                </span>
                              ) : (
                                <span className="dg-room-res-meta-tag dg-room-res-meta-tag--from-slot">
                                  {ROOM_BOOKING_ORIGIN_LABELS.SLOT}
                                </span>
                              )}
                              <span className="dg-room-res-meta-tag">{item.organizerService}</span>
                              {item.assistantNote ? (
                                <span className="dg-room-res-meta-tag dg-room-res-meta-tag--proposed">
                                  Créneau proposé
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="dg-room-res-room-cell">
                            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                            <span>{item.roomName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="dg-room-res-usage-badge">
                            <Tag className="h-3 w-3 shrink-0" aria-hidden />
                            {ROOM_USAGE_LABELS[item.usageType]}
                          </span>
                        </td>
                        <td>
                          <div className="admin-appt-slot">
                            <CalendarClock className="admin-appt-slot-icon" aria-hidden />
                            <div>
                              <p className="admin-appt-slot-date">{slot.date}</p>
                              <p className="admin-appt-slot-time">{slot.time}</p>
                              <p className="dg-room-res-slot-relative">{slot.relative}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-appt-submitted">
                            <div className="admin-appt-submitted-icon" aria-hidden>
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="admin-appt-submitted-date">{submitted.date}</p>
                              <p className="admin-appt-submitted-time">{submitted.time}</p>
                              <p className="admin-appt-submitted-relative">{submitted.relative}</p>
                              {!canReview && modified ? (
                                <p className="dg-room-res-inline-modified">
                                  Modifiée · {modified.date} {modified.time}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="dg-room-res-td-status">
                          <span className={statusBadgeClass(liveStatus, autoExpired)}>
                            {statusLabel(item, liveStatus, autoExpired)}
                          </span>
                        </td>
                        <td className="admin-appt-td-actions" onClick={(e) => e.stopPropagation()}>
                          <RoomReservationRowActions
                            mode={isOwnScope ? 'own' : 'review'}
                            variant={listTab}
                            item={{ ...item, status: liveStatus }}
                            permissions={permissions}
                            canReview={canReview}
                            cancellable={cancellable}
                            editable={editable}
                            actionLoading={actionLoading}
                            availabilityHref={buildAvailabilityHref(item)}
                            onApprove={() => setConfirmAction({ type: 'approve', item })}
                            onReject={() => setRejectTarget(item)}
                            onPropose={() => setProposeTarget(item)}
                            onCancel={() => setConfirmAction({ type: 'cancel', item })}
                            onEdit={() => setEditTarget(item)}
                            onDetail={() => toggleDetail(item)}
                            onArchive={() => setConfirmAction({ type: 'archive', item })}
                            onRestore={() => setConfirmAction({ type: 'restore', item })}
                            onDelete={() => setConfirmAction({ type: 'delete', item })}
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="dg-room-res-detail-row">
                          <td colSpan={colSpan}>
                            <RoomReservationRowDetailPanel
                              item={item}
                              canEdit={editable}
                              onEdit={() => {
                                setExpandedId(null);
                                setEditTarget(item);
                              }}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="admin-appt-table-foot dg-room-res-table-foot">
              <span>
                {stats.pending > 0 ? (
                  <>
                    <strong>{stats.pending}</strong> en attente de validation
                  </>
                ) : (
                  'Aucune demande en attente'
                )}
              </span>
              <span className="tabular-nums">
                Total période : <strong>{stats.total}</strong>
                {exportedAt ? ` · MAJ ${exportedAt}` : ''}
              </span>
            </div>
          </>
        ) : null}
      </div>

      <AdminConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmDialogMeta?.title ?? ''}
        message={confirmDialogMeta?.message ?? null}
        confirmLabel={confirmDialogMeta?.confirmLabel ?? 'Confirmer'}
        intent={confirmDialogMeta?.intent ?? 'success'}
        loading={actionLoading}
        onConfirm={() => void runConfirm()}
      />

      <AdminConfirmDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="Vider la corbeille ?"
        message={
          <>
            Toutes les réservations de la corbeille seront supprimées définitivement.
            <br />
            <span className="text-muted-foreground">Cette action est irréversible.</span>
          </>
        }
        confirmLabel="Vider la corbeille"
        intent="destructive"
        loading={actionLoading}
        onConfirm={() => void emptyTrash()}
      />

      <RoomReservationRejectDialog
        item={rejectTarget}
        open={!!rejectTarget}
        loading={actionLoading}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        onConfirm={(reason) => void runReject(reason)}
      />

      <RoomReservationProposeDialog
        item={proposeTarget}
        open={!!proposeTarget}
        loading={actionLoading}
        onOpenChange={(o) => !o && setProposeTarget(null)}
        onSuccess={() => void load()}
      />

      <RoomReservationEditDialog
        item={editTarget}
        open={!!editTarget}
        loading={actionLoading}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSuccess={() => void load()}
      />
    </div>
  );
}
