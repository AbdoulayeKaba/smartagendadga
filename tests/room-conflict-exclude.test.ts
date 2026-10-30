import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isExcludedRoomBooking } from '@/lib/dg/room-conflict-exclude';

describe('room conflict exclude', () => {
  it('exclut la réservation liée', () => {
    assert.equal(
      isExcludedRoomBooking({ id: 'res-1' }, { excludeReservationId: 'res-1' }),
      true
    );
    assert.equal(
      isExcludedRoomBooking({ id: 'res-2' }, { excludeReservationId: 'res-1' }),
      false
    );
  });

  it('exclut le RDV courant (id brut ou préfixe appt-)', () => {
    assert.equal(
      isExcludedRoomBooking({ id: '42' }, { excludeAppointmentId: '42' }),
      true
    );
    assert.equal(
      isExcludedRoomBooking({ id: 'appt-42' }, { excludeAppointmentId: '42' }),
      true
    );
    assert.equal(
      isExcludedRoomBooking({ id: 'other' }, { excludeAppointmentId: '42' }),
      false
    );
  });
});
