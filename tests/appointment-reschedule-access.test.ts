import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReviewerEditAppointment,
  isAppointmentReschedulable,
} from '@/lib/dg/appointment-reschedule-access';

const now = new Date('2026-08-12T11:16:00.000Z');

test('appointment reschedule access', () => {
  const pastApproved = {
    status: 'APPROVED',
    startAt: '2026-08-12T09:00:00.000Z',
    endAt: '2026-08-12T10:00:00.000Z',
  };
  assert.equal(isAppointmentReschedulable(pastApproved, now), false);

  const upcomingApproved = {
    status: 'APPROVED',
    startAt: '2026-08-12T14:00:00.000Z',
    endAt: '2026-08-12T15:00:00.000Z',
  };
  assert.equal(isAppointmentReschedulable(upcomingApproved, now), true);

  const pending = {
    status: 'PENDING',
    startAt: '2026-08-12T09:00:00.000Z',
    endAt: '2026-08-12T10:00:00.000Z',
  };
  assert.equal(isAppointmentReschedulable(pending, now), true);
});

test('reviewer edit access allows assistant and dg on pending requests', () => {
  assert.equal(
    canReviewerEditAppointment('ASSISTANT', { 'action.appointments.edit': true }, 'PENDING'),
    true
  );
  assert.equal(
    canReviewerEditAppointment('DG', { 'action.appointments.edit': true }, 'PENDING'),
    true
  );
  assert.equal(
    canReviewerEditAppointment('DG', { 'action.appointments.edit': false }, 'PENDING'),
    false
  );
  assert.equal(
    canReviewerEditAppointment('ASSISTANT', { 'action.appointments.edit': true }, 'APPROVED'),
    false
  );
  assert.equal(
    canReviewerEditAppointment(
      'ASSISTANT',
      { 'action.appointments.edit': true },
      'APPROVED',
      {
        startAt: '2026-08-12T14:00:00.000Z',
        endAt: '2026-08-12T15:00:00.000Z',
        now,
      }
    ),
    true
  );
  assert.equal(
    canReviewerEditAppointment(
      'DG',
      { 'action.appointments.edit': true },
      'APPROVED',
      {
        startAt: '2026-08-12T09:00:00.000Z',
        endAt: '2026-08-12T10:00:00.000Z',
        now,
      }
    ),
    false
  );
  assert.equal(
    canReviewerEditAppointment(
      'DG',
      { 'action.appointments.edit': true },
      'APPROVED',
      {
        startAt: '2026-08-12T11:00:00.000Z',
        endAt: '2026-08-12T12:00:00.000Z',
        now,
      }
    ),
    false
  );
});
