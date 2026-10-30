import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMailExecutionDeadline, getMailDeadlineState } from '@/lib/workspace/mail-utils';
import type { MailItem } from '@/lib/workspace/types';

const now = new Date(2026, 7, 5, 16, 0, 0);

function mail(
  executionDeadline: string | null,
  workflowStatus: MailItem['workflowStatus'] = 'IN_PROGRESS'
) {
  return { executionDeadline, workflowStatus } as MailItem;
}

describe('mail deadline state', () => {
  it('reports the number of overdue calendar days', () => {
    assert.deepEqual(getMailDeadlineState(mail('2026-07-09'), 3, now), {
      status: 'OVERDUE',
      days: 27,
    });
  });

  it('distinguishes today, due soon and on-track deadlines', () => {
    assert.deepEqual(getMailDeadlineState(mail('2026-08-05'), 3, now), {
      status: 'TODAY',
      days: 0,
    });
    assert.deepEqual(getMailDeadlineState(mail('2026-08-08'), 3, now), {
      status: 'DUE_SOON',
      days: 3,
    });
    assert.deepEqual(getMailDeadlineState(mail('2026-08-09'), 3, now), {
      status: 'ON_TRACK',
      days: 4,
    });
  });

  it('closes deadline alerts for processed or archived mail', () => {
    assert.deepEqual(getMailDeadlineState(mail('2026-07-09', 'PROCESSED'), 3, now), {
      status: 'CLOSED',
      days: null,
    });
  });
});

describe('mail execution deadline', () => {
  it('grants 7 working days for a normal mail', () => {
    // Mercredi 5 août 2026 + 7 jours ouvrés => vendredi 14 août 2026.
    assert.equal(computeMailExecutionDeadline('2026-08-05', 'NORMAL'), '2026-08-14');
  });

  it('grants 3 working days for an urgent mail', () => {
    assert.equal(computeMailExecutionDeadline('2026-08-05', 'URGENT'), '2026-08-10');
  });

  it('skips the weekend when the registration falls on a friday', () => {
    // Vendredi 7 août 2026 + 3 jours ouvrés => mercredi 12 août 2026.
    assert.equal(computeMailExecutionDeadline('2026-08-07', 'URGENT'), '2026-08-12');
  });

  it('returns null for an unusable date', () => {
    assert.equal(computeMailExecutionDeadline('', 'NORMAL'), null);
  });
});
