import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rangesConflict, rangesWithinMargin } from '@/lib/dg/scheduling';

const slot = (start: string, end: string) => ({
  startAt: new Date(`2026-10-20T${start}:00Z`),
  endAt: new Date(`2026-10-20T${end}:00Z`),
});

describe('chevauchement réel', () => {
  it('ne signale pas deux créneaux consécutifs', () => {
    assert.equal(rangesConflict(slot('09:00', '10:00'), slot('10:00', '11:00')), false);
    assert.equal(rangesConflict(slot('10:00', '11:00'), slot('09:00', '10:00')), false);
  });

  it('signale un chevauchement effectif', () => {
    assert.equal(rangesConflict(slot('09:00', '10:30'), slot('10:00', '11:00')), true);
  });

  it('laisse la marge de 15 minutes comme avertissement', () => {
    assert.equal(rangesWithinMargin(slot('09:00', '10:00'), slot('10:00', '11:00')), true);
    assert.equal(rangesWithinMargin(slot('09:00', '10:30'), slot('10:00', '11:00')), false);
  });
});
