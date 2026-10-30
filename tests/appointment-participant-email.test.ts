import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reminderKindForOffset,
  reminderLabelFr,
  resolveReminderOffsets,
  isAppointmentSlotElapsed,
  shouldDispatchScheduledAppointmentMail,
  SLOT_ELAPSED_REMINDERS_LABEL,
} from '@/lib/dg/appointment-reminder-schedule';
import {
  buildAppointmentConfirmationMail,
  buildAppointmentInvitePendingMail,
  buildAppointmentInviteUpdatedMail,
  buildAppointmentInviteWithdrawnMail,
  buildAppointmentRejectedMail,
  buildAppointmentRequestUpdatedMail,
  buildAppointmentReminderMail,
  buildAppointmentRescheduledMail,
  buildAppointmentStartedMail,
  buildAppointmentEndedMail,
  buildAssistantNewRequestMail,
  buildDgApprovedMail,
  buildDgPlannedAppointmentMail,
  collectStaffCopyEmails,
  staffMailboxCc,
  buildUrgentAppointmentMail,
  buildAssistantApprovedMail,
  buildRequesterApprovedMail,
  resolveAppointmentMailAudience,
} from '@/lib/emails/appointment-mail';
import {
  listAppointmentReminderRecipients,
  listParticipantRecipientsFromSource,
} from '@/lib/dg/appointment-reminder-recipients';

describe('appointment reminder schedule', () => {
  it('uses standard 24h and 1h offsets when unset', () => {
    assert.deepEqual(resolveReminderOffsets(undefined), [1440, 60]);
    assert.deepEqual(resolveReminderOffsets(null), [1440, 60]);
  });

  it('disables reminders when set to 0', () => {
    assert.deepEqual(resolveReminderOffsets(0), []);
  });

  it('uses a single custom offset when provided', () => {
    assert.deepEqual(resolveReminderOffsets(30), [30]);
    assert.deepEqual(resolveReminderOffsets(1440), [1440]);
  });

  it('maps reminder kinds and labels', () => {
    assert.equal(reminderKindForOffset(1440), 'REMINDER_24H');
    assert.equal(reminderKindForOffset(60), 'REMINDER_1H');
    assert.equal(reminderLabelFr(15), '15 minutes');
    assert.equal(reminderLabelFr(60), '1 heure');
    assert.equal(reminderLabelFr(1440), '24 heures');
  });

  it('marks an elapsed slot so reminders stay off', () => {
    const startAt = new Date('2026-09-05T12:00:00Z');
    assert.equal(isAppointmentSlotElapsed(startAt, new Date('2026-09-05T11:59:00Z')), false);
    assert.equal(isAppointmentSlotElapsed(startAt, new Date('2026-09-26T13:55:00Z')), true);
    assert.match(SLOT_ELAPSED_REMINDERS_LABEL, /rappels désactivés/);
  });

  it('never dispatches a 1h reminder after the meeting has started', () => {
    const startAt = new Date('2026-09-05T12:00:00Z');
    const endAt = new Date('2026-09-05T13:00:00Z');
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'REMINDER_1H',
        now: new Date('2026-09-05T11:00:00Z'),
        startAt,
        endAt,
      }),
      true
    );
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'REMINDER_1H',
        now: new Date('2026-09-26T13:55:00Z'),
        startAt,
        endAt,
      }),
      false
    );
  });

  it('sends meeting-started only while the slot is ongoing', () => {
    const startAt = new Date('2026-09-05T12:00:00Z');
    const endAt = new Date('2026-09-05T13:00:00Z');
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'MEETING_STARTED',
        now: new Date('2026-09-05T12:05:00Z'),
        startAt,
        endAt,
      }),
      true
    );
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'MEETING_STARTED',
        now: new Date('2026-09-26T13:55:00Z'),
        startAt,
        endAt,
      }),
      false
    );
  });

  it('drops late meeting-ended catch-up after 6 hours', () => {
    const startAt = new Date('2026-09-05T12:00:00Z');
    const endAt = new Date('2026-09-05T13:00:00Z');
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'MEETING_ENDED',
        now: new Date('2026-09-05T13:10:00Z'),
        startAt,
        endAt,
      }),
      true
    );
    assert.equal(
      shouldDispatchScheduledAppointmentMail({
        kind: 'MEETING_ENDED',
        now: new Date('2026-09-26T13:55:00Z'),
        startAt,
        endAt,
      }),
      false
    );
  });
});

