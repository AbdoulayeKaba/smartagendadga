import type { AppointmentReviewItem } from '@/lib/dg/appointments-review';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/dg/appointments-review';
import { isReservableMeetingRoomName } from '@/lib/dg/meeting-room-config';

export function displayAppointmentType(appointment: AppointmentReviewItem) {
  return appointment.appointmentTypeLabel ?? APPOINTMENT_TYPE_LABELS[appointment.type];
}

export function displayLocation(appointment: AppointmentReviewItem) {
  return appointment.locationLabel ?? appointment.location?.trim() ?? '—';
}

export function displayReservedRoom(appointment: AppointmentReviewItem) {
  if (appointment.reservedRoomName?.trim()) return appointment.reservedRoomName.trim();
  if (appointment.roomReserved) {
    return appointment.locationLabel ?? appointment.location?.trim() ?? null;
  }
  const location = appointment.locationLabel ?? appointment.location?.trim() ?? '';
  if (location && isReservableMeetingRoomName(location)) return location;
  return null;
}

export function displayMotif(appointment: AppointmentReviewItem) {
  return appointment.motifLabel ?? '—';
}

export function isAppointmentOnlineMeeting(appointment: AppointmentReviewItem): boolean {
  if (appointment.isOnlineMeeting) return true;
  const location = (appointment.locationLabel ?? appointment.location ?? '').trim().toLowerCase();
  if (!location) return false;
  return location.includes('en ligne') || location.includes('teams');
}

export function displayAppointmentModality(appointment: AppointmentReviewItem): {
  online: boolean;
  label: string;
  hint: string;
} {
  const online = isAppointmentOnlineMeeting(appointment);
  return online
    ? { online: true, label: 'En ligne', hint: 'Microsoft Teams' }
    : { online: false, label: 'Présentiel', hint: 'Sur site' };
}

export function displayRequesterName(appointment: AppointmentReviewItem) {
  const stated = displayAppointmentRequester(appointment);
  if (stated?.name) return stated.name;
  const { requestedBy } = appointment;
  return `${requestedBy.firstName} ${requestedBy.lastName}`.trim();
}

/** Coordonnées saisies pour la personne qui demande le rendez-vous. */
export function displayAppointmentRequester(appointment: AppointmentReviewItem): {
  name: string;
  phone: string | null;
  email: string | null;
} | null {
  const name = appointment.requesterFullName?.trim() ?? '';
  const phone = appointment.requesterPhone?.trim() || null;
  const email = appointment.requesterEmail?.trim() || null;
  if (name || phone || email) {
    return { name: name || 'Demandeur', phone, email };
  }
  if (appointment.requestedBy.role === 'EXTERNAL') {
    const accountName = `${appointment.requestedBy.firstName} ${appointment.requestedBy.lastName}`.trim();
    return {
      name: accountName || 'Demandeur',
      phone: appointment.requestedBy.phone?.trim() || null,
      email: appointment.requestedBy.email?.trim() || null,
    };
  }
  return null;
}

export function displayRequesterContactLine(appointment: AppointmentReviewItem) {
  const stated = displayAppointmentRequester(appointment);
  if (stated && (stated.phone || stated.email)) {
    return [stated.phone, stated.email].filter(Boolean).join(' · ');
  }
  return appointment.requestedBy.department ?? appointment.requestedBy.email;
}

/** Personnes en copie, sans le compte qui a saisi la demande ni le demandeur. */
export function displayCopyParticipants(appointment: AppointmentReviewItem) {
  const hidden = new Set(
    [appointment.requestedBy.email, appointment.requesterEmail]
      .map((email) => email?.trim().toLowerCase() ?? '')
      .filter(Boolean)
  );
  const seen = new Set<string>();
  return appointment.participants.filter((participant) => {
    const email = participant.email.trim().toLowerCase();
    if (!email || hidden.has(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}
