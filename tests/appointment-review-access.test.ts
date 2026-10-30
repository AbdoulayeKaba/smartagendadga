import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAppointmentActions } from '@/lib/dg/appointment-review-access';
import {
  canReviewerEditAppointment,
  isAppointmentReschedulable,
} from '@/lib/dg/appointment-reschedule-access';

const now = new Date('2026-08-12T11:16:00.000Z');

test('review actions respect permission toggles', () => {
  const allOff = reviewAppointmentActions({}, 'PENDING', 'active');
  assert.equal(allOff.canApprove, false);
  assert.equal(allOff.canReschedule, false);
  assert.equal(allOff.canReject, false);
  assert.equal(allOff.canEdit, false);
  assert.equal(allOff.canDetail, false);
  assert.equal(allOff.canArchive, false);

  const approveOnly = reviewAppointmentActions(
    { 'action.appointments.approve': true },
    'PENDING',
    'active'
  );
  assert.equal(approveOnly.canApprove, true);
  assert.equal(approveOnly.canReject, false);

  const approved = reviewAppointmentActions(
    {
      'action.appointments.approve': true,
      'action.appointments.reschedule': true,
      'action.appointments.edit': true,
    },
    'APPROVED',
    'active',
    {
      role: 'DG',
      startAt: '2026-08-12T14:00:00.000Z',
      endAt: '2026-08-12T15:00:00.000Z',
      now,
    }
  );
  assert.equal(approved.canApprove, false);
  assert.equal(approved.canReschedule, true);
  assert.equal(approved.canEdit, true);
});

test('assistant and dg can edit pending requests', () => {
  const assistant = reviewAppointmentActions(
    { 'action.appointments.edit': true },
    'PENDING',
    'active',
    { role: 'ASSISTANT' }
  );
  assert.equal(assistant.canEdit, true);
  assert.equal(canReviewerEditAppointment('ASSISTANT', { 'action.appointments.edit': true }, 'PENDING'), true);
  assert.equal(canReviewerEditAppointment('ASSISTANT', { 'action.appointments.edit': false }, 'PENDING'), false);

  const dg = reviewAppointmentActions(
    { 'action.appointments.edit': true },
    'PENDING',
    'active',
    { role: 'DG' }
  );
  assert.equal(dg.canEdit, true);
});

test('a past appointment cannot be cancelled, edited, or rescheduled', () => {
  const past = reviewAppointmentActions(
    {
      'action.appointments.reschedule': true,
      'action.appointments.reject': true,
      'action.appointments.edit': true,
    },
    'APPROVED',
    'active',
    {
      role: 'DG',
      startAt: '2026-08-12T09:00:00.000Z',
      endAt: '2026-08-12T10:00:00.000Z',
      now,
    }
  );
  assert.equal(past.canReschedule, false);
  assert.equal(past.canReject, false);
  assert.equal(past.canEdit, false);
  assert.equal(
    isAppointmentReschedulable(
      {
        status: 'APPROVED',
        startAt: '2026-08-12T09:00:00.000Z',
        endAt: '2026-08-12T10:00:00.000Z',
      },
      now
    ),
    false
  );
});

test('trash actions use restore and delete permissions', () => {
  const trash = reviewAppointmentActions(
    {
      'action.appointments.restore': true,
      'action.appointments.delete': false,
      'action.appointments.detail': true,
    },
    'APPROVED',
    'trash'
  );
  assert.equal(trash.canRestore, true);
  assert.equal(trash.canDelete, false);
  assert.equal(trash.canDetail, true);
  assert.equal(trash.canApprove, false);
});
