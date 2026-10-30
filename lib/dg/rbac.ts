export type DgRole = 'DG' | 'ASSISTANT' | 'MANAGER' | 'EXTERNAL';

export function parseDgRole(raw: string | null | undefined): DgRole {
  if (raw === 'DG' || raw === 'ASSISTANT' || raw === 'MANAGER' || raw === 'EXTERNAL') return raw;
  return 'MANAGER';
}

export function canReviewAppointments(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}

export function canRequestAppointment(role: DgRole) {
  return role === 'MANAGER' || role === 'EXTERNAL' || role === 'ASSISTANT' || role === 'DG';
}

export function canUseUrgentOverride(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}

/** Toutes les demandes passent par la file d’attente (validation assistante). */
export function canAutoConfirmRoomReservation(_role: DgRole) {
  return false;
}

export function canReviewRoomReservations(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}

/** Réservation de salle : espace admin, assistante et DGA uniquement. */
export function canRequestRoomReservation(role: DgRole) {
  return role === 'ASSISTANT' || role === 'DG';
}

/** L’assistante réserve jusqu’à l’heure de début. Le référentiel ne la bloque pas. */
export function assistantBooksUntilStart(role: string) {
  return role === 'ASSISTANT';
}

/** @deprecated La planification crée toujours une demande en attente ; l’agenda DGA se met à jour uniquement après validation assistante. */
export function canAutoApprovePlannedAppointment(_role: DgRole) {
  return false;
}

/** Administratrice de la plateforme : utilisateurs, import, paramétrage. */
export function canAdminPlatform(role: DgRole) {
  return role === 'ASSISTANT';
}
