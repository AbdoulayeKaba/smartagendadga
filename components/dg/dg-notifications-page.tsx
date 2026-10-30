'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCheck,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Search,
  Users,
  X,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AppointmentRejectDialog } from '@/components/appointments/appointment-reject-dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import {
  APP_TIMEZONE,
  formatDateLong,
  formatIsoDateInAppTz,
  formatTimeInAppTz,
  formatTimeRange,
  getWallClockPartsInAppTz,
} from '@/lib/datetime';
import {
  displayAppointmentModality,
  displayLocation,
  displayRequesterName,
  displayReservedRoom,
} from '@/lib/dg/appointment-review-display';
import { involvementLabel, type AppointmentInvolvement } from '@/lib/dg/appointment-involvement';
import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import { userInitials } from '@/lib/dg/role-labels';
import { cn } from '@/lib/utils';

type InboxAppointment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  requesterName: string;
  department: string | null;
};

type InboxItem = {
  id: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  appointmentId: string | null;
  read: boolean;
  createdAt: string;
  scheduledFor?: string | null;
  appointment?: InboxAppointment | null;
  involvement?: AppointmentInvolvement | null;
};

type DayEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
};

type Tone = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'orange';
type StatusFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | 'request' | 'approve' | 'reject' | 'reschedule' | 'reminder' | 'meeting' | 'other';
type DateFilter = 'all' | 'today' | 'yesterday' | 'week';

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 18 * 60;

function notificationInstant(item: InboxItem) {
  const raw = item.scheduledFor || item.createdAt;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(item.createdAt) : date;
}

function shiftDay(isoDay: string, delta: number) {
  const date = new Date(`${isoDay}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return formatIsoDateInAppTz(date);
}

function kindMeta(kind: string): { label: string; tone: Tone; Icon: ComponentType<{ className?: string }> } {
  if (kind === 'REQUEST_CREATED') return { label: 'Non lue', tone: 'blue', Icon: Bell };
  if (kind === 'APPROVED') return { label: 'Validation', tone: 'green', Icon: CalendarCheck };
  if (kind === 'REJECTED') return { label: 'Refus', tone: 'red', Icon: CalendarX };
  if (kind === 'RESCHEDULED') return { label: 'Reprogrammation', tone: 'amber', Icon: CalendarClock };
  if (kind === 'MEETING_STARTED') return { label: 'Réunion', tone: 'violet', Icon: Users };
  if (kind === 'REMINDER_24H' || kind === 'REMINDER_1H' || kind === 'MEETING_ENDED') {
    return { label: 'Information', tone: 'green', Icon: Bell };
  }
  if (kind.startsWith('MAIL_')) return { label: 'Information', tone: 'orange', Icon: Bell };
  if (kind.startsWith('MISSION_')) return { label: 'Mise à jour', tone: 'green', Icon: Calendar };
  return { label: 'Information', tone: 'blue', Icon: Bell };
}

function typeOf(kind: string): Exclude<TypeFilter, 'all'> {
  if (kind === 'REQUEST_CREATED') return 'request';
  if (kind === 'APPROVED') return 'approve';
  if (kind === 'REJECTED') return 'reject';
  if (kind === 'RESCHEDULED') return 'reschedule';
  if (kind === 'REMINDER_24H' || kind === 'REMINDER_1H') return 'reminder';
  if (kind === 'MEETING_STARTED' || kind === 'MEETING_ENDED') return 'meeting';
  return 'other';
}

function groupTitle(day: string, today: string) {
  if (day === today) return "Aujourd'hui";
  if (day === shiftDay(today, -1)) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`));
}

