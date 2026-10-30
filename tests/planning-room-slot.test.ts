import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluatePlanningRoomSlot } from '../lib/dg/planning-room-slot';
import type { AvailabilitySlot } from '../lib/services/dg-availability';

const slots: AvailabilitySlot[] = [
  { startTime: '09:00', endTime: '10:00', status: 'AVAILABLE' },
  { startTime: '10:00', endTime: '11:00', status: 'BUSY', reason: 'Réservée — Comité' },
  { startTime: '11:00', endTime: '12:00', status: 'BUFFER' },
  { startTime: '14:00', endTime: '15:00', status: 'BLOCKED', reason: 'Jour férié' },
];

describe('planning room slot evaluation', () => {
  it('accepte un créneau libre', () => {
    const result = evaluatePlanningRoomSlot(slots, '09:00', '10:00');
    assert.equal(result.ok, true);
    assert.equal(result.status, 'available');
    assert.match(result.message, /09:00–10:00/);
  });

  it('détecte une salle occupée', () => {
    const result = evaluatePlanningRoomSlot(slots, '10:00', '11:00');
    assert.equal(result.ok, false);
    assert.equal(result.status, 'busy');
    assert.match(result.message, /Comité/i);
  });

  it('signale la marge sans la traiter comme un conflit', () => {
    const result = evaluatePlanningRoomSlot(slots, '11:00', '12:00');
    assert.equal(result.ok, true);
    assert.equal(result.status, 'margin');
  });

  it('détecte un créneau hors plage', () => {
    const result = evaluatePlanningRoomSlot(slots, '16:00', '17:00');
    assert.equal(result.ok, false);
    assert.equal(result.status, 'outside');
  });
});
