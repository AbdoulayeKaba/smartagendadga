import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSchedulingBlockedRanges,
  findSchedulingBlockedRange,
  isPlanningDateBlocked,
  normalizeSchedulingContext,
  validatePlanningDate,
  type AppointmentSchedulingContext,
} from '@/lib/dg/appointment-scheduling-context';

const baseCtx: AppointmentSchedulingContext = normalizeSchedulingContext({
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  allowWeekendAppointments: false,
  holidays: [],
  blockedRanges: [],
});

describe('planning date blocked by missions and unavailabilities', () => {
  it('construit les plages missions et congés', () => {
    const ranges = buildSchedulingBlockedRanges({
      unavailabilities: [
        {
          kind: 'unavailability',
          type: 'conge',
          startDate: '2026-08-10',
          endDate: '2026-08-20',
          startTime: '00:00',
          endTime: '23:59',
          motif: 'Congé annuel',
          confidentialityLevel: 'standard',
          active: true,
        },
      ],
      now: new Date('2026-07-29T12:00:00'),
      missions: [
        {
          departAt: '2026-07-28T08:00:00',
          returnAt: '2026-07-31T18:00:00',
          status: 'ONGOING',
          subject: 'Mission Dakar',
        },
        {
          departAt: '2026-09-01T08:00:00',
          returnAt: '2026-09-05T18:00:00',
          status: 'CANCELLED',
          subject: 'Annulée',
        },
      ],
    });

    assert.equal(ranges.length, 2);
    assert.equal(ranges[0]?.source, 'unavailability');
    assert.equal(ranges[1]?.source, 'mission');
    assert.equal(ranges[1]?.startDate, '2026-07-28');
    assert.equal(ranges[1]?.endDate, '2026-07-31');
  });

  it('grise les dates de mission et de congé dans le calendrier', () => {
    const ctx = normalizeSchedulingContext({
      ...baseCtx,
      blockedRanges: buildSchedulingBlockedRanges({
        unavailabilities: [
          {
            kind: 'unavailability',
            type: 'conge',
            startDate: '2026-08-10',
            endDate: '2026-08-12',
            startTime: '00:00',
            endTime: '23:59',
            motif: 'Congé annuel',
            confidentialityLevel: 'standard',
            active: true,
          },
        ],
        missions: [
          {
            departAt: new Date('2026-07-30T09:00:00'),
            returnAt: new Date('2026-07-30T18:00:00'),
            status: 'PLANNED',
            subject: 'Mission',
          },
        ],
      }),
    });

    assert.equal(isPlanningDateBlocked(ctx, '2026-07-30'), false);
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-11'), true);
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-13'), false);

    const now = new Date(2026, 9, 19, 18, 32, 0);
    const mission = {
      departAt: new Date(2026, 9, 19, 8, 0, 0),
      returnAt: new Date(2026, 9, 22, 18, 0, 0),
      subject: 'Sommet regional',
    };
    const planned = buildSchedulingBlockedRanges({
      unavailabilities: [],
      now,
      missions: [{ ...mission, status: 'PLANNED' }],
    });
    assert.equal(findSchedulingBlockedRange('2026-10-19', planned), null);
    assert.equal(findSchedulingBlockedRange('2026-10-20', planned), null);
    const ongoing = buildSchedulingBlockedRanges({
      unavailabilities: [],
      now,
      missions: [{ ...mission, status: 'ONGOING' }],
    });
    assert.equal(findSchedulingBlockedRange('2026-10-19', ongoing)?.source, 'mission');
    assert.equal(findSchedulingBlockedRange('2026-10-22', ongoing)?.source, 'mission');
    assert.equal(findSchedulingBlockedRange('2026-10-23', ongoing), null);
    assert.equal(validatePlanningDate(ctx, '2026-07-30'), null);
    assert.match(validatePlanningDate(ctx, '2026-08-11') ?? '', /indisponible|Congé/i);
    assert.equal(findSchedulingBlockedRange('2026-08-11', ctx.blockedRanges)?.source, 'unavailability');
  });

  it('conserve le blocage week-end / férié', () => {
    const ctx = normalizeSchedulingContext({
      ...baseCtx,
      holidays: [{ date: '2026-08-15', annualRepeat: true, active: true, type: 'national' }],
    });
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-01'), true); // samedi
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-15'), true);
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-14'), false);
  });

  it('ouvre toutes les dates pour un RDV en ligne (Teams)', () => {
    const ctx = normalizeSchedulingContext({
      ...baseCtx,
      holidays: [{ date: '2026-08-15', annualRepeat: true, active: true, type: 'national' }],
      blockedRanges: [
        {
          startDate: '2026-07-28',
          endDate: '2026-07-31',
          source: 'mission',
          label: 'Mission Dakar',
        },
      ],
    });
    const online = { isOnlineMeeting: true };
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-01', online), false); // samedi
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-15', online), false); // férié
    assert.equal(isPlanningDateBlocked(ctx, '2026-07-30', online), false); // mission
    assert.equal(isPlanningDateBlocked(ctx, '2026-07-30'), false);
    assert.equal(validatePlanningDate(ctx, '2026-07-30'), null);
    assert.equal(validatePlanningDate(ctx, '2026-08-01', online), null);
  });

  it('bloque le présentiel mais autorise le en ligne sur mission / congé / férié', () => {
    const ctx = normalizeSchedulingContext({
      ...baseCtx,
      holidays: [{ date: '2026-08-15', annualRepeat: true, active: true, type: 'national' }],
      blockedRanges: [
        {
          startDate: '2026-08-10',
          endDate: '2026-08-12',
          source: 'unavailability',
          label: 'Congé annuel',
        },
      ],
    });
    const presentiel = { isOnlineMeeting: false };
    const online = { isOnlineMeeting: true };

    assert.equal(isPlanningDateBlocked(ctx, '2026-08-11', presentiel), true);
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-15', presentiel), true);
    assert.match(validatePlanningDate(ctx, '2026-08-11', presentiel) ?? '', /indisponible|Congé/i);

    assert.equal(isPlanningDateBlocked(ctx, '2026-08-11', online), false);
    assert.equal(isPlanningDateBlocked(ctx, '2026-08-15', online), false);
    assert.equal(validatePlanningDate(ctx, '2026-08-11', online), null);
  });
});
