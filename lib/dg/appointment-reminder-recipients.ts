import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';

export type ReminderRecipient = {
  email: string;
  name: string;
  userId: string | null;
};

export type ReminderRecipientSource = {
  requestedById: string;
  description?: string | null;
  requestedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  participants: {
    email: string;
    name: string;
    userId: string | null;
  }[];
};

function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function listParticipantRecipientsFromSource(
  appointment: ReminderRecipientSource
): ReminderRecipient[] {
  const seen = new Set<string>();
  const recipients: ReminderRecipient[] = [];

  for (const participant of appointment.participants) {
    const email = participant.email.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({
      email,
      name: participant.name.trim() || email.split('@')[0] || 'Participant',
      userId: participant.userId,
    });
  }

  return recipients;
}

function statedRequesterRecipient(
  description: string | null | undefined
): ReminderRecipient | null {
  const meta = parseAppointmentMeta(description).meta;
  const email = meta.requesterEmail?.trim() ?? '';
  if (!email.includes('@')) return null;
  return {
    email,
    name: meta.requesterFullName?.trim() || email.split('@')[0] || 'Demandeur',
    userId: null,
  };
}

/** Personnes en copie, compte qui a saisi la demande, et demandeur indiqué sur la fiche. */
export function listAppointmentReminderRecipients(
  appointment: ReminderRecipientSource
): ReminderRecipient[] {
  const recipients = listParticipantRecipientsFromSource(appointment);
  const seen = new Set(recipients.map((r) => r.email.toLowerCase()));
  const requesterEmail = appointment.requestedBy.email.trim();
  if (requesterEmail && !seen.has(requesterEmail.toLowerCase())) {
    recipients.push({
      email: requesterEmail,
      name: displayName(appointment.requestedBy.firstName, appointment.requestedBy.lastName),
      userId: appointment.requestedById,
    });
    seen.add(requesterEmail.toLowerCase());
  }
  const stated = statedRequesterRecipient(appointment.description);
  if (stated && !seen.has(stated.email.toLowerCase())) {
    recipients.push(stated);
  }
  return recipients;
}
