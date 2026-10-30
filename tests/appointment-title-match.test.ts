import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTitleDuplicateMessage,
  classifyAppointmentTitleMatches,
  findBlockingAppointmentTitleMatch,
  findExactAppointmentTitleMatch,
  findTitleDuplicateRow,
  getTitleDuplicateMessage,
  isBlockingTitleDuplicate,
  normalizeAppointmentTitle,
  titlesMatchExactly,
} from '../lib/dg/appointment-title-match';

describe('appointment-title-match', () => {
  it('normalise la casse, les accents et la ponctuation', () => {
    assert.equal(normalizeAppointmentTitle('  Rendez-vous  1  '), 'rendez vous 1');
    assert.equal(
      titlesMatchExactly('Rendez-vous partenaire', 'rendez vous partenaire'),
      true
    );
    assert.equal(
      titlesMatchExactly('Réunion stratégique', 'reunion strategique'),
      true
    );
  });

  it('classe exact avant partiel et ignore excludeId', () => {
    const matches = classifyAppointmentTitleMatches(
      'rendez-vous',
      [
        { id: '1', title: 'Autre', startAt: '2026-07-15', status: 'PENDING' },
        { id: '2', title: 'Rendez-vous', startAt: '2026-07-16', status: 'APPROVED' },
        { id: '3', title: 'Rendez-vous stratégique', startAt: '2026-07-17', status: 'PENDING' },
        { id: '4', title: 'Rendez-vous', startAt: '2026-07-18', status: 'REJECTED' },
        { id: '5', title: 'Rendez-vous', startAt: '2026-07-19', status: 'PENDING' },
      ],
      { excludeId: '5', limit: 10 }
    );

    assert.equal(matches[0]?.exact, true);
    assert.equal(matches[0]?.id, '2');
    assert.ok(matches.some((m) => m.id === '3' && !m.exact));
    assert.ok(matches.some((m) => m.id === '4'));
    assert.ok(!matches.some((m) => m.id === '5'));
  });

  it('ne bloque pas un titre identique sur une autre journée', () => {
    const matches = classifyAppointmentTitleMatches(
      'rendez-vous partenaire - rencontre',
      [
        {
          id: '1',
          title: 'rendez-vous partenaire - rencontre',
          startAt: '2026-07-30T09:00:00',
          status: 'REJECTED',
        },
      ],
      { formDate: '2026-08-15' }
    );

    assert.equal(findBlockingAppointmentTitleMatch(matches), undefined);
    assert.equal(isBlockingTitleDuplicate(matches[0]!), false);
  });

  it('bloque le même titre le même jour', () => {
    const matches = classifyAppointmentTitleMatches(
      'rendez-vous partenaire - rencontre',
      [
        {
          id: '1',
          title: 'rendez-vous partenaire - rencontre',
          startAt: '2026-07-30T09:00:00',
          status: 'REJECTED',
        },
      ],
      { formDate: '2026-07-30' }
    );

    const blocking = findBlockingAppointmentTitleMatch(matches);
    assert.equal(blocking?.id, '1');
    assert.match(buildTitleDuplicateMessage(blocking!, '2026-07-30'), /Doublon/i);
    assert.equal(
      getTitleDuplicateMessage('rejected'),
      buildTitleDuplicateMessage(blocking!, '2026-07-30')
    );
  });

  it('findTitleDuplicateRow ne retient le même titre que pour la journée demandée', () => {
    const rows = [
      {
        id: '1',
        title: 'rendez-vous partenaire - rencontre',
        startAt: new Date('2026-07-30T09:00:00'),
        endAt: new Date('2026-07-30T10:00:00'),
        status: 'REJECTED',
      },
    ];

    const sameDay = findTitleDuplicateRow(
      {
        title: 'Rendez-vous partenaire - rencontre',
        date: '2026-07-30',
      },
      rows
    );
    assert.equal(sameDay?.id, '1');

    const otherDay = findTitleDuplicateRow(
      {
        title: 'Rendez-vous partenaire - rencontre',
        date: '2026-08-15',
      },
      rows
    );
    assert.equal(otherDay, null);
  });

  it('marque bloquant seulement le titre exact de la même journée', () => {
    const matches = classifyAppointmentTitleMatches(
      'Point stratégique',
      [
        { id: '1', title: 'Point stratégique', startAt: '2026-07-30T10:00:00', status: 'PENDING' },
        { id: '2', title: 'Point stratégique', startAt: '2026-08-01T10:00:00', status: 'APPROVED' },
      ],
      { formDate: '2026-07-30' }
    );

    const blocking = findBlockingAppointmentTitleMatch(matches);
    assert.equal(blocking?.id, '1');
    assert.equal(isBlockingTitleDuplicate(matches[0]!), true);
    assert.match(
      buildTitleDuplicateMessage(matches[0]!, '2026-07-30'),
      /déjà à une demande en attente/i
    );
  });

  it('findExactAppointmentTitleMatch', () => {
    const matches = classifyAppointmentTitleMatches('Alpha', [
      { id: '1', title: 'Alpha', startAt: '2026-01-01', status: 'PENDING' },
      { id: '2', title: 'Alpha beta', startAt: '2026-01-02', status: 'PENDING' },
    ]);
    assert.equal(findExactAppointmentTitleMatch(matches)?.id, '1');
  });
});
