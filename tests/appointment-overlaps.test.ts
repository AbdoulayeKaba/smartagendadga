import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexAppointmentOverlaps, overlapPeerLabel } from '@/lib/dg/appointment-overlaps';

describe('appointment overlaps', () => {
  it('groups pending and approved appointments that share a slot', () => {
    const index = indexAppointmentOverlaps([
      {
        id: 'a',
        title: 'rdv rendez-vous',
        startAt: '2026-09-29T08:00:00.000Z',
        endAt: '2026-09-29T09:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'b',
        title: 'rdv rdv',
        startAt: '2026-09-29T08:00:00.000Z',
        endAt: '2026-09-29T09:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'c',
        title: 'rendez',
        startAt: '2026-09-29T08:00:00.000Z',
        endAt: '2026-09-29T09:00:00.000Z',
        status: 'APPROVED',
      },
      {
        id: 'd',
        title: 'autre jour',
        startAt: '2026-09-30T08:00:00.000Z',
        endAt: '2026-09-30T09:00:00.000Z',
        status: 'APPROVED',
      },
      {
        id: 'e',
        title: 'refusé',
        startAt: '2026-09-29T08:00:00.000Z',
        endAt: '2026-09-29T09:00:00.000Z',
        status: 'REJECTED',
      },
    ]);

    assert.equal(index.ids.size, 3);
    assert.equal(index.pairCount, 3);
    assert.equal(index.ids.has('d'), false);
    assert.equal(index.ids.has('e'), false);
    assert.deepEqual(index.peersById.get('a'), ['rdv rdv', 'rendez']);
    assert.equal(overlapPeerLabel(['rendez']), 'Chevauche « rendez »');
    assert.equal(overlapPeerLabel(['rdv rdv', 'rendez']), 'Chevauche 2 rendez-vous');
  });

  it('ignores back-to-back slots', () => {
    const index = indexAppointmentOverlaps([
      {
        id: 'a',
        title: 'matin',
        startAt: '2026-09-29T08:00:00.000Z',
        endAt: '2026-09-29T09:00:00.000Z',
        status: 'APPROVED',
      },
      {
        id: 'b',
        title: 'suite',
        startAt: '2026-09-29T09:00:00.000Z',
        endAt: '2026-09-29T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);
    assert.equal(index.ids.size, 0);
    assert.equal(index.pairCount, 0);
  });
});
