import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectDailyAgendaConflicts, detectConflictsFromDisplayTimes } from '@/lib/ai/agenda-conflicts';

describe('detectDailyAgendaConflicts', () => {
  it('détecte deux RDV au même horaire de début', () => {
    const start = new Date('2026-07-06T15:00:00');
    const conflicts = detectDailyAgendaConflicts([
      {
        id: 'a',
        title: 'redez-vous',
        startAt: start,
        endAt: new Date('2026-07-06T16:30:00'),
        requester: 'Marie Diallo',
      },
      {
        id: 'b',
        title: 'Revue hebdomadaire cabinet',
        startAt: new Date(start),
        endAt: new Date('2026-07-06T16:00:00'),
        requester: 'Marie Diallo',
      },
    ]);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.sameStart, true);
    assert.match(conflicts[0]?.message ?? '', /Deux RDV commencent/);
  });

  it('accepte les dates ISO en chaîne', () => {
    const conflicts = detectDailyAgendaConflicts([
      {
        id: 'a',
        title: 'RDV A',
        startAt: '2026-07-06T15:00:00.000Z' as unknown as Date,
        endAt: '2026-07-06T16:00:00.000Z' as unknown as Date,
        requester: 'A',
      },
      {
        id: 'b',
        title: 'RDV B',
        startAt: '2026-07-06T15:00:00.000Z' as unknown as Date,
        endAt: '2026-07-06T16:30:00.000Z' as unknown as Date,
        requester: 'B',
      },
    ]);

    assert.ok(conflicts.length >= 1);
  });

  it('détecte un chevauchement via les horaires affichés', () => {
    const conflicts = detectConflictsFromDisplayTimes([
      {
        id: 'a',
        title: 'redez-vous',
        time: '15:00 – 16:30',
        requester: 'Marie Diallo',
      },
      {
        id: 'b',
        title: 'Revue hebdomadaire cabinet',
        time: '15:00 – 16:00',
        requester: 'Marie Diallo',
      },
    ]);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.sameStart, true);
  });
});
