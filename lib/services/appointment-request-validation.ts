import type { DgRole } from '@/lib/dg/rbac';
import {
  isMinSubmissionLeadWaivedByUrgency,
  isSameDayOpenByJustifiedUrgency,
  type AppointmentBusinessRules,
  type PreContactChoice,
  type UrgencyLevel,
} from '@/lib/dg/appointment-business-rules';
import {
  embedDescriptionWithMeta,
  type AppointmentRequestMeta,
} from '@/lib/dg/appointment-request-meta';
import {
  APPOINTMENT_POLICY_MESSAGES,
  validateAppointmentAgainstPolicy,
} from '@/lib/dg/scheduling-policy';
import { getUnavailabilityMeta } from '@/lib/dg/referential-types';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
  listReferentialItems,
} from '@/lib/services/referentials-admin';
import { listAppointments } from '@/lib/services/appointments';
import { requesterContactError } from '@/lib/dg/appointment-planning';
import {
  findTitleDuplicateRow,
  getTitleDuplicateMessage,
  resolveTitleDuplicateReason,
} from '@/lib/dg/appointment-title-match';
import {
  isDateBlockedByMinSubmissionLead,
  minSubmissionLeadMessage,
  validateSlotAgainstMinSubmissionLead,
} from '@/lib/dg/min-submission-lead';

export type AppointmentValidationInput = {
  requestedById: string;
  requesterRole: DgRole;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  excludeId?: string;
  urgencyLevel: UrgencyLevel;
  justification?: string;
  preContact: PreContactChoice[];
  appointmentTypeRef?: string;
  locationRef?: string;
  motifRef?: string;
  roomReserved?: boolean;
  roomId?: string;
  roomName?: string;
  roomUsageType?: string;
  roomEquipment?: string[];
  roomReservationId?: string;
  isOnlineMeeting?: boolean;
  meetingFormat?: 'PRESENTIEL' | 'ONLINE' | 'HYBRID';
  requesterFullName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
};

export type RuleViolation = {
  ruleId: string;
  code: string;
  message: string;
  blocking: boolean;
};

export type RuleWarning = {
  ruleId: string;
  code: string;
  message: string;
};

export type AppointmentValidationResult = {
  ok: boolean;
  violations: RuleViolation[];
  warnings: RuleWarning[];
  priorityScore: number;
  meta: AppointmentRequestMeta;
  description: string;
  workflowSteps: string[];
};

function msBetween(a: Date, b: Date) {
  return b.getTime() - a.getTime();
}

function parseSlot(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

async function countRequesterAppointments(
  requestedById: string,
  opts: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; from?: Date; to?: Date }
) {
  const rows = await listAppointments({
    requestedById,
    ...(opts.from ? { from: opts.from } : {}),
    ...(opts.to ? { to: opts.to } : {}),
  });
  if (!opts.status) return rows.length;
  return rows.filter((r) => r.status === opts.status).length;
}

async function countDgAppointmentsOnDay(date: string) {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const rows = await listAppointments({ from: dayStart, to: dayEnd, status: 'APPROVED' });
  return rows.length;
}

function weekRange(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon, to: sun };
}

async function countDgAppointmentsInWeek(date: string) {
  const { from, to } = weekRange(date);
  const rows = await listAppointments({ from, to, status: 'APPROVED' });
  return rows.length;
}

