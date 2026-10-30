import { NextResponse } from 'next/server';
import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { requireApiSession } from '@/lib/auth/api-auth';
import { formatIsoDateInAppTz } from '@/lib/datetime';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { listAppointmentsForDashboard } from '@/lib/services/appointments';
import { listRoomReservations } from '@/lib/services/room-reservations';
import { currentYear, yearRange } from '@/lib/temporal/year-range';

function isSameAppDay(a: Date, b: Date) {
  return formatIsoDateInAppTz(a) === formatIsoDateInAppTz(b);
}

function mapPerson(user: { firstName: string; lastName: string }) {
  return { firstName: user.firstName, lastName: user.lastName };
}

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const url = new URL(req.url);
  const year = parseYearFromRequest(url) ?? currentYear();
  const bounds = yearRange(year);
  const isViewingCurrentYear = year === currentYear();
  const now = isViewingCurrentYear ? new Date() : new Date(year, 0, 1);
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  if (isViewingCurrentYear) {
    await autoRejectExpiredPendingAppointments({ now });
  }

  const periodFilter = { from: bounds.from, to: bounds.to };

  const rows = await listAppointmentsForDashboard(periodFilter);
  const pending = rows.filter((a) => a.status === 'PENDING');
  const approved = rows.filter((a) => a.status === 'APPROVED');
  const rejected = rows.filter((a) => a.status === 'REJECTED');

  const today = new Date();
  const todayUltraUrgent = [...pending, ...approved]
    .filter((a) => a.urgentOverride && isSameAppDay(a.startAt, today))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const weeklyFlow = isViewingCurrentYear
    ? eachDayOfInterval({ start: todayStart, end: addDays(todayStart, 6) }).map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayApproved = approved.filter(
          (a) => a.startAt >= dayStart && a.startAt <= dayEnd
        ).length;
        const dayPending = pending.filter(
          (a) => a.startAt >= dayStart && a.startAt <= dayEnd
        ).length;
        return {
          label: format(day, 'EEE', { locale: fr }),
          date: format(day, 'd MMM', { locale: fr }),
          approved: dayApproved,
          pending: dayPending,
          total: dayApproved + dayPending,
        };
      })
    : eachMonthOfInterval({ start: bounds.from, end: bounds.to }).map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthApproved = approved.filter(
          (a) => a.startAt >= monthStart && a.startAt <= monthEnd
        ).length;
        const monthPending = pending.filter(
          (a) => a.startAt >= monthStart && a.startAt <= monthEnd
        ).length;
        return {
          label: format(month, 'MMM', { locale: fr }),
          date: format(month, 'MMMM', { locale: fr }),
          approved: monthApproved,
          pending: monthPending,
          total: monthApproved + monthPending,
        };
      });

  const historyDays = isViewingCurrentYear
    ? eachDayOfInterval({ start: subDays(todayStart, 6), end: todayStart })
    : [];

  const roomReservations = await listRoomReservations({
    from: isViewingCurrentYear ? startOfDay(historyDays[0] ?? todayStart) : bounds.from,
    to: isViewingCurrentYear ? endOfDay(todayStart) : bounds.to,
  });

  const roomTrend = isViewingCurrentYear
    ? historyDays.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayReservations = roomReservations.filter(
          (r) => r.startAt >= dayStart && r.startAt <= dayEnd
        );
        const reunion = dayReservations.filter((r) => r.usageType === 'REUNION').length;
        const comite = dayReservations.filter((r) => r.usageType === 'COMITE').length;
        const autres = dayReservations.filter(
          (r) => r.usageType === 'FORMATION' || r.usageType === 'ENTRETIEN' || r.usageType === 'AUTRE'
        ).length;
        return {
          label: format(day, 'EEEE', { locale: fr }),
          shortLabel: format(day, 'EEEEE', { locale: fr }),
          date: format(day, 'd MMM', { locale: fr }),
          reunion,
          comite,
          autres,
          total: dayReservations.length,
        };
      })
    : eachMonthOfInterval({ start: bounds.from, end: bounds.to }).map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthReservations = roomReservations.filter(
          (r) => r.startAt >= monthStart && r.startAt <= monthEnd
        );
        const reunion = monthReservations.filter((r) => r.usageType === 'REUNION').length;
        const comite = monthReservations.filter((r) => r.usageType === 'COMITE').length;
        const autres = monthReservations.filter(
          (r) => r.usageType === 'FORMATION' || r.usageType === 'ENTRETIEN' || r.usageType === 'AUTRE'
        ).length;
        return {
          label: format(month, 'MMMM', { locale: fr }),
          shortLabel: format(month, 'MMM', { locale: fr }),
          date: format(month, 'yyyy', { locale: fr }),
          reunion,
          comite,
          autres,
          total: monthReservations.length,
        };
      });

  const roomReservationsWeek = roomReservations.filter(
    (r) => r.startAt >= weekStart && r.startAt <= weekEnd
  ).length;

  const pendingByPriority = [
    { key: 'HIGH', label: 'Haute', value: pending.filter((a) => a.priority === 'HIGH').length },
    { key: 'MEDIUM', label: 'Moyenne', value: pending.filter((a) => a.priority === 'MEDIUM').length },
    { key: 'LOW', label: 'Basse', value: pending.filter((a) => a.priority === 'LOW').length },
  ];

  const byStatus = [
    { key: 'pending', label: 'En attente', value: pending.length },
    { key: 'approved', label: 'Approuvés', value: approved.length },
    { key: 'rejected', label: 'Refusés', value: rejected.length },
  ];

  const weekAppointments = approved.filter((a) => a.startAt >= weekStart && a.startAt <= weekEnd);

  const approvedTodayList = isViewingCurrentYear
    ? approved
        .filter((a) => isSameAppDay(a.startAt, now))
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    : approved.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).slice(0, 5);

  const approvedToday = isViewingCurrentYear
    ? approvedTodayList.length
    : approved.length;
  const approvedWeek = isViewingCurrentYear ? weekAppointments.length : approved.length;
  const totalDecided = approved.length + rejected.length;
  const approvalRate = totalDecided > 0 ? Math.round((approved.length / totalDecided) * 100) : 100;

  const decided = [...approved, ...rejected].filter((a) => a.reviewedAt);
  const avgDecisionHours =
    decided.length > 0
      ? Math.round(
          decided.reduce(
            (sum, a) => sum + (a.reviewedAt!.getTime() - a.createdAt.getTime()) / 3_600_000,
            0
          ) / decided.length
        )
      : 0;

  const peakDay = weeklyFlow.reduce(
    (best, day) => (day.total > best.total ? day : best),
    weeklyFlow[0] ?? { label: '', date: '', total: 0, approved: 0, pending: 0 }
  );

  const nextAppointment = isViewingCurrentYear
    ? approved
        .filter((a) => a.startAt >= now)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0]
    : approved.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];

  const tomorrowStart = startOfDay(addDays(todayStart, 1));
  const tomorrowEnd = endOfDay(addDays(todayStart, 1));
  const tomorrowUrgentAppointments = isViewingCurrentYear
    ? approved
        .filter((a) => a.urgentOverride && a.startAt >= tomorrowStart && a.startAt <= tomorrowEnd)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((a) => ({
          id: a.id,
          title: a.title,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          requestedBy: mapPerson(a.requestedBy),
        }))
    : approved
        .filter((a) => a.urgentOverride)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .slice(0, 3)
        .map((a) => ({
          id: a.id,
          title: a.title,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          requestedBy: mapPerson(a.requestedBy),
        }));

  const insights: { id: string; tone: 'info' | 'warning' | 'success' | 'neutral'; message: string }[] =
    [];

  if (!isViewingCurrentYear) {
    insights.push({
      id: 'period',
      tone: 'info',
      message: `Vue filtrée sur l'année ${year}`,
    });
  }

  const highPriority = pending.filter((a) => a.priority === 'HIGH').length;
  if (highPriority > 0) {
    insights.push({
      id: 'high-priority',
      tone: 'warning',
      message: `${highPriority} demande${highPriority > 1 ? 's' : ''} haute priorité à traiter en urgence`,
    });
  }
  if (peakDay.total > 0) {
    insights.push({
      id: 'peak-day',
      tone: 'info',
      message: isViewingCurrentYear
        ? `Pic d'activité prévu ${peakDay.label} · ${peakDay.date} (${peakDay.total} RDV)`
        : `Pic d'activité en ${peakDay.date} (${peakDay.total} RDV)`,
    });
  }
  if (isViewingCurrentYear && approvedToday > 0) {
    insights.push({
      id: 'today-count',
      tone: 'success',
      message: `${approvedToday} rendez-vous confirmé${approvedToday > 1 ? 's' : ''} aujourd'hui`,
    });
  } else if (isViewingCurrentYear) {
    insights.push({
      id: 'today-free',
      tone: 'neutral',
      message: "Aucun RDV confirmé aujourd'hui — créneaux disponibles",
    });
  } else if (approved.length > 0) {
    insights.push({
      id: 'year-approved',
      tone: 'success',
      message: `${approved.length} rendez-vous confirmé${approved.length > 1 ? 's' : ''} sur ${year}`,
    });
  }
  if (pending.length > 0) {
    insights.push({
      id: 'queue',
      tone: pending.length >= 5 ? 'warning' : 'info',
      message: `${pending.length} demande${pending.length > 1 ? 's' : ''} en file d'attente de validation`,
    });
  }
  if (avgDecisionHours > 0) {
    insights.push({
      id: 'avg-decision',
      tone: 'neutral',
      message: `Délai moyen de traitement : ${avgDecisionHours} h`,
    });
  }

  return NextResponse.json({
    pending: todayUltraUrgent.map((p) => ({
      id: p.id,
      title: p.title,
      startAt: p.startAt.toISOString(),
      priority: p.priority,
      requestedBy: mapPerson(p.requestedBy),
    })),
    todayAgenda: approvedTodayList.map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      priority: a.priority,
      requestedBy: mapPerson(a.requestedBy),
    })),
    nextAppointment: nextAppointment
      ? {
          id: nextAppointment.id,
          title: nextAppointment.title,
          startAt: nextAppointment.startAt.toISOString(),
          requestedBy: mapPerson(nextAppointment.requestedBy),
        }
      : null,
    tomorrowUrgentAppointments,
    insights: insights.slice(0, 5),
    stats: {
      pending: pending.length,
      approvedToday,
      approvedWeek,
      approvalRate,
      highPriority,
      rejectedTotal: rejected.length,
      avgDecisionHours,
      peakDayLabel: peakDay.total > 0 ? `${peakDay.label} · ${peakDay.date}` : null,
      peakDayCount: peakDay.total,
      roomReservationsWeek,
      isCurrentYear: isViewingCurrentYear,
      year,
    },
    charts: {
      weeklyFlow,
      roomTrend,
      byStatus,
      sparklines: {
        flow: weeklyFlow.map((d) => d.total),
        rooms: roomTrend.map((d) => d.total),
        pending: pendingByPriority.map((d) => d.value),
        approval: roomTrend.map((d) => d.reunion + d.comite),
      },
    },
  });
}
