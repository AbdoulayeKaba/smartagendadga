import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageMissionHotel,
  isMissionHotelLocked,
  missionHotelColumnLabel,
  missionHotelStatusLabel,
  resolveMissionHotelStatus,
} from '../lib/workspace/mission-hotel-status';

describe('mission hotel status', () => {
  it('returns null when no reservation exists', () => {
    assert.equal(resolveMissionHotelStatus([]), null);
    assert.equal(missionHotelStatusLabel(null), 'À réserver');
  });

  it('shows TO_BOOK label', () => {
    assert.equal(missionHotelStatusLabel('TO_BOOK'), 'À réserver');
  });

  it('uses simplified column labels', () => {
    assert.equal(missionHotelColumnLabel(null), 'À réserver');
    assert.equal(missionHotelColumnLabel('TO_BOOK'), 'À réserver');
    assert.equal(missionHotelColumnLabel('BOOKING_IN_PROGRESS'), 'Déjà réservé');
    assert.equal(missionHotelColumnLabel('CONFIRMED'), 'Déjà réservé');
  });

  it('locks hotel for completed missions', () => {
    const completed = { status: 'COMPLETED' as const, archived: false };
    assert.equal(isMissionHotelLocked(completed), true);
    assert.equal(canManageMissionHotel(completed), false);
    assert.equal(missionHotelColumnLabel('BOOKED', completed), 'À réserver');
  });

  it('allows hotel for ongoing missions', () => {
    const ongoing = { status: 'ONGOING' as const, archived: false };
    assert.equal(isMissionHotelLocked(ongoing), false);
    assert.equal(canManageMissionHotel(ongoing), true);
  });

  it('picks the least advanced active status', () => {
    assert.equal(resolveMissionHotelStatus(['CONFIRMED', 'TO_BOOK']), 'TO_BOOK');
    assert.equal(resolveMissionHotelStatus(['BOOKED', 'BOOKING_IN_PROGRESS']), 'BOOKING_IN_PROGRESS');
  });

  it('falls back to cancelled when all reservations are cancelled', () => {
    assert.equal(resolveMissionHotelStatus(['CANCELLED', 'CANCELLED']), 'CANCELLED');
  });
});
