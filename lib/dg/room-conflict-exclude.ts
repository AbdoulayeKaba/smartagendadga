/** Ids à ignorer lors d’un contrôle de conflit salle (édition RDV / réservation). */
export type RoomConflictExcludeOptions = {
  excludeReservationId?: string;
  excludeAppointmentId?: string;
  /** Assistante : aucune règle de référentiel ni occupation ne bloque tant que l’heure n’est pas passée. */
  ignoreReferentialRules?: boolean;
};

export function isExcludedRoomBooking(
  row: { id: string },
  options?: RoomConflictExcludeOptions
) {
  if (!options) return false;
  if (options.excludeReservationId && row.id === options.excludeReservationId) return true;
  if (options.excludeAppointmentId) {
    if (row.id === options.excludeAppointmentId) return true;
    if (row.id === `appt-${options.excludeAppointmentId}`) return true;
  }
  return false;
}
