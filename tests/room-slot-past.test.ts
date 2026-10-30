import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSlotStartInThePast } from '@/lib/dg/scheduling';

describe('past room slots', () => {
  it('blocks a slot whose start is already over', () => {
    assert.equal(
      isSlotStartInThePast('2026-09-28', '10:00', new Date('2026-09-28T11:00:00Z')),
      true
    );
  });

  it('keeps a slot that has not started', () => {
    assert.equal(
      isSlotStartInThePast('2026-09-28', '15:00', new Date('2026-09-28T10:00:00Z')),
      false
    );
  });
});
