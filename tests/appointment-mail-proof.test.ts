import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAppointmentMailProof } from '@/lib/dg/appointment-mail-proof';

describe('appointment mail proof', () => {
  const startAt = new Date('2026-09-05T12:00:00Z');
  const endAt = new Date('2026-09-05T13:00:00Z');

  it('marks a 1h reminder as skipped when the slot has already passed', () => {
    const lines = buildAppointmentMailProof({
      status: 'APPROVED',
      startAt,
      endAt,
      now: new Date('2026-09-26T13:55:00Z'),
      reminderMinutesBefore: null,
      notifications: [
        {
          kind: 'APPROVED',
          emailSent: true,
          scheduledFor: null,
          sentAt: new Date('2026-09-01T18:01:00Z'),
        },
        {
          kind: 'REMINDER_1H',
          emailSent: false,
          scheduledFor: new Date('2026-09-05T11:00:00Z'),
          sentAt: null,
        },
      ],
    });

    const reminder = lines.find((l) => l.kind === 'REMINDER_1H');
    assert.equal(reminder?.status, 'skipped');
    assert.match(reminder?.detail ?? '', /créneau est passé/i);
    assert.equal(lines.find((l) => l.kind === 'APPROVED')?.status, 'sent');
  });

  it('keeps a future 1h reminder as scheduled', () => {
    const futureStart = new Date('2026-09-29T12:00:00Z');
    const lines = buildAppointmentMailProof({
      status: 'APPROVED',
      startAt: futureStart,
      endAt: new Date('2026-09-29T13:00:00Z'),
      now: new Date('2026-09-26T10:00:00Z'),
      reminderMinutesBefore: 60,
      notifications: [
        {
          kind: 'REMINDER_1H',
          emailSent: false,
          scheduledFor: new Date('2026-09-29T11:00:00Z'),
          sentAt: null,
        },
      ],
    });
    assert.equal(lines.find((l) => l.kind === 'REMINDER_1H')?.status, 'scheduled');
  });
});
