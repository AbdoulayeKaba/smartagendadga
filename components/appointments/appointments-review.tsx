'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import { formatDistanceToNow } from 'date-fns';
import {
  DATE_FNS_LOCALE,
  formatDate,
  formatIsoDateInAppTz,
  formatTimeInAppTz,
  formatTimeRange,
} from '@/lib/datetime';
import { parseDateTime } from '@/lib/dg/scheduling';
import {
  ArrowLeft,
  ArrowUp,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Signal,
  Video,
  X,
  Zap,
  FileSpreadsheet,
  ShieldAlert,
  History,
  Radio,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmptyTrashButton,
  AdminTrashBanner,
  AdminTrashEmptyState,
  AdminTrashScopeTabs,
} from '@/components/admin/admin-trash-ui';
import {
  WORKSPACE_ROW_NUMBER_TD_CLASS,
  WORKSPACE_ROW_NUMBER_TH_CLASS,
} from '@/components/workspace/workspace-module-list';
import { AppointmentRejectDialog } from '@/components/appointments/appointment-reject-dialog';
import { AppointmentApproveDialog } from '@/components/appointments/appointment-approve-dialog';
import { AppointmentRequesterProfileDialog } from '@/components/appointments/appointment-requester-profile-dialog';
import {
  AppointmentRescheduleDialog,
  type RescheduleSubmitPayload,
} from '@/components/appointments/appointment-reschedule-dialog';
import { AppointmentImportDialog } from '@/components/appointments/appointment-import-dialog';
import { AppointmentRowActions } from '@/components/appointments/appointment-row-actions';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExportFormatMenuContent } from '@/components/ui/export-format-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { LIVE_TOPICS, emitLiveRefresh, useDebouncedCallback, useLiveClock, useLiveRefresh, useScheduledRefresh } from '@/lib/dg/live-refresh';
import {
  collectAppointmentTransitionTimes,
  resolveLiveAppointmentStatusView,
  resolveLiveClockIntervalMs,
} from '@/lib/dg/appointment-live-transitions';
import {
  downloadAppointmentsExcel,
  printAppointmentsPdf,
} from '@/lib/dg/appointments-export-utils';
import { computeAppointmentsOwnAnalytics } from '@/lib/dg/appointments-own-analytics';
import { useApp } from '@/lib/app-context';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canReviewAppointments, canUseUrgentOverride } from '@/lib/dg/rbac';
import type {
  AppointmentReviewItem,
  AppointmentsReviewStats,
} from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_IMPORTED_LABEL,
  APPOINTMENT_URGENCY_LABELS,
  approvedAppointmentPhaseBadgeClass,
  approvedAppointmentPhaseLabel,
  appointmentStatusBadgeClassForItem,
  appointmentStatusDotClass,
  appointmentStatusLabel,
  appointmentUrgencyBadgeClass,
  getApprovedAppointmentPhase,
  APPOINTMENT_ONGOING_ARCHIVE_MESSAGE,
  isApprovedAppointmentOngoing,
} from '@/lib/dg/appointments-review';
import {
  APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE,
  APPOINTMENT_PAST_LOCKED_MESSAGE,
} from '@/lib/dg/appointment-reschedule-access';
import type { AppointmentStatus } from '@prisma/client';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { displayAppointmentModality } from '@/lib/dg/appointment-review-display';
import { PLANNING_URGENT_LABEL } from '@/lib/dg/urgent-slot-priority';
import type { AppointmentUrgencyFilter } from '@/lib/dg/appointments-review';
import { cn } from '@/lib/utils';

const AppointmentsOwnChartsPanel = dynamic(
  () =>
    import('@/components/appointments/appointments-own-charts-panel').then(
      (mod) => mod.AppointmentsOwnChartsPanel
    ),
  { ssr: false }
);

type ApiResponse = {
  items: AppointmentReviewItem[];
  stats: AppointmentsReviewStats;
};

type StatusTab = AppointmentStatus | 'ALL';

function ReviewKpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: 'green' | 'orange' | 'blue' | 'default';
}) {
  return (
    <div className="admin-appt-kpi" data-tone={tone ?? 'default'}>
      <Icon className="admin-appt-kpi-icon-svg" aria-hidden />
      <span className="admin-appt-kpi-label">{label}</span>
      <span className="admin-appt-kpi-value">{value}</span>
    </div>
  );
}

function formatSlot(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const nearStart = Math.abs(start.getTime() - Date.now()) < 60_000;
  return {
    date: formatDate(start, 'EEE d MMM yyyy'),
    time: formatTimeRange(start, end),
    relative: formatDistanceToNow(start, {
      addSuffix: true,
      locale: DATE_FNS_LOCALE,
      includeSeconds: nearStart,
    }),
  };
}

function buildPlanEditHref(item: AppointmentReviewItem) {
  return `/dg/plan?editId=${encodeURIComponent(item.id)}`;
}

