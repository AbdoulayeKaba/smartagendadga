import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainRoomSpan,
  moveRoomSpanStart,
  roomFullDaySpan,
  roomSpanOptions,
  type RoomGridSlot,
} from '../lib/dg/room-slot-span';

function slot(startTime: string, endTime: string, status = 'AVAILABLE', label?: string): RoomGridSlot {
  return { startTime, endTime, status, label };
}

const afternoon = [
  slot('13:00', '14:00'),
  slot('14:00', '15:00'),
  slot('15:00', '16:00'),
  slot('16:00', '17:00'),
  slot('17:00', '18:00'),
];

describe('room slot span', () => {
  it('offers 3 h and 4 h when the following slots are free', () => {
    const options = roomSpanOptions(afternoon, '14:00');
    assert.deepEqual(
      options.map((option) => [option.minutes, option.endTime, option.available]),
      [
        [60, '15:00', true],
        [120, '16:00', true],
        [180, '17:00', true],
        [240, '18:00', true],
      ]
    );

    const span = explainRoomSpan(afternoon, '14:00', '17:00');
    assert.equal(span.ok, true);
    if (span.ok) {
      assert.deepEqual(
        span.option.slots.map((item) => item.startTime),
        ['14:00', '15:00', '16:00']
      );
    }
  });

  it('stops a longer duration on the first occupied slot', () => {
    const slots = [
      slot('14:00', '15:00'),
      slot('15:00', '16:00'),
      slot('16:00', '17:00', 'BUSY', 'Comité'),
      slot('17:00', '18:00'),
    ];
    const options = roomSpanOptions(slots, '14:00');
    assert.equal(options.find((option) => option.minutes === 120)?.available, true);
    assert.equal(options.find((option) => option.minutes === 180)?.available, false);
    assert.match(options.find((option) => option.minutes === 180)?.blockedReason ?? '', /16:00–17:00/);
    assert.match(options.find((option) => option.minutes === 180)?.blockedReason ?? '', /Comité/);

    const refused = explainRoomSpan(slots, '14:00', '17:00');
    assert.equal(refused.ok, false);
    const kept = explainRoomSpan(slots, '14:00', '16:00');
    assert.equal(kept.ok, true);
  });

  it('does not jump a gap between morning and afternoon slots', () => {
    const slots = [slot('10:00', '11:00'), slot('13:00', '14:00'), slot('14:00', '15:00')];
    const options = roomSpanOptions(slots, '10:00');
    assert.equal(options.length, 1);
    assert.equal(options[0]?.endTime, '11:00');
    assert.equal(explainRoomSpan(slots, '10:00', '14:00').ok, false);
  });

  it('accepts the whole day even when it exceeds 4 hours', () => {
    const day = [
      slot('08:00', '09:00'),
      slot('09:00', '10:00'),
      slot('10:00', '11:00'),
      slot('11:00', '12:00'),
      slot('12:00', '13:00'),
      slot('13:00', '14:00'),
    ];
    const full = roomFullDaySpan(day);
    assert.equal(full?.available, true);
    assert.equal(full?.startTime, '08:00');
    assert.equal(full?.endTime, '14:00');
    assert.equal(explainRoomSpan(day, '08:00', '14:00').ok, true);
    assert.equal(explainRoomSpan(day, '08:00', '13:00').ok, false);

    const busy = [...day];
    busy[2] = slot('10:00', '11:00', 'BUSY', 'Comité');
    assert.equal(roomFullDaySpan(busy)?.available, false);
    assert.equal(explainRoomSpan(busy, '08:00', '14:00').ok, false);
  });

  it('keeps a 3 h duration when the new start still has three free slots', () => {
    const moved = moveRoomSpanStart(afternoon, '13:00', '14:00', '17:00');
    assert.deepEqual(moved, { startTime: '13:00', endTime: '16:00' });
  });
});