describe('appointment participant recipients', () => {
  const base = {
    id: 'appt-1',
    title: 'Audience',
    description: null,
    startAt: new Date('2026-06-22T09:00:00Z'),
    endAt: new Date('2026-06-22T10:00:00Z'),
    allDay: false,
    location: 'Bureau du DGA',
    timezone: 'Africa/Conakry',
    reminderMinutesBefore: null,
    requestedById: 'user-1',
    requestedBy: {
      id: 'user-1',
      firstName: 'Jean',
      lastName: 'Demandeur',
      email: 'demandeur@organisation.local',
    },
    participants: [
      { email: 'a@organisation.local', name: 'Alice', userId: 'u-a' },
      { email: 'b@organisation.local', name: 'Bob', userId: 'u-b' },
      { email: 'a@organisation.local', name: 'Alice duplicate', userId: 'u-a' },
    ],
  };

  it('deduplicates participants by email', () => {
    const recipients = listParticipantRecipientsFromSource(base);
    assert.equal(recipients.length, 2);
    assert.deepEqual(
      recipients.map((r) => r.email).sort(),
      ['a@organisation.local', 'b@organisation.local']
    );
  });

  it('includes the requester in reminder recipients when absent from participants', () => {
    const recipients = listAppointmentReminderRecipients(base);
    assert.equal(recipients.length, 3);
    assert.ok(recipients.some((r) => r.email === 'demandeur@organisation.local'));
  });

  it('includes the stated requester and keeps copy participants', () => {
    const recipients = listAppointmentReminderRecipients({
      ...base,
      description:
        '<!--APPT_META:{"urgencyLevel":"NORMAL","preContact":[],"requesterFullName":"Mamadou Diallo","requesterEmail":"mamadou.diallo@arpt.gov.gn"}-->',
    });
    assert.deepEqual(
      recipients.map((recipient) => recipient.email).sort(),
      [
        'a@organisation.local',
        'b@organisation.local',
        'demandeur@organisation.local',
        'mamadou.diallo@arpt.gov.gn',
      ]
    );
    const stated = recipients.find((recipient) => recipient.email === 'mamadou.diallo@arpt.gov.gn');
    assert.equal(stated?.name, 'Mamadou Diallo');
  });
});

describe('appointment Teams link in approval mails', () => {
  const teamsUrl = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc';
  const ctx = {
    organizationName: 'DGA',
    recipientName: 'Alice',
    title: 'Point Teams',
    description: null,
    startAt: new Date('2026-06-22T09:00:00Z'),
    endAt: new Date('2026-06-22T10:00:00Z'),
    allDay: false,
    location: 'En ligne (Teams)',
    timezone: 'Africa/Conakry',
    requestedByName: 'Jean Demandeur',
    teamsMeetingUrl: teamsUrl,
  };

  it('includes the Teams join URL in confirmation, requester and DGA mails', () => {
    const confirmation = buildAppointmentConfirmationMail(ctx);
    const requester = buildRequesterApprovedMail(ctx);
    const dg = buildDgApprovedMail(ctx);

    for (const mail of [confirmation, requester, dg]) {
      assert.match(mail.html, /Rejoindre la réunion Teams/);
      assert.match(mail.html, /Lien Teams/);
      assert.ok(mail.html.includes(teamsUrl));
    }
  });

  it('omits the Teams block when no join URL is present', () => {
    const mail = buildAppointmentConfirmationMail({ ...ctx, teamsMeetingUrl: null });
    assert.doesNotMatch(mail.html, /Rejoindre la réunion Teams/);
    assert.doesNotMatch(mail.html, /Lien Teams/);
  });
});

