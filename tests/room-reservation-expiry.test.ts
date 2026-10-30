import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectRoomReservationTransitionTimes,
  isConfirmedRoomReservationFinished,
  isPendingRoomReservationExpired,
  resolveLiveRoomReservationStatus,
  ROOM_AUTO_EXPIRE_PENDING_REASON,
} from '@/lib/dg/room-reservation-expiry';

describe('room-reservation-expiry', () => {
  const now = new Date('2026-08-12T14:00:00.000Z');

  it('marks PENDING as expired when start has passed', () => {
    assert.equal(
      isPendingRoomReservationExpired(
        {
          status: 'PENDING',
          startAt: '2026-08-12T13:00:00.000Z',
        },
        now
      ),
      true
    );
    assert.equal(
      resolveLiveRoomReservationStatus(
        {
          status: 'PENDING',
          startAt: '2026-08-12T13:00:00.000Z',
          endAt: '2026-08-12T14:00:00.000Z',
        },
        now
      ).status,
      'REJECTED'
    );
  });

  it('keeps PENDING when start is in the future', () => {
    assert.equal(
      isPendingRoomReservationExpired(
        {
          status: 'PENDING',
          startAt: '2026-08-12T15:00:00.000Z',
        },
        now
      ),
      false
    );
  });

  it('marks CONFIRMED as COMPLETED when end has passed', () => {
    assert.equal(
      isConfirmedRoomReservationFinished(
        {
          status: 'CONFIRMED',
          endAt: '2026-08-12T13:30:00.000Z',
        },
        now
      ),
      true
    );
    assert.equal(
      resolveLiveRoomReservationStatus(
        {
          status: 'CONFIRMED',
          startAt: '2026-08-12T12:00:00.000Z',
          endAt: '2026-08-12T13:30:00.000Z',
        },
        now
      ).status,
      'COMPLETED'
    );
  });

  it('keeps CONFIRMED while the slot is ongoing', () => {
    assert.equal(
      resolveLiveRoomReservationStatus(
        {
          status: 'CONFIRMED',
          startAt: '2026-08-12T13:00:00.000Z',
          endAt: '2026-08-12T15:00:00.000Z',
        },
        now
      ).status,
      'CONFIRMED'
    );
  });

  it('schedules only future transitions', () => {
    const times = collectRoomReservationTransitionTimes(
      [
        {
          status: 'PENDING',
          startAt: '2026-08-12T13:00:00.000Z',
          endAt: '2026-08-12T14:00:00.000Z',
        },
        {
          status: 'CONFIRMED',
          startAt: '2026-08-12T15:00:00.000Z',
          endAt: '2026-08-12T16:00:00.000Z',
        },
      ],
      now
    );
    assert.deepEqual(times, [new Date('2026-08-12T16:00:00.000Z').getTime()]);
  });
});
