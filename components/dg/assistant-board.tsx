'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Plus,
} from 'lucide-react';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { detectDailyAgendaConflicts } from '@/lib/ai/agenda-conflicts';
import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';
import {
  DG_ROOM_AVAILABILITY_HREF,
  DG_ROOM_RESERVATIONS_HREF,
} from '@/lib/dg/meeting-room-config';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'day' | 'list';

type AppointmentRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  location: string | null;
  isOnlineMeeting: boolean;
  description: string | null;
  participants?: { id: string }[];
  requestedBy?: { firstName: string; lastName: string };
};

type RoomRow = {
  id: string;
  title: string;
  roomName: string;
  startAt: string;
  endAt: string;
  status: string;
  appointmentId?: string;
};

type OverlayRow = {
  id: string;
  kind: string;
  title: string;
  startAt: string;
};

type Chip = {
  id: string;
  title: string;
  time: string;
  tone: 'confirmed' | 'pending' | 'live' | 'upcoming' | 'holiday' | 'room';
};

const VIEW_LABELS: { id: ViewMode; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'week', label: 'Semaine' },
  { id: 'day', label: 'Jour' },
  { id: 'list', label: 'Liste' },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function dayKey(value: Date | string) {
  return formatIsoDateInAppTz(value);
}

function sameDay(a: Date | string, b: Date | string) {
  return dayKey(a) === dayKey(b);
}

function requesterName(row: AppointmentRow) {
  const person = row.requestedBy;
  if (!person) return '';
  return `${person.firstName} ${person.lastName}`.trim();
}

function placeLabel(row: AppointmentRow) {
  const meta = parseAppointmentMeta(row.description);
  if (row.isOnlineMeeting && !meta.meta.roomName) return 'En ligne (Teams)';
  if (meta.meta.roomName?.trim()) return meta.meta.roomName.trim();
  if (row.location?.trim()) return row.location.trim();
  if (row.isOnlineMeeting) return 'En ligne (Teams)';
  return '';
}

function badgeFor(row: AppointmentRow, now: Date) {
  const start = new Date(row.startAt);
  const end = new Date(row.endAt);
  if (row.status === 'PENDING') return { label: 'À valider', tone: 'amber' as const };
  if (now >= start && now < end) return { label: 'En cours', tone: 'blue' as const };
  if (start.getTime() > now.getTime() && !sameDay(start, now)) {
    return { label: 'À venir', tone: 'violet' as const };
  }
  return { label: 'Confirmé', tone: 'green' as const };
}

