import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSlotTimeline,
  ensureRequestedSlot,
  isRequestedSlotDifferent,
  parseAppointmentMeta,
  preserveTracedSlot,
  readPreRescheduleSlot,
  traceSlotBeforeReschedule,
} from '../lib/dg/appointment-request-meta';

const initialStart = new Date('2026-09-29T11:45:00.000Z');
const initialEnd = new Date('2026-09-29T12:00:00.000Z');
const keptStart = new Date('2026-09-29T12:00:00.000Z');
const keptEnd = new Date('2026-09-29T13:00:00.000Z');

test('requested slot is kept when the meeting is moved', () => {
  const created = ensureRequestedSlot('<!--APPT_META:{"urgencyLevel":"URGENT","preContact":[]}-->', {
    startAt: initialStart,
    endAt: initialEnd,
  });
  const moved = ensureRequestedSlot(created, { startAt: keptStart, endAt: keptEnd });
  const { meta } = parseAppointmentMeta(moved);
  assert.equal(meta.requestedStartAt, initialStart.toISOString());
  assert.equal(meta.requestedEndAt, initialEnd.toISOString());
  assert.equal(isRequestedSlotDifferent(keptStart, keptEnd, meta), true);
  assert.equal(isRequestedSlotDifferent(initialStart, initialEnd, meta), false);
});

test('start time is traced once, before the assistant reschedules', () => {
  const before = ensureRequestedSlot(null, { startAt: initialStart, endAt: initialEnd });
  const traced = traceSlotBeforeReschedule(before, { startAt: initialStart, endAt: initialEnd });
  const again = traceSlotBeforeReschedule(traced, { startAt: keptStart, endAt: keptEnd });
  const slot = readPreRescheduleSlot(parseAppointmentMeta(again).meta);
  assert.equal(slot?.startAt.toISOString(), initialStart.toISOString());
  const rebuilt = preserveTracedSlot('<!--APPT_META:{"urgencyLevel":"URGENT","preContact":[]}-->', again);
  assert.equal(parseAppointmentMeta(rebuilt).meta.preRescheduleStartAt, initialStart.toISOString());
  assert.equal(parseAppointmentMeta(rebuilt).meta.slotHistory?.length, 2);
});

test('slot timeline keeps every full change, then the current slot', () => {
  const laterStart = new Date('2026-10-02T08:00:00.000Z');
  const laterEnd = new Date('2026-10-02T09:00:00.000Z');
  const created = ensureRequestedSlot(null, { startAt: initialStart, endAt: initialEnd });
  const firstMove = traceSlotBeforeReschedule(created, { startAt: initialStart, endAt: initialEnd });
  const secondMove = traceSlotBeforeReschedule(firstMove, { startAt: keptStart, endAt: keptEnd });
  const timeline = buildSlotTimeline({
    description: secondMove,
    currentStart: laterStart,
    currentEnd: laterEnd,
    recorded: [
      { startAt: keptStart.toISOString(), endAt: keptEnd.toISOString() },
      { startAt: laterStart.toISOString(), endAt: laterEnd.toISOString() },
    ],
  });
  assert.deepEqual(
    timeline.map((slot) => slot.startAt),
    [initialStart.toISOString(), keptStart.toISOString(), laterStart.toISOString()]
  );
  assert.equal(timeline[0]?.endAt, initialEnd.toISOString());
  assert.equal(timeline[1]?.endAt, keptEnd.toISOString());
  assert.equal(timeline[2]?.endAt, laterEnd.toISOString());
});
