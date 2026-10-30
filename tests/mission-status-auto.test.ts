import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canManuallyCancelMission,
  canManuallyStartMission,
  computeAutoStatus,
  computeAutoStatusAfterDatePatch,
  isMissionAutoStartDue,
  isMissionDepartTodayVisualState,
  isReturnDateReached,
  validateCancelTransition,
  validateStartTransition,
} from '../lib/workspace/mission-status-workflow';
import { resolveMissionVisualState } from '../lib/workspace/mission-visual-state';

function localAt(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe('mission auto status after date patch', () => {
  it('passes to ONGOING when depart moves into a past period', () => {
    const departDay = localAt(2026, 6, 9, 0, 0);
    const now = localAt(2026, 6, 10, 14, 0);
    const planned = {
      status: 'PLANNED' as const,
      departAt: localAt(2026, 6, 15, 0, 0).toISOString(),
      returnAt: localAt(2026, 6, 20, 0, 0).toISOString(),
    };
    const next = computeAutoStatusAfterDatePatch(
      planned,
      { departAt: departDay.toISOString() },
      now
    );
    assert.equal(next, 'ONGOING');
  });

  it('stays null when depart is still in the future', () => {
    const now = localAt(2026, 6, 10, 12, 0);
    const planned = {
      status: 'PLANNED' as const,
      departAt: localAt(2026, 6, 15, 0, 0).toISOString(),
      returnAt: localAt(2026, 6, 20, 0, 0).toISOString(),
    };
    const next = computeAutoStatusAfterDatePatch(
      planned,
      { departAt: localAt(2026, 6, 12, 0, 0).toISOString() },
      now
    );
    assert.equal(next, null);
  });

  it('stays PLANNED on depart day before 07h00 (auto)', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const now = localAt(2026, 6, 13, 6, 30);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isMissionAutoStartDue(now, departDay, returnDay), false);
    assert.equal(computeAutoStatus(mission, now), null);
    assert.equal(isMissionDepartTodayVisualState(departDay, now), false);
    // Jour du départ : démarrage manuel déjà possible (période départ–retour).
    assert.equal(canManuallyStartMission(now, departDay, returnDay), true);
    assert.equal(validateStartTransition(mission, now), null);
  });

  it('allows cancel on depart today before auto-start at 22h59', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const now = localAt(2026, 6, 13, 10, 0);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(canManuallyCancelMission(mission, now), true);
    assert.equal(validateCancelTransition(mission, now), null);
  });

  it('blocks cancel after auto-start at 22h59 on depart day', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const now = localAt(2026, 6, 13, 22, 59);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(canManuallyCancelMission(mission, now), false);
    assert.equal(validateCancelTransition(mission, now), 'MISSION_ALREADY_STARTED');
  });

  it('allows manual start from 07h00 on depart day; auto start still at 22h59', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const morning = localAt(2026, 6, 13, 9, 30);
    const afternoon = localAt(2026, 6, 13, 18, 30);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isMissionDepartTodayVisualState(departDay, morning), true);
    assert.equal(isMissionDepartTodayVisualState(departDay, afternoon), true);
    assert.equal(resolveMissionVisualState(mission, morning), 'DEPART_TODAY');
    assert.equal(isMissionAutoStartDue(morning, departDay, returnDay), false);
    assert.equal(computeAutoStatus(mission, morning), null);
    assert.equal(canManuallyStartMission(morning, departDay, returnDay), true);
    assert.equal(validateStartTransition(mission, morning), null);
  });

  it('stays depart today after 18h30 until 22h59 on depart day', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const evening = localAt(2026, 6, 13, 21, 0);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isMissionDepartTodayVisualState(departDay, evening), true);
    assert.equal(isMissionAutoStartDue(evening, departDay, returnDay), false);
    assert.equal(computeAutoStatus(mission, evening), null);
  });

  it('passes to ONGOING at 22h59 on depart day (auto)', () => {
    const departDay = localAt(2026, 6, 13, 0, 0);
    const returnDay = localAt(2026, 6, 16, 0, 0);
    const now = localAt(2026, 6, 13, 22, 59);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isMissionAutoStartDue(now, departDay, returnDay), true);
    assert.equal(computeAutoStatus(mission, now), 'ONGOING');
    assert.equal(isMissionDepartTodayVisualState(departDay, now), false);
    assert.equal(resolveMissionVisualState(mission, now), 'ONGOING');
  });

  it('keeps manual ONGOING before 22h59 on depart day (no auto revert)', () => {
    const departDay = localAt(2026, 7, 1, 0, 0);
    const returnDay = localAt(2026, 7, 4, 0, 0);
    const now = localAt(2026, 7, 1, 11, 0);
    const mission = {
      status: 'ONGOING' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(resolveMissionVisualState(mission, now), 'ONGOING');
    assert.equal(computeAutoStatus(mission, now), null);
  });

  it('blocks manual start before the departure day', () => {
    const departDay = localAt(2026, 6, 15, 0, 0);
    const returnDay = localAt(2026, 6, 20, 0, 0);
    const now = localAt(2026, 6, 10, 12, 0);
    const mission = {
      status: 'PLANNED' as const,
      departAt: departDay.toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(canManuallyStartMission(now, departDay, returnDay), false);
    assert.equal(validateStartTransition(mission, now), 'OUTSIDE_MISSION_PERIOD');
  });

  it('stays ONGOING on return day before 23h59', () => {
    const returnDay = localAt(2026, 6, 13, 0, 0);
    const now = localAt(2026, 6, 13, 18, 30);
    const mission = {
      status: 'ONGOING' as const,
      departAt: localAt(2026, 6, 10, 0, 0).toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isReturnDateReached(now, returnDay), false);
    assert.equal(computeAutoStatus(mission, now), null);
  });

  it('passes to COMPLETED at 23h59 on return day', () => {
    const returnDay = localAt(2026, 6, 13, 0, 0);
    const now = localAt(2026, 6, 13, 23, 59);
    const mission = {
      status: 'ONGOING' as const,
      departAt: localAt(2026, 6, 10, 0, 0).toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(isReturnDateReached(now, returnDay), true);
    assert.equal(computeAutoStatus(mission, now), 'COMPLETED');
  });

  it('passes to COMPLETED the day after return', () => {
    const returnDay = localAt(2026, 6, 13, 0, 0);
    const now = localAt(2026, 6, 14, 8, 0);
    const mission = {
      status: 'ONGOING' as const,
      departAt: localAt(2026, 6, 10, 0, 0).toISOString(),
      returnAt: returnDay.toISOString(),
    };
    assert.equal(computeAutoStatus(mission, now), 'COMPLETED');
  });
});
