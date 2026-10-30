import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentMatchesRoom,
  normalizeRoomLabel,
} from '../lib/services/room-availability';

describe('room availability matching', () => {
  it('normalizes room labels for comparison', () => {
    assert.equal(
      normalizeRoomLabel('  Salle   du Conseil  '),
      normalizeRoomLabel('salle du conseil')
    );
  });

  it('matches exact room names', () => {
    assert.equal(appointmentMatchesRoom('Salle du Conseil', 'Salle du Conseil'), true);
    assert.equal(appointmentMatchesRoom('Bureau du DGA', 'Salle du Conseil'), false);
  });

  it('matches partial room names', () => {
    assert.equal(appointmentMatchesRoom('Salle du Conseil — étage 2', 'Salle du Conseil'), true);
    assert.equal(appointmentMatchesRoom('Réunion Salle du Conseil', 'Salle du Conseil'), true);
  });

  it('ignores empty locations', () => {
    assert.equal(appointmentMatchesRoom('', 'Salle du Conseil'), false);
    assert.equal(appointmentMatchesRoom(null, 'Salle du Conseil'), false);
    assert.equal(appointmentMatchesRoom(undefined, 'Salle du Conseil'), false);
  });
});
