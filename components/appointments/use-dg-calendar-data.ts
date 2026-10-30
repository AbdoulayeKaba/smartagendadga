'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { LIVE_TOPICS, emitLiveRefresh, useLiveRefresh } from '@/lib/dg/live-refresh';
import type { CalendarOverlayEvent } from '@/lib/dg/calendar-overlay-events';
import { slotStartTime, type CalendarSlotId } from '@/lib/dg/calendar-slots';
import {
  CALENDAR_DRAG_BLOCKED_MESSAGE,
  canDragCalendarAppointment,
  isCalendarAppointmentPast,
} from '@/lib/dg/calendar-appointment-drag';
import { canUseUrgentOverride, type DgRole } from '@/lib/dg/rbac';
import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';

export type CalendarAppointment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  priority: string;
  urgentOverride?: boolean;
};

export type CalendarView = 'month' | 'week' | 'day';

export { canDragCalendarAppointment, isCalendarAppointmentPast };

function resolveCalendarRange(
  view: CalendarView,
  anchor: Date,
  selectedDay: Date
): { from: Date; to: Date } {
  if (view === 'month') {
    const mStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const mEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return { from: mStart, to: addDays(mEnd, 1) };
  }
  if (view === 'day') {
    const d = new Date(selectedDay);
    d.setHours(0, 0, 0, 0);
    return { from: d, to: addDays(d, 1) };
  }
  const wStart = startOfWeek(anchor, { weekStartsOn: 1 });
  return { from: wStart, to: addDays(wStart, 7) };
}