describe('DGA mail when the assistant plans an appointment', () => {
  it('tells the DGA that an appointment was planned for them', () => {
    const mail = buildDgPlannedAppointmentMail({
      organizationName: 'ARPT',
      recipientName: 'Directeur Général Adjoint',
      title: 'Signature / validation',
      description: null,
      startAt: new Date('2026-10-26T08:00:00'),
      endAt: new Date('2026-10-26T09:00:00'),
      allDay: false,
      location: null,
      timezone: 'Africa/Conakry',
      requestedByName: 'Aïssatou Bah',
      isOnlineMeeting: false,
    });

    assert.match(mail.subject, /Votre agenda — Signature \/ validation/);
    assert.match(mail.html, /Rendez-vous inscrit à votre agenda/);
    assert.match(mail.html, /Bonjour <strong>Monsieur le Directeur général adjoint<\/strong>/);
    assert.match(mail.html, /Aïssatou Bah a inscrit un rendez-vous à votre agenda/);
    assert.match(mail.html, /Planifié par/);
    assert.match(mail.html, /Présentiel/);
    assert.doesNotMatch(mail.html, />Lieu</);
    assert.doesNotMatch(mail.html, /sur site/);
    assert.doesNotMatch(mail.html, /Demandé par/);

    const named = buildDgPlannedAppointmentMail({
      organizationName: 'ARPT',
      recipientName: 'Abdoulaye KABA',
      title: 'Signature / validation',
      description:
        '<!--APPT_META:{"urgencyLevel":"NORMAL","preContact":[],"requesterFullName":"Mamadou Diallo","requesterPhone":"+224 620 00 00 00","requesterEmail":"mamadou.diallo@arpt.gov.gn"}-->',
      startAt: new Date('2026-10-26T08:00:00'),
      endAt: new Date('2026-10-26T09:00:00'),
      allDay: false,
      location: 'En ligne (Teams)',
      timezone: 'Africa/Conakry',
      requestedByName: 'Aïssatou Bah',
      isOnlineMeeting: true,
    });
    assert.match(named.html, /Bonjour <strong>Abdoulaye KABA<\/strong>/);
    assert.match(named.html, /demandé par Mamadou Diallo/);
    assert.match(named.html, /Demandeur/);
    assert.match(named.html, /mamadou\.diallo@arpt\.gov\.gn/);
    assert.match(named.html, /transmis dès la validation du créneau/);
  });
});

describe('staff mail copy list', () => {
  it('lists the requester email and the copy participants for the DGA', () => {
    const description =
      '<!--APPT_META:{"requesterFullName":"Mamadou Diallo","requesterEmail":"mamadou.diallo@arpt.gov.gn"}-->';
    const emails = collectStaffCopyEmails({
      description,
      requestedByEmail: 'assistante@arpt.gov.gn',
      requestedByRole: 'ASSISTANT',
      participants: [
        { email: 'camara@arpt.gov.gn' },
        { email: 'mamadou.diallo@arpt.gov.gn' },
        { email: 'sylla@arpt.gov.gn' },
        { email: 'assistante@arpt.gov.gn' },
      ],
    });
    assert.deepEqual(emails, [
      'mamadou.diallo@arpt.gov.gn',
      'camara@arpt.gov.gn',
      'sylla@arpt.gov.gn',
    ]);
    assert.deepEqual(staffMailboxCc(emails, 'dga@arpt.gov.gn'), emails);
    assert.deepEqual(staffMailboxCc(emails, 'Mamadou.Diallo@arpt.gov.gn'), [
      'camara@arpt.gov.gn',
      'sylla@arpt.gov.gn',
    ]);

    const mail = buildDgApprovedMail({
      organizationName: 'ARPT',
      recipientName: 'Directeur Général Adjoint',
      title: 'vendredi',
      description,
      startAt: new Date('2026-10-30T09:00:00'),
      endAt: new Date('2026-10-30T10:00:00'),
      allDay: false,
      location: 'Salle de réunion A',
      timezone: 'Africa/Conakry',
      copyEmails: emails,
    });
    assert.match(mail.html, /Monsieur le Directeur général adjoint/);
    assert.doesNotMatch(mail.html, /En copie/);
    assert.doesNotMatch(mail.html, /mamadou\.diallo@arpt\.gov\.gn/);
    assert.doesNotMatch(mail.html, /camara@arpt\.gov\.gn/);
    assert.doesNotMatch(mail.html, /sylla@arpt\.gov\.gn/);
    assert.doesNotMatch(mail.html, /Salle de réunion A/);
    assert.doesNotMatch(mail.html, /assistante@arpt\.gov\.gn/);
  });
});

