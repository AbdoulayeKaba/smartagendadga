import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isReservableMeetingRoomName } from '../lib/dg/meeting-room-config';

describe('reservable meeting rooms', () => {
  it('accepts only the 11th and 12th floor meeting rooms', () => {
    assert.equal(isReservableMeetingRoomName('Salle de réunion 12ème étage'), true);
    assert.equal(isReservableMeetingRoomName('Salle de réunion 11ème étage'), true);
    assert.equal(isReservableMeetingRoomName('salle de reunion 11eme etage'), true);
    assert.equal(isReservableMeetingRoomName('Bureau du DGA'), false);
    assert.equal(isReservableMeetingRoomName('Salle du Conseil'), false);
    assert.equal(isReservableMeetingRoomName('En ligne (Teams)'), false);
    assert.equal(isReservableMeetingRoomName('Salle de réunion 10ème étage'), false);
  });
});