export function useDgCalendarData(canDrag: boolean, role: DgRole) {
  const dragEnabled = canDrag && (role === 'ASSISTANT' || role === 'DG');
  const urgentAllowed = canUseUrgentOverride(role);
  const { year } = useTemporalNavigation();

  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  useEffect(() => {
    setAnchor((prev) => {
      if (prev.getFullYear() === year) return prev;
      return new Date(year, prev.getMonth(), 1);
    });
    setSelectedDay((prev) => {
      if (prev.getFullYear() === year) return prev;
      return new Date(year, prev.getMonth(), Math.min(prev.getDate(), 28));
    });
  }, [year]);
  const [items, setItems] = useState<CalendarAppointment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<CalendarAppointment[]>([]);
  const [overlays, setOverlays] = useState<CalendarOverlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragUrgentMode, setDragUrgentMode] = useState(false);
  const [togglingUrgentId, setTogglingUrgentId] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  /** Re-render périodique pour actualiser l'état passé / déplaçable sans rechargement API. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setItems((current) => (current.length ? [...current] : current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * Clé stable de la plage chargée.
   * En vue mois/semaine, le jour sélectionné n’influence pas from/to —
   * un clic sur une case ne déclenche donc ni fetch ni skeleton.
   */
  const dataRangeKey = useMemo(() => {
    const { from, to } = resolveCalendarRange(view, anchor, selectedDay);
    return `${view}:${from.getTime()}:${to.getTime()}`;
  }, [view, anchor, selectedDay]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true || hasLoadedOnceRef.current;
    if (!silent) setLoading(true);
    try {
      const { from, to } = resolveCalendarRange(view, anchor, selectedDay);
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const todayFrom = addDays(new Date(), -1).toISOString();
      const todayTo = addDays(new Date(), 2).toISOString();
      const [apptRes, overlayRes, todayRes] = await Promise.all([
        fetch(`/api/appointments?status=APPROVED&from=${fromIso}&to=${toIso}`),
        fetch(`/api/dg/calendar-overlays?from=${fromIso}&to=${toIso}`),
        fetch(`/api/appointments?from=${todayFrom}&to=${todayTo}`),
      ]);
      const apptJson = await apptRes.json();
      const overlayJson = overlayRes.ok ? await overlayRes.json() : { items: [] };
      const todayJson = todayRes.ok ? await todayRes.json() : { items: [] };
      const todayKey = formatIsoDateInAppTz(new Date());
      setItems(apptJson.items ?? []);
      setOverlays(overlayJson.items ?? []);
      setTodayAppointments(
        ((todayJson.items ?? []) as CalendarAppointment[]).filter(
          (item) =>
            formatIsoDateInAppTz(item.startAt) === todayKey &&
            (item.status === 'PENDING' || item.status === 'APPROVED')
        )
      );
      hasLoadedOnceRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [view, anchor, selectedDay]);

  useEffect(() => {
    void load();
    // Recharge uniquement quand la plage de données change vraiment (pas au clic jour).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataRangeKey
  }, [dataRangeKey]);

  useLiveRefresh(() => void load({ silent: true }), {
    topics: [LIVE_TOPICS.appointments, LIVE_TOPICS.all],
    intervalMs: 0,
  });

  const reschedule = async (
    appointmentId: string,
    targetDate: string,
    startTime: string,
    endTime: string,
    applyUrgent?: boolean
  ) => {
    const body: Record<string, unknown> = { date: targetDate, startTime, endTime, keepApproved: true };
    if (applyUrgent && urgentAllowed) body.urgentOverride = true;

    const res = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Déplacement impossible',
        description:
          j.error === 'SCHEDULE_CONFLICT'
            ? 'Conflit (buffer 15 min inclus).'
            : j.error === 'APPOINTMENT_NOT_RESCHEDULABLE'
              ? CALENDAR_DRAG_BLOCKED_MESSAGE
              : j.message || 'Le créneau n’a pas pu être déplacé. Réessayez.',
      });
      return false;
    }
    toast({
      title: 'Rendez-vous déplacé',
      description: applyUrgent
        ? 'Le rendez-vous reste validé. Priorité ultra urgente activée.'
        : 'Le rendez-vous reste validé sur le nouveau créneau.',
    });
    await load({ silent: true });
    emitLiveRefresh(LIVE_TOPICS.appointments);
    return true;
  };

  const onDropToDay = async (
    appointmentId: string,
    targetDate: string,
    hour?: number,
    applyUrgent?: boolean
  ) => {
    const appt = items.find((a) => a.id === appointmentId);
    if (!appt) return;
    if (appt.status !== 'APPROVED') {
      toast({ variant: 'destructive', title: 'RDV non déplaçable.' });
      return;
    }
    if (!canDragCalendarAppointment(appt, true)) {
      toast({
        variant: 'destructive',
        title: 'Déplacement impossible',
        description: CALENDAR_DRAG_BLOCKED_MESSAGE,
      });
      return;
    }

    const oldStart = new Date(appt.startAt);
    const oldEnd = new Date(appt.endAt);
    const durationMin = Math.max(15, Math.round((oldEnd.getTime() - oldStart.getTime()) / 60_000));
    const wall = formatTimeInAppTz(oldStart);
    const [wallH, wallM] = wall.split(':').map(Number);
    const h = hour ?? wallH;
    const m = hour !== undefined ? 0 : wallM;
    const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endTotal = h * 60 + m + durationMin;
    const endTimeStr = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

    await reschedule(appointmentId, targetDate, startTime, endTimeStr, applyUrgent);
  };

  const onDropToSlot = async (
    appointmentId: string,
    targetDate: string,
    slotId: CalendarSlotId,
    applyUrgent?: boolean
  ) => {
    const appt = items.find((a) => a.id === appointmentId);
    if (!appt) return;
    if (appt.status !== 'APPROVED') return;
    if (!canDragCalendarAppointment(appt, true)) {
      toast({
        variant: 'destructive',
        title: 'Déplacement impossible',
        description: CALENDAR_DRAG_BLOCKED_MESSAGE,
      });
      return;
    }

    const oldStart = new Date(appt.startAt);
    const oldEnd = new Date(appt.endAt);
    const durationMin = Math.max(15, Math.round((oldEnd.getTime() - oldStart.getTime()) / 60_000));
    const { hour, minute } = slotStartTime(slotId);
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endTotal = hour * 60 + minute + durationMin;
    const endTimeStr = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

    await reschedule(appointmentId, targetDate, startTime, endTimeStr, applyUrgent);
  };

  const toggleUrgent = async (appointmentId: string, next: boolean) => {
    setTogglingUrgentId(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/urgent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgentOverride: next }),
      });
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Échec' });
        return;
      }
      toast({
        variant: next ? 'warning' : 'success',
        title: next ? 'Priorité ultra urgente activée' : 'Priorité ultra urgente désactivée',
        description: next
          ? 'La demande remonte en tête de file pour traitement immédiat.'
          : 'La demande reprend sa place dans la file standard.',
      });
      await load({ silent: true });
      emitLiveRefresh(LIVE_TOPICS.appointments);
    } finally {
      setTogglingUrgentId(null);
    }
  };

  return {
    view,
    setView,
    anchor,
    setAnchor,
    selectedDay,
    setSelectedDay,
    items,
    todayAppointments,
    overlays,
    loading,
    draggingId,
    setDraggingId,
    dragUrgentMode,
    setDragUrgentMode,
    dragEnabled,
    urgentAllowed,
    togglingUrgentId,
    onDropToDay,
    onDropToSlot,
    toggleUrgent,
    load,
  };
}
