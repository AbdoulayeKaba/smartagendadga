import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appointmentMatchesTemporalRange } from '@/lib/dg/appointment-temporal-range';

describe('appointment temporal range', () => {
  const year2026 = {
    from: new Date('2026-01-01T00:00:00'),
    to: new Date('2026-12-31T23:59:59'),
  };

  it('includes appointments whose slot overlaps the period', () => {
    const ok = appointmentMatchesTemporalRange(
      {
        startAt: new Date('2026-06-10T15:00:00'),
        endAt: new Date('2026-06-10T17:00:00'),
        createdAt: new Date('2026-06-01T10:00:00'),
      },
      year2026.from,
      year2026.to
    );
    assert.equal(ok, true);
  });

  it('includes historical imports submitted during the period', () => {
    const ok = appointmentMatchesTemporalRange(
      {
        startAt: new Date('2025-03-15T10:00:00'),
        endAt: new Date('2025-03-15T11:00:00'),
        createdAt: new Date('2026-06-28T12:00:00'),
      },
      year2026.from,
      year2026.to
    );
    assert.equal(ok, true);
  });

  it('keeps only the slot day when the user picks a period', () => {
    const onDay = appointmentMatchesTemporalRange(
      {
        startAt: new Date('2026-10-30T15:00:00.000Z'),
        endAt: new Date('2026-10-30T16:00:00.000Z'),
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      new Date('2026-10-30T00:00:00.000Z'),
      new Date('2026-10-30T23:59:59.999Z'),
      { slotOnly: true }
    );
    const otherDay = appointmentMatchesTemporalRange(
      {
        startAt: new Date('2026-11-20T08:00:00.000Z'),
        endAt: new Date('2026-11-20T09:00:00.000Z'),
        createdAt: new Date('2026-10-30T12:00:00.000Z'),
      },
      new Date('2026-10-30T00:00:00.000Z'),
      new Date('2026-10-30T23:59:59.999Z'),
      { slotOnly: true }
    );
    assert.equal(onDay, true);
    assert.equal(otherDay, false);
  });

  it('excludes old appointments outside slot and submission period', () => {
    const ok = appointmentMatchesTemporalRange(
      {
        startAt: new Date('2024-01-10T10:00:00'),
        endAt: new Date('2024-01-10T11:00:00'),
        createdAt: new Date('2024-01-05T09:00:00'),
      },
      year2026.from,
      year2026.to
    );
    assert.equal(ok, false);
  });
});
