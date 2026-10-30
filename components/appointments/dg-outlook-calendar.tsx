'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  GripVertical,
  LayoutGrid,
  Loader2,
  Plus,
  ListTodo,
  Zap,
} from 'lucide-react';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { AppointmentImportDialog } from '@/components/appointments/appointment-import-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { formatIsoDateInAppTz, formatTimeInAppTz, getWallClockPartsInAppTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  useDgCalendarData,
  type CalendarAppointment,
  type CalendarView,
  canDragCalendarAppointment,
  isCalendarAppointmentPast,
} from '@/components/appointments/use-dg-calendar-data';
import { AppointmentPlanningDialog } from '@/components/appointments/appointment-planning-dialog';
import type { CalendarOverlayEvent } from '@/lib/dg/calendar-overlay-events';
import { canReviewAppointments } from '@/lib/dg/rbac';
import {
  PLANNING_URGENT_LABEL,
  PLANNING_URGENT_TOGGLE_DESC,
} from '@/lib/dg/urgent-slot-priority';

export type { CalendarAppointment };

const HOUR_START = 7;
const HOUR_END = 19;
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type Props = { canDrag?: boolean; compact?: boolean; onHide?: () => void };

function statusLabel(status: string) {
  if (status === 'APPROVED') return 'Approuvé';
  if (status === 'PENDING') return 'En attente';
  if (status === 'REJECTED') return 'Refusé';
  return status;
}

function parseSideEventTitle(title: string) {
  const match = title.match(/^RDV\s*[—–-]\s*(.+)$/i);
  if (match?.[1]) {
    return { prefixed: true, name: match[1].trim() };
  }
  return { prefixed: false, name: title };
}

function eventClassName(a: CalendarAppointment) {
  if (a.urgentOverride && !isCalendarAppointmentPast(a)) return 'dg-cal-event-urgent';
  if (a.status === 'PENDING') return 'dg-cal-event-pending';
  if (a.status === 'APPROVED') {
    if (isCalendarAppointmentPast(a)) return 'dg-cal-event-approved-past';
    return 'dg-cal-event-approved';
  }
  return 'border-l-[3px] border-l-muted-foreground/40 bg-muted/50 text-muted-foreground';
}

function formatEventTime(iso: string) {
  return formatTimeInAppTz(iso);
}

function eventTopPx(iso: string, hourPx: number) {
  const { hour, minute } = getWallClockPartsInAppTz(iso);
  return ((hour - HOUR_START) + minute / 60) * hourPx;
}

function appointmentDayKey(iso: string) {
  return formatIsoDateInAppTz(iso);
}

function overlayClassName(kind: CalendarOverlayEvent['kind']) {
  if (kind === 'holiday') return 'dg-cal-overlay-holiday';
  if (kind === 'unavailability') return 'dg-cal-overlay-unav';
  if (kind === 'mission-planned') return 'dg-cal-overlay-mission-planned';
  if (kind === 'mission-depart-today') return 'dg-cal-overlay-mission-depart-today';
  if (kind === 'mission-ongoing') return 'dg-cal-overlay-mission-ongoing';
  if (kind === 'mission-completed') return 'dg-cal-overlay-mission-completed';
  return 'dg-cal-overlay-mission-cancelled';
}

function overlayKindLabel(kind: CalendarOverlayEvent['kind']) {
  if (kind === 'holiday') return 'Jour férié';
  if (kind === 'unavailability') return 'Indisponibilité';
  if (kind === 'mission-planned') return 'Mission planifiée';
  if (kind === 'mission-depart-today') return 'Départ aujourd\'hui';
  if (kind === 'mission-ongoing') return 'Mission en cours';
  if (kind === 'mission-completed') return 'Mission terminée';
  return 'Mission annulée';
}

function OverlayChip({ event, compact }: { event: CalendarOverlayEvent; compact?: boolean }) {
  const timeLabel = event.allDay
    ? 'Journée'
    : `${formatEventTime(event.startAt)} – ${formatEventTime(event.endAt)}`;

  return (
    <div
      className={cn(
        'rounded-r-md rounded-l-sm border border-border/30 px-1.5 py-0.5 text-left',
        overlayClassName(event.kind),
        compact ? 'text-[9px] leading-snug' : 'text-[10px] leading-tight'
      )}
      title={`${event.title} · ${timeLabel}`}
    >
      <span className="block truncate font-medium">{event.title}</span>
    </div>
  );
}