describe('urgent appointment mail for the DGA', () => {
  it('renders a full brief instead of a one-line alert', () => {
    const mail = buildUrgentAppointmentMail(
      {
        organizationName: 'ARPT',
        recipientName: 'Directeur Général Adjoint',
        title: 'LUNDI',
        description: 'Briefing partenaire',
        startAt: new Date('2026-10-26T08:00:00'),
        endAt: new Date('2026-10-26T09:00:00'),
        allDay: false,
        location: null,
        timezone: 'Africa/Conakry',
        requestedByName: 'Aïssatou Bah',
        isOnlineMeeting: false,
      },
      'dg'
    );

    assert.match(mail.subject, /Demande ultra urgente — LUNDI/);
    assert.match(mail.html, /Bonjour <strong>Monsieur le Directeur général adjoint<\/strong>/);
    assert.doesNotMatch(mail.html, />Lieu</);
    assert.match(mail.html, /Une demande ultra urgente a été signalée pour votre agenda/);
    assert.doesNotMatch(mail.html, /Aïssatou Bah/);
    assert.doesNotMatch(mail.html, /En copie/);
    assert.match(mail.html, /Détails du rendez-vous/);
    assert.match(mail.html, /Présentiel/);
    assert.doesNotMatch(mail.html, /À traiter en priorité :/);
  });

  it('tells the DGA that an already approved appointment was marked ultra urgent', () => {
    const mail = buildUrgentAppointmentMail(
      {
        organizationName: 'ARPT',
        recipientName: 'Directeur Général Adjoint',
        title: 'Point de coordination',
        description: null,
        startAt: new Date('2026-10-30T09:00:00'),
        endAt: new Date('2026-10-30T09:15:00'),
        allDay: false,
        location: 'Salle de réunion A',
        timezone: 'Africa/Conakry',
        requestedByName: 'Aïssatou Bah',
        isOnlineMeeting: false,
      },
      'dg',
      { alreadyApproved: true }
    );

    assert.match(mail.subject, /Rendez-vous ultra urgent — Point de coordination/);
    assert.match(mail.html, /Un rendez-vous déjà validé a été signalé comme ultra urgent/);
    assert.doesNotMatch(mail.html, /en attente de validation/);
    assert.doesNotMatch(mail.html, /Aïssatou Bah/);
    assert.doesNotMatch(mail.html, /Salle de réunion A/);
    assert.doesNotMatch(mail.html, /En copie/);
  });
});

describe('DGA mail when an appointment is rescheduled', () => {
  it('tells the DGA the new slot is planned for their agenda', () => {
    const mail = buildAppointmentRescheduledMail(
      {
        organizationName: 'ARPT',
        recipientName: 'Directeur Général Adjoint',
        title: 'LUNDI',
        description: null,
        startAt: new Date('2026-10-27T10:00:00'),
        endAt: new Date('2026-10-27T11:00:00'),
        allDay: false,
        location: null,
        timezone: 'Africa/Conakry',
        requestedByName: 'Aïssatou Bah',
        isOnlineMeeting: false,
      },
      { forDg: true }
    );

    assert.match(mail.subject, /Rendez-vous replanifié — LUNDI/);
    assert.match(mail.html, /Rendez-vous replanifié/);
    assert.match(mail.html, /votre agenda a été replanifié/);
    assert.match(mail.html, /Détails du rendez-vous/);
    assert.match(mail.html, /Accéder à l.agenda/);
    assert.match(mail.html, /\/dg\/appointments/);
  });
});

