import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateInYear, rangeOverlapsYear, yearRange } from '@/lib/temporal/year-range';
import {
  filterMailByYear,
  filterMissionsByYear,
} from '@/lib/temporal/workspace-year-filters';
import type { DgMission, MailItem } from '@/lib/workspace/types';

describe('temporal year filter', () => {
  it('builds full calendar year bounds', () => {
    const range = yearRange(2026);
    assert.equal(range.year, 2026);
    assert.equal(range.from.getFullYear(), 2026);
    assert.equal(range.from.getMonth(), 0);
    assert.equal(range.to.getFullYear(), 2026);
    assert.equal(range.to.getMonth(), 11);
  });

  it('detects date in year', () => {
    assert.equal(dateInYear('2026-06-15T10:00:00.000Z', 2026), true);
    assert.equal(dateInYear('2025-12-31T23:00:00.000Z', 2026), false);
  });

  it('filters mail by mailDate year', () => {
    const items = [
      { mailDate: '2026-03-01' },
      { mailDate: '2025-11-20' },
    ] as MailItem[];
    const filtered = filterMailByYear(items, 2026);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.mailDate, '2026-03-01');
  });

  it('filters missions overlapping selected year', () => {
    const items = [
      {
        departAt: '2025-11-01',
        returnAt: '2026-02-01',
      },
      {
        departAt: '2024-01-01',
        returnAt: '2024-03-01',
      },
    ] as DgMission[];
    const filtered = filterMissionsByYear(items, 2026);
    assert.equal(filtered.length, 1);
    assert.equal(rangeOverlapsYear('2025-11-01', '2026-02-01', 2026), true);
  });
});