function chipTone(row: AppointmentRow, now: Date): Chip['tone'] {
  const start = new Date(row.startAt);
  const end = new Date(row.endAt);
  if (row.status === 'PENDING') return 'pending';
  if (now >= start && now < end) return 'live';
  if (start.getTime() > now.getTime()) return 'upcoming';
  return 'confirmed';
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function AssistantBoard() {
  const [now, setNow] = useState(() => new Date());
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<ViewMode>('month');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [todayRooms, setTodayRooms] = useState(0);
  const [holidays, setHolidays] = useState<OverlayRow[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  const range = useMemo(() => {
    const monthStart = startOfMonth(anchor);
    const from = startOfWeek(monthStart, { weekStartsOn: 1 });
    const to = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 15);
    return { from, to };
  }, [anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = dayKey(new Date());
    const from = range.from.toISOString();
    const to = range.to.toISOString();
    try {
      const [apptRes, pendingRes, roomRes, todayRoomRes, overlayRes] = await Promise.all([
        fetch(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          cache: 'no-store',
        }),
        fetch('/api/appointments?status=PENDING', { cache: 'no-store' }),
        fetch(
          `/api/dg/room-reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&status=ALL`,
          { cache: 'no-store' }
        ),
        fetch(`/api/dg/room-reservations?date=${today}&status=ALL`, { cache: 'no-store' }),
        fetch(
          `/api/dg/calendar-overlays?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: 'no-store' }
        ),
      ]);
      const apptJson = apptRes.ok ? await apptRes.json() : { items: [] };
      const pendingJson = pendingRes.ok ? await pendingRes.json() : { items: [] };
      const roomJson = roomRes.ok ? await roomRes.json() : { items: [] };
      const todayRoomJson = todayRoomRes.ok ? await todayRoomRes.json() : { items: [] };
      const overlayJson = overlayRes.ok ? await overlayRes.json() : { items: [] };
      const visible = ((apptJson.items ?? []) as AppointmentRow[]).filter(
        (row) => row.status === 'APPROVED' || row.status === 'PENDING'
      );
      setAppointments(visible);
      setPendingCount(((pendingJson.items ?? []) as AppointmentRow[]).length);
      setRooms((roomJson.items ?? []) as RoomRow[]);
      setTodayRooms(
        ((todayRoomJson.items ?? []) as RoomRow[]).filter(
          (row) => row.status === 'CONFIRMED' || row.status === 'PENDING'
        ).length
      );
      setHolidays(
        ((overlayJson.items ?? []) as OverlayRow[]).filter((row) => row.kind === 'holiday')
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [anchor]);

  const selectedDate = useMemo(() => {
    const match = monthDays.find((day) => dayKey(day) === selectedKey);
    if (match) return match;
    const [year, month, day] = selectedKey.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1, 12);
  }, [monthDays, selectedKey]);

  const conflicts = useMemo(() => {
    const approved = appointments.filter((row) => row.status === 'APPROVED');
    const byDay = new Map<string, AppointmentRow[]>();
    for (const row of approved) {
      const key = dayKey(row.startAt);
      const group = byDay.get(key) ?? [];
      group.push(row);
      byDay.set(key, group);
    }
    return [...byDay.values()].flatMap((group) =>
      detectDailyAgendaConflicts(
        group.map((row) => ({
          id: row.id,
          title: row.title,
          startAt: new Date(row.startAt),
          endAt: new Date(row.endAt),
          requester: requesterName(row),
        }))
      )
    );
  }, [appointments]);

  const todayKey = dayKey(now);
  const todayAppointments = appointments.filter(
    (row) => row.status === 'APPROVED' && dayKey(row.startAt) === todayKey
  );
  const dayAppointments = appointments
    .filter((row) => dayKey(row.startAt) === selectedKey)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const upcoming = appointments
    .filter((row) => new Date(row.startAt).getTime() > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 4);

  function chipsFor(day: Date): Chip[] {
    const key = dayKey(day);
    const holidayChips: Chip[] = holidays
      .filter((row) => dayKey(row.startAt) === key)
      .map((row) => ({
        id: row.id,
        title: row.title.replace(/\s*\([^)]*\)\s*$/, ''),
        time: '',
        tone: 'holiday',
      }));
    const appointmentChips: Chip[] = appointments
      .filter((row) => dayKey(row.startAt) === key)
      .map((row) => ({
        id: row.id,
        title: row.title,
        time: formatTimeInAppTz(row.startAt),
        tone: chipTone(row, now),
      }));
    const linked = new Set(
      appointments
        .map((row) => parseAppointmentMeta(row.description).meta.roomReservationId)
        .filter((id): id is string => Boolean(id))
    );
    const roomChips: Chip[] = rooms
      .filter(
        (row) =>
          dayKey(row.startAt) === key &&
          (row.status === 'CONFIRMED' || row.status === 'PENDING') &&
          !row.appointmentId &&
          !linked.has(row.id)
      )
      .map((row) => ({
        id: `room-${row.id}`,
        title: row.title,
        time: formatTimeInAppTz(row.startAt),
        tone: 'room',
      }));
    return [...holidayChips, ...appointmentChips, ...roomChips];
  }

  function shift(direction: -1 | 1) {
    if (view === 'month' || view === 'list') {
      setAnchor((current) => (direction < 0 ? subMonths(current, 1) : addMonths(current, 1)));
      return;
    }
    if (view === 'week') {
      setAnchor((current) => (direction < 0 ? subWeeks(current, 1) : addWeeks(current, 1)));
      return;
    }
    const next = addDays(selectedDate, direction);
    setSelectedKey(dayKey(next));
    setAnchor(next);
  }

  function goToday() {
    const current = new Date();
    setNow(current);
    setAnchor(current);
    setSelectedKey(dayKey(current));
  }

  function exportAgenda() {
    const rows = appointments
      .filter((row) => isSameMonth(new Date(row.startAt), anchor))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const header = ['Date', 'Début', 'Fin', 'Objet', 'Statut', 'Lieu', 'Demandeur'];
    const lines = [
      header.map(csvCell).join(';'),
      ...rows.map((row) =>
        [
          dayKey(row.startAt),
          formatTimeInAppTz(row.startAt),
          formatTimeInAppTz(row.endAt),
          row.title,
          row.status === 'PENDING' ? 'En attente' : 'Confirmé',
          placeLabel(row),
          requesterName(row),
        ]
          .map(csvCell)
          .join(';')
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agenda-dga-${format(anchor, 'yyyy-MM')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const periodLabel =
    view === 'day'
      ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })
      : view === 'week'
        ? `Semaine du ${format(weekDays[0] ?? anchor, 'd MMM', { locale: fr })}`
        : format(anchor, 'MMMM yyyy', { locale: fr });

  return (
    <div className="asst-board">
      <header className="asst-board-head">
        <div>
          <h1>Espace Assistante</h1>
          <p>Gestion des rendez-vous, réservations de salles et suivi de l&apos;agenda du DGA</p>
        </div>
        <div className="asst-board-plan" ref={menuRef}>
          <button
            type="button"
            className="asst-board-plan-btn"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Plus aria-hidden />
            Planifier un rendez-vous
            <ChevronDown aria-hidden />
          </button>
          {menuOpen ? (
            <div className="asst-board-plan-menu" role="menu">
              <Link href="/dg/plan" role="menuitem" onClick={() => setMenuOpen(false)}>
                Nouveau rendez-vous
              </Link>
              <Link href={DG_ROOM_AVAILABILITY_HREF} role="menuitem" onClick={() => setMenuOpen(false)}>
                Réserver une salle
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <section className="asst-kpis" aria-label="Indicateurs">
        <Kpi
          tone="amber"
          icon={<Clock3 aria-hidden />}
          value={pendingCount}
          label="Demandes en attente"
          href="/dg/appointments"
          action="Voir les demandes"
        />
        <Kpi
          tone="green"
          icon={<CalendarCheck aria-hidden />}
          value={todayAppointments.length}
          label="Rendez-vous aujourd'hui"
          href="/dg/fiche-jour"
          action="Voir l'agenda du jour"
        />
        <Kpi
          tone="blue"
          icon={<Building2 aria-hidden />}
          value={todayRooms}
          label="Salles réservées aujourd'hui"
          href={DG_ROOM_RESERVATIONS_HREF}
          action="Voir les salles"
        />
        <Kpi
          tone="red"
          icon={<AlertTriangle aria-hidden />}
          value={conflicts.length}
          label="Conflit de planning"
          href="#asst-alerts"
          action="Voir les alertes"
        />
      </section>

      <div className="asst-layout">
        <section className="asst-calendar" aria-label="Agenda du DGA">
          <div className="asst-calendar-head">
            <div className="asst-calendar-title">
              <span className="asst-calendar-mark" aria-hidden>
                <CalendarDays />
              </span>
              <div>
                <h2>Agenda du DGA</h2>
                <p>Consultez, gérez et planifiez les rendez-vous et réservations</p>
              </div>
            </div>
            <div className="asst-calendar-tools">
              <button type="button" className="asst-today" onClick={goToday}>
                Aujourd&apos;hui
              </button>
              <div className="asst-nav">
                <button type="button" aria-label="Période précédente" onClick={() => shift(-1)}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" aria-label="Période suivante" onClick={() => shift(1)}>
                  <ChevronRight aria-hidden />
                </button>
              </div>
              <p className="asst-period">{periodLabel}</p>
              <div className="asst-views" role="tablist" aria-label="Affichage">
                {VIEW_LABELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={view === item.id}
                    className={cn(view === item.id && 'is-active')}
                    onClick={() => setView(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? <div className="asst-loading">Chargement de l&apos;agenda…</div> : null}

          {view === 'month' ? (
            <div className="asst-month">
              <div className="asst-weekdays">
                {WEEKDAYS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="asst-month-grid">
                {monthDays.map((day) => {
                  const key = dayKey(day);
                  const chips = chipsFor(day);
                  const outside = !isSameMonth(day, anchor);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        'asst-day',
                        outside && 'is-outside',
                        key === selectedKey && 'is-selected',
                        key === todayKey && 'is-today'
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <span className="asst-day-num">{format(day, 'd')}</span>
                      <span className="asst-chips">
                        {chips.slice(0, 3).map((chip) => (
                          <span key={chip.id} className={cn('asst-chip', `is-${chip.tone}`)}>
                            {chip.time ? <strong>{chip.time}</strong> : null}
                            <em>{chip.title}</em>
                          </span>
                        ))}
                        {chips.length > 3 ? (
                          <span className="asst-chip-more">+{chips.length - 3}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {view === 'week' ? (
            <div className="asst-week">
              {weekDays.map((day) => {
                const key = dayKey(day);
                const chips = chipsFor(day);
                return (
                  <button
                    key={key}
                    type="button"
                    className={cn('asst-week-col', key === todayKey && 'is-today', key === selectedKey && 'is-selected')}
                    onClick={() => setSelectedKey(key)}
                  >
                    <span className="asst-week-label">
                      {format(day, 'EEE d', { locale: fr })}
                    </span>
                    {chips.length === 0 ? <span className="asst-empty-slot">Aucun créneau</span> : null}
                    {chips.map((chip) => (
                      <span key={chip.id} className={cn('asst-chip', `is-${chip.tone}`)}>
                        {chip.time ? <strong>{chip.time}</strong> : null}
                        <em>{chip.title}</em>
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          ) : null}

          {view === 'day' || view === 'list' ? (
            <ul className="asst-list">
              {(view === 'day' ? dayAppointments : appointments)
                .slice()
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .map((row) => {
                  const badge = badgeFor(row, now);
                  return (
                    <li key={row.id}>
                      <button type="button" onClick={() => setSelectedKey(dayKey(row.startAt))}>
                        <span className="asst-list-when">
                          {view === 'list'
                            ? format(new Date(row.startAt), 'EEE d MMM', { locale: fr })
                            : formatTimeInAppTz(row.startAt)}
                          <small>
                            {formatTimeInAppTz(row.startAt)} – {formatTimeInAppTz(row.endAt)}
                          </small>
                        </span>
                        <span className="asst-list-body">
                          <strong>{row.title}</strong>
                          <small>
                            {[requesterName(row), placeLabel(row)].filter(Boolean).join(' · ')}
                          </small>
                        </span>
                        <span className={cn('asst-badge', `is-${badge.tone}`)}>{badge.label}</span>
                      </button>
                    </li>
                  );
                })}
              {(view === 'day' ? dayAppointments : appointments).length === 0 ? (
                <li className="asst-list-empty">Aucun rendez-vous sur cette période.</li>
              ) : null}
            </ul>
          ) : null}

          <footer className="asst-calendar-foot">
            <ul className="asst-legend">
              <li><i className="is-confirmed" /> Rendez-vous confirmé</li>
              <li><i className="is-pending" /> En attente de validation</li>
              <li><i className="is-live" /> En cours</li>
              <li><i className="is-upcoming" /> À venir</li>
              <li><i className="is-holiday" /> Jour férié</li>
              <li><i className="is-room" /> Réservation de salle</li>
            </ul>
            <button type="button" className="asst-export" onClick={exportAgenda}>
              <Download aria-hidden />
              Exporter
            </button>
          </footer>
        </section>

        <aside className="asst-side">
          <section className="asst-card">
            <header>
              <h3>Rendez-vous du jour</h3>
              <Link href="/dg/fiche-jour">Voir tout</Link>
            </header>
            <p className="asst-side-date">{format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}</p>
            {dayAppointments.length === 0 ? (
              <p className="asst-side-empty">Aucun rendez-vous ce jour.</p>
            ) : (
              <ul className="asst-side-list">
                {dayAppointments.map((row) => {
                  const badge = badgeFor(row, now);
                  const people = row.participants?.length ?? 0;
                  return (
                    <li key={row.id}>
                      <span className="asst-side-time">
                        {formatTimeInAppTz(row.startAt)}
                        <small>{formatTimeInAppTz(row.endAt)}</small>
                      </span>
                      <span className="asst-side-main">
                        <strong>{row.title}</strong>
                        <span className={cn('asst-badge', `is-${badge.tone}`)}>{badge.label}</span>
                        <small>
                          {[placeLabel(row), people > 0 ? `${people} participant${people > 1 ? 's' : ''}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="asst-card">
            <header>
              <h3>Prochains rendez-vous</h3>
              <Link href="/dg/appointments">Voir tout</Link>
            </header>
            {upcoming.length === 0 ? (
              <p className="asst-side-empty">Aucun rendez-vous à venir sur la période.</p>
            ) : (
              <ul className="asst-upcoming">
                {upcoming.map((row) => {
                  const badge = badgeFor(row, now);
                  return (
                    <li key={row.id}>
                      <span className="asst-upcoming-date">
                        {format(new Date(row.startAt), 'EEE d MMM', { locale: fr })}
                        <small>
                          {formatTimeInAppTz(row.startAt)} – {formatTimeInAppTz(row.endAt)}
                        </small>
                      </span>
                      <span className="asst-upcoming-body">
                        <strong>{row.title}</strong>
                        <small>{placeLabel(row) || 'Lieu à confirmer'}</small>
                      </span>
                      <span className={cn('asst-badge', `is-${badge.tone}`)}>{badge.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="asst-card" id="asst-alerts">
            <header>
              <h3>
                <AlertTriangle aria-hidden />
                Alertes et conflits
              </h3>
              <Link href="/dg/appointments">Voir tout</Link>
            </header>
            {conflicts.length === 0 ? (
              <div className="asst-alert-empty">
                <CalendarDays aria-hidden />
                <strong>Aucun conflit de planning</strong>
                <p>Aucun chevauchement détecté pour la période sélectionnée.</p>
              </div>
            ) : (
              <ul className="asst-alerts">
                {conflicts.slice(0, 4).map((conflict) => (
                  <li key={conflict.id}>{conflict.message}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  tone,
  icon,
  value,
  label,
  href,
  action,
}: {
  tone: 'amber' | 'green' | 'blue' | 'red';
  icon: ReactNode;
  value: number;
  label: string;
  href: string;
  action: string;
}) {
  return (
    <article className={cn('asst-kpi', `is-${tone}`)}>
      <span className="asst-kpi-icon">{icon}</span>
      <p className="asst-kpi-value">{value}</p>
      <p className="asst-kpi-label">{label}</p>
      <Link href={href}>{action} →</Link>
    </article>
  );
}