describe('assistant mail when she validates an appointment', () => {
  const base = {
    organizationName: 'ARPT',
    recipientName: 'Aissatou Bah',
    title: 'Revue réglementaire',
    startAt: new Date('2026-10-26T08:00:00'),
    endAt: new Date('2026-10-26T09:00:00'),
    allDay: false,
    timezone: 'Africa/Conakry',
    requestedByName: 'Aissatou Bah',
    teamsMeetingUrl: null,
  };

  it('confirms her validation instead of treating her as the requester', () => {
    const mail = buildAssistantApprovedMail(
      {
        ...base,
        description:
          '<!--APPT_META:{"urgencyLevel":"NORMAL","preContact":[],"requesterFullName":"Mamadou Diallo","requesterPhone":"+224 620 00 00 00","requesterEmail":"mamadou.diallo@arpt.gov.gn","roomName":"Salle du conseil"}-->',
        location: 'Salle du conseil',
        isOnlineMeeting: false,
      },
      { selfValidated: true }
    );

    assert.match(mail.subject, /Rendez-vous validé — Revue réglementaire/);
    assert.match(mail.html, /Bonjour <strong>Aissatou Bah<\/strong>/);
    assert.match(mail.html, /Vous avez validé ce rendez-vous/);
    assert.match(mail.html, /demandé par Mamadou Diallo/);
    assert.match(mail.html, /Demandeur/);
    assert.match(mail.html, /mamadou\.diallo@arpt\.gov\.gn/);
    assert.match(mail.html, /Salle du conseil/);
    assert.match(mail.html, /présentiel/i);
    assert.match(mail.html, /Accéder à l.agenda/);
    assert.doesNotMatch(mail.html, /validée par l.assistante/);
    assert.doesNotMatch(mail.html, /Votre demande de rendez-vous/);
  });

  it('keeps the requester wording when the recipient is not the assistant', () => {
    const mail = buildRequesterApprovedMail({
      ...base,
      recipientName: 'Mamadou Diallo',
      description: null,
      location: 'Salle du conseil',
      isOnlineMeeting: false,
    });
    assert.match(mail.subject, /Demande approuvée — Revue réglementaire/);
    assert.match(mail.html, /validée par l.assistante du DGA/);
    assert.doesNotMatch(mail.html, /Accès plateforme/);
  });

  it('states that a slot she planned was validated by someone else', () => {
    const mail = buildAssistantApprovedMail(
      {
        ...base,
        description: null,
        location: null,
        isOnlineMeeting: false,
      },
      { selfValidated: false }
    );
    assert.match(mail.html, /que vous avez inscrit à l.agenda est maintenant validé/);
    assert.doesNotMatch(mail.html, /Vous avez validé ce rendez-vous/);
  });
});

