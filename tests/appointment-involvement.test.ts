import assert from 'node:assert/strict';
import test from 'node:test';
import {
  audienceInvolvement,
  resolveInvolvement,
} from '../lib/dg/appointment-involvement';

const externalId = 'user-ext';
const externalEmail = 'invite@organisation.local';

test('le demandeur est initié, même s’il est aussi dans les participants', () => {
  assert.equal(
    resolveInvolvement({
      userId: externalId,
      email: externalEmail,
      requestedById: externalId,
      participants: [{ userId: externalId, email: externalEmail }],
    }),
    'initiator'
  );
});

test('un compte invité est reconnu par userId ou par e-mail', () => {
  assert.equal(
    resolveInvolvement({
      userId: externalId,
      email: externalEmail,
      requestedById: 'autre',
      participants: [{ userId: null, email: 'Invite@organisation.local' }],
    }),
    'invitee'
  );
  assert.equal(
    resolveInvolvement({
      userId: externalId,
      email: externalEmail,
      requestedById: 'autre',
      participants: [{ userId: externalId, email: 'autre@organisation.local' }],
    }),
    'invitee'
  );
});

test('une notification d’invité mal rangée sur le demandeur reste visible pour l’invité seulement', () => {
  const appointment = {
    requestedById: 'demandeur',
    participants: [{ userId: null, email: externalEmail }],
  };
  assert.equal(
    audienceInvolvement({
      userId: externalId,
      email: externalEmail,
      notificationUserId: 'demandeur',
      recipientEmail: externalEmail,
      appointment,
    }),
    'invitee'
  );
  assert.equal(
    audienceInvolvement({
      userId: 'demandeur',
      email: 'demandeur@organisation.local',
      notificationUserId: 'demandeur',
      recipientEmail: externalEmail,
      appointment,
    }),
    null
  );
});

test('le demandeur voit sa propre notification, pas celle d’un rendez-vous étranger', () => {
  assert.equal(
    audienceInvolvement({
      userId: externalId,
      email: externalEmail,
      notificationUserId: externalId,
      recipientEmail: externalEmail,
      appointment: {
        requestedById: externalId,
        participants: [],
      },
    }),
    'initiator'
  );
  assert.equal(
    audienceInvolvement({
      userId: externalId,
      email: externalEmail,
      notificationUserId: externalId,
      recipientEmail: null,
      appointment: {
        requestedById: 'autre',
        participants: [],
      },
    }),
    null
  );
});