type EventChipProps = {
  a: CalendarAppointment;
  compact?: boolean;
  draggable?: boolean;
  urgentOnDrag?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
};

function EventChip({ a, compact, draggable, urgentOnDrag, onDragStart, onDragEnd, isDragging }: EventChipProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.setData('appointmentId', a.id);
        if (urgentOnDrag) e.dataTransfer.setData('urgentOnDrop', '1');
        onDragStart?.(a.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group/event relative rounded-r-md rounded-l-sm border border-border/40 px-2 py-1 text-left transition-all duration-150',
        eventClassName(a),
        compact ? 'text-[10px] leading-snug' : 'text-[11px] leading-tight',
        draggable && 'cursor-grab hover:brightness-[0.98] active:cursor-grabbing active:scale-[0.99]',
        isDragging && 'scale-95 opacity-40 ring-2 ring-[color-mix(in_oklch,var(--dg-cal-green)_28%,transparent)]'
      )}
      title={`${a.title} · ${formatEventTime(a.startAt)} – ${formatEventTime(a.endAt)}`}
    >
      <div className="flex items-center gap-1">
        {!compact ? (
          <span className="shrink-0 tabular-nums font-semibold opacity-80">{formatEventTime(a.startAt)}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
        {a.urgentOverride ? <Zap className="h-2.5 w-2.5 shrink-0 text-amber-600" /> : null}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (v: CalendarView) => void;
}) {
  const items: { id: CalendarView; label: string; icon: React.ReactNode }[] = [
    { id: 'month', label: 'Mois', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'week', label: 'Semaine', icon: <Columns3 className="h-3.5 w-3.5" /> },
    { id: 'day', label: 'Jour', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="dg-cal-view-toggle inline-flex shrink-0 rounded-lg border border-border/60 bg-muted/50 p-0.5 shadow-inner">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all lg:gap-1.5 lg:px-2.5 lg:py-1.5 lg:text-xs',
            view === item.id
              ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {item.icon}
          <span className="hidden lg:inline">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function DayAgendaPanel({
  day,
  events,
  overlays,
  selectedAppointmentId,
  togglingUrgentId,
  onSelectAppointment,
  onOpenDay,
  onPlan,
}: {
  day: Date;
  events: CalendarAppointment[];
  overlays: CalendarOverlayEvent[];
  selectedAppointmentId?: string | null;
  togglingUrgentId?: string | null;
  onSelectAppointment?: (id: string | null) => void;
  onOpenDay: () => void;
  onPlan: (dateKey: string) => void;
}) {
  const key = format(day, 'yyyy-MM-dd');
  const urgentCount = events.filter((a) => a.urgentOverride).length;

  return (
    <aside
      className={cn(
        'dg-cal-day-panel dg-cal-day-panel--dense',
        urgentCount > 0 && 'dg-cal-day-panel--has-urgent'
      )}
    >
      <div className="dg-cal-day-panel-header">
        <p className="dg-cal-day-panel-eyebrow">Jour sélectionné</p>
        <p className="dg-cal-day-panel-date">
          {format(day, 'EEEE d MMMM', { locale: fr })}
        </p>
        <div className="dg-cal-day-panel-summary">
          {urgentCount > 0 ? (
            <span className="dg-cal-day-panel-summary-urgent">
              {urgentCount} ultra urgent{urgentCount > 1 ? 's' : ''}
            </span>
          ) : null}
          {urgentCount > 0 ? (
            <span className="dg-cal-day-panel-summary-sep" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="dg-cal-day-panel-summary-count">
            {events.length} RDV
          </span>
        </div>
      </div>

      {overlays.length > 0 || events.length > 0 ? (
        <div className="dg-cal-day-panel-list">
          {overlays.length > 0 ? (
            <div className="space-y-1">
              {overlays.map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    'rounded-md border border-border/40 px-1.5 py-1',
                    overlayClassName(o.kind)
                  )}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-wide opacity-80">
                    {overlayKindLabel(o.kind)}
                  </p>
                  <p className="break-words text-[10px] font-medium leading-snug">{o.title}</p>
                </div>
              ))}
            </div>
          ) : null}

          {events.map((a) => {
            const isSelected = selectedAppointmentId === a.id
            const isToggling = togglingUrgentId === a.id
            const parsedTitle = parseSideEventTitle(a.title)

            return (
              <button
                key={a.id}
                type="button"
                data-status={a.status}
                onClick={() => onSelectAppointment?.(isSelected ? null : a.id)}
                className={cn(
                  'dg-cal-side-event',
                  isSelected && 'dg-cal-side-event--selected',
                  a.urgentOverride && 'dg-cal-side-event--urgent',
                  isToggling && 'opacity-60'
                )}
              >
                <div className="dg-cal-side-event-inner">
                  <div className="dg-cal-side-event-head">
                    <p className="dg-cal-side-event-name" title={parsedTitle.name}>
                      {parsedTitle.name}
                    </p>
                    <div className="dg-cal-side-event-meta">
                      {a.urgentOverride ? (
                        <Zap
                          className="h-2.5 w-2.5 shrink-0 text-amber-600"
                          aria-label="Ultra urgent"
                        />
                      ) : null}
                      <span className="dg-cal-side-event-chip" data-status={a.status}>
                        {statusLabel(a.status)}
                      </span>
                    </div>
                  </div>
                  <p className="dg-cal-side-event-time">
                    {formatEventTime(a.startAt)} – {formatEventTime(a.endAt)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="dg-cal-day-panel-empty">
          <span className="dg-cal-day-panel-empty-icon" aria-hidden>
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <p className="dg-cal-day-panel-empty-title">Aucun rendez-vous</p>
          <p className="dg-cal-day-panel-empty-sub">Sélectionnez un jour ou créez un RDV</p>
        </div>
      )}

      <div className="dg-cal-day-panel-actions">
        <Button
          variant="outline"
          size="sm"
          className="dg-cal-analyze-btn"
          onClick={onOpenDay}
        >
          <ListTodo className="h-3 w-3" />
          Vue jour détaillée
        </Button>
        <Button
          type="button"
          size="sm"
          className="dg-cal-day-panel-plan"
          onClick={() => onPlan(key)}
        >
          <CalendarPlus className="h-3 w-3" />
          Nouveau RDV
        </Button>
      </div>
    </aside>
  )
}

function CalendarSkeleton() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-4 h-8 w-48 rounded-lg bg-muted" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export function DgOutlookCalendar({ canDrag = false, compact = false, onHide }: Props) {
  const role = useDgRole();
  const importAllowed = canReviewAppointments(role);
  const cal = useDgCalendarData(canDrag, role);
  const hourPx = compact ? 40 : 56;
  const maxMonthEvents = compact ? 2 : 3;
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [planDate, setPlanDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAppointmentId(null);
  }, [cal.selectedDay]);

  const openPlanning = (dateKey: string) => {
    setPlanDate(dateKey);
    setPlanOpen(true);
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cal.anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cal.anchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cal.anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cal.view === 'day' ? cal.selectedDay : cal.anchor, { weekStartsOn: 1 });
    return Array.from({ length: cal.view === 'day' ? 1 : 7 }, (_, i) => addDays(start, i));
  }, [cal.anchor, cal.selectedDay, cal.view]);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  const titleLabel = useMemo(() => {
    if (cal.view === 'month') return format(cal.anchor, 'MMMM yyyy', { locale: fr });
    if (cal.view === 'day') return format(cal.selectedDay, 'd MMMM yyyy', { locale: fr });
    const w = startOfWeek(cal.anchor, { weekStartsOn: 1 });
    return `${format(w, 'd', { locale: fr })} – ${format(addDays(w, 6), 'd MMM yyyy', { locale: fr })}`;
  }, [cal.view, cal.anchor, cal.selectedDay]);

  const dayStats = useMemo(() => {
    const todayItems = cal.todayAppointments;
    return {
      total: todayItems.length,
      approved: todayItems.filter((a) => a.status === 'APPROVED').length,
    };
  }, [cal.todayAppointments]);

  const selectedEvents = useMemo(
    () =>
      cal.items
        .filter((a) => appointmentDayKey(a.startAt) === format(cal.selectedDay, 'yyyy-MM-dd'))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [cal.items, cal.selectedDay]
  );

  const selectedOverlays = useMemo(
    () =>
      cal.overlays
        .filter((o) => appointmentDayKey(o.startAt) === format(cal.selectedDay, 'yyyy-MM-dd'))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [cal.overlays, cal.selectedDay]
  );

  useEffect(() => {
    if (!selectedAppointmentId) return;
    if (!selectedEvents.some((a) => a.id === selectedAppointmentId)) {
      setSelectedAppointmentId(null);
    }
  }, [selectedEvents, selectedAppointmentId]);

  const selectedAppointment = useMemo(
    () => (selectedAppointmentId ? cal.items.find((a) => a.id === selectedAppointmentId) ?? null : null),
    [cal.items, selectedAppointmentId]
  );

  const urgentToolbarChecked = selectedAppointment
    ? Boolean(selectedAppointment.urgentOverride)
    : cal.dragUrgentMode;

  const urgentToolbarTitle = selectedAppointment
    ? 'Activer ou désactiver la priorité ultra urgente pour le RDV sélectionné'
    : PLANNING_URGENT_TOGGLE_DESC;

  const handleUrgentToolbarChange = (checked: boolean) => {
    if (selectedAppointment) {
      void cal.toggleUrgent(selectedAppointment.id, checked);
      return;
    }
    cal.setDragUrgentMode(checked);
  };

  const nowLineTop = useMemo(() => {
    const { hour, minute } = getWallClockPartsInAppTz(new Date());
    if (hour < HOUR_START || hour > HOUR_END) return null;
    return ((hour - HOUR_START) + minute / 60) * hourPx;
  }, [hourPx]);

  const goToday = () => {
    const t = new Date();
    cal.setAnchor(t);
    cal.setSelectedDay(t);
  };

  const goPrev = () => {
    if (cal.view === 'month') cal.setAnchor((d) => subMonths(d, 1));
    else if (cal.view === 'week') cal.setAnchor((d) => subWeeks(d, 1));
    else cal.setSelectedDay((d) => addDays(d, -1));
  };

  const goNext = () => {
    if (cal.view === 'month') cal.setAnchor((d) => addMonths(d, 1));
    else if (cal.view === 'week') cal.setAnchor((d) => addWeeks(d, 1));
    else cal.setSelectedDay((d) => addDays(d, 1));
  };

  const dayAppointments = (dayKey: string) =>
    cal.items
      .filter((a) => appointmentDayKey(a.startAt) === dayKey)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const dayOverlays = (dayKey: string) =>
    cal.overlays
      .filter((o) => appointmentDayKey(o.startAt) === dayKey)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const handleDrop = (dateKey: string, hour?: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropDay(null);
    const id = e.dataTransfer.getData('appointmentId');
    const urgent = e.dataTransfer.getData('urgentOnDrop') === '1' || cal.dragUrgentMode;
    if (id) void cal.onDropToDay(id, dateKey, hour, urgent);
    cal.setDraggingId(null);
  };

  const dragHandlers = (dateKey: string, hour?: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!cal.dragEnabled) return;
      e.preventDefault();
      setDropDay(`${dateKey}-${hour ?? 'all'}`);
    },
    onDragLeave: () => setDropDay(null),
    onDrop: handleDrop(dateKey, hour),
  });

  const showSidePanel = cal.view === 'month';

  return (
    <div className={cn('dg-cal-shell dg-cal-theme', compact && 'dg-cal-shell--compact')}>
      {/* Toolbar */}
      <div className="dg-cal-toolbar">
        <div className="dg-cal-toolbar-row">
          <div className="dg-cal-toolbar-left">
            <div className="dg-cal-icon">
              <CalendarDays className={cn(compact ? 'h-4 w-4' : 'h-4 w-4')} />
            </div>
            <div className="dg-cal-toolbar-title">
              <p className="dg-cal-toolbar-eyebrow">Période</p>
              <h2
                className={cn(
                  'truncate font-semibold capitalize tracking-tight text-foreground',
                  compact ? 'text-sm' : 'text-base'
                )}
              >
                {titleLabel}
              </h2>
            </div>

            <Separator orientation="vertical" className={cn('hidden sm:block', compact ? 'h-6' : 'h-8')} />

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={cn('shrink-0 shadow-sm', compact ? 'h-7 px-2 text-xs' : 'h-8')}
                onClick={goToday}
              >
                Aujourd&apos;hui
              </Button>
              <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('rounded-none', compact ? 'h-7 w-7' : 'h-8 w-8')}
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('rounded-none', compact ? 'h-7 w-7' : 'h-8 w-8')}
                  onClick={goNext}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {onHide ? (
                <button type="button" className="dg-cal-hide-btn" onClick={onHide}>
                  Masquer
                </button>
              ) : null}
            </div>
          </div>

          <div className="dg-cal-toolbar-right">
            <div
              className={cn(
                'dg-cal-toolbar-stats',
                compact && 'px-2 py-1 text-[10px]'
              )}
            >
              <span>
                <span className="font-semibold text-foreground">{dayStats.total}</span>
                <span className="text-muted-foreground"> RDV aujourd&apos;hui</span>
              </span>
              <span className="text-border">|</span>
              <span className="dg-cal-accent-text font-medium">{dayStats.approved} acceptés</span>
            </div>

            {cal.urgentAllowed ? (
              <div
                className={cn(
                  'dg-cal-toolbar-urgent',
                  selectedAppointment && 'dg-cal-toolbar-urgent--active'
                )}
                title={urgentToolbarTitle}
              >
                <Switch
                  id="drag-urgent-outlook"
                  checked={urgentToolbarChecked}
                  disabled={
                    selectedAppointment
                      ? cal.togglingUrgentId === selectedAppointment.id
                      : !cal.dragEnabled
                  }
                  onCheckedChange={handleUrgentToolbarChange}
                />
                <Label
                  htmlFor="drag-urgent-outlook"
                  className="dg-cal-toolbar-urgent-label"
                >
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="truncate">{PLANNING_URGENT_LABEL}</span>
                </Label>
              </div>
            ) : null}

            {importAllowed ? (
              <button
                type="button"
                className={cn('dg-cal-import-btn', compact && 'dg-cal-import-btn--compact')}
                onClick={() => setImportOpen(true)}
                aria-label="Importer des rendez-vous (Excel)"
                title="Importer des rendez-vous (Excel)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden xl:inline">Import Excel</span>
              </button>
            ) : null}

            <ViewToggle view={cal.view} onChange={cal.setView} />
          </div>
        </div>
      </div>

      <div className={cn('dg-cal-body', showSidePanel && 'dg-cal-body--with-panel')}>
        <div className="dg-cal-main">
          {cal.loading ? <CalendarSkeleton /> : null}

          {cal.view === 'month' && !cal.loading ? (
            <div className="select-none">
              <div className="dg-cal-weekday-row grid grid-cols-7 border-b border-border/50 bg-muted/30">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={cn(
                      'py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider',
                      i >= 5 ? 'text-muted-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, cal.anchor);
                  const today = isToday(day);
                  const selected = isSameDay(day, cal.selectedDay);
                  const weekend = isWeekend(day);
                  const overlays = dayOverlays(key);
                  const events = dayAppointments(key);
                  const visibleOverlays = overlays.slice(0, compact ? 1 : 2);
                  const visibleEvents = events.slice(0, Math.max(0, maxMonthEvents - visibleOverlays.length));
                  const more =
                    overlays.length -
                    visibleOverlays.length +
                    (events.length - visibleEvents.length);
                  const dropActive = dropDay?.startsWith(key);

                  return (
                    <div
                      key={key}
                      className={cn(
                        'dg-cal-month-cell group relative border-b border-r border-border/40 p-1 transition-all duration-150 last:border-r-0',
                        compact ? 'min-h-[72px]' : 'min-h-[96px]',
                        inMonth ? 'bg-card' : 'bg-muted/20',
                        weekend && inMonth && 'bg-muted/15',
                        !selected && 'hover:bg-muted/25',
                        selected && 'dg-cal-day-cell--selected',
                        dropActive && cal.dragEnabled && 'bg-[color-mix(in_oklch,var(--dg-cal-green-soft)_40%,white)]'
                      )}
                      onClick={() => cal.setSelectedDay(day)}
                      {...dragHandlers(key)}
                    >
                      <div className="dg-cal-day-cell-head mb-1 flex items-center justify-between px-0.5">
                        <span
                          className={cn(
                            today ? 'dg-cal-day-num-today' : 'dg-cal-day-num',
                            !today && inMonth && 'text-foreground',
                            !today && !inMonth && 'text-muted-foreground/70'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        <button
                          type="button"
                          className="dg-cal-day-hover-btn flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPlanning(key);
                          }}
                          title="Nouveau rendez-vous"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-0.5 px-0.5">
                        {visibleOverlays.map((o) => (
                          <OverlayChip key={o.id} event={o} compact />
                        ))}
                        {visibleEvents.map((a) => (
                          <EventChip
                            key={a.id}
                            a={a}
                            compact
                            draggable={canDragCalendarAppointment(a, cal.dragEnabled)}
                            urgentOnDrag={cal.dragUrgentMode}
                            onDragStart={(id) => cal.setDraggingId(id)}
                            onDragEnd={() => cal.setDraggingId(null)}
                            isDragging={cal.draggingId === a.id}
                          />
                        ))}
                        {more > 0 ? (
                          <button
                            type="button"
                            className="dg-cal-more-link w-full rounded-md px-1 py-0.5 text-left text-[10px] font-medium transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              cal.setSelectedDay(day);
                              cal.setView('day');
                            }}
                          >
                            +{more} autre{more > 1 ? 's' : ''}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {(cal.view === 'week' || cal.view === 'day') && !cal.loading ? (
            <div className={cn('overflow-auto', compact ? 'max-h-[min(58vh,520px)]' : 'max-h-[min(72vh,680px)]')}>
              <div
                className="sticky top-0 z-10 grid border-b border-border/50 bg-card/95 backdrop-blur-sm"
                style={{ gridTemplateColumns: `${compact ? 40 : 52}px repeat(${weekDays.length}, minmax(0, 1fr))` }}
              >
                <div className="border-r border-border/40" />
                {weekDays.map((day) => {
                  const today = isToday(day);
                  const selected = isSameDay(day, cal.selectedDay);
                  return (
                    <button
                      key={format(day, 'yyyy-MM-dd')}
                      type="button"
                      onClick={() => cal.setSelectedDay(day)}
                      className={cn(
                        'border-l border-border/40 px-2 py-3 text-center transition-colors',
                        today && 'dg-cal-week-day--today',
                        selected && 'dg-cal-week-day--selected'
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {format(day, 'EEE', { locale: fr })}
                      </div>
                      <div
                        className={cn(
                          'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                          today && 'dg-cal-week-num-today',
                          !today && 'text-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                className="relative grid"
                style={{ gridTemplateColumns: `${compact ? 40 : 52}px repeat(${weekDays.length}, minmax(0, 1fr))` }}
              >
                <div className="dg-cal-hour-gutter border-r border-border/40 bg-muted/20">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="dg-cal-hour-row relative border-b border-border/30 pr-1.5 text-right text-[10px] font-medium text-muted-foreground"
                      style={{ height: hourPx }}
                    >
                      <span className="dg-cal-hour-label">{h}:00</span>
                    </div>
                  ))}
                </div>

                {weekDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const events = dayAppointments(key);
                  const overlays = dayOverlays(key);
                  const showNow = isToday(day) && nowLineTop !== null;

                  return (
                    <div key={key} className="relative border-l border-border/40 bg-card/50">
                      {overlays.some((o) => o.allDay) ? (
                        <div className="absolute inset-x-0 top-0 z-[5] space-y-0.5 p-0.5">
                          {overlays
                            .filter((o) => o.allDay)
                            .map((o) => (
                              <OverlayChip key={o.id} event={o} compact />
                            ))}
                        </div>
                      ) : null}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className={cn(
                            'border-b border-border/25',
                            h % 2 === 0 && 'bg-muted/[0.03]',
                            dropDay === `${key}-${h}` && cal.dragEnabled && 'bg-[color-mix(in_oklch,var(--dg-cal-green-soft)_35%,white)]'
                          )}
                          style={{ height: hourPx }}
                          {...dragHandlers(key, h)}
                        />
                      ))}
                      {showNow ? <div className="dg-cal-now-line" style={{ top: nowLineTop }} /> : null}
                      {overlays
                        .filter((o) => !o.allDay)
                        .map((o) => {
                          const top = eventTopPx(o.startAt, hourPx);
                          const height = Math.max(
                            compact ? 20 : 28,
                            ((new Date(o.endAt).getTime() - new Date(o.startAt).getTime()) / 3600000) *
                              hourPx
                          );
                          return (
                            <div
                              key={o.id}
                              className="absolute left-0.5 right-0.5 z-[8] opacity-95"
                              style={{ top: top + 2, height: height - 4 }}
                            >
                              <OverlayChip event={o} compact />
                            </div>
                          );
                        })}
                      {events.map((a) => {
                        const top = eventTopPx(a.startAt, hourPx);
                        const height = Math.max(
                          compact ? 20 : 28,
                          ((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 3600000) *
                            hourPx
                        );
                        const draggable = canDragCalendarAppointment(a, cal.dragEnabled);

                        return (
                          <div
                            key={a.id}
                            className="absolute left-1 right-1 z-10"
                            style={{ top: top + 2, height: height - 4 }}
                          >
                            <div
                              draggable={draggable}
                              onDragStart={(e) => {
                                if (!draggable) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.setData('appointmentId', a.id);
                                if (cal.dragUrgentMode) e.dataTransfer.setData('urgentOnDrop', '1');
                                cal.setDraggingId(a.id);
                              }}
                              onDragEnd={() => cal.setDraggingId(null)}
                              className={cn(
                                'flex h-full flex-col justify-center rounded-lg border border-border/40 px-2 py-1 shadow-md',
                                eventClassName(a),
                                draggable && 'cursor-grab active:cursor-grabbing',
                                cal.draggingId === a.id && 'opacity-40'
                              )}
                            >
                              <p className="truncate text-[11px] font-semibold">{a.title}</p>
                              <p className="truncate text-[9px] opacity-80">
                                {formatEventTime(a.startAt)} – {formatEventTime(a.endAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!cal.loading && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 bg-muted/25 text-muted-foreground',
                compact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2.5 text-[11px]'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="dg-cal-legend-dot h-2.5 w-1 rounded-full" />
                Approuvé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-event-pending border border-border/40" />
                En attente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-1 rounded-full bg-amber-500" />
                Urgent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-overlay-holiday border border-border/30" />
                Férié
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-overlay-unav border border-border/30" />
                Indispo.
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-overlay-mission-planned border border-border/30" />
                Mission planifiée
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-overlay-mission-ongoing border border-border/30" />
                Mission en cours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm dg-cal-overlay-mission-completed border border-border/30" />
                Mission terminée
              </span>
              {cal.dragEnabled ? (
                <span className="ml-auto flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  Glisser-déposer pour reprogrammer (RDV à venir uniquement)
                </span>
              ) : null}
            </div>
          )}
        </div>

        {showSidePanel ? (
          <DayAgendaPanel
            day={cal.selectedDay}
            events={selectedEvents}
            overlays={selectedOverlays}
            selectedAppointmentId={selectedAppointmentId}
            togglingUrgentId={cal.togglingUrgentId}
            onSelectAppointment={setSelectedAppointmentId}
            onOpenDay={() => {
              cal.setAnchor(cal.selectedDay);
              cal.setView('day');
            }}
            onPlan={openPlanning}
          />
        ) : null}
      </div>

      {cal.loading ? (
        <div className="flex items-center justify-center gap-2 border-t py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Synchronisation de l&apos;agenda…
        </div>
      ) : null}

      <AppointmentPlanningDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        defaultDate={planDate}
        onSuccess={() => void cal.load({ silent: true })}
      />

      <AppointmentImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void cal.load({ silent: true })}
      />
    </div>
  );
}

export function DgWeekCalendar(props: Props) {
  return <DgOutlookCalendar {...props} />;
}