function groupDateLabel(day: string) {
  const raw = new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function minutesOf(iso: string) {
  const parts = getWallClockPartsInAppTz(iso);
  return parts.hour * 60 + parts.minute;
}

export function DgNotificationsPage() {
  const router = useRouter();
  const { permissions } = useApp();
  const canReview = permissions['appointments.review'] === true;
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppointmentReviewItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const closedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dg/notifications?limit=80');
      if (!res.ok) return;
      const json = (await res.json()) as { items: InboxItem[]; unread: number };
      setItems(json.items ?? []);
      setUnread(json.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = formatIsoDateInAppTz(new Date());

  const counts = useMemo(
    () => ({
      unread,
      total: items.length,
      approve: items.filter((item) => item.kind === 'APPROVED').length,
      reject: items.filter((item) => item.kind === 'REJECTED').length,
      reschedule: items.filter((item) => item.kind === 'RESCHEDULED').length,
    }),
    [items, unread]
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const weekStart = shiftDay(today, -6);
    return items.filter((item) => {
      if (status === 'unread' && item.read) return false;
      if (status === 'read' && !item.read) return false;
      if (type !== 'all' && typeOf(item.kind) !== type) return false;
      const day = formatIsoDateInAppTz(notificationInstant(item));
      if (dateFilter === 'today' && day !== today) return false;
      if (dateFilter === 'yesterday' && day !== shiftDay(today, -1)) return false;
      if (dateFilter === 'week' && day < weekStart) return false;
      if (!needle) return true;
      const meta = kindMeta(item.kind);
      const hay = [
        item.title,
        item.message,
        meta.label,
        item.appointment?.title,
        item.appointment?.requesterName,
        item.appointment?.department,
        item.involvement ? involvementLabel(item.involvement) : null,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, status, type, dateFilter, today]);

  const groups = useMemo(() => {
    const map = new Map<string, InboxItem[]>();
    for (const item of visible) {
      const day = formatIsoDateInAppTz(notificationInstant(item));
      const list = map.get(day);
      if (list) list.push(item);
      else map.set(day, [item]);
    }
    return [...map.entries()];
  }, [visible]);

  useEffect(() => {
    if (!visible.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && visible.some((item) => item.id === current)) return current;
      if (closedRef.current) return null;
      return visible[0]?.id ?? null;
    });
  }, [visible]);

  const selected = visible.find((item) => item.id === selectedId) ?? null;
  const selectedDay = selected ? formatIsoDateInAppTz(notificationInstant(selected)) : today;

  useEffect(() => {
    const appointmentId = selected?.appointmentId;
    if (!appointmentId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/appointments/${appointmentId}/detail`);
        if (!res.ok || cancelled) {
          if (!cancelled) setDetail(null);
          return;
        }
        const json = (await res.json()) as { item: AppointmentReviewItem };
        if (!cancelled) setDetail(json.item);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.appointmentId]);

  useEffect(() => {
    let cancelled = false;
    const from = new Date(`${selectedDay}T00:00:00`);
    const to = new Date(`${selectedDay}T23:59:59`);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      status: 'APPROVED',
    });
    if (!canReview) params.set('involved', '1');
    const path = canReview ? '/api/dg/appointments' : '/api/appointments/mine';
    void (async () => {
      try {
        const res = await fetch(`${path}?${params.toString()}`);
        if (!res.ok || cancelled) {
          if (!cancelled) setDayEvents([]);
          return;
        }
        const json = (await res.json()) as { items?: DayEvent[] };
        if (!cancelled) setDayEvents(json.items ?? []);
      } catch {
        if (!cancelled) setDayEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDay, canReview]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch('/api/dg/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } finally {
      setMarking(false);
    }
  };

  const openAppointment = () => {
    const id = selected?.appointmentId;
    if (id) {
      const base = canReview ? '/dg/appointments' : '/appointments/mine';
      router.push(`${base}?open=${encodeURIComponent(id)}`);
      return;
    }
    if (selected?.href) router.push(selected.href);
  };

  const submitReject = async (reason: string) => {
    if (!detail) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/appointments/${detail.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason }),
      });
      if (!res.ok) {
        toast({
          title: 'Refus impossible',
          description: 'Cette demande ne peut plus être refusée.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Demande refusée', description: 'Le demandeur sera notifié.' });
      setRejectOpen(false);
      await load();
    } finally {
      setRejecting(false);
    }
  };

  const pending = detail?.status === 'PENDING';
  const filtersActive = status !== 'all' || type !== 'all' || dateFilter !== 'all' || q.trim().length > 0;
  const nowMin = minutesOf(new Date().toISOString());
  const showNow = selectedDay === today && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN;

  return (
    <div className="dg-ninbox">
      <AdminPageHeader
        variant="flat"
        eyebrow="DGA"
        title="Notifications"
        description="Alertes sur vos demandes et le traitement des rendez-vous."
        mark={
          <span className="dg-act-mark" aria-hidden>
            <Bell className="h-4 w-4" />
          </span>
        }
        actions={
          <div className="dg-ninbox-header-actions">
            <button type="button" className="dg-ninbox-readall" disabled={marking || unread === 0} onClick={() => void markAllRead()}>
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Tout lire
            </button>
            <button type="button" className="dg-ninbox-more" aria-label="Actualiser" disabled={loading} onClick={() => void load()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </button>
          </div>
        }
      />

      <div className="dg-ninbox-kpis">
        <Kpi icon={Bell} label="Non lues" value={counts.unread} tone="blue" active={status === 'unread'} onClick={() => { setStatus(status === 'unread' ? 'all' : 'unread'); setType('all'); }} />
        <Kpi icon={Calendar} label="Total affiché" value={counts.total} tone="blue" active={status === 'all' && type === 'all'} onClick={() => { setStatus('all'); setType('all'); setDateFilter('all'); }} />
        <Kpi icon={CalendarCheck} label="Validations" value={counts.approve} tone="green" active={type === 'approve'} onClick={() => setType(type === 'approve' ? 'all' : 'approve')} />
        <Kpi icon={CalendarX} label="Refus" value={counts.reject} tone="red" active={type === 'reject'} onClick={() => setType(type === 'reject' ? 'all' : 'reject')} />
        <Kpi icon={CalendarClock} label="Reprogrammations" value={counts.reschedule} tone="violet" active={type === 'reschedule'} onClick={() => setType(type === 'reschedule' ? 'all' : 'reschedule')} />
      </div>

      <section className="dg-ninbox-toolbar">
        <div className="dg-ninbox-search">
          <Search aria-hidden />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Rechercher une notification..." aria-label="Rechercher une notification" />
        </div>
        <select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="unread">Non lues</option>
          <option value="read">Lues</option>
        </select>
        <select aria-label="Type" value={type} onChange={(event) => setType(event.target.value as TypeFilter)}>
          <option value="all">Tous les types</option>
          <option value="request">Demandes</option>
          <option value="approve">Validations</option>
          <option value="reject">Refus</option>
          <option value="reschedule">Reprogrammations</option>
          <option value="reminder">Rappels</option>
          <option value="meeting">Réunions</option>
          <option value="other">Autres</option>
        </select>
        <select aria-label="Date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
          <option value="all">Toutes les dates</option>
          <option value="today">Aujourd&apos;hui</option>
          <option value="yesterday">Hier</option>
          <option value="week">7 derniers jours</option>
        </select>
        <button
          type="button"
          className="dg-ninbox-advanced"
          aria-pressed={filtersActive}
          onClick={() => {
            setQ('');
            setStatus('all');
            setType('all');
            setDateFilter('all');
          }}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtres avancés
        </button>
      </section>

      <div className="dg-ninbox-split">
        <section className="dg-ninbox-list" aria-label="Notifications">
          {loading && !items.length ? (
            <div className="dg-notif-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !visible.length ? (
            <p className="dg-notif-empty">Aucune notification pour ce filtre.</p>
          ) : (
            groups.map(([day, rows]) => (
              <div key={day} className="dg-ninbox-day">
                <header>
                  <span>
                    <Calendar aria-hidden />
                    {groupTitle(day, today)}
                    <em>{rows.length}</em>
                  </span>
                  <time dateTime={day}>{groupDateLabel(day)}</time>
                </header>
                <ul>
                  {rows.map((item) => {
                    const meta = kindMeta(item.kind);
                    const Icon = meta.Icon;
                    const when = notificationInstant(item);
                    const active = item.id === selectedId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={cn('dg-ninbox-row', active && 'is-active', !item.read && 'is-unread')}
                          data-tone={meta.tone}
                          aria-pressed={active}
                          onClick={() => {
                            closedRef.current = false;
                            setSelectedId(item.id);
                          }}
                        >
                          <time dateTime={when.toISOString()}>{formatTimeInAppTz(when)}</time>
                          <span className="dg-ninbox-rail" aria-hidden>
                            <span />
                          </span>
                          <span className="dg-ninbox-icon">
                            <Icon />
                          </span>
                          <span className="dg-ninbox-copy">
                            <strong>{item.title}</strong>
                            <span>{item.message}</span>
                            {item.appointment ? (
                              <small>
                                {item.appointment.requesterName}
                                {item.appointment.department ? ` · ${item.appointment.department}` : ''}
                              </small>
                            ) : null}
                            {item.involvement ? (
                              <em className="dg-ninbox-role" data-kind={item.involvement}>
                                {involvementLabel(item.involvement)}
                              </em>
                            ) : null}
                          </span>
                          <span className="dg-ninbox-badge">{meta.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="dg-ninbox-side">
          <section className="dg-ninbox-cal" aria-label="Calendrier du jour">
            <header>
              <h2>
                <Calendar aria-hidden /> Calendrier du jour
              </h2>
              <button type="button" onClick={() => router.push(canReview ? '/dg/availability' : '/appointments/mine')}>
                Voir l&apos;agenda
              </button>
            </header>
            <div className="dg-ninbox-axis">
              {Array.from({ length: 10 }, (_, index) => {
                const hour = 8 + index;
                return <span key={hour}>{String(hour).padStart(2, '0')}:00</span>;
              })}
              {showNow ? (
                <span className="dg-ninbox-now" style={{ left: `${((nowMin - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100}%` }}>
                  {formatTimeInAppTz(new Date())}
                </span>
              ) : null}
              <div className="dg-ninbox-events">
                {dayEvents.map((event, index) => {
                  const start = Math.max(DAY_START_MIN, minutesOf(event.startAt));
                  const end = Math.min(DAY_END_MIN, minutesOf(event.endAt));
                  if (end <= start) return null;
                  const span = DAY_END_MIN - DAY_START_MIN;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="dg-ninbox-event"
                      data-i={index % 5}
                      style={{ left: `${((start - DAY_START_MIN) / span) * 100}%`, width: `${((end - start) / span) * 100}%` }}
                      onClick={() => router.push(`/dg/appointments?open=${encodeURIComponent(event.id)}`)}
                    >
                      <strong>{event.title}</strong>
                      <span>
                        {formatTimeInAppTz(event.startAt)} – {formatTimeInAppTz(event.endAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <NotificationDetail
            item={selected}
            detail={detail}
            loading={detailLoading}
            pending={pending && canReview}
            onOpen={openAppointment}
            onTreat={openAppointment}
            onReject={() => setRejectOpen(true)}
            onClose={() => {
              closedRef.current = true;
              setSelectedId(null);
            }}
          />
        </aside>
      </div>

      <AppointmentRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        appointment={detail}
        loading={rejecting}
        onSubmit={submitReject}
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dg-ninbox-kpi" data-tone={tone} data-active={active ? 'true' : 'false'} aria-pressed={active} onClick={onClick}>
      <span>
        <Icon />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </button>
  );
}

function NotificationDetail({
  item,
  detail,
  loading,
  pending,
  onOpen,
  onTreat,
  onReject,
  onClose,
}: {
  item: InboxItem | null;
  detail: AppointmentReviewItem | null;
  loading: boolean;
  pending: boolean;
  onOpen: () => void;
  onTreat: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  if (!item) {
    return (
      <section className="dg-ninbox-detail">
        <p className="dg-ninbox-empty">Sélectionnez une notification.</p>
      </section>
    );
  }
  const meta = kindMeta(item.kind);
  const when = notificationInstant(item);
  const modality = detail ? displayAppointmentModality(detail) : null;
  const room = detail ? displayReservedRoom(detail) ?? displayLocation(detail) : null;
  const requester = detail ? displayRequesterName(detail) : item.appointment?.requesterName ?? '—';
  const service = detail?.requestedBy.department ?? item.appointment?.department ?? 'DGA';

  return (
    <section className="dg-ninbox-detail" aria-label="Détail de la notification">
      <header>
        <h2>
          <Bell aria-hidden /> Détail de la notification
        </h2>
        <button type="button" aria-label="Fermer le détail" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="dg-ninbox-detail-hero">
        <span className="dg-ninbox-icon" data-tone={meta.tone}>
          <meta.Icon />
        </span>
        <div>
          <strong>{item.title}</strong>
          <span className="dg-ninbox-badge" data-tone={meta.tone}>
            {meta.label}
          </span>
        </div>
        <time>
          {groupTitle(formatIsoDateInAppTz(when), formatIsoDateInAppTz(new Date()))}
          <small>{formatTimeInAppTz(when)}</small>
        </time>
      </div>
      {loading ? (
        <p className="dg-ninbox-empty">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du rendez-vous…
        </p>
      ) : (
        <dl>
          <div>
            <dt>Demandeur</dt>
            <dd>{requester}</dd>
          </div>
          {item.involvement ? (
            <div>
              <dt>Votre lien</dt>
              <dd>
                <em className="dg-ninbox-role" data-kind={item.involvement}>
                  {involvementLabel(item.involvement)}
                </em>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Service</dt>
            <dd>{service || 'DGA'}</dd>
          </div>
          <div>
            <dt>Objet</dt>
            <dd>{detail?.title ?? item.appointment?.title ?? item.title}</dd>
          </div>
          <div>
            <dt>Date et heure</dt>
            <dd>
              {detail
                ? `${formatDateLong(detail.startAt)} · ${formatTimeRange(detail.startAt, detail.endAt)}`
                : item.appointment
                  ? `${formatDateLong(item.appointment.startAt)} · ${formatTimeRange(item.appointment.startAt, item.appointment.endAt)}`
                  : formatDateLong(when)}
            </dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{modality ? (modality.online ? 'En ligne' : 'En présentiel') : '—'}</dd>
          </div>
          <div>
            <dt>Lieu / Salle</dt>
            <dd>{room && room !== '—' ? room : '—'}</dd>
          </div>
          <div>
            <dt>Participants</dt>
            <dd className="dg-ninbox-people">
              {detail?.participants.length ? (
                detail.participants.slice(0, 4).map((person) => (
                  <span key={person.id} title={person.name}>
                    {person.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                ))
              ) : (
                <span>{userInitials(requester.split(' ')[0] ?? '', requester.split(' ').slice(1).join(' '))}</span>
              )}
              {detail && detail.participants.length > 4 ? <em>+{detail.participants.length - 4} autres</em> : null}
            </dd>
          </div>
          <div>
            <dt>Contexte</dt>
            <dd>{item.message}</dd>
          </div>
        </dl>
      )}
      <div className="dg-ninbox-actions">
        <button type="button" className="is-primary" disabled={!item.appointmentId} onClick={onOpen}>
          <Eye /> Voir la demande
        </button>
        <button type="button" disabled={!pending} onClick={onTreat}>
          <Calendar /> Traiter
        </button>
        <button type="button" className="is-danger" disabled={!pending} onClick={onReject}>
          <X /> Refuser
        </button>
      </div>
    </section>
  );
}
