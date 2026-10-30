import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  prolongationExtraDays,
  resolveOperationalStateAfterReturnChange,
  validateMissionExtend,
  validateMissionReopen,
} from '../lib/workspace/mission-operational-state';

function localAt(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

describe('mission operational state', () => {
  const ongoing = {
    status: 'ONGOING' as const,
    archived: false,
    departAt: localAt(2026, 6, 10),
    returnAt: localAt(2026, 6, 12),
    initialReturnAt: localAt(2026, 6, 12),
    operationalState: 'NORMAL' as const,
    prolongationCount: 0,
  };

  it('validates extension with reason', () => {
    assert.equal(
      validateMissionExtend(ongoing, {
        returnAt: localAt(2026, 6, 15),
        reason: 'Réunion supplémentaire',
      }),
      null
    );
  });

  it('rejects extension without reason', () => {
    assert.equal(
      validateMissionExtend(ongoing, { returnAt: localAt(2026, 6, 15), reason: '  ' }),
      'EXTEND_REASON_REQUIRED'
    );
  });

  it('marks operational state as PROLONGED', () => {
    assert.equal(
      resolveOperationalStateAfterReturnChange(
        ongoing.initialReturnAt,
        localAt(2026, 6, 15),
        ongoing.returnAt
      ),
      'PROLONGED'
    );
  });

  it('marks operational state as SHORTENED', () => {
    assert.equal(
      resolveOperationalStateAfterReturnChange(
        ongoing.initialReturnAt,
        localAt(2026, 6, 11),
        ongoing.returnAt
      ),
      'SHORTENED'
    );
  });

  it('validates shortening with reason', () => {
    assert.equal(
      validateMissionExtend(ongoing, {
        returnAt: localAt(2026, 6, 11),
        reason: 'Retour anticipé',
      }),
      null
    );
  });

  it('computes extra prolongation days', () => {
    const extra = prolongationExtraDays({
      initialReturnAt: localAt(2026, 6, 12),
      returnAt: localAt(2026, 6, 15),
    });
    assert.equal(extra, 3);
  });

  it('forbids reopening a completed mission', () => {
    const completed = {
      ...ongoing,
      status: 'COMPLETED' as const,
      returnAt: localAt(2026, 6, 10),
    };
    const now = new Date(2026, 5, 12, 10, 0, 0, 0);
    assert.equal(validateMissionReopen(completed, {}, now), 'MISSION_COMPLETED_FINAL');
    assert.equal(
      validateMissionReopen(completed, { returnAt: localAt(2026, 6, 15) }, now),
      'MISSION_COMPLETED_FINAL'
    );
  });

  it('requires new return date when reopening cancelled mission after return day', () => {
    const cancelled = {
      ...ongoing,
      status: 'CANCELLED' as const,
      returnAt: localAt(2026, 6, 10),
    };
    const now = new Date(2026, 5, 12, 10, 0, 0, 0);
    assert.equal(validateMissionReopen(cancelled, {}, now), 'REOPEN_RETURN_REQUIRED');
    assert.equal(
      validateMissionReopen(cancelled, { returnAt: localAt(2026, 6, 15) }, now),
      null
    );
  });

  it('allows reopening a cancelled mission before departure', () => {
    const cancelled = {
      ...ongoing,
      status: 'CANCELLED' as const,
      departAt: localAt(2026, 6, 20),
      returnAt: localAt(2026, 6, 25),
    };
    const now = new Date(2026, 5, 12, 10, 0, 0, 0);
    assert.equal(validateMissionReopen(cancelled, { reason: 'Événement reporté' }, now), null);
  });
});
