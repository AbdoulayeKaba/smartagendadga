import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appointmentToPlanningInitial,
  buildAppointmentRequestBody,
  buildPlanningRoomReservationBody,
  emptyPlanningForm,
  validatePlanningRoomBooking,
} from '@/lib/dg/appointment-planning';
import { embedDescriptionWithMeta } from '@/lib/dg/appointment-request-meta';

describe('appointment planning room booking', () => {
  it('accepte une planification sans réservation de salle', () => {
    const form = emptyPlanningForm({ title: 'Point DGA' });
    assert.equal(form.reserveRoom, false);
    assert.equal(validatePlanningRoomBooking(form), null);
  });

  it('exige une salle quand la réservation est activée', () => {
    const form = emptyPlanningForm({ title: 'Comité' });
    form.reserveRoom = true;
    assert.match(validatePlanningRoomBooking(form) ?? '', /salle/i);

    form.roomId = 'room-1';
    form.roomName = 'Salle de réunion 12ème étage';
    assert.equal(validatePlanningRoomBooking(form), null);
  });

  it('refuse la réservation pour un RDV toute la journée', () => {
    const form = emptyPlanningForm({ title: 'Journée' });
    form.reserveRoom = true;
    form.allDay = true;
    form.roomId = 'room-1';
    form.roomName = 'Salle A';
    assert.match(validatePlanningRoomBooking(form) ?? '', /toute la journée/i);
  });

  it('utilise la salle comme emplacement du RDV et le même créneau horaire', () => {
    const form = emptyPlanningForm({ title: 'Comité stratégique' });
    form.reserveRoom = true;
    form.roomId = 'room-1';
    form.roomName = 'Salle de réunion 12ème étage';
    form.roomUsageType = 'COMITE';
    form.roomEquipment = ['videoprojecteur', 'ecran'];
    form.date = '2026-07-30';
    form.startTime = '09:00';
    form.endTime = '10:00';

    const appointmentBody = buildAppointmentRequestBody(form, {
      urgentOverride: false,
      participants: [],
    });
    assert.equal(appointmentBody.roomReserved, undefined);
    assert.equal(appointmentBody.roomName, undefined);
    assert.equal(appointmentBody.startTime, '09:00');
    assert.equal(appointmentBody.endTime, '10:00');

    const roomBody = buildPlanningRoomReservationBody(form);
    assert.equal(roomBody.roomId, 'room-1');
    assert.equal(roomBody.title, 'Comité stratégique');
    assert.equal(roomBody.usageType, 'COMITE');
    assert.equal(roomBody.organizerService, 'Rendez-vous');
    assert.equal(roomBody.bookingOrigin, 'APPOINTMENT');
    assert.deepEqual(roomBody.equipment, ['videoprojecteur', 'ecran']);
    assert.equal(roomBody.date, appointmentBody.date);
    assert.equal(roomBody.startTime, appointmentBody.startTime);
    assert.equal(roomBody.endTime, appointmentBody.endTime);
  });

  it('réhydrate la réservation de salle en édition', () => {
    const description = embedDescriptionWithMeta('Note interne', {
      urgencyLevel: 'NORMAL',
      preContact: [],
      roomReserved: true,
      roomId: 'room-1',
      roomName: 'Salle de réunion 12ème étage',
      roomUsageType: 'COMITE',
      roomEquipment: ['micro', 'ecran'],
      roomReservationId: 'res-42',
    });
    const initial = appointmentToPlanningInitial({
      id: 'appt-1',
      title: 'Comité stratégique',
      description,
      startAt: new Date('2026-07-30T16:00:00'),
      endAt: new Date('2026-07-30T17:00:00'),
      priority: 'MEDIUM',
      type: 'INTERNAL',
      allDay: false,
      timezone: 'Africa/Conakry',
      location: 'Salle de réunion 12ème étage',
      reminderMinutesBefore: null,
      strategicContactId: null,
      urgentOverride: false,
      isOnlineMeeting: false,
      participants: [],
    });
    const form = emptyPlanningForm(initial);
    assert.equal(form.reserveRoom, true);
    assert.equal(form.roomId, 'room-1');
    assert.equal(form.roomName, 'Salle de réunion 12ème étage');
    assert.equal(form.roomUsageType, 'COMITE');
    assert.deepEqual(form.roomEquipment, ['micro', 'ecran']);
    assert.equal(form.roomReservationId, 'res-42');
    assert.equal(form.description, 'Note interne');
  });

  it('fixe le lieu Teams et ignore la salle pour un RDV en ligne', () => {
    const form = emptyPlanningForm({ title: 'Point Teams' });
    form.isOnlineMeeting = true;
    form.reserveRoom = true;
    form.roomId = 'room-1';
    form.roomName = 'Salle A';
    const body = buildAppointmentRequestBody(form, { urgentOverride: false, participants: [] });
    assert.equal(body.isOnlineMeeting, true);
    assert.equal(body.location, 'En ligne (Teams)');
    assert.equal(body.roomReserved, undefined);
    assert.equal(validatePlanningRoomBooking(form), null);
  });
});