describe('platform access link for DGA and assistant only', () => {
  const ctx = {
    organizationName: 'ARPT',
    recipientName: 'Directeur Général Adjoint',
    title: 'LUNDI',
    description: null,
    startAt: new Date('2026-10-27T10:00:00'),
    endAt: new Date('2026-10-27T11:00:00'),
    allDay: false,
    location: null,
    timezone: 'Africa/Conakry',
    requestedByName: 'Aïssatou Bah',
    isOnlineMeeting: true,
    teamsMeetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc',
  };

  it('adds a platform button on staff mails and omits it for requesters and invitees', () => {
    const staff = [
      buildDgApprovedMail(ctx),
      buildDgPlannedAppointmentMail(ctx),
      buildUrgentAppointmentMail(ctx, 'dg'),
      buildUrgentAppointmentMail(ctx, 'assistant'),
      buildAssistantNewRequestMail(ctx),
      buildAssistantApprovedMail(ctx, { selfValidated: true }),
      buildAppointmentReminderMail(ctx, 60, { forStaff: true }),
      buildAppointmentRescheduledMail(ctx, { forDg: true }),
    ];
    for (const mail of staff) {
      assert.match(mail.html, /Accès plateforme/);
      assert.match(mail.html, /Accéder à l.agenda/);
      assert.match(mail.html, /\/dg\/appointments/);
    }

    const external = [
      buildRequesterApprovedMail(ctx),
      buildAppointmentConfirmationMail(ctx),
      buildAppointmentRescheduledMail(ctx, { staysApproved: true }),
      buildAppointmentReminderMail(ctx, 60),
    ];
    for (const mail of external) {
      assert.doesNotMatch(mail.html, /Accès plateforme/);
      assert.doesNotMatch(mail.html, /Accéder à l.agenda/);
    }
  });
});

describe('appointment started mail', () => {
  const ctx = {
    organizationName: 'ARPT',
    recipientName: 'Abdoulaye KABA',
    title: 'rdv-presentiel-kaba',
    description: null,
    startAt: new Date('2026-09-02T12:00:00'),
    endAt: new Date('2026-09-02T13:00:00'),
    allDay: false,
    location: 'Bureau du DGA',
    timezone: 'Africa/Conakry',
    requestedByName: 'Abdoulaye KABA',
  };

  it('renders a live started template with en cours badge', () => {
    const mail = buildAppointmentStartedMail(ctx);
    assert.match(mail.subject, /Réunion en cours/);
    assert.match(mail.html, /Votre rendez-vous est en cours/);
    assert.match(mail.html, /En cours/);
    assert.match(mail.html, /rdv-presentiel-kaba/);
    assert.doesNotMatch(mail.html, /Accès plateforme/);

    const staff = buildAppointmentStartedMail(ctx, { forStaff: true });
    assert.match(staff.subject, /Réunion en cours/);
    assert.match(staff.html, /Un rendez-vous de votre agenda vient de commencer/);
    assert.match(staff.html, /Accès plateforme/);
    assert.match(staff.html, /Accéder à l.agenda/);
  });
});

describe('appointment ended mail', () => {
  const ctx = {
    organizationName: 'ARPT',
    recipientName: 'Abdoulaye KABA',
    title: 'rdv-presentiel-kaba',
    description: null,
    startAt: new Date('2026-09-02T12:00:00'),
    endAt: new Date('2026-09-02T13:00:00'),
    allDay: false,
    location: 'Bureau du DGA',
    timezone: 'Africa/Conakry',
    requestedByName: 'Abdoulaye KABA',
  };

  it('renders a completed ended template with terminé badge', () => {
    const mail = buildAppointmentEndedMail(ctx);
    assert.match(mail.subject, /Réunion terminée/);
    assert.match(mail.html, /Votre rendez-vous est terminé/);
    assert.match(mail.html, /Terminé/);
    assert.match(mail.html, /rdv-presentiel-kaba/);

    const dg = buildAppointmentEndedMail(
      {
        ...ctx,
        recipientName: 'Directeur General Adjoint',
        location: 'Salle de réunion A',
      },
      { forStaff: true }
    );
    assert.match(dg.html, /Bonjour <strong>Monsieur le Directeur général adjoint<\/strong>/);
    assert.match(dg.html, /Un rendez-vous de votre agenda est terminé/);
    assert.match(dg.html, /Mode · Présentiel/);
    assert.doesNotMatch(dg.html, /Salle de réunion A/);
    assert.doesNotMatch(dg.html, />Lieu</);
  });
});

