import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReopenMission,
  resolveReopenTargetStatus,
  validateReopenTransition,
} from '../lib/workspace/mission-status-workflow';

function localAt(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

describe('mission reopen workflow', () => {
  const base = {
    archived: false,
    departAt: localAt(2026, 6, 20),
    returnAt: localAt(2026, 6, 25),
  };

  it('allows admins to reopen cancelled missions only', () => {
    assert.equal(
      canReopenMission({ ...base, status: 'CANCELLED' }, 'ASSISTANT'),
      true
    );
    assert.equal(
      canReopenMission({ ...base, status: 'COMPLETED' }, 'ASSISTANT'),
      false
    );
    assert.equal(
      canReopenMission({ ...base, status: 'CANCELLED' }, 'DG'),
      false
    );
  });

  it('forbids reopening a completed mission', () => {
    const now = new Date(2026, 5, 10, 10, 0, 0, 0);
    const mission = { ...base, status: 'COMPLETED' as const };
    assert.equal(validateReopenTransition(mission, now), 'MISSION_COMPLETED_FINAL');
  });

  it('resolves cancelled mission to PLANNED before departure', () => {
    const now = new Date(2026, 5, 10, 10, 0, 0, 0);
    const mission = { ...base, status: 'CANCELLED' as const };
    assert.equal(resolveReopenTargetStatus(mission, now), 'PLANNED');
    assert.equal(validateReopenTransition(mission, now), null);
  });

  it('resolves cancelled mission to ONGOING during mission period', () => {
    const now = new Date(2026, 5, 22, 10, 0, 0, 0);
    const mission = {
      ...base,
      status: 'CANCELLED' as const,
      departAt: localAt(2026, 6, 15),
      returnAt: localAt(2026, 6, 25),
    };
    assert.equal(resolveReopenTargetStatus(mission, now), 'ONGOING');
    assert.equal(validateReopenTransition(mission, now), null);
  });
});