export async function validateAppointmentRequest(
  input: AppointmentValidationInput,
  options?: { rules?: AppointmentBusinessRules; skipSlotPolicy?: boolean }
): Promise<AppointmentValidationResult> {
  const rules = options?.rules ?? (await getAppointmentBusinessRules());
  const violations: RuleViolation[] = [];
  const warnings: RuleWarning[] = [];

  const startAt = parseSlot(input.date, input.startTime);
  const endAt = parseSlot(input.date, input.endTime);
  const durationMinutes = Math.round(msBetween(startAt, endAt) / 60_000);

  if (rules.maxPendingPerEmployee.enabled) {
    const rows = await listAppointments({ requestedById: input.requestedById, status: 'PENDING' });
    const pending = rows.filter((r) => r.id !== input.excludeId).length;
    if (pending >= rules.maxPendingPerEmployee.maxCount) {
      violations.push({
        ruleId: 'maxPendingPerEmployee',
        code: 'MAX_PENDING',
        message: `Maximum ${rules.maxPendingPerEmployee.maxCount} demande(s) en attente par employé.`,
        blocking: true,
      });
    }
  }

  if (rules.duplicateControl.enabled) {
    const rows = await listAppointments({ requestedById: input.requestedById });
    const duplicate = findTitleDuplicateRow(
      {
        title: input.title,
        excludeId: input.excludeId,
        date: input.date,
      },
      rows
    );

    if (duplicate) {
      violations.push({
        ruleId: 'duplicateControl',
        code: 'DUPLICATE_REQUEST',
        message: getTitleDuplicateMessage(resolveTitleDuplicateReason(duplicate, input.date)),
        blocking: true,
      });
    }
  }

  if (input.requesterRole === 'ASSISTANT' || input.requesterRole === 'DG') {
    const hasRequesterContact = Boolean(
      input.requesterFullName?.trim() ||
        input.requesterPhone?.trim() ||
        input.requesterEmail?.trim()
    );
    const contactError = hasRequesterContact
      ? requesterContactError({
          fullName: input.requesterFullName ?? '',
          phone: input.requesterPhone ?? '',
          email: input.requesterEmail ?? '',
        })
      : null;
    if (contactError) {
      violations.push({
        ruleId: 'requesterContact',
        code: 'REQUESTER_CONTACT',
        message: contactError,
        blocking: true,
      });
    }
  }

  if (rules.urgencyJustification.enabled && rules.urgencyJustification.levels.includes(input.urgencyLevel)) {
    const just = (input.justification ?? '').trim();
    if (just.length < rules.urgencyJustification.minChars) {
      violations.push({
        ruleId: 'urgencyJustification',
        code: 'JUSTIFICATION_REQUIRED',
        message: `La justification de l’urgence est obligatoire (minimum ${rules.urgencyJustification.minChars} caractères).`,
        blocking: true,
      });
    }
  }

  const leadWaived = isMinSubmissionLeadWaivedByUrgency(
    rules.urgencyJustification,
    input.urgencyLevel,
    input.justification
  );
  if (rules.minSubmissionLead.enabled && !leadWaived) {
    const leadMsg = input.allDay
      ? isDateBlockedByMinSubmissionLead(input.date, new Date(), rules.minSubmissionLead)
        ? minSubmissionLeadMessage(rules.minSubmissionLead)
        : null
      : validateSlotAgainstMinSubmissionLead({
          date: input.date,
          startTime: input.startTime,
          rule: rules.minSubmissionLead,
        });
    if (leadMsg) {
      violations.push({
        ruleId: 'minSubmissionLead',
        code: 'MIN_SUBMISSION_LEAD',
        message: leadMsg,
        blocking: true,
      });
    }
  }

  const config = await getPlatformSettings();

  if (rules.maxPerMonth.enabled) {
    const from = new Date();
    from.setDate(from.getDate() - rules.maxPerMonth.periodDays);
    const active = await listAppointments({ requestedById: input.requestedById, from });
    const relevant = active.filter(
      (r) =>
        (r.status === 'PENDING' || r.status === 'APPROVED') && r.id !== input.excludeId
    ).length;
    if (relevant >= rules.maxPerMonth.maxCount) {
      violations.push({
        ruleId: 'maxPerMonth',
        code: 'MAX_PER_PERIOD',
        message: `Maximum ${rules.maxPerMonth.maxCount} rendez-vous sur ${rules.maxPerMonth.periodDays} jours.`,
        blocking: true,
      });
    }
  }

  if (rules.allowedSlotsOnly.enabled && !options?.skipSlotPolicy) {
    const holidays = await listActiveHolidays();
    const unavailabilityItems = await listActiveUnavailabilities();
    const unavailabilities = unavailabilityItems
      .map((i) => getUnavailabilityMeta(i))
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const onDay = await countDgAppointmentsOnDay(input.date);
    const onWeek = await countDgAppointmentsInWeek(input.date);

    const policyViolation = validateAppointmentAgainstPolicy({
      config,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes,
      appointmentsOnDay: onDay,
      appointmentsOnWeek: onWeek,
      holidays,
      unavailabilities,
      allDay: input.allDay,
      isOnlineMeeting: input.isOnlineMeeting,
      ignoreDateBlocks: isSameDayOpenByJustifiedUrgency(
        rules.urgencyJustification,
        input.urgencyLevel,
        input.justification,
        input.date
      ),
    });

    if (policyViolation) {
      violations.push({
        ruleId: 'allowedSlotsOnly',
        code: policyViolation,
        message: APPOINTMENT_POLICY_MESSAGES[policyViolation],
        blocking: true,
      });
    }
  }

  const meta: AppointmentRequestMeta = {
    urgencyLevel: input.urgencyLevel,
    justification: input.justification?.trim() || undefined,
    preContact: [],
    appointmentTypeRef: input.appointmentTypeRef,
    locationRef: input.locationRef,
    motifRef: input.motifRef,
    ...(input.meetingFormat ? { meetingFormat: input.meetingFormat } : {}),
    ...(input.requesterFullName?.trim()
      ? { requesterFullName: input.requesterFullName.trim().replace(/\s+/g, ' ') }
      : {}),
    ...(input.requesterPhone?.trim() ? { requesterPhone: input.requesterPhone.trim() } : {}),
    ...(input.requesterEmail?.trim() ? { requesterEmail: input.requesterEmail.trim() } : {}),
    ...(input.roomReserved
      ? {
          roomReserved: true,
          roomId: input.roomId,
          roomName: input.roomName,
          roomUsageType: input.roomUsageType,
          ...(Array.isArray(input.roomEquipment) && input.roomEquipment.length > 0
            ? { roomEquipment: input.roomEquipment }
            : {}),
          ...(input.roomReservationId?.trim()
            ? { roomReservationId: input.roomReservationId.trim() }
            : {}),
        }
      : {}),
  };

  const userText = (input.description ?? '').replace(/<!--APPT_META:[\s\S]*?-->/, '').trim();
  const description = embedDescriptionWithMeta(userText, meta);

  return {
    ok: violations.filter((v) => v.blocking).length === 0,
    violations,
    warnings,
    priorityScore: 0,
    meta,
    description,
    workflowSteps: [],
  };
}
