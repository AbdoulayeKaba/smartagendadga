import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppointmentReviewItem } from '../lib/dg/appointments-review';
import {
  displayAppointmentRequester,
  displayCopyParticipants,
} from '../lib/dg/appointment-review-display';

function item(
  patch: Partial<AppointmentReviewItem> & Pick<AppointmentReviewItem, 'requestedBy' | 'participants'>
): AppointmentReviewItem {
  return patch as AppointmentReviewItem;
}

const assistant = {
  id: 'u1',
  firstName: 'Aissatou',
  lastName: 'Bah',
  email: 'kaba.abdoulaye@arpt.gov.gn',
  phone: null,
  department: null,
  role: 'ASSISTANT',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  avatarUrl: null,
};

test('demandeur uses the stated contact, not the account that planned it', () => {
  const requester = displayAppointmentRequester(
    item({
      requestedBy: assistant,
      requesterFullName: 'Mamadou Diallo',
      requesterPhone: '+224620000000',
      requesterEmail: 'mamadou.diallo@exemple.gov',
      participants: [],
    })
  );
  assert.equal(requester?.name, 'Mamadou Diallo');
  assert.equal(requester?.phone, '+224620000000');
  assert.equal(requester?.email, 'mamadou.diallo@exemple.gov');
});

test('participants are the people in copy, without the planner account', () => {
  const copies = displayCopyParticipants(
    item({
      requestedBy: assistant,
      requesterEmail: 'mamadou.diallo@exemple.gov',
      participants: [
        {
          id: 'p1',
          email: 'kaba.abdoulaye@arpt.gov.gn',
          name: 'Aissatou Bah',
          isExternal: false,
        },
        {
          id: 'p2',
          email: 'mamadou.diallo@exemple.gov',
          name: 'Mamadou Diallo',
          isExternal: true,
        },
        {
          id: 'p3',
          email: 'fatou.camara@exemple.gov',
          name: 'fatou.camara',
          isExternal: true,
        },
      ],
    })
  );
  assert.deepEqual(
    copies.map((participant) => participant.email),
    ['fatou.camara@exemple.gov']
  );
});
