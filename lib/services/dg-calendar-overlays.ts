import { mergeCalendarOverlayEvents } from '@/lib/dg/calendar-overlay-events';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
} from '@/lib/services/referentials-admin';
import { listWorkspaceMissions } from '@/lib/services/workspace-service';

export async function listDgCalendarOverlays(from: Date, toExclusive: Date) {
  const [holidays, unavailabilities, missions] = await Promise.all([
    listActiveHolidays(),
    listActiveUnavailabilities(),
    listWorkspaceMissions({ archived: false }),
  ]);

  const agendaMissions = missions.filter(
    (m) => m.status === 'PLANNED' || m.status === 'ONGOING' || m.status === 'COMPLETED'
  );

  return mergeCalendarOverlayEvents(
    holidays,
    unavailabilities,
    agendaMissions,
    from,
    toExclusive
  );
}