function periodBoundIso(isoDate: string, edge: 'start' | 'end') {
  const instant = parseDateTime(isoDate, edge === 'start' ? '00:00' : '23:59');
  if (edge === 'end') instant.setSeconds(59, 999);
  return instant.toISOString();
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

const STATUS_TAB_LABELS: Record<StatusTab, string> = {
  ALL: 'Tous les statuts',
  PENDING: 'En attente',
  APPROVED: 'Approuvés',
  REJECTED: 'Refusés',
};

type ListTab = 'active' | 'trash';

type AppointmentsReviewProps = {
  /** `own` = mes demandes (uniquement les RDV planifiés par l'utilisateur). */
  scope?: 'review' | 'own';
};

export function AppointmentsReview({ scope = 'review' }: AppointmentsReviewProps) {
  const isOwnScope = scope === 'own';
  const { permissions } = useApp();
  const role = useDgRole();
  const urgentAllowed = canUseUrgentOverride(role);
  const importAllowed = canReviewAppointments(role) && !isOwnScope;
  const searchParams = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [urgency, setUrgency] = useState<AppointmentUrgencyFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);

  const [listTab, setListTab] = useState<ListTab>('active');
  const [reviewItem, setReviewItem] = useState<AppointmentReviewItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AppointmentReviewItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentReviewItem | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<AppointmentReviewItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AppointmentReviewItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentReviewItem | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<'approve' | 'reschedule'>('reschedule');
  const [rescheduleValidates, setRescheduleValidates] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { year, range, setYear } = useTemporalNavigation();

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      // Mes demandes : charger tous les statuts pour graphiques + filtrer côté client.
      if (urgency !== 'ALL') params.set('urgency', urgency);
      if (q.trim()) params.set('q', q.trim());
      // Mes demandes : pas de fenêtre temporelle globale — uniquement si l’utilisateur filtre.
      const todayIso = formatIsoDateInAppTz(new Date());
      const pickedFrom = todayOnly ? todayIso : dateFrom;
      const pickedTo = todayOnly ? todayIso : dateTo;
      const userPeriod = Boolean(pickedFrom || pickedTo);
      const rawFrom = userPeriod ? pickedFrom || pickedTo : '';
      const rawTo = userPeriod ? pickedTo || pickedFrom : '';
      const effectiveFrom = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom;
      const effectiveTo = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo;
      if (effectiveFrom) params.set('from', periodBoundIso(effectiveFrom, 'start'));
      else if (!isOwnScope) params.set('from', range.fromIso);
      if (effectiveTo) params.set('to', periodBoundIso(effectiveTo, 'end'));
      else if (!isOwnScope) params.set('to', range.toIso);
      if (userPeriod) params.set('slotOnly', '1');
      if (!isOwnScope) {
        params.set('year', String(year));
      }
      params.set('archived', listTab === 'trash' ? 'true' : 'false');

      const apiPath = isOwnScope ? '/api/appointments/mine' : '/api/dg/appointments';
      const res = await fetch(`${apiPath}?${params.toString()}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as ApiResponse);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    q,
    urgency,
    dateFrom,
    dateTo,
    todayOnly,
    year,
    range,
    listTab,
    isOwnScope,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAppointmentId = searchParams.get('open');
  const openedAppointmentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!openAppointmentId) return;
    if (openedAppointmentRef.current === openAppointmentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/appointments/${openAppointmentId}/detail`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { item: AppointmentReviewItem };
        if (cancelled || !json.item) return;
        openedAppointmentRef.current = openAppointmentId;
        setReviewItem(json.item);
        const start = new Date(json.item.startAt);
        if (!Number.isNaN(start.getTime())) setYear(start.getFullYear());
      } catch {
        /* La liste reste disponible si la fiche ne s'ouvre pas. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openAppointmentId, setYear]);

  const periodItems = useMemo(() => {
    if (!data?.items) return [];
    if (todayOnly) {
      const todayIso = formatIsoDateInAppTz(new Date());
      return data.items.filter((item) => formatIsoDateInAppTz(item.startAt) === todayIso);
    }
    if (!dateFrom && !dateTo) return data.items;
    return data.items.filter((item) => slotDayInPeriod(item.startAt, dateFrom, dateTo));
  }, [data?.items, dateFrom, dateTo, todayOnly]);

  const displayItems = useMemo(() => {
    const items = statusTab === 'ALL' ? periodItems : periodItems.filter((item) => item.status === statusTab);
    return [...items].sort((a, b) => {
      const created = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (Number.isFinite(created) && created !== 0) return created;
      return b.id.localeCompare(a.id);
    });
  }, [periodItems, statusTab]);

  const canSelectRows =
    !isOwnScope &&
    (listTab === 'trash'
      ? permissions['action.appointments.delete'] === true
      : permissions['action.appointments.archive'] === true);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => displayItems.some((item) => item.id === id)));
  }, [displayItems]);

  useEffect(() => {
    setSelectedIds([]);
  }, [listTab]);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [showTableLift, setShowTableLift] = useState(false);

  useEffect(() => {
    const node = tableWrapRef.current;
    if (!node) return;

    let parent: HTMLElement | null = node.parentElement;
    let scroller: HTMLElement | Window = window;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 24) {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }

    const update = () => {
      setShowTableLift(node.getBoundingClientRect().top < -180);
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [data, loading, displayItems.length]);

  const scrollTableToTop = () => {
    tableWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const liveClockIntervalMs = useMemo(
    () => resolveLiveClockIntervalMs(displayItems),
    [displayItems]
  );

  const liveNow = useLiveClock({ intervalMs: liveClockIntervalMs });

  const refreshSilently = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const refreshSilentlyDebounced = useDebouncedCallback(refreshSilently, 800);

  useLiveRefresh(refreshSilentlyDebounced, {
    topics: [LIVE_TOPICS.appointments],
    intervalMs: 0,
  });

  const transitionTimes = useMemo(
    () => collectAppointmentTransitionTimes(displayItems),
    [displayItems]
  );

  useScheduledRefresh(refreshSilentlyDebounced, transitionTimes);

  const applyLocalItemPatch = useCallback((id: string, patch: Partial<AppointmentReviewItem>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      };
    });
  }, []);

  const removeLocalItem = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      };
    });
  }, []);

  useEffect(() => {
    setReviewItem((current) => {
      if (!current || !data?.items) return current;
      const fresh = data.items.find((item) => item.id === current.id);
      if (!fresh || (fresh.status === current.status && fresh.updatedAt === current.updatedAt)) {
        return current;
      }
      return fresh;
    });
  }, [data]);

  const refreshAfterMutation = useCallback(() => {
    emitLiveRefresh(LIVE_TOPICS.appointments);
    refreshSilently();
  }, [refreshSilently]);

  const resetFilters = () => {
    setListTab('active');
    setStatusTab('ALL');
    setQ('');
    setUrgency('ALL');
    setDateFrom('');
    setDateTo('');
    setTodayOnly(false);
  };

  const handleApiError = (
    j: { error?: string; message?: string },
    item?: AppointmentReviewItem
  ) => {
    const canReplan =
      item != null && (j.error === 'SLOT_NO_LONGER_FREE' || j.error === 'SCHEDULE_CONFLICT');
    toast({
      variant: 'destructive',
      duration: canReplan ? 12000 : undefined,
      title: 'Action impossible',
      description:
        j.message ??
        (j.error === 'SCHEDULE_CONFLICT'
          ? 'Conflit de planning (buffer 15 min).'
          : j.error === 'SLOT_NO_LONGER_FREE'
            ? 'Ce créneau n’est plus libre.'
          : j.error === 'SLOT_EXPIRED'
            ? 'Le créneau demandé est déjà passé.'
            : j.error === 'INVALID_STATE'
              ? 'Cette demande ne peut plus être modifiée.'
              : j.error === 'APPOINTMENT_NOT_RESCHEDULABLE'
                ? APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE
                : j.error === 'APPOINTMENT_PAST'
                  ? APPOINTMENT_PAST_LOCKED_MESSAGE
                : j.error === 'APPOINTMENT_ONGOING'
                  ? APPOINTMENT_ONGOING_ARCHIVE_MESSAGE
                  : j.error === 'FORBIDDEN'
                ? 'Vous n’avez pas les droits pour cette action.'
                : j.error === 'VALIDATION_ERROR'
                  ? 'Données invalides. Vérifiez la date et les horaires.'
                  : j.error === 'INVALID_TIME_RANGE'
                    ? 'L’heure de fin doit être après l’heure de début.'
                    : j.error === 'NOT_FOUND'
                      ? 'Rendez-vous introuvable.'
                      : j.error === 'SERVER_ERROR'
                        ? 'Erreur serveur. Réessayez.'
                        : j.error ?? 'Erreur inconnue.'),
      action: canReplan ? (
        <ToastAction
          altText="Replanifier le rendez-vous"
          className="app-toast-action"
          onClick={() => {
            setApproveTarget(null);
            setReviewItem(null);
            setRescheduleValidates(true);
            setRescheduleMode(item.status === 'PENDING' ? 'approve' : 'reschedule');
            setRescheduleTarget(item);
          }}
        >
          Replanifier
        </ToastAction>
      ) : undefined,
    });
  };

  const approve = async (item: AppointmentReviewItem, slot?: RescheduleSubmitPayload) => {
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
      const j = (await res.json().catch(() => ({}))) as { alreadyApproved?: boolean; error?: string; message?: string };
      if (!res.ok) {
        handleApiError(j, item);
        return false;
      }
      toast({
        title: j.alreadyApproved ? 'Déjà approuvé' : 'Rendez-vous approuvé',
        description: j.alreadyApproved
          ? 'Ce créneau est déjà confirmé dans l’agenda.'
          : 'Le créneau est confirmé dans l’agenda.',
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (item: AppointmentReviewItem, reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        handleApiError(j);
        return false;
      }
      toast({
        title: item.status === 'APPROVED' ? 'Rendez-vous annulé' : 'Demande refusée',
        description: 'Le demandeur sera notifié.',
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const reschedule = async (item: AppointmentReviewItem, slot: RescheduleSubmitPayload) => {
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
        handleApiError(j, item);
        return false;
      }
      toast({
        title: 'Rendez-vous reporté',
        description:
          item.status === 'APPROVED'
            ? 'Le nouveau créneau reste approuvé. Le demandeur a été notifié.'
            : 'Le demandeur a été notifié par e-mail.',
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const approveInFlight = useRef(false);
  const rowClickLock = useRef(false);
  const dialogOpenRef = useRef(false);
  const rescheduleClosedAt = useRef(0);
  const rescheduleOpenTimer = useRef<number | null>(null);
  dialogOpenRef.current = Boolean(rescheduleTarget || approveTarget || rejectTarget);
  const lockRowClick = () => {
    rowClickLock.current = true;
    window.setTimeout(() => {
      rowClickLock.current = false;
    }, 500);
  };
  const markRescheduleClosed = () => {
    rescheduleClosedAt.current = Date.now();
    if (rescheduleOpenTimer.current != null) {
      window.clearTimeout(rescheduleOpenTimer.current);
      rescheduleOpenTimer.current = null;
    }
  };
  const onConfirmApprove = async () => {
    if (!approveTarget || approveInFlight.current) return;
    approveInFlight.current = true;
    const target = approveTarget;
    try {
      const ok = await approve(target);
      if (ok) {
        setApproveTarget(null);
        applyLocalItemPatch(target.id, { status: 'APPROVED' });
        refreshAfterMutation();
      }
    } finally {
      approveInFlight.current = false;
    }
  };

  const onRescheduleSubmit = async (slot: RescheduleSubmitPayload) => {
    if (!rescheduleTarget) return;
    const target = rescheduleTarget;
    if (rescheduleValidates && target.status === 'PENDING') {
      const ok = await approve(target, slot);
      if (ok) {
        setRescheduleTarget(null);
        setRescheduleValidates(false);
        setApproveTarget(null);
        applyLocalItemPatch(target.id, { status: 'APPROVED' });
        refreshAfterMutation();
      }
      return;
    }
    const ok = await reschedule(target, slot);
    if (ok) {
      setRescheduleTarget(null);
      setRescheduleValidates(false);
      if (target.status === 'APPROVED') {
        applyLocalItemPatch(target.id, { status: 'APPROVED' });
        setReviewItem((current) =>
          current?.id === target.id ? { ...current, status: 'APPROVED' } : current
        );
      }
      refreshAfterMutation();
    }
  };

  const onRejectSubmit = async (reason: string) => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    const ok = await reject(target, reason);
    if (ok) {
      setRejectTarget(null);
      applyLocalItemPatch(target.id, { status: 'REJECTED', rejectionReason: reason });
      refreshAfterMutation();
    }
  };

  const openReschedule = (item: AppointmentReviewItem, mode: 'approve' | 'reschedule') => {
    if (Date.now() - rescheduleClosedAt.current < 450) return;
    lockRowClick();
    setReviewItem(null);
    setRescheduleValidates(item.status === 'APPROVED');
    setRescheduleMode(mode);
    setRescheduleTarget(item);
  };

  const archiveAppointment = async (item: AppointmentReviewItem) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        handleApiError(j);
        return false;
      }
      toast({
        title: isOwnScope ? 'Demande déplacée en corbeille' : 'Rendez-vous déplacé dans la corbeille',
        description: isOwnScope
          ? 'Vous pourrez la restaurer ou la supprimer depuis la corbeille.'
          : undefined,
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const restoreAppointment = async (item: AppointmentReviewItem) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        handleApiError(j);
        return false;
      }
      toast({
        title: isOwnScope ? 'Demande restaurée' : 'Rendez-vous restauré',
        description: isOwnScope ? 'La demande est de nouveau visible dans vos actifs.' : undefined,
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteAppointmentPermanent = async (item: AppointmentReviewItem) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${item.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const description =
          j.error === 'NOT_ARCHIVED'
            ? 'Le rendez-vous doit d’abord être dans la corbeille.'
            : j.error === 'INVALID_STATE'
              ? 'Seules les demandes en attente ou refusées peuvent être retirées.'
              : j.error === 'FORBIDDEN'
                ? 'Vous n’avez pas l’autorisation de supprimer cette demande.'
                : j.error === 'NOT_FOUND'
                  ? 'Demande introuvable.'
                  : 'Une erreur est survenue. Réessayez.';
        toast({
          variant: 'destructive',
          title: 'Suppression impossible',
          description,
        });
        return false;
      }
      toast({
        title: isOwnScope ? 'Demande supprimée' : 'Rendez-vous supprimé définitivement',
        description: isOwnScope
          ? 'La demande a été retirée définitivement de votre corbeille.'
          : undefined,
      });
      emitLiveRefresh(LIVE_TOPICS.appointments);
      return true;
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirmArchive = async () => {
    if (!archiveTarget) return;
    if (isApprovedAppointmentOngoing(archiveTarget, liveNow)) return;
    const target = archiveTarget;
    const ok = await archiveAppointment(target);
    if (ok) {
      setArchiveTarget(null);
      setReviewItem(null);
      removeLocalItem(target.id);
      refreshAfterMutation();
    }
  };

  const onConfirmRestore = async (item: AppointmentReviewItem) => {
    const ok = await restoreAppointment(item);
    if (ok) {
      setReviewItem(null);
      removeLocalItem(item.id);
      refreshAfterMutation();
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const ok = await deleteAppointmentPermanent(target);
    if (ok) {
      setDeleteTarget(null);
      setReviewItem(null);
      removeLocalItem(target.id);
      refreshAfterMutation();
    }
  };

  const onConfirmBulk = async () => {
    const targets = displayItems.filter((item) => selectedIds.includes(item.id));
    if (!targets.length) {
      setBulkOpen(false);
      return;
    }
    setActionLoading(true);
    let done = 0;
    let skipped = 0;
    try {
      for (const item of targets) {
        if (listTab === 'active' && isApprovedAppointmentOngoing(item, liveNow)) {
          skipped += 1;
          continue;
        }
        const res =
          listTab === 'trash'
            ? await fetch(`/api/appointments/${item.id}`, { method: 'DELETE' })
            : await fetch(`/api/appointments/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true }),
              });
        if (!res.ok) continue;
        done += 1;
        removeLocalItem(item.id);
      }
      toast({
        title: listTab === 'trash' ? 'Suppression effectuée' : 'Mis en corbeille',
        description:
          skipped > 0
            ? `${done} traité${done > 1 ? 's' : ''}, ${skipped} en cours ignoré${skipped > 1 ? 's' : ''}.`
            : `${done} rendez-vous.`,
      });
      setSelectedIds([]);
      setBulkOpen(false);
      setReviewItem(null);
      refreshAfterMutation();
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirmEmptyTrash = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        isOwnScope ? '/api/appointments/mine/trash' : '/api/dg/appointments/trash',
        { method: 'POST' }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        handleApiError(j);
        return;
      }
      toast({
        title: 'Corbeille vidée',
        description: `${j.purged ?? 0} ${isOwnScope ? 'demande(s)' : 'rendez-vous'} supprimé${(j.purged ?? 0) > 1 ? 's' : ''}.`,
      });
      setEmptyTrashOpen(false);
      setData((prev) => (prev ? { ...prev, items: [] } : prev));
      refreshAfterMutation();
    } finally {
      setActionLoading(false);
    }
  };

  const tabCounts = useMemo(() => {
    if (dateFrom || dateTo || todayOnly) {
      return {
        ALL: periodItems.length,
        PENDING: periodItems.filter((item) => item.status === 'PENDING').length,
        APPROVED: periodItems.filter((item) => item.status === 'APPROVED').length,
        REJECTED: periodItems.filter((item) => item.status === 'REJECTED').length,
      };
    }
    if (!data?.stats) return { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    return {
      ALL: data.stats.total,
      PENDING: data.stats.pending,
      APPROVED: data.stats.approved,
      REJECTED: data.stats.rejected,
    };
  }, [data?.stats, periodItems, dateFrom, dateTo, todayOnly]);

  const ownAnalytics = useMemo(
    () =>
      isOwnScope && listTab === 'active' && data?.items
        ? computeAppointmentsOwnAnalytics(data.items)
        : null,
    [isOwnScope, listTab, data?.items]
  );

  const periodActive = Boolean(dateFrom || dateTo);

  const handleExportExcel = async () => {
    if (!displayItems.length || exportBusy) return;
    setExportBusy(true);
    try {
      await downloadAppointmentsExcel(displayItems);
      toast({
        variant: 'success',
        title: 'Export Excel généré',
        description: `${displayItems.length} rendez-vous exportés.`,
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
    if (!displayItems.length) return;
    printAppointmentsPdf(displayItems);
  };

  return (
    <div className={cn('admin-appt-page-inner', isOwnScope && 'admin-appt-own')}>
      <AdminPageHeader
        variant="flat"
        eyebrow={isOwnScope ? 'Mes demandes' : 'Rendez-vous'}
        title={isOwnScope ? 'Suivi de mes rendez-vous' : 'Liste des rendez-vous'}
        description={
          isOwnScope
            ? 'Consultez l’état de vos demandes, vos créneaux confirmés et l’historique auprès du cabinet du DGA.'
            : 'Valider, refuser ou reporter les demandes.'
        }
        actions={
          <div className="admin-appt-header-actions">
            <Link
              href="/dg/plan"
              className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--primary"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
              Planifier un RDV
            </Link>
            {!isOwnScope ? (
              <Link
                href="/dg/assistant"
                className="admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--secondary"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden />
                Agenda
              </Link>
            ) : null}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="admin-appt-filter-btn admin-appt-header-btn"
                  disabled={!displayItems.length || exportBusy}
                  aria-label="Exporter la liste des rendez-vous"
                  title="Exporter la liste des rendez-vous"
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
                count={displayItems.length}
                summary="rendez-vous · détails complets"
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

      {isOwnScope && listTab === 'active' && ownAnalytics && ownAnalytics.total > 0 ? (
        <AppointmentsOwnChartsPanel analytics={ownAnalytics} />
      ) : isOwnScope && data?.stats ? (
        <div className="admin-appt-kpi-strip admin-appt-kpi-strip--own">
          {listTab === 'trash' ? (
            <ReviewKpi icon={X} label="Corbeille" value={data.stats.trash ?? 0} tone="orange" />
          ) : (
            <>
              <ReviewKpi icon={Clock} label="En attente" value={data.stats.pending} tone="blue" />
              <ReviewKpi icon={Calendar} label="Approuvés" value={data.stats.approved} tone="green" />
              <ReviewKpi icon={X} label="Refusés" value={data.stats.rejected} />
            </>
          )}
        </div>
      ) : null}

      <section
        className={cn('admin-appt-toolbar', listTab === 'trash' && 'admin-trash-toolbar')}
      >
        <div className="admin-appt-filters">
          <div className="admin-appt-filters-top">
            <div className="admin-appt-filters-leading">
              {listTab === 'active' ? (
                <div className="admin-appt-tabs" role="tablist" aria-label="Filtrer par statut">
                  {(
                    [
                      ['ALL', 'Tous'],
                      ['PENDING', 'En attente'],
                      ['APPROVED', 'Approuvés'],
                      ['REJECTED', 'Refusés'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === id}
                      data-active={statusTab === id}
                      className="admin-appt-tab"
                      onClick={() => setStatusTab(id)}
                    >
                      {label}
                      <span className="admin-appt-tab-count">{tabCounts[id]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <AdminTrashBanner
                  count={data?.stats.trash ?? 0}
                  emptyHint="Aucun élément — espace prêt pour les rendez-vous archivés"
                  filledHint={`${data?.stats.trash ?? 0} rendez-vous — restaurables avant suppression définitive`}
                />
              )}

              {!isOwnScope ? (
                <AdminTrashScopeTabs
                  value={listTab}
                  onChange={setListTab}
                  trashCount={data?.stats.trash ?? 0}
                />
              ) : null}

              {listTab === 'trash' && (data?.stats.trash ?? 0) > 0 ? (
                <AdminEmptyTrashButton
                  onClick={() => setEmptyTrashOpen(true)}
                  disabled={actionLoading}
                />
              ) : null}
            </div>

            {loading ? (
              <span className="admin-appt-loading-hint">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                MAJ…
              </span>
            ) : (
              <span className="admin-appt-results-hint">
                {data ? (
                  <>
                    <strong>{displayItems.length}</strong> affiché
                    {displayItems.length > 1 ? 's' : ''}
                    {' · '}
                    {listTab === 'trash'
                      ? 'Corbeille'
                      : todayOnly
                        ? "Aujourd'hui"
                        : dateFrom || dateTo
                          ? dateFrom && dateTo && dateFrom !== dateTo
                            ? `${formatPeriodDay(dateFrom > dateTo ? dateTo : dateFrom)} – ${formatPeriodDay(dateFrom > dateTo ? dateFrom : dateTo)}`
                            : formatPeriodDay(dateFrom || dateTo)
                          : STATUS_TAB_LABELS[statusTab]}
                  </>
                ) : null}
              </span>
            )}
          </div>

          <div className="admin-appt-filters-row">
            <div className="admin-appt-search">
              <Search className="admin-appt-search-icon" aria-hidden />
              <Input
                className="admin-settings-input admin-appt-search-input"
                placeholder={
                  listTab === 'trash' ? 'Rechercher dans la corbeille…' : 'Rechercher…'
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="admin-appt-filter-actions" role="group" aria-label="Filtres et actions">
              <button
                type="button"
                className={cn('admin-appt-today-btn', todayOnly && 'is-active')}
                aria-pressed={todayOnly}
                title="Afficher uniquement les rendez-vous dont le créneau est à la date du jour"
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
                      periodActive && 'admin-appt-filter-icon-btn--active'
                    )}
                    data-active={periodActive}
                    aria-label="Période"
                    title="Période"
                  >
                    <Calendar className="admin-appt-filter-icon" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="admin-appt-period-popover" align="start">
                  <div className="admin-appt-period-row">
                    <div className="admin-appt-period-field">
                      <Label htmlFor="appt-date-from" className="admin-appt-period-label">
                        Du
                      </Label>
                      <FrenchDateField
                        id="appt-date-from"
                        className="admin-appt-period-input"
                        value={dateFrom}
                        onChange={(value) => {
                          setTodayOnly(false);
                          setDateFrom(value);
                        }}
                      />
                    </div>
                    <div className="admin-appt-period-field">
                      <Label htmlFor="appt-date-to" className="admin-appt-period-label">
                        Au
                      </Label>
                      <FrenchDateField
                        id="appt-date-to"
                        className="admin-appt-period-input"
                        value={dateTo}
                        onChange={(value) => {
                          setTodayOnly(false);
                          setDateTo(value);
                        }}
                      />
                    </div>
                    {periodActive ? (
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

              <Select
                value={urgency}
                onValueChange={(v) => setUrgency(v as AppointmentUrgencyFilter)}
              >
                <SelectTrigger
                  className={cn(
                    'admin-appt-filter-icon-btn admin-appt-filter-icon-btn--priority',
                    urgency !== 'ALL' && 'admin-appt-filter-icon-btn--active'
                  )}
                  aria-label="Urgence"
                  title="Urgence"
                >
                  <Signal className="admin-appt-filter-icon text-current" aria-hidden />
                </SelectTrigger>
                <SelectContent className="admin-appt-filter-menu">
                  <SelectItem value="ALL">Toutes</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="URGENT">Urgence</SelectItem>
                </SelectContent>
              </Select>

              <button
                type="button"
                className="admin-appt-filter-icon-btn admin-appt-filter-icon-btn--reset"
                onClick={resetFilters}
                aria-label="Réinitialiser"
                title="Réinitialiser"
              >
                <RotateCcw className="admin-appt-filter-icon" aria-hidden />
              </button>

              {importAllowed ? (
                <button
                  type="button"
                  className="admin-appt-filter-icon-btn admin-appt-filter-icon-btn--import"
                  onClick={() => setImportOpen(true)}
                  aria-label="Importer Excel"
                  title="Importer des rendez-vous (Excel)"
                >
                  <FileSpreadsheet className="admin-appt-filter-icon" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div
        ref={tableWrapRef}
        className={cn(
          'admin-appt-table-wrap',
          listTab === 'trash' && 'admin-trash-table-wrap'
        )}
      >
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des rendez-vous…
          </div>
        ) : null}

        {!loading && !data ? (
          <div className="admin-appt-empty admin-appt-empty--error">
            <div className="admin-appt-empty-icon" aria-hidden>
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="admin-appt-empty-title">Chargement impossible</p>
            <p className="admin-appt-empty-blurb">
              Impossible de récupérer vos rendez-vous. Vérifiez votre connexion puis réessayez.
            </p>
            <button
              type="button"
              className="admin-btn-primary admin-appt-empty-cta"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Réessayer
            </button>
          </div>
        ) : null}

        {!loading && data && displayItems.length === 0 ? (
          listTab === 'trash' && !q.trim() ? (
            <AdminTrashEmptyState
              description="Les rendez-vous mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement."
              onBackToActive={() => setListTab('active')}
              backLabel="Retour aux actifs"
            />
          ) : (
          <div className={cn('admin-appt-empty', isOwnScope && 'admin-appt-empty--own', listTab === 'trash' && 'admin-trash-empty')}>
            <div className="admin-appt-empty-icon" aria-hidden>
              <CalendarClock className="h-6 w-6" />
            </div>
            <p className="admin-appt-empty-title">
              {isOwnScope
                ? listTab === 'trash'
                  ? 'Corbeille vide'
                  : data.items.length > 0
                    ? 'Aucune demande pour ce filtre'
                    : 'Aucune demande pour le moment'
                : todayOnly
                  ? "Aucun rendez-vous aujourd'hui"
                  : q.trim()
                    ? 'Aucun résultat'
                    : 'Aucun rendez-vous'}
            </p>
            <p className="admin-appt-empty-blurb">
              {q.trim()
                ? 'Essayez un autre mot-clé ou réinitialisez la recherche.'
                : isOwnScope
                ? listTab === 'trash'
                  ? 'Les demandes que vous mettez en corbeille apparaîtront ici avant suppression définitive.'
                  : periodActive || todayOnly || statusTab !== 'ALL' || q.trim() || urgency !== 'ALL'
                    ? 'Aucune demande ne correspond à vos filtres. Élargissez la recherche ou réinitialisez-les.'
                    : 'Planifiez un rendez-vous : il apparaîtra ici dès l’envoi, en attente de validation du cabinet.'
                : todayOnly
                  ? 'Aucun créneau ne tombe à la date du jour. Désactivez « Aujourd’hui » pour revoir toute la période.'
                  : 'Ajustez les filtres ou consultez un autre onglet de statut.'}
            </p>
            {isOwnScope && listTab !== 'trash' ? (
              <div className="admin-appt-empty-actions">
                {periodActive || todayOnly || statusTab !== 'ALL' || q.trim() || urgency !== 'ALL' ? (
                  <button
                    type="button"
                    className="admin-btn-cancel admin-appt-empty-cta admin-appt-empty-cta--ghost"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Réinitialiser les filtres
                  </button>
                ) : null}
                <Link
                  href="/dg/plan"
                  className="admin-btn-primary admin-appt-empty-cta"
                >
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                  Planifier un RDV
                </Link>
              </div>
            ) : null}
          </div>
          )
        ) : null}

        {displayItems.length > 0 ? (
          <>
            {canSelectRows && selectedIds.length > 0 ? (
              <div className="admin-appt-selection-bar">
                <span>
                  <strong>{selectedIds.length}</strong> sélectionné{selectedIds.length > 1 ? 's' : ''}
                </span>
                <button type="button" className="admin-appt-selection-clear" onClick={() => setSelectedIds([])}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="admin-appt-selection-delete"
                  onClick={() => setBulkOpen(true)}
                  disabled={actionLoading}
                >
                  {listTab === 'trash' ? 'Supprimer' : 'Mettre en corbeille'}
                </button>
              </div>
            ) : null}
            <div className="admin-appt-table-scroll">
              <table className={cn('admin-appt-table admin-appt-table--rdv', canSelectRows && 'admin-appt-table--select')}>
                <thead>
                  <tr>
                    {canSelectRows ? (
                      <th className="admin-appt-th-select">
                        <Checkbox
                          checked={
                            displayItems.length > 0 &&
                            displayItems.every((item) => selectedIds.includes(item.id))
                              ? true
                              : displayItems.some((item) => selectedIds.includes(item.id))
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setSelectedIds(displayItems.map((item) => item.id));
                              return;
                            }
                            setSelectedIds([]);
                          }}
                          aria-label="Tout sélectionner"
                        />
                      </th>
                    ) : null}
                    <th className={WORKSPACE_ROW_NUMBER_TH_CLASS}>N°</th>
                    <th className="admin-appt-th-main">Rendez-vous</th>
                    <th className="admin-appt-th-slot">Créneau</th>
                    <th className="admin-appt-th-status">Statut</th>
                    <th className="admin-appt-th-choice">Choix</th>
                    <th className="admin-appt-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, index) => {
                    const statusView = resolveLiveAppointmentStatusView(item, liveNow);
                    const liveItem =
                      statusView.status !== item.status || statusView.autoRejected
                        ? {
                            ...item,
                            status: statusView.status,
                            autoRejected: Boolean(statusView.autoRejected),
                          }
                        : item;
                    const slot = formatSlot(item.startAt, item.endAt);
                    const modality = displayAppointmentModality(item);
                    const { userText } = parseAppointmentMeta(item.description);
                    const approvedPhase = getApprovedAppointmentPhase(item, liveNow);
                    const PhaseIcon =
                      approvedPhase === 'upcoming'
                        ? CalendarClock
                        : approvedPhase === 'ongoing'
                          ? Radio
                          : History;
                    return (
                      <tr
                        key={item.id}
                        data-status={liveItem.status}
                        data-approved-phase={approvedPhase ?? undefined}
                        data-selected={reviewItem?.id === item.id ? 'true' : undefined}
                        className={cn(
                          'admin-appt-table-row',
                          index % 2 === 1 && 'admin-appt-row-alt',
                          selectedIds.includes(item.id) && 'admin-appt-row--checked',
                          item.status === 'PENDING' &&
                            item.urgentOverride &&
                            'admin-appt-row--planning-urgent',
                          approvedPhase === 'upcoming' && 'admin-appt-row--approved-upcoming',
                          approvedPhase === 'ongoing' && 'admin-appt-row--approved-live',
                          approvedPhase === 'past' && 'admin-appt-row--approved-past'
                        )}
                        onClick={(event) => {
                          if (dialogOpenRef.current || rowClickLock.current) return;
                          setRescheduleTarget(null);
                          setRescheduleValidates(false);
                          const target = event.target;
                          if (
                            target instanceof Element &&
                            target.closest(
                              '.admin-appt-td-actions, [data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-item"], [data-slot="dialog-content"], [data-slot="dialog-overlay"]'
                            )
                          ) {
                            return;
                          }
                          setReviewItem(item);
                        }}
                      >
                        {canSelectRows ? (
                          <td className="admin-appt-td-select" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(item.id)}
                              onCheckedChange={(checked) => {
                                setSelectedIds((current) =>
                                  checked === true
                                    ? current.includes(item.id)
                                      ? current
                                      : [...current, item.id]
                                    : current.filter((id) => id !== item.id)
                                );
                              }}
                              aria-label={`Sélectionner ${item.title}`}
                            />
                          </td>
                        ) : null}
                        <td className={WORKSPACE_ROW_NUMBER_TD_CLASS}>{index + 1}</td>
                        <td className="admin-appt-td-main">
                          <div className="admin-appt-cell-main">
                            <p className="admin-appt-title">{item.title}</p>
                            {userText ? (
                              <p className="admin-appt-desc">{userText}</p>
                            ) : null}
                            <div className="admin-appt-meta">
                              <span
                                data-urgency={item.urgencyLevel}
                                className={cn(
                                  'admin-appt-badge',
                                  appointmentUrgencyBadgeClass(item.urgencyLevel)
                                )}
                              >
                                {APPOINTMENT_URGENCY_LABELS[item.urgencyLevel]}
                              </span>
                              {item.urgentOverride ? (
                                <span className="admin-appt-urgent-pill">
                                  <Zap className="h-3 w-3" />
                                  {PLANNING_URGENT_LABEL}
                                </span>
                              ) : null}
                              {item.importedFromExcel ? (
                                <span
                                  className="admin-appt-import-pill"
                                  title="Importé depuis un fichier Excel"
                                >
                                  <FileSpreadsheet className="h-3 w-3" aria-hidden />
                                  {APPOINTMENT_IMPORTED_LABEL}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="admin-appt-td-slot">
                          <div
                            className={cn(
                              'admin-appt-slot',
                              approvedPhase && `admin-appt-slot--${approvedPhase}`
                            )}
                          >
                            <div className="admin-appt-slot-icon" aria-hidden>
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="admin-appt-slot-date">{slot.date}</p>
                              <p className="admin-appt-slot-time">{slot.time}</p>
                              <p
                                className={cn(
                                  'admin-appt-slot-relative',
                                  approvedPhase && `admin-appt-slot-relative--${approvedPhase}`
                                )}
                              >
                                {slot.relative}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="admin-appt-td-status">
                          <div
                            className={cn(
                              'admin-appt-status',
                              approvedPhase && 'admin-appt-status--approved-phase'
                            )}
                          >
                            <div className="admin-appt-status-main">
                              <span className={cn('admin-appt-status-dot', appointmentStatusDotClass(statusView))} />
                              <span
                                className={cn(
                                  'admin-appt-badge',
                                  appointmentStatusBadgeClassForItem(statusView),
                                  approvedPhase && approvedAppointmentPhaseBadgeClass(approvedPhase)
                                )}
                              >
                                {appointmentStatusLabel(statusView)}
                              </span>
                            </div>
                            {approvedPhase ? (
                              <span
                                className={cn(
                                  'admin-appt-phase-pill',
                                  `admin-appt-phase-pill--${approvedPhase}`
                                )}
                              >
                                <PhaseIcon className="admin-appt-phase-pill-icon" aria-hidden />
                                {approvedAppointmentPhaseLabel(approvedPhase)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="admin-appt-td-choice">
                          <span
                            className={cn(
                              'admin-appt-choice',
                              modality.online ? 'admin-appt-choice--online' : 'admin-appt-choice--onsite'
                            )}
                          >
                            {modality.online ? (
                              <Video aria-hidden />
                            ) : (
                              <Building2 aria-hidden />
                            )}
                            {modality.label}
                          </span>
                        </td>
                        <td className="admin-appt-td-actions" onClick={(e) => e.stopPropagation()}>
                          <AppointmentRowActions
                            mode={isOwnScope ? 'own' : 'review'}
                            role={role}
                            permissions={permissions}
                            variant={listTab}
                            item={liveItem}
                            actionLoading={actionLoading}
                            editHref={buildPlanEditHref(item)}
                            onApprove={() => setApproveTarget(item)}
                            onReject={() => setRejectTarget(item)}
                            onReschedule={() => {
                              if (Date.now() - rescheduleClosedAt.current < 450) return;
                              lockRowClick();
                              setReviewItem(null);
                              const target = item;
                              const mode = target.status === 'PENDING' ? 'approve' : 'reschedule';
                              if (rescheduleOpenTimer.current != null) {
                                window.clearTimeout(rescheduleOpenTimer.current);
                              }
                              rescheduleOpenTimer.current = window.setTimeout(() => {
                                rescheduleOpenTimer.current = null;
                                openReschedule(target, mode);
                              }, 0);
                            }}
                            onDetail={() => setReviewItem(item)}
                            onArchive={() => setArchiveTarget(item)}
                            onRestore={() => void onConfirmRestore(item)}
                            onDelete={() => setDeleteTarget(item)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="admin-appt-table-foot">
              <span>
                {(data?.stats.pending ?? 0) > 0 ? (
                  <>
                    <strong>{data?.stats.pending}</strong> en attente de validation
                  </>
                ) : (
                  'Aucune demande en attente'
                )}
              </span>
              <span className="tabular-nums">
                Total période : <strong>{data?.stats.total ?? displayItems.length}</strong>
              </span>
            </div>
          </>
        ) : null}
      </div>

      {showTableLift ? (
        <button
          type="button"
          className="admin-appt-lift"
          onClick={scrollTableToTop}
          aria-label="Remonter en haut du tableau"
        >
          <ArrowUp aria-hidden />
          Haut
        </button>
      ) : null}

      {!isOwnScope ? (
        <>
          <AppointmentApproveDialog
            open={!!approveTarget}
            onOpenChange={(o) => {
              if (!o) {
                lockRowClick();
                setApproveTarget(null);
              }
            }}
            appointment={approveTarget}
            loading={actionLoading}
            onConfirm={onConfirmApprove}
          />

          <AppointmentRejectDialog
            open={!!rejectTarget}
            onOpenChange={(o) => {
              if (!o) {
                lockRowClick();
                setRejectTarget(null);
              }
            }}
            appointment={rejectTarget}
            loading={actionLoading}
            onSubmit={onRejectSubmit}
          />

          <AppointmentRescheduleDialog
            open={!!rescheduleTarget}
            onOpenChange={(o) => {
              if (!o) {
                markRescheduleClosed();
                lockRowClick();
                setReviewItem(null);
                setRescheduleTarget(null);
                setRescheduleValidates(false);
              }
            }}
            appointment={rescheduleTarget}
            mode={rescheduleMode}
            validatesNow={rescheduleValidates}
            urgentAllowed={urgentAllowed}
            loading={actionLoading}
            onSubmit={onRescheduleSubmit}
          />

          <AppointmentImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onImported={load}
          />
        </>
      ) : null}

      <AppointmentRequesterProfileDialog
        appointment={reviewItem}
        open={!!reviewItem && !rescheduleTarget && !approveTarget && !rejectTarget}
        loading={actionLoading}
        onOpenChange={(o) => !o && setReviewItem(null)}
        onApprove={
          isOwnScope || permissions['action.appointments.approve'] !== true
            ? undefined
            : (item) => {
                setReviewItem(null);
                setApproveTarget(item);
              }
        }
        onReschedule={
          isOwnScope || permissions['action.appointments.reschedule'] !== true
            ? undefined
            : (item, mode) => {
                openReschedule(item, mode);
              }
        }
        onReject={
          isOwnScope || permissions['action.appointments.reject'] !== true
            ? undefined
            : (item) => {
                setReviewItem(null);
                setRejectTarget(item);
              }
        }
      />

      <AdminConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        intent={
          archiveTarget && isApprovedAppointmentOngoing(archiveTarget, liveNow)
            ? 'blocked'
            : 'archive'
        }
        title={
          archiveTarget && isApprovedAppointmentOngoing(archiveTarget, liveNow)
            ? 'Mise en corbeille impossible'
            : isOwnScope
              ? 'Mettre en corbeille ?'
              : 'Mettre dans la corbeille ?'
        }
        message={
          archiveTarget ? (
            isApprovedAppointmentOngoing(archiveTarget, liveNow) ? (
              <>
                <span className="font-medium text-foreground">{archiveTarget.title}</span> est
                actuellement <span className="font-medium text-foreground">en cours</span>.{' '}
                {APPOINTMENT_ONGOING_ARCHIVE_MESSAGE}
              </>
            ) : isOwnScope ? (
              <>
                La demande <span className="font-medium text-foreground">{archiveTarget.title}</span>{' '}
                sera retirée de votre suivi actif. Vous pourrez la restaurer depuis la corbeille.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{archiveTarget.title}</span> sera retiré de la
                liste active. Vous pourrez le restaurer depuis la corbeille.
              </>
            )
          ) : null
        }
        confirmLabel="Mettre en corbeille"
        hideConfirm={Boolean(
          archiveTarget && isApprovedAppointmentOngoing(archiveTarget, liveNow)
        )}
        loading={actionLoading}
        onConfirm={() => void onConfirmArchive()}
      />

      <AdminConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Supprimer définitivement ?"
        message={
          deleteTarget ? (
            isOwnScope ? (
              <>
                La demande <span className="font-medium text-foreground">{deleteTarget.title}</span> sera
                supprimée de façon irréversible.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{deleteTarget.title}</span> sera supprimé de
                façon irréversible.
              </>
            )
          ) : null
        }
        confirmLabel="Supprimer"
        loading={actionLoading}
        onConfirm={() => void onConfirmDelete()}
      />

      <AdminConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={
          listTab === 'trash'
            ? 'Supprimer la sélection ?'
            : 'Mettre la sélection en corbeille ?'
        }
        message={
          listTab === 'trash' ? (
            <>
              <span className="font-medium text-foreground">{selectedIds.length}</span> rendez-vous seront
              supprimés de façon irréversible.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{selectedIds.length}</span> rendez-vous seront
              retirés de la liste active. Vous pourrez les restaurer depuis la corbeille. Un rendez-vous en
              cours est ignoré.
            </>
          )
        }
        confirmLabel={listTab === 'trash' ? 'Supprimer' : 'Mettre en corbeille'}
        loading={actionLoading}
        onConfirm={() => void onConfirmBulk()}
      />

      <AdminConfirmDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="Vider la corbeille ?"
        message={
          isOwnScope
            ? 'Toutes vos demandes en corbeille seront supprimées définitivement.'
            : 'Tous les rendez-vous en corbeille seront supprimés définitivement.'
        }
        confirmLabel="Vider la corbeille"
        loading={actionLoading}
        onConfirm={() => void onConfirmEmptyTrash()}
      />
    </div>
  );
}
