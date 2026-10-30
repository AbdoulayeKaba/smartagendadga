import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeApprovalSlotBlock } from '@/lib/dg/approval-slot-guard';
import { buildDgDaySheetRows } from '@/lib/dg/day-sheet';
import { isMissionBlockingApproval } from '@/lib/workspace/mission-visual-state';

describe('approval slot guard', () => {
  const startAt = new Date('2026-09-29T09:00:00Z');
  const endAt = new Date('2026-09-29T10:00:00Z');

  it('blocks a slot already taken by another approved meeting', () => {
    const message = describeApprovalSlotBlock({
      startAt,
      endAt,
      dateKey: '2026-09-29',
      appointments: [
        {
          id: 'other',
          title: 'Réunion budget',
          startAt: new Date('2026-09-29T09:30:00Z'),
          endAt: new Date('2026-09-29T10:30:00Z'),
        },
      ],
      blockedRanges: [],
    });
    assert.match(message ?? '', /n’est plus libre/);
    assert.match(message ?? '', /Réunion budget/);
  });

  it('does not block a slot that falls on a mission', () => {
    const message = describeApprovalSlotBlock({
      startAt,
      endAt,
      dateKey: '2026-09-29',
      appointments: [],
      blockedRanges: [
        {
          startDate: '2026-09-28',
          endDate: '2026-09-30',
          source: 'mission',
          label: 'Conakry',
        },
      ],
    });
    assert.equal(message, null);
  });

  it('blocks a slot that falls on an unavailability', () => {
    const message = describeApprovalSlotBlock({
      startAt,
      endAt,
      dateKey: '2026-09-29',
      appointments: [],
      blockedRanges: [
        {
          startDate: '2026-09-29',
          endDate: '2026-09-29',
          source: 'unavailability',
          label: 'Congé',
        },
      ],
    });
    assert.match(message ?? '', /indisponibilité/i);
    assert.match(message ?? '', /Congé/);
  });

  it('lets the assistant approve while the mission is not ongoing', () => {
    const now = new Date(2026, 9, 19, 18, 3, 0);
    const mission = {
      status: 'PLANNED' as const,
      departAt: new Date(2026, 9, 19, 0, 0, 0),
      returnAt: new Date(2026, 9, 22, 0, 0, 0),
    };
    assert.equal(isMissionBlockingApproval(mission, now), false);
    assert.equal(
      isMissionBlockingApproval(
        { ...mission, status: 'ONGOING' },
        new Date(2026, 9, 20, 10, 0, 0)
      ),
      true
    );
    assert.equal(
      isMissionBlockingApproval(mission, new Date(2026, 9, 19, 22, 59, 0)),
      true
    );
  });

  it('leaves a free slot open', () => {
    const message = describeApprovalSlotBlock({
      startAt,
      endAt,
      dateKey: '2026-09-29',
      appointments: [
        {
          id: 'later',
          title: 'Après-midi',
          startAt: new Date('2026-09-29T14:00:00Z'),
          endAt: new Date('2026-09-29T15:00:00Z'),
        },
      ],
      blockedRanges: [],
    });
    assert.equal(message, null);
  });
});

describe('day sheet rows', () => {
  it('lists time, requester, Teams and room', () => {
    const rows = buildDgDaySheetRows([
      {
        id: 'a',
        title: 'Point cabinet',
        startAt: new Date('2026-09-29T08:00:00Z'),
        endAt: new Date('2026-09-29T09:00:00Z'),
        location: 'En ligne (Teams)',
        isOnlineMeeting: true,
        description: '<!--APPT_META:{"urgencyLevel":"NORMAL","preContact":[],"roomName":"Salle 12"}-->',
        requestedBy: { firstName: 'Awa', lastName: 'Diallo' },
      },
    ]);
    assert.equal(rows[0]?.title, 'Point cabinet');
    assert.equal(rows[0]?.requester, 'Awa Diallo');
    assert.equal(rows[0]?.place, 'Microsoft Teams');
    assert.equal(rows[0]?.room, 'Salle 12');
    assert.match(rows[0]?.time ?? '', /–/);
  });
});
