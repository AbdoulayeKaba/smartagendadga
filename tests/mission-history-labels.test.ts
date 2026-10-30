import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  missionHistoryActionLabel,
  missionHistoryDetail,
} from '../lib/workspace/mission-history-labels';
import type { DgMissionHistoryEntry } from '../lib/workspace/types';

function entry(partial: Partial<DgMissionHistoryEntry>): DgMissionHistoryEntry {
  return {
    id: '1',
    missionId: 'm1',
    userId: 'u1',
    userName: 'Marie Diallo',
    action: 'update',
    fieldName: null,
    oldValue: null,
    newValue: null,
    detail: null,
    createdAt: '2026-06-11T14:00:00.000Z',
    ...partial,
  };
}

describe('mission history labels', () => {
  it('labels creation and hotel actions', () => {
    assert.equal(missionHistoryActionLabel(entry({ action: 'create' })), 'Création');
    assert.equal(
      missionHistoryActionLabel(entry({ action: 'hotel.create' })),
      'Réservation hôtel'
    );
    assert.equal(
      missionHistoryActionLabel(entry({ action: 'hotel.delete' })),
      'Suppression réservation hôtel'
    );
    assert.equal(missionHistoryActionLabel(entry({ action: 'archive' })), 'Mise en corbeille');
  });

  it('formats status transitions in French', () => {
    const detail = missionHistoryDetail(
      entry({
        action: 'status.change',
        fieldName: 'status',
        oldValue: 'PLANNED',
        newValue: 'ONGOING',
      })
    );
    assert.equal(detail, 'Planifiée → En cours');
  });

  it('shows hotel detail when provided', () => {
    const detail = missionHistoryDetail(
      entry({
        action: 'hotel.create',
        detail: 'Hilton — Paris (Réservé)',
      })
    );
    assert.equal(detail, 'Hilton — Paris (Réservé)');
  });
});
