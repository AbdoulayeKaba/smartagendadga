import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canDragCalendarAppointment,
  isCalendarAppointmentPast,
} from '@/lib/dg/calendar-appointment-drag';
import { isAppointmentReschedulable } from '@/lib/dg/appointment-reschedule-access';

const now = new Date('2026-08-12T11:16:00.000Z');

describe('calendar-appointment-drag', () => {
  it('considère passé un RDV approuvé terminé', () => {
    const appt = {
      status: 'APPROVED',
      startAt: '2026-08-12T09:00:00.000Z',
      endAt: '2026-08-12T10:00:00.000Z',
    };
    assert.equal(isCalendarAppointmentPast(appt, now), true);
    assert.equal(canDragCalendarAppointment(appt, true, now), false);
    assert.equal(isAppointmentReschedulable(appt, now), false);
  });

  it('considère non déplaçable un RDV approuvé en cours', () => {
    const appt = {
      status: 'APPROVED',
      startAt: '2026-08-12T10:00:00.000Z',
      endAt: '2026-08-12T12:00:00.000Z',
    };
    assert.equal(isCalendarAppointmentPast(appt, now), false);
    assert.equal(canDragCalendarAppointment(appt, true, now), false);
    assert.equal(isAppointmentReschedulable(appt, now), false);
  });

  it('autorise le glisser-déposer pour un RDV approuvé à venir', () => {
    const appt = {
      status: 'APPROVED',
      startAt: '2026-08-12T14:00:00.000Z',
      endAt: '2026-08-12T15:00:00.000Z',
    };
    assert.equal(isCalendarAppointmentPast(appt, now), false);
    assert.equal(canDragCalendarAppointment(appt, true, now), true);
    assert.equal(isAppointmentReschedulable(appt, now), true);
  });

  it('refuse le glisser-déposer si drag désactivé ou statut non approuvé', () => {
    const upcoming = {
      status: 'APPROVED',
      startAt: '2026-08-12T14:00:00.000Z',
      endAt: '2026-08-12T15:00:00.000Z',
    };
    assert.equal(canDragCalendarAppointment(upcoming, false, now), false);
    assert.equal(
      canDragCalendarAppointment({ ...upcoming, status: 'PENDING' }, true, now),
      false
    );
  });
});
