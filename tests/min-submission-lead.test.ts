import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMinSubmissionLeadWaivedByUrgency, isSameDayOpenByJustifiedUrgency } from '@/lib/dg/appointment-business-rules';
import { formatIsoDateInAppTz } from '@/lib/datetime/format';
import {
  addDaysToIsoDate,
  earliestAllowedIsoDate,
  earliestSelectableStartTimeOnDate,
  isDateBlockedByMinSubmissionLead,
  MIN_SUBMISSION_LEAD_WAIVED_NOTICE,
  minSubmissionLeadMessage,
  minSubmissionLeadNotice,
  normalizeMinSubmissionLeadRule,
  resolvePlanningSlotDefaultsForDate,
  validateSlotAgainstMinSubmissionLead,
} from '@/lib/dg/min-submission-lead';

describe('min submission lead (R1)', () => {
  const now = new Date('2026-07-30T10:00:00+00:00');

  it('adds calendar days to an ISO date', () => {
    assert.equal(addDaysToIsoDate('2026-07-30', 0), '2026-07-30');
    assert.equal(addDaysToIsoDate('2026-07-30', 1), '2026-07-31');
  });

  it('blocks dates before minDays', () => {
    const rule = { enabled: true, minHours: 0, minDays: 1 };
    const earliest = earliestAllowedIsoDate(now, rule);
    assert.ok(earliest > '2026-07-29');
    assert.equal(isDateBlockedByMinSubmissionLead(earliestAllowedIsoDate(now, { enabled: true, minHours: 0, minDays: 0 }), now, rule), true);
    assert.equal(
      isDateBlockedByMinSubmissionLead(addDaysToIsoDate(earliestAllowedIsoDate(now, { enabled: true, minHours: 0, minDays: 0 }), 1), now, rule),
      false
    );
  });

  it('applies minHours to start time on the same day', () => {
    const rule = { enabled: true, minHours: 1, minDays: 0 };
    // Use a fixed local-ish instant via ISO without relying on TZ for date part of message
    const msg = minSubmissionLeadMessage(rule);
    assert.match(msg, /1 heure/);

    const violation = validateSlotAgainstMinSubmissionLead({
      date: '2099-01-01',
      startTime: '00:00',
      now: new Date('2099-01-01T12:00:00Z'),
      rule,
    });
    assert.equal(violation, minSubmissionLeadMessage(rule));

    const ok = validateSlotAgainstMinSubmissionLead({
      date: '2099-01-01',
      startTime: '14:00',
      now: new Date('2099-01-01T12:00:00Z'),
      rule,
    });
    assert.equal(ok, null);
  });

  it('returns a start lower bound on the earliest allowed day', () => {
    const rule = { enabled: true, minHours: 1, minDays: 0 };
    const bound = earliestSelectableStartTimeOnDate('2099-06-15', new Date('2099-06-15T08:07:00Z'), rule);
    // Bound exists and is after 08:07
    assert.ok(bound);
    assert.ok(bound! >= '08:15' || bound! >= '09:00');
  });

  it('ignores the rule when disabled', () => {
    const rule = { enabled: false, minHours: 24, minDays: 5 };
    assert.equal(isDateBlockedByMinSubmissionLead('2026-07-30', now, rule), false);
    assert.equal(
      validateSlotAgainstMinSubmissionLead({
        date: '2026-07-30',
        startTime: '09:00',
        now,
        rule,
      }),
      null
    );
  });

  it('normalizes 24 h glissantes en 1 jour calendaire', () => {
    const raw = { enabled: true, minHours: 24, minDays: 0 };
    const normalized = normalizeMinSubmissionLeadRule(raw);
    assert.deepEqual(normalized, { enabled: true, minHours: 0, minDays: 1 });

    const tomorrow = addDaysToIsoDate(earliestAllowedIsoDate(now, { enabled: true, minHours: 0, minDays: 0 }), 1);
    assert.equal(isDateBlockedByMinSubmissionLead(earliestAllowedIsoDate(now, { enabled: true, minHours: 0, minDays: 0 }), now, raw), true);
    assert.equal(isDateBlockedByMinSubmissionLead(tomorrow, now, raw), false);

    const defaults = resolvePlanningSlotDefaultsForDate({
      date: tomorrow,
      now,
      rule: raw,
      workDayStart: '09:00',
      workDayEnd: '18:00',
      officeHoursRestricted: true,
    });
    assert.equal(defaults.startTime, '09:00');
    assert.equal(defaults.endTime, '10:00');
  });

  it('explains the politeness delay and lifts it only for a justified urgency', () => {
    const rule = { enabled: true, minHours: 0, minDays: 1 };
    const notice = minSubmissionLeadNotice(rule);
    assert.match(notice ?? '', /La demande doit arriver/);
    assert.doesNotMatch(notice ?? '', /Délai de politesse/);
    assert.match(notice ?? '', /1 jour/);
    assert.equal(minSubmissionLeadNotice({ enabled: false, minHours: 0, minDays: 1 }), null);
    const zero = minSubmissionLeadNotice({ enabled: true, minHours: 0, minDays: 0 });
    assert.match(zero ?? '', /créneau trop proche/);
    assert.doesNotMatch(zero ?? '', /politesse/i);
    assert.equal(isDateBlockedByMinSubmissionLead('2026-07-30', now, { enabled: true, minHours: 0, minDays: 0 }), false);

    const urgency = {
      enabled: true,
      minChars: 50,
      levels: ['URGENT', 'TRES_URGENT', 'CRITIQUE'] as Array<'URGENT' | 'TRES_URGENT' | 'CRITIQUE'>,
    };
    assert.equal(isMinSubmissionLeadWaivedByUrgency(urgency, 'NORMAL', 'x'.repeat(50)), false);
    assert.equal(isMinSubmissionLeadWaivedByUrgency(urgency, 'URGENT', 'trop court'), false);
    assert.equal(isMinSubmissionLeadWaivedByUrgency(urgency, 'URGENT', 'x'.repeat(50)), true);
    assert.match(MIN_SUBMISSION_LEAD_WAIVED_NOTICE, /ne s’applique plus/);
    assert.doesNotMatch(MIN_SUBMISSION_LEAD_WAIVED_NOTICE, /politesse/i);

    const today = formatIsoDateInAppTz(now);
    const tomorrow = addDaysToIsoDate(today, 1);
    const text = 'x'.repeat(50);
    assert.equal(isSameDayOpenByJustifiedUrgency(urgency, 'URGENT', text, today, now), true);
    assert.equal(isSameDayOpenByJustifiedUrgency(urgency, 'URGENT', 'court', today, now), false);
    assert.equal(isSameDayOpenByJustifiedUrgency(urgency, 'URGENT', text, tomorrow, now), false);
  });
});
