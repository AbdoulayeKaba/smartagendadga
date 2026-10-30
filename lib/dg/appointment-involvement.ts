export type AppointmentInvolvement = 'initiator' | 'invitee';

export function involvementLabel(value: AppointmentInvolvement): string {
  return value === 'initiator' ? 'Initié par vous' : 'Invité';
}

export function sameEmail(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim().toLowerCase() ?? '';
  const b = right?.trim().toLowerCase() ?? '';
  return Boolean(a) && a === b;
}

export function resolveInvolvement(input: {
  userId: string;
  email: string;
  requestedById: string;
  participants: { userId: string | null; email: string }[];
}): AppointmentInvolvement | null {
  if (input.requestedById === input.userId) return 'initiator';
  const invited = input.participants.some(
    (participant) =>
      participant.userId === input.userId || sameEmail(participant.email, input.email)
  );
  return invited ? 'invitee' : null;
}

/** Notification adressée à cet utilisateur (pas une copie déposée sur un autre compte). */
export function notificationAddressedToUser(input: {
  userId: string;
  email: string;
  notificationUserId: string;
  recipientEmail: string | null;
}): boolean {
  if (sameEmail(input.recipientEmail, input.email)) return true;
  if (input.notificationUserId !== input.userId) return false;
  const recipient = input.recipientEmail?.trim() ?? '';
  return !recipient || sameEmail(recipient, input.email);
}

/**
 * Pour un profil sans revue cabinet : la notification reste visible seulement
 * si elle le concerne comme demandeur ou comme invité.
 */
export function audienceInvolvement(input: {
  userId: string;
  email: string;
  notificationUserId: string;
  recipientEmail: string | null;
  appointment: {
    requestedById: string;
    participants: { userId: string | null; email: string }[];
  } | null;
}): AppointmentInvolvement | null {
  if (
    !notificationAddressedToUser({
      userId: input.userId,
      email: input.email,
      notificationUserId: input.notificationUserId,
      recipientEmail: input.recipientEmail,
    })
  ) {
    return null;
  }
  if (!input.appointment) return null;
  return (
    resolveInvolvement({
      userId: input.userId,
      email: input.email,
      requestedById: input.appointment.requestedById,
      participants: input.appointment.participants,
    }) ?? (sameEmail(input.recipientEmail, input.email) ? 'invitee' : null)
  );
}
