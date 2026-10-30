import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDgaFocus, shiftIsoDate } from '@/lib/dg/dga-focus';

const now = new Date('2026-10-27T15:00:00.000Z');

function row(partial: {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  isOnlineMeeting?: boolean;
}) {
  return {
    id: partial.id,
    title: partial.title,
    description: null,
    startAt: new Date(partial.startAt),
    endAt: new Date(partial.endAt),
    status: partial.status,
    isOnlineMeeting: partial.isOnlineMeeting ?? false,
    location: null,
    teamsMeetingUrl: null,
    requestedBy: { firstName: 'Awa', lastName: 'Diallo' },
  };
}

test('shiftIsoDate advances a civil day', () => {
  assert.equal(shiftIsoDate('2026-10-27', 1), '2026-10-28');
  assert.equal(shiftIsoDate('2026-10-31', 1), '2026-11-01');
});

test('keeps only today and tomorrow pending decisions', () => {
  const focus = buildDgaFocus(
    [
      row({
        id: 'today',
        title: 'Point tutelle',
        startAt: '2026-10-27T09:00:00.000Z',
        endAt: '2026-10-27T09:30:00.000Z',
        status: 'PENDING',
      }),
      row({
        id: 'tomorrow',
        title: 'Comité',
        startAt: '2026-10-28T10:00:00.000Z',
        endAt: '2026-10-28T11:00:00.000Z',
        status: 'PENDING',
        isOnlineMeeting: true,
      }),
      row({
        id: 'later',
        title: 'Plus tard',
        startAt: '2026-11-02T10:00:00.000Z',
        endAt: '2026-11-02T11:00:00.000Z',
        status: 'PENDING',
      }),
      row({
        id: 'first',
        title: 'Ouverture',
        startAt: '2026-10-28T08:00:00.000Z',
        endAt: '2026-10-28T08:30:00.000Z',
        status: 'APPROVED',
      }),
    ],
    now
  );

  assert.deepEqual(
    focus.decisions.map((card) => card.id),
    ['today', 'tomorrow']
  );
  assert.equal(focus.decisions[1]?.mode, 'En ligne');
  assert.equal(focus.tomorrow.first?.title, 'Ouverture');
  assert.equal(focus.tomorrow.decisions.length, 1);
  assert.equal(focus.tomorrow.conflicts.length, 0);
});
