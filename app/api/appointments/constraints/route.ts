import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { BUSINESS_RULE_CATALOG } from '@/lib/dg/appointment-business-rules';
import { buildSchedulingBlockedRanges } from '@/lib/dg/appointment-scheduling-context';
import { getHolidayMeta, getUnavailabilityMeta } from '@/lib/dg/referential-types';
import { effectiveAutoRejectBeforeStartMinutes } from '@/lib/dg/appointment-expiry';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
  listReferentialItems,
} from '@/lib/services/referentials-admin';
import { listAppointmentParticipantUsers } from '@/lib/services/appointment-participant-users';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { listWorkspaceMissions } from '@/lib/services/workspace-service';

/** Règles actives exposées aux demandeurs (lecture seule). */
export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const [rules, config, holidaysRaw, unavailabilityItems, missions] = await Promise.all([
    getAppointmentBusinessRules(),
    getPlatformSettings(),
    listActiveHolidays().catch(() => []),
    listActiveUnavailabilities().catch(() => []),
    listWorkspaceMissions({ archived: false }).catch(() => []),
  ]);

  const types = await listReferentialItems('types-rdv', { archived: false }).catch(() => []);
  const [lieux, motifs, participantUsers] = await Promise.all([
    listReferentialItems('lieux', { archived: false }).catch(() => []),
    listReferentialItems('motifs', { archived: false }).catch(() => []),
    listAppointmentParticipantUsers().catch(() => []),
  ]);

  const holidays = holidaysRaw.map((item) => {
    const meta = getHolidayMeta(item);
    return {
      date: meta.date,
      annualRepeat: meta.annualRepeat,
      active: meta.active,
      type: meta.type,
    };
  });

  const unavailabilities = unavailabilityItems
    .map((item) => getUnavailabilityMeta(item))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const blockedRanges = buildSchedulingBlockedRanges({
    unavailabilities,
    missions,
  });

  return NextResponse.json({
    catalog: BUSINESS_RULE_CATALOG,
    rules,
    scheduling: {
      workingDays: config.workingDays,
      allowWeekendAppointments: config.allowWeekendAppointments,
      workDayStart: config.workDayStart,
      workDayEnd: config.workDayEnd,
      lunchBreakStart: config.lunchBreakStart,
      lunchBreakEnd: config.lunchBreakEnd,
      slotDurationMinutes: config.slotDurationMinutes,
      allowOutsideHours: config.allowOutsideHours,
      autoRejectBeforeStartMinutes: effectiveAutoRejectBeforeStartMinutes(
        config.autoRejectBeforeStartMinutes,
        rules.minSubmissionLead
      ),
      holidays,
      blockedRanges,
    },
    appointmentTypes: types.map((t) => ({
      id: t.id,
      name: t.name,
      durationMinutes: t.value ? Number(t.value) : null,
    })),
    locations: lieux.map((item) => ({ id: item.id, name: item.name })),
    motifs: motifs.map((item) => ({ id: item.id, name: item.name })),
    participantUsers,
  });
}
