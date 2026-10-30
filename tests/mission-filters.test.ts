import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_MISSION_FILTERS,
  filterMissions,
  matchesMissionSearch,
} from '../lib/workspace/mission-filters';
import type { DgMission } from '../lib/workspace/types';

function mission(partial: Partial<DgMission>): DgMission {
  return {
    id: '1',
    subject: 'Conférence test',
    missionType: 'Conférence',
    destination: '+33 France',
    destinations: ['FR'],
    details: null,
    departAt: '2026-06-15T12:00:00.000Z',
    returnAt: '2026-06-18T12:00:00.000Z',
    initialReturnAt: '2026-06-18T12:00:00.000Z',
    participants: null,
    observations: null,
    status: 'PLANNED',
    operationalState: 'NORMAL',
    prolongationCount: 0,
    archived: false,
    archivedAt: null,
    documentCount: 0,
    hotelStatus: null,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    statusChangedAt: '2026-06-01T12:00:00.000Z',
    completedAt: null,
    cancelReason: null,
    cancelReasonDetail: null,
    closureReport: null,
    closureResults: null,
    closureRecommendations: null,
    closureComments: null,
    ...partial,
  };
}

describe('mission filters', () => {
  const items = [
    mission({ id: 'a', subject: 'Formation DGA', missionType: 'Formation', destinations: ['GN'] }),
    mission({
      id: 'b',
      subject: 'Séminaire',
      missionType: 'Séminaire',
      destinations: ['FR'],
      status: 'ONGOING',
      departAt: '2026-06-10T12:00:00.000Z',
      returnAt: '2026-06-12T12:00:00.000Z',
    }),
  ];

  it('searches across subject and type', () => {
    assert.equal(matchesMissionSearch(items[0]!, 'formation'), true);
    assert.equal(matchesMissionSearch(items[0]!, 'séminaire'), false);
  });

  it('filters by mission type', () => {
    const filtered = filterMissions(items, { ...EMPTY_MISSION_FILTERS, missionType: 'Formation' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, 'a');
  });

  it('filters by destination code', () => {
    const filtered = filterMissions(items, { ...EMPTY_MISSION_FILTERS, destination: 'FR' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, 'b');
  });

  it('filters by depart date range', () => {
    const filtered = filterMissions(items, {
      ...EMPTY_MISSION_FILTERS,
      departFrom: '2026-06-14',
      departTo: '2026-06-20',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, 'a');
  });
});
