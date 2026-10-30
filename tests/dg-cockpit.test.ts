import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDgCockpit, formatFreeDuration, type CockpitSource } from '@/lib/dg/dg-cockpit';

const now = new Date('2026-09-28T10:51:00Z');

function source(patch: Partial<CockpitSource> = {}): CockpitSource {
  return {
    viewer: { firstName: 'Awa', lastName: 'Diallo', role: 'DG' },
    now,
    appointments: [],
    reservations: [],
    pendingAppointments: 0,
    pendingReservations: [],
    missions: [],
    mail: [],
    contacts: [],
    slots: [],
    roomName: 'Salle de réunion 12ème étage',
    ...patch,
  };
}

describe('cockpit DGA', () => {
  it('formats free time', () => {
    assert.equal(formatFreeDuration(150), '2h30');
    assert.equal(formatFreeDuration(60), '1h');
    assert.equal(formatFreeDuration(0), '0 min');
  });

  it('counts a linked room meeting once, as a réunion', () => {
    const view = buildDgCockpit(
      source({
        appointments: [
          {
            id: 'a1',
            title: 'Point budget',
            startAt: new Date('2026-09-28T09:00:00Z'),
            endAt: new Date('2026-09-28T10:00:00Z'),
            status: 'APPROVED',
            isOnlineMeeting: false,
            location: 'Salle de réunion 12ème étage',
            requestedByName: 'M. Diallo',
            requestedByService: 'Direction Générale',
          },
          {
            id: 'a2',
            title: 'Partenaire',
            startAt: new Date('2026-09-28T14:00:00Z'),
            endAt: new Date('2026-09-28T15:00:00Z'),
            status: 'APPROVED',
            isOnlineMeeting: false,
            location: 'Bureau DGA',
            requestedByName: 'A. Mbowe',
            requestedByService: '',
          },
        ],
        reservations: [
          {
            id: 'r1',
            title: 'Point budget',
            usageType: 'REUNION',
            roomName: 'Salle de réunion 12ème étage',
            organizerService: 'Direction Générale',
            startAt: new Date('2026-09-28T09:00:00Z'),
            endAt: new Date('2026-09-28T10:00:00Z'),
            status: 'CONFIRMED',
            appointmentId: 'a1',
          },
        ],
        slots: [
          { startTime: '11:00', endTime: '11:30', status: 'AVAILABLE' },
          { startTime: '08:00', endTime: '08:30', status: 'BLOCKED' },
        ],
      })
    );

    assert.equal(view.greeting, 'Bonjour Monsieur le DGA');
    assert.equal(view.kpis.meetings.count, 1);
    assert.equal(view.kpis.appointments.count, 1);
    assert.equal(view.kpis.free.label, '30 min');
    assert.equal(view.agenda.filter((item) => item.title === 'Point budget').length, 1);
    assert.equal(view.agenda.some((item) => item.kind === 'free'), true);
    assert.equal(view.room.slices.find((slice) => slice.key === 'free')?.count, 1);
    assert.equal(view.room.slices.find((slice) => slice.key === 'blocked')?.count, 1);
  });

  it('hides a mission whose return date has passed, even if the stored status is still planned', () => {
    const view = buildDgCockpit(
      source({
        missions: [
          {
            id: 'm-done',
            subject: 'Afrique du Sud',
            destination: '+27 Afrique du Sud',
            departAt: '2026-09-01T08:00:00.000Z',
            returnAt: '2026-09-10T18:00:00.000Z',
            status: 'PLANNED',
            participants: '',
          },
        ],
      })
    );

    assert.equal(view.kpis.missions.count, 0);
    assert.equal(view.kpis.missions.hint, 'Aucune en cours');
    assert.equal(view.attention.some((item) => item.id === 'mission-planned'), false);
    assert.equal(view.agenda.some((item) => item.kind === 'mission'), false);
  });
});
