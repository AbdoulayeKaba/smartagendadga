import type { NotificationKind } from '@prisma/client';

export type MockNotification = {
  id: string;
  userId: string;
  appointmentId: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

let notifications: MockNotification[] = [];
let seq = 1;

function nextId() {
  return `mock-notif-${seq++}`;
}

export function mockCreateNotification(input: {
  userId: string;
  appointmentId?: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href?: string;
}) {
  const row: MockNotification = {
    id: nextId(),
    userId: input.userId,
    appointmentId: input.appointmentId ?? null,
    kind: input.kind,
    title: input.title,
    message: input.message,
    href: input.href ?? (input.appointmentId ? '/dg/appointments' : null),
    readAt: null,
    createdAt: new Date(),
  };
  notifications.unshift(row);
  if (notifications.length > 200) notifications = notifications.slice(0, 200);
  return row;
}

export function mockListNotifications(userId: string, limit = 30) {
  return notifications.filter((n) => n.userId === userId).slice(0, limit);
}

export function mockCountUnread(userId: string) {
  return notifications.filter((n) => n.userId === userId && !n.readAt).length;
}

export function mockMarkNotificationRead(userId: string, id: string) {
  const idx = notifications.findIndex((n) => n.id === id && n.userId === userId);
  if (idx < 0) return null;
  notifications[idx] = { ...notifications[idx], readAt: new Date() };
  return notifications[idx];
}

export function mockMarkAllNotificationsRead(userId: string) {
  const now = new Date();
  notifications = notifications.map((n) =>
    n.userId === userId && !n.readAt ? { ...n, readAt: now } : n
  );
}

export function mockSeedNotifications() {
  if (notifications.length > 0) return;
  mockCreateNotification({
    userId: 'mock-assistant',
    kind: 'REQUEST_CREATED',
    title: 'Nouvelle demande de rendez-vous',
    message: 'Audience ministère des PT — en attente de validation.',
    href: '/dg/appointments',
  });
}

mockSeedNotifications();
