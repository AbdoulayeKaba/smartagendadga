import assert from 'node:assert/strict';
import test from 'node:test';
import { externalNavActiveId, isExternalWorkspace } from '../lib/layout/external-space';

test('external workspace is limited to the EXTERNAL role', () => {
  assert.equal(isExternalWorkspace('EXTERNAL', 'EXTERNAL'), true);
  assert.equal(isExternalWorkspace('ASSISTANT', 'ASSISTANT'), false);
  assert.equal(isExternalWorkspace('DG', 'DG'), false);
  assert.equal(isExternalWorkspace('MANAGER', 'MANAGER'), false);
});

test('external nav highlights one destination', () => {
  assert.equal(externalNavActiveId('/dg/plan'), null);
  assert.equal(externalNavActiveId('/appointments/mine'), null);
  assert.equal(externalNavActiveId('/appointments/board'), 'board');
  assert.equal(externalNavActiveId('/dg/availability'), null);
  assert.equal(externalNavActiveId('/dg/availability/reservations/mine'), null);
  assert.equal(externalNavActiveId('/appointments/agenda'), null);
  assert.equal(externalNavActiveId('/dg/activity'), 'history');
  assert.equal(externalNavActiveId('/dg/notifications'), 'notifications');
  assert.equal(externalNavActiveId('/dg/appointments'), null);
});
