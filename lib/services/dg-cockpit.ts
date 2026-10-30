import { addDays } from 'date-fns';
import { formatIsoDateInAppTz } from '@/lib/datetime';
import { parseDateTime } from '@/lib/dg/scheduling';
import { isPendingRoomReservationExpired } from '@/lib/dg/room-reservation-expiry';
import {
  buildDgCockpit,
  type CockpitMail,
  type CockpitReservation,
  type DgCockpitData,
} from '@/lib/dg/dg-cockpit';
import { listAppointments } from '@/lib/services/appointments';
import { listMeetingRooms, getRoomAvailability } from '@/lib/services/room-availability';
import { listRoomReservations } from '@/lib/services/room-reservations';
import {
  listWorkspaceContacts,
  listWorkspaceMail,
  listWorkspaceMissions,
} from '@/lib/services/workspace-service';

export async function getDgCockpit(
  viewer: { firstName: string; lastName: string; role: string },
  now = new Date()
): Promise<DgCockpitData> {
  const todayKey = formatIsoDateInAppTz(now);
  const dayStart = parseDateTime(todayKey, '00:00');
  const horizonEnd = addDays(dayStart, 15);

  const [appointments, pendingAppointments, reservations, pendingReservations, missions, mail, contacts, rooms] =
    await Promise.all([
      listAppointments({ status: 'APPROVED', from: dayStart, to: horizonEnd }).catch(() => []),
      listAppointments({ status: 'PENDING' }).catch(() => []),
      listRoomReservations({
        from: dayStart,
        to: horizonEnd,
        status: 'CONFIRMED',
        archived: false,
      }).catch(() => []),
      listRoomReservations({ status: 'PENDING', archived: false }).catch(() => []),
      listWorkspaceMissions({ archived: false }).catch(() => []),
      listWorkspaceMail({ archived: false }).catch(() => []),
      listWorkspaceContacts({ archived: false }).catch(() => []),
      listMeetingRooms().catch(() => []),
    ]);

  const room = rooms[0];
  const availability = room ? await getRoomAvailability(todayKey, room.id).catch(() => null) : null;

  const toReservation = (
    item: (typeof reservations)[number]
  ): CockpitReservation => ({
    id: item.id,
    title: item.title,
    usageType: item.usageType,
    roomName: item.roomName,
    organizerService: item.organizerService,
    startAt: item.startAt,
    endAt: item.endAt,
    status: item.status,
    appointmentId: item.appointmentId ?? null,
  });

  return buildDgCockpit({
    viewer,
    now,
    appointments: appointments.map((item) => ({
      id: item.id,
      title: item.title,
      startAt: item.startAt,
      endAt: item.endAt,
      status: item.status,
      isOnlineMeeting: item.isOnlineMeeting,
      location: item.location,
      requestedByName: `${item.requestedBy.firstName} ${item.requestedBy.lastName}`.trim(),
      requestedByService: item.requestedBy.department?.trim() || '',
    })),
    reservations: reservations.map(toReservation),
    pendingAppointments: pendingAppointments.length,
    pendingReservations: pendingReservations
      .filter((item) => !isPendingRoomReservationExpired(item, now))
      .map(toReservation),
    missions: missions.map((item) => ({
      id: item.id,
      subject: item.subject,
      destination: item.destination,
      departAt: item.departAt,
      returnAt: item.returnAt,
      status: item.status,
      participants: item.participants,
    })),
    mail: mail.map(
      (item): CockpitMail => ({
        priority: item.priority,
        workflowStatus: item.workflowStatus,
        direction: item.direction,
        archived: item.archived,
      })
    ),
    contacts: contacts.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      jobTitle: item.jobTitle,
      organization: item.organization,
      appointmentCount: item.appointmentCount,
    })),
    slots: (availability?.slots ?? []).map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
    })),
    roomName: room?.name ?? '',
  });
}