describe('appointment rejected mail', () => {
  const ctx = {
    organizationName: 'ARPT',
    recipientName: 'Abdoulaye KABA',
    title: 'rdv-abdoulaye1',
    description: null,
    startAt: new Date('2026-09-02T16:45:00'),
    endAt: new Date('2026-09-02T17:45:00'),
    allDay: false,
    location: 'Bureau du DGA',
    timezone: 'Africa/Conakry',
    requestedByName: 'Abdoulaye KABA',
    logoUrl: 'cid:institution-logo',
  };

  it('addresses the requester and the invitee differently', () => {
    const shared = {
      organizationName: 'ARPT',
      title: 'Point budget',
      description: null,
      startAt: new Date('2026-09-29T08:00:00Z'),
      endAt: new Date('2026-09-29T09:00:00Z'),
      allDay: false,
      location: 'Bureau du DGA',
      timezone: 'Africa/Conakry',
      requestedByName: 'Aissatou Bah',
    };
    const requester = buildAppointmentRescheduledMail({
      ...shared,
      recipientName: 'Aissatou Bah',
      audience: 'requester',
    });
    const invitee = buildAppointmentRescheduledMail({
      ...shared,
      recipientName: 'Mamadou Diallo',
      audience: 'invitee',
    });
    const invitation = buildAppointmentConfirmationMail({
      ...shared,
      recipientName: 'Mamadou Diallo',
    });
    const pendingInvite = buildAppointmentInvitePendingMail({
      ...shared,
      recipientName: 'Mamadou Diallo',
    });

    assert.equal(resolveAppointmentMailAudience('a@arpt.gn', 'A@arpt.gn'), 'requester');
    assert.equal(resolveAppointmentMailAudience('a@arpt.gn', 'b@arpt.gn'), 'invitee');
    assert.match(requester.subject, /Rendez-vous reporté/);
    assert.match(requester.html, /en attente de validation/);
    assert.doesNotMatch(requester.html, /Demandé par/);
    assert.match(invitee.subject, /Réunion déplacée/);
    assert.match(invitee.html, /réunion à laquelle vous êtes invité/);
    assert.match(invitee.html, /Demandé par/);
    assert.match(invitation.subject, /Invitation/);
    assert.match(invitation.html, /Vous êtes invité/);
    assert.match(invitation.html, /Aissatou Bah vous convie/);
    assert.match(pendingInvite.subject, /Invitation en attente/);
    assert.match(pendingInvite.html, /n’est pas encore confirmée/);
    assert.match(pendingInvite.html, /En attente de validation/);
    assert.doesNotMatch(pendingInvite.html, /Votre demande de rendez-vous/);
    assert.match(
      buildAppointmentReminderMail({ ...shared, recipientName: 'Mamadou Diallo', audience: 'invitee' }, 60)
        .html,
      /réunion à laquelle vous êtes invité/
    );
    const staffReminder = buildAppointmentReminderMail(
      { ...shared, recipientName: 'Directeur Général Adjoint' },
      60,
      { forStaff: true }
    );
    assert.match(staffReminder.subject, /Rappel d’agenda/);
    assert.match(staffReminder.html, /Un rendez-vous de votre agenda aura lieu dans 1 heure/);
    assert.match(staffReminder.html, /Monsieur le Directeur général adjoint/);
    assert.match(staffReminder.html, /Accéder à l.agenda/);
    assert.match(pendingInvite.html, /Mode · Présentiel/);
    assert.match(pendingInvite.html, /Bureau du DGA/);
    assert.match(pendingInvite.html, />Lieu</);
    const onSiteWithoutRoom = buildAppointmentInvitePendingMail({
      ...shared,
      recipientName: 'Mamadou Diallo',
      location: null,
      isOnlineMeeting: false,
    });
    assert.match(onSiteWithoutRoom.html, /Présentiel — sur site/);
    assert.doesNotMatch(onSiteWithoutRoom.html, /Lieu à confirmer/);
    assert.match(pendingInvite.html, />Présentiel</);
  });

  it('shows online versus in-person and a pending update to invitees', () => {
    const base = {
      organizationName: 'ARPT',
      recipientName: 'Abdoulaye KABA',
      title: 'rdv rendez vous',
      description: null,
      startAt: new Date('2026-09-29T08:00:00Z'),
      endAt: new Date('2026-09-29T09:00:00Z'),
      allDay: false,
      timezone: 'Africa/Conakry',
      requestedByName: 'Aissatou Bah',
    };
    const online = buildAppointmentInvitePendingMail({
      ...base,
      location: 'En ligne (Teams)',
      isOnlineMeeting: true,
    });
    const inPerson = buildAppointmentInvitePendingMail({
      ...base,
      location: 'Bureau du DGA',
      isOnlineMeeting: false,
    });
    const updated = buildAppointmentInviteUpdatedMail({
      ...base,
      location: 'Salle de réunion 12ème étage',
      isOnlineMeeting: false,
    });
    const requesterUpdate = buildAppointmentRequestUpdatedMail({
      ...base,
      recipientName: 'Aissatou Bah',
      location: 'Salle de réunion 12ème étage',
      isOnlineMeeting: false,
    });
    const withdrawn = buildAppointmentInviteWithdrawnMail({
      ...base,
      location: 'Bureau du DGA',
    });

    assert.match(online.subject, /Invitation en attente/);
    assert.match(online.html, /Mode · En ligne/);
    assert.match(online.html, /En ligne — Microsoft Teams/);
    assert.match(online.html, /sera envoyé après validation/);
    assert.doesNotMatch(online.html, /Lieu à confirmer/);
    assert.doesNotMatch(online.html, /Bureau du DGA/);
    assert.match(inPerson.html, /Mode · Présentiel/);
    assert.match(inPerson.html, /Bureau du DGA/);
    assert.doesNotMatch(inPerson.html, /Lieu à confirmer/);
    assert.match(updated.subject, /Invitation mise à jour/);
    assert.match(updated.html, /a modifié cette réunion avant sa validation/);
    assert.match(updated.html, /n’est pas encore confirmée/);
    assert.match(updated.html, /Salle de réunion 12ème étage/);
    assert.match(updated.html, /Demandé par/);
    assert.doesNotMatch(updated.html, /Votre demande de rendez-vous/);
    assert.match(requesterUpdate.subject, /Demande mise à jour/);
    assert.match(requesterUpdate.html, /Vous avez modifié votre demande/);
    assert.doesNotMatch(requesterUpdate.html, /Demandé par/);
    assert.match(withdrawn.subject, /Invitation retirée/);
    assert.match(withdrawn.html, /vous a retiré/);
  });

  it('renders a branded rejection template with reason and details', () => {
    const mail = buildAppointmentRejectedMail(ctx, { reason: 'Créneau indisponible' });
    assert.match(mail.subject, /Demande refusée/);
    assert.match(mail.html, /Motif du refus/);
    assert.match(mail.html, /Créneau indisponible/);
    assert.match(mail.html, /Détails du rendez-vous/);
    assert.match(mail.html, /rdv-abdoulaye1/);
    assert.match(mail.html, /Refusé/);
    assert.match(mail.html, /cid:institution-logo/);

    const autoRequester = buildAppointmentRejectedMail(
      { ...ctx, audience: 'requester' },
      { reason: 'Rejet automatique : non validé.', autoRejected: true }
    );
    const autoInvitee = buildAppointmentRejectedMail(
      { ...ctx, audience: 'invitee', requestedByName: 'Aissatou Bah' },
      { reason: 'Rejet automatique : non validé.', autoRejected: true }
    );
    assert.match(autoRequester.subject, /Demande refusée automatiquement/);
    assert.match(autoRequester.html, /refusée automatiquement/);
    assert.match(autoInvitee.subject, /Réunion annulée/);
    assert.match(autoInvitee.html, /n’aura pas lieu/);
    assert.doesNotMatch(autoInvitee.html, /Votre demande de rendez-vous/);
  });
});
