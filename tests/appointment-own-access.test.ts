import test from 'node:test';
import assert from 'node:assert/strict';
import { ownAppointmentActions } from '@/lib/dg/appointment-own-access';

test('own appointment actions respect permissions and status (active)', () => {
  const perms = {
    'appointments.own.detail': true,
    'appointments.own.edit': true,
    'appointments.own.delete': true,
  };

  assert.deepEqual(ownAppointmentActions(perms, 'PENDING'), {
    canDetail: true,
    canEdit: true,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });

  assert.equal(
    ownAppointmentActions(perms, 'PENDING', 'active', {
      endAt: '2026-08-12T10:00:00.000Z',
      now: new Date('2026-08-12T11:16:00.000Z'),
    }).canEdit,
    false
  );

  assert.deepEqual(ownAppointmentActions(perms, 'APPROVED'), {
    canDetail: true,
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });

  assert.deepEqual(ownAppointmentActions(perms, 'REJECTED'), {
    canDetail: true,
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });

  assert.deepEqual(ownAppointmentActions({}, 'PENDING'), {
    canDetail: false,
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });
});

test('own appointment actions in trash variant', () => {
  const perms = {
    'appointments.own.detail': true,
    'appointments.own.delete': true,
  };

  assert.deepEqual(ownAppointmentActions(perms, 'REJECTED', 'trash'), {
    canDetail: true,
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });
});
