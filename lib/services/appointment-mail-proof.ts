import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockGetAppointmentById } from '@/lib/mock/store';
import {
  buildAppointmentMailProof,
  type AppointmentMailProofLine,
} from '@/lib/dg/appointment-mail-proof';

export async function getAppointmentMailProof(
  appointmentId: string
): Promise<AppointmentMailProofLine[] | null> {
  if (isMockDataEnabled()) {
    const appointment = mockGetAppointmentById(appointmentId);
    if (!appointment) return null;
    return buildAppointmentMailProof({
      status: appointment.status,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      reminderMinutesBefore: appointment.reminderMinutesBefore,
      notifications: [],
    });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      reminderMinutesBefore: true,
    },
  });
  if (!appointment) return null;

  const notifications = await prisma.notification.findMany({
    where: { appointmentId },
    select: {
      kind: true,
      emailSent: true,
      scheduledFor: true,
      sentAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return buildAppointmentMailProof({
    status: appointment.status,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    reminderMinutesBefore: appointment.reminderMinutesBefore,
    notifications,
  });
}
