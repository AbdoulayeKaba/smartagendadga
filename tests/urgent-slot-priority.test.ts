import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  effectiveUrgencyLevel,
  planningUrgentSortScore,
} from '@/lib/dg/urgent-slot-priority';
import { buildUrgentSlotSyncResult } from '@/lib/services/appointment-urgent-priority';

describe('urgent slot priority', () => {
  it('elevates urgency when planning urgent override is on', () => {
    assert.equal(effectiveUrgencyLevel('NORMAL', true), 'TRES_URGENT');
    assert.equal(effectiveUrgencyLevel('URGENT', true), 'TRES_URGENT');
    assert.equal(effectiveUrgencyLevel('CRITIQUE', true), 'CRITIQUE');
    assert.equal(effectiveUrgencyLevel('NORMAL', false), 'NORMAL');
  });

  it('sorts pending planning urgent items ahead of others', () => {
    const normal = planningUrgentSortScore({
      status: 'PENDING',
      urgentOverride: false,
      urgencyLevel: 'NORMAL',
      businessScore: 100,
    });
    const planningUrgent = planningUrgentSortScore({
      status: 'PENDING',
      urgentOverride: true,
      urgencyLevel: 'TRES_URGENT',
      businessScore: 10,
    });
    assert.ok(planningUrgent > normal);
  });

  it('embeds planning priority meta and sets HIGH priority for pending urgent', () => {
    const result = buildUrgentSlotSyncResult({
      description: 'Demande importante',
      status: 'PENDING',
      title: 'RDV ministre',
      urgentOverride: true,
    });
    assert.equal(result.priority, 'HIGH');
    assert.match(result.description ?? '', /planningPriority/);
  });
});
