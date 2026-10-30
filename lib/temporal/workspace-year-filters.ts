import type {
  AudienceRecord,
  DgDecision,
  DgMission,
  DgMissionHotelReservation,
  DgProject,
  DgTask,
  ImportantDeadline,
  MailItem,
  OfficialInvitation,
  StrategicContact,
  VaultDocument,
} from '@/lib/workspace/types';
import { anyDateInYear, dateInYear, rangeOverlapsYear } from '@/lib/temporal/year-range';

export function filterTasksByYear(items: DgTask[], year: number): DgTask[] {
  return items.filter((t) =>
    anyDateInYear([t.dueAt, t.startAt, t.createdAt], year)
  );
}

export function filterProjectsByYear(items: DgProject[], year: number): DgProject[] {
  return items.filter((p) =>
    anyDateInYear([p.startAt, p.dueAt, p.createdAt], year)
  );
}

export function filterDecisionsByYear(items: DgDecision[], year: number): DgDecision[] {
  return items.filter((d) =>
    anyDateInYear([d.meetingDate, d.dueAt, d.createdAt], year)
  );
}

export function filterMailByYear(items: MailItem[], year: number): MailItem[] {
  return items.filter((m) => dateInYear(m.mailDate, year));
}

export function filterAudiencesByYear(items: AudienceRecord[], year: number): AudienceRecord[] {
  return items.filter((a) => dateInYear(a.heldAt, year));
}

export function filterInvitationsByYear(items: OfficialInvitation[], year: number): OfficialInvitation[] {
  return items.filter((i) => dateInYear(i.eventDate, year));
}

export function filterMissionsByYear(items: DgMission[], year: number): DgMission[] {
  return items.filter((m) => rangeOverlapsYear(m.departAt, m.returnAt, year));
}

export function filterHotelReservationsByYear(
  items: DgMissionHotelReservation[],
  year: number
): DgMissionHotelReservation[] {
  return items.filter((r) => rangeOverlapsYear(r.arrivalDate, r.departureDate, year));
}

export function filterDeadlinesByYear(items: ImportantDeadline[], year: number): ImportantDeadline[] {
  return items.filter((d) => dateInYear(d.dueAt, year));
}

export function filterDocumentsByYear(items: VaultDocument[], year: number): VaultDocument[] {
  return items.filter((d) =>
    anyDateInYear([d.reportDate, d.uploadedAt], year)
  );
}

/** Annuaire : contacts créés ou mis à jour durant l'année. */
export function filterContactsByYear(items: StrategicContact[], year: number): StrategicContact[] {
  return items.filter((c) =>
    anyDateInYear([c.createdAt, c.updatedAt], year)
  );
}
