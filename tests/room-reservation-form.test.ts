import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoomReservationBody, emptyRoomReservationForm } from '../lib/dg/room-reservation-form';

describe('room reservation form', () => {
  it('builds API body with room-specific fields', () => {
    const form = emptyRoomReservationForm({
      date: '2026-06-15',
      startTime: '09:00',
      endTime: '09:30',
    });
    form.title = 'Comité de pilotage';
    form.organizerService = 'Direction générale';
    form.participantCount = '12';
    form.equipment = ['videoprojecteur', 'ecran'];

    const body = buildRoomReservationBody(form, { id: 'lieu-1', name: 'Salle du Conseil' });

    assert.equal(body.title, 'Comité de pilotage');
    assert.equal(body.usageType, 'REUNION');
    assert.equal(body.organizerService, 'Direction générale');
    assert.equal(body.participantCount, 12);
    assert.deepEqual(body.equipment, ['videoprojecteur', 'ecran']);
    assert.equal(body.roomName, 'Salle du Conseil');
    assert.equal(body.date, '2026-06-15');
    assert.equal(body.bookingOrigin, 'SLOT');
    assert.notEqual(body.title, undefined);
    assert.equal('urgencyLevel' in body, false);
    assert.equal('participants' in body, false);
  });

  it('renseigne un service par défaut si le département est omis', () => {
    const form = emptyRoomReservationForm({
      date: '2026-06-15',
      startTime: '09:00',
      endTime: '09:30',
    });
    form.title = 'Point court';
    const body = buildRoomReservationBody(form, { id: 'lieu-1', name: 'Salle A' });
    assert.equal(body.organizerService, 'Non précisé');
    assert.equal(body.participantCount, undefined);
  });
});
