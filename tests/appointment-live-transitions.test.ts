import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectAppointmentTransitionTimes,
  isPendingAutoRejectDue,
  resolveLiveAppointmentStatusView,
  resolveLiveClockIntervalMs,
} from '@/lib/dg/appointment-live-transitions';
import { isApprovedAppointmentOngoing } from '@/lib/dg/appointments-review';

test('pending auto reject preview when slot start has passed', () => {
  const now = new Date('2026-08-12T12:05:00');
  const item = { status: 'PENDING' as const, startAt: '2026-08-12T12:00:00' };

  assert.equal(isPendingAutoRejectDue(item, now), true);
  assert.deepEqual(resolveLiveAppointmentStatusView(item, now), {
    status: 'REJECTED',
    autoRejected: true,
  });
});

test('pending stays pending before slot start', () => {
  const now = new Date('2026-08-12T11:59:00');
  const item = { status: 'PENDING' as const, startAt: '2026-08-12T12:00:00' };

  assert.equal(isPendingAutoRejectDue(item, now), false);
  assert.deepEqual(resolveLiveAppointmentStatusView(item, now), item);
});

test('collects transition times for pending and approved appointments', () => {
  const now = new Date('2026-08-12T11:00:00');
  const times = collectAppointmentTransitionTimes(
    [
      { status: 'PENDING', startAt: '2026-08-12T12:00:00', endAt: '2026-08-12T12:30:00' },
      { status: 'APPROVED', startAt: '2026-08-12T13:00:00', endAt: '2026-08-12T14:00:00' },
    ],
    now
  );

  assert.deepEqual(times, [
    new Date('2026-08-12T12:00:00').getTime(),
    new Date('2026-08-12T13:00:00').getTime(),
    new Date('2026-08-12T14:00:00').getTime(),
  ]);
});

test('slows live clock outside urgent transition window', () => {
  const now = new Date('2026-08-12T11:00:00');
  assert.equal(
    resolveLiveClockIntervalMs(
      [{ status: 'APPROVED', startAt: '2026-08-12T15:00:00', endAt: '2026-08-12T16:00:00' }],
      now
    ),
    30_000
  );
  assert.equal(
    resolveLiveClockIntervalMs(
      [{ status: 'PENDING', startAt: '2026-08-12T11:02:00', endAt: '2026-08-12T11:30:00' }],
      now
    ),
    1000
  );
});

test('detects ongoing approved appointment for archive guard', () => {
  assert.equal(
    isApprovedAppointmentOngoing(
      { status: 'APPROVED', startAt: '2026-09-02T12:00:00', endAt: '2026-09-02T13:00:00' },
      new Date('2026-09-02T12:30:00')
    ),
    true
  );
  assert.equal(
    isApprovedAppointmentOngoing(
      { status: 'APPROVED', startAt: '2026-09-02T12:00:00', endAt: '2026-09-02T13:00:00' },
      new Date('2026-09-02T11:30:00')
    ),
    false
  );
});
