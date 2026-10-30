/** Créneau ou date de soumission dans la période (imports historiques visibles l’année courante). */
export function appointmentMatchesTemporalRange(
  row: { startAt: Date; endAt: Date; createdAt: Date },
  from?: Date,
  to?: Date,
  options?: { slotOnly?: boolean }
): boolean {
  if (!from && !to) return true;
  if (options?.slotOnly) {
    return (!from || row.startAt >= from) && (!to || row.startAt <= to);
  }
  const slotInRange =
    (!from || row.endAt >= from) && (!to || row.startAt <= to);
  const submittedInRange =
    (!from || row.createdAt >= from) && (!to || row.createdAt <= to);
  return slotInRange || submittedInRange;
}
