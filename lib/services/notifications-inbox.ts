import type { NotificationKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  audienceInvolvement,
  type AppointmentInvolvement,
} from '@/lib/dg/appointment-involvement';
import {
  mockCountUnread,
  mockListNotifications,
  mockMarkAllNotificationsRead,
  mockMarkNotificationRead,
} from '@/lib/mock/notifications-store';

export type InboxNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string | null;
  appointmentId: string | null;
  read: boolean;
  createdAt: string;
  scheduledFor: string | null;
  appointment: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    requesterName: string;
    department: string | null;
  } | null;
  /** Demandeur ou invité. Renseigné pour un profil sans revue cabinet. */
  involvement?: AppointmentInvolvement | null;
};

export type InboxAudienceScope = {
  email: string;
  /** Limite la boîte aux rendez-vous demandés ou auxquels l'utilisateur est invité. */
  audienceOnly: boolean;
};

function hrefForKind(kind: NotificationKind, appointmentId: string | null, role: string) {
  if (
    kind === 'MISSION_CREATED' ||
    kind === 'MISSION_CANCELLED' ||
    kind === 'MISSION_COMPLETED' ||
    kind === 'MISSION_DEPART_TODAY' ||
    kind === 'MISSION_RETURN_TODAY' ||
    kind === 'MISSION_CLOSE_SUGGESTED' ||
    kind === 'MISSION_EXTENDED' ||
    kind === 'MISSION_REOPENED'
  ) {
    return '/dg/workspace/missions';
  }
  if (kind === 'MAIL_DEADLINE_SOON' || kind === 'MAIL_OVERDUE') {
    return '/dg/workspace/mail';
  }
  if (!appointmentId) return null;
  if (role === 'MANAGER' || role === 'EXTERNAL') return '/appointments/mine';
  return '/dg/appointments';
}

function addressedWhere(userId: string, email: string) {
  const recipient = email.trim();
  if (!recipient) return { userId };
  return {
    OR: [
      { userId, recipientEmail: null },
      { userId, recipientEmail: recipient },
      { recipientEmail: recipient },
    ],
  };
}

const audienceAppointmentSelect = {
  id: true,
  title: true,
  startAt: true,
  endAt: true,
  status: true,
  requestedById: true,
  requestedBy: {
    select: { firstName: true, lastName: true, department: true },
  },
  participants: { select: { userId: true, email: true } },
} as const;

export async function listInboxNotifications(
  userId: string,
  role: string,
  limit = 30,
  scope?: InboxAudienceScope
) {
  if (isMockDataEnabled()) {
    return mockListNotifications(userId, limit).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      message: n.message,
      href: n.href,
      appointmentId: n.appointmentId,
      read: Boolean(n.readAt),
      createdAt: n.createdAt.toISOString(),
      scheduledFor: null,
      appointment: null,
      involvement: null,
    }));
  }

  if (scope?.audienceOnly) {
    const rows = await prisma.notification.findMany({
      where: addressedWhere(userId, scope.email),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { appointment: { select: audienceAppointmentSelect } },
    });
    return rows
      .flatMap((n) => {
        const involvement = audienceInvolvement({
          userId,
          email: scope.email,
          notificationUserId: n.userId,
          recipientEmail: n.recipientEmail,
          appointment: n.appointment
            ? {
                requestedById: n.appointment.requestedById,
                participants: n.appointment.participants,
              }
            : null,
        });
        if (!involvement) return [];
        return [
          {
            id: n.id,
            kind: n.kind,
            title: n.title,
            message: n.message,
            href: hrefForKind(n.kind, n.appointmentId, role),
            appointmentId: n.appointmentId,
            read: Boolean(n.sentAt),
            createdAt: n.createdAt.toISOString(),
            scheduledFor: n.scheduledFor?.toISOString() ?? null,
            appointment: n.appointment
              ? {
                  id: n.appointment.id,
                  title: n.appointment.title,
                  startAt: n.appointment.startAt.toISOString(),
                  endAt: n.appointment.endAt.toISOString(),
                  status: n.appointment.status,
                  requesterName:
                    `${n.appointment.requestedBy.firstName} ${n.appointment.requestedBy.lastName}`.trim(),
                  department: n.appointment.requestedBy.department,
                }
              : null,
            involvement,
          },
        ];
      })
      .sort(
        (a, b) =>
          new Date(b.scheduledFor ?? b.createdAt).getTime() -
          new Date(a.scheduledFor ?? a.createdAt).getTime()
      )
      .slice(0, limit);
  }

  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      appointment: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          status: true,
          requestedBy: {
            select: { firstName: true, lastName: true, department: true },
          },
        },
      },
    },
  });

  return rows
    .map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      message: n.message,
      href: hrefForKind(n.kind, n.appointmentId, role),
      appointmentId: n.appointmentId,
      read: Boolean(n.sentAt),
      createdAt: n.createdAt.toISOString(),
      scheduledFor: n.scheduledFor?.toISOString() ?? null,
      appointment: n.appointment
        ? {
            id: n.appointment.id,
            title: n.appointment.title,
            startAt: n.appointment.startAt.toISOString(),
            endAt: n.appointment.endAt.toISOString(),
            status: n.appointment.status,
            requesterName: `${n.appointment.requestedBy.firstName} ${n.appointment.requestedBy.lastName}`.trim(),
            department: n.appointment.requestedBy.department,
          }
        : null,
    }))
    .sort(
      (a, b) =>
        new Date(b.scheduledFor ?? b.createdAt).getTime() -
        new Date(a.scheduledFor ?? a.createdAt).getTime()
    );
}

export async function countUnreadNotifications(userId: string, scope?: InboxAudienceScope) {
  if (isMockDataEnabled()) return mockCountUnread(userId);

  if (scope?.audienceOnly) {
    const rows = await prisma.notification.findMany({
      where: { ...addressedWhere(userId, scope.email), sentAt: null },
      select: {
        userId: true,
        recipientEmail: true,
        appointment: { select: audienceAppointmentSelect },
      },
    });
    return rows.filter((row) =>
      audienceInvolvement({
        userId,
        email: scope.email,
        notificationUserId: row.userId,
        recipientEmail: row.recipientEmail,
        appointment: row.appointment
          ? {
              requestedById: row.appointment.requestedById,
              participants: row.appointment.participants,
            }
          : null,
      })
    ).length;
  }

  return prisma.notification.count({
    where: { userId, sentAt: null },
  });
}

export async function markNotificationRead(userId: string, id: string, email = '') {
  if (isMockDataEnabled()) {
    const row = mockMarkNotificationRead(userId, id);
    return row ? { ok: true as const } : { ok: false as const, error: 'NOT_FOUND' as const };
  }

  const recipient = email.trim();
  const updated = await prisma.notification.updateMany({
    where: {
      id,
      OR: recipient ? [{ userId }, { recipientEmail: recipient }] : [{ userId }],
    },
    data: { sentAt: new Date() },
  });
  return updated.count > 0
    ? { ok: true as const }
    : { ok: false as const, error: 'NOT_FOUND' as const };
}

export async function markAllNotificationsRead(userId: string, scope?: InboxAudienceScope) {
  if (isMockDataEnabled()) {
    mockMarkAllNotificationsRead(userId);
    return { ok: true as const };
  }

  await prisma.notification.updateMany({
    where: scope?.audienceOnly
      ? { ...addressedWhere(userId, scope.email), sentAt: null }
      : { userId, sentAt: null },
    data: { sentAt: new Date() },
  });
  return { ok: true as const };
}
