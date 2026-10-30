import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_REJECT_EXPIRED_REASON,
  AUTO_REJECT_START_PASSED_REASON,
  effectiveAutoRejectBeforeStartMinutes,
  formatAutoRejectExpiredReason,
  getAutoRejectDeadline,
  isPendingAppointmentExpired,
  resolveAutoRejectReason,
} from '../lib/dg/appointment-expiry';
import { appointmentStatusLabel } from '../lib/dg/appointments-review';

describe('appointment auto reject expiry', () => {
  const beforeStartMinutes = 120;

  it('detects pending appointments past the validation deadline (2 h before start)', () => {
    const now = new Date('2026-06-17T12:00:00');
    const startAt = '2026-06-17T14:00:00';

    assert.equal(
      isPendingAppointmentExpired('PENDING', startAt, now, beforeStartMinutes),
      true
    );
    assert.equal(
      isPendingAppointmentExpired('PENDING', startAt, new Date('2026-06-17T11:59:59'), beforeStartMinutes),
      false
    );
    assert.equal(
      isPendingAppointmentExpired('APPROVED', startAt, now, beforeStartMinutes),
      false
    );
  });

  it('computes the auto-reject deadline from start time', () => {
    const start = new Date('2026-06-17T14:00:00Z');
    const deadline = getAutoRejectDeadline(start, 120);
    assert.equal(deadline.getTime(), start.getTime() - 120 * 60_000);
  });

  it('exposes a stable rejection reason', () => {
    assert.match(AUTO_REJECT_EXPIRED_REASON, /2 h avant le début/i);
    assert.match(formatAutoRejectExpiredReason(60), /1 h avant le début/i);
  });

  it('detects pending appointments once the slot start time has passed', () => {
    const startAt = '2026-06-17T14:00:00';
    const now = new Date('2026-06-17T14:05:00');

    assert.equal(isPendingAppointmentExpired('PENDING', startAt, now, 120), true);
    assert.equal(isPendingAppointmentExpired('PENDING', startAt, now, 0), true);
    assert.equal(
      isPendingAppointmentExpired('PENDING', startAt, new Date('2026-06-17T13:59:59'), 0),
      false
    );
  });

  it('uses a dedicated reason when the slot start time has passed', () => {
    const startAt = new Date('2026-06-17T14:00:00');
    const now = new Date('2026-06-17T14:01:00');

    assert.equal(resolveAutoRejectReason(startAt, now, 120), AUTO_REJECT_START_PASSED_REASON);
    assert.equal(resolveAutoRejectReason(startAt, now, 0), AUTO_REJECT_START_PASSED_REASON);
  });

  it('drops the pre-start window when the submission lead is 0 h and 0 day', () => {
    assert.equal(
      effectiveAutoRejectBeforeStartMinutes(120, { enabled: true, minHours: 0, minDays: 0 }),
      0
    );
    assert.equal(
      effectiveAutoRejectBeforeStartMinutes(120, { enabled: false, minHours: 24, minDays: 1 }),
      0
    );
    assert.equal(
      effectiveAutoRejectBeforeStartMinutes(120, { enabled: true, minHours: 0, minDays: 1 }),
      120
    );
  });

  it('labels auto-rejected items distinctly', () => {
    assert.equal(
      appointmentStatusLabel({ status: 'REJECTED', autoRejected: true }),
      'Rejet automatique'
    );
    assert.equal(
      appointmentStatusLabel({ status: 'REJECTED', autoRejected: false }),
      'Refusé'
    );
  });
});
