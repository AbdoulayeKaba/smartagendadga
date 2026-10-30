import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAppointmentRequestBody,
  buildSubmitParticipants,
  emptyPlanningForm,
} from '@/lib/dg/appointment-planning';

describe('contact appointment planning', () => {
  it('includes strategicContactId when planning from a contact', () => {
    const form = emptyPlanningForm({
      title: 'RDV — Ministre Dupont',
      participantName: 'Ministre Dupont',
      participantEmail: 'dupont@gouv.local',
      type: 'EXTERNAL',
      strategicContactId: 'ct-001',
    });

    const participants = buildSubmitParticipants(form.participantUserIds, [], form.externalParticipant);

    const body = buildAppointmentRequestBody(form, {
      urgentOverride: false,
      participants,
    });

    assert.equal(body.strategicContactId, 'ct-001');
    assert.equal(body.type, 'EXTERNAL');
    assert.equal(body.title, 'RDV — Ministre Dupont');
    assert.equal(participants.length, 1);
    assert.equal(participants[0]?.email, 'dupont@gouv.local');
    assert.equal(participants[0]?.isExternal, true);
  });

  it('builds multiple internal participants from user ids', () => {
    const directory = [
      { id: 'u1', email: 'a@org.local', firstName: 'Alice', lastName: 'A' },
      { id: 'u2', email: 'b@org.local', firstName: 'Bob', lastName: 'B' },
    ];
    const participants = buildSubmitParticipants(['u1', 'u2'], directory, null);
    assert.equal(participants.length, 2);
    assert.equal(participants[0]?.userId, 'u1');
    assert.equal(participants[1]?.isExternal, false);
  });

  it('omits strategicContactId when not linked to a contact', () => {
    const form = emptyPlanningForm();
    const body = buildAppointmentRequestBody(form, { urgentOverride: false, participants: [] });
    assert.equal('strategicContactId' in body, false);
  });
});
