import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMissionDuplicate,
  isMissionDuplicateOf,
  isMissionSubjectConflict,
  normalizeMissionSubject,
} from '../lib/workspace/mission-duplicate';

describe('mission duplicate detection', () => {
  it('normalizes subject for comparison', () => {
    assert.equal(
      normalizeMissionSubject('  Formation   EMSP  '),
      normalizeMissionSubject('formation emsp')
    );
  });

  it('detects same objet regardless of type or dates', () => {
    const existing = {
      id: 'mis-1',
      archived: false,
      subject: 'test',
    };
    assert.equal(isMissionDuplicateOf({ subject: 'test' }, existing), true);
    assert.equal(isMissionDuplicateOf({ subject: '  TEST  ' }, existing), true);
  });

  it('ignores archived missions', () => {
    const existing = {
      id: 'mis-2',
      archived: true,
      subject: 'test',
    };
    assert.equal(isMissionDuplicateOf({ subject: 'test' }, existing), false);
  });

  it('ignores cancelled and completed missions', () => {
    assert.equal(
      isMissionDuplicateOf({ subject: 'test' }, { id: 'a', archived: false, status: 'CANCELLED', subject: 'test' }),
      false
    );
    assert.equal(
      isMissionDuplicateOf({ subject: 'test' }, { id: 'b', archived: false, status: 'COMPLETED', subject: 'test' }),
      false
    );
    assert.equal(
      isMissionSubjectConflict({ id: 'c', archived: false, status: 'ONGOING', subject: 'test' }),
      true
    );
  });

  it('ignores the mission being edited', () => {
    const existing = {
      id: 'mis-3',
      archived: false,
      subject: 'test',
    };
    assert.equal(isMissionDuplicateOf({ subject: 'test' }, existing, { excludeId: 'mis-3' }), false);
  });

  it('ignores different objet', () => {
    const existing = {
      id: 'mis-4',
      archived: false,
      subject: 'Autre objet',
    };
    assert.equal(isMissionDuplicateOf({ subject: 'test' }, existing), false);
  });

  it('finds duplicate in a list', () => {
    const duplicate = findMissionDuplicate({ subject: 'Formation EMSP' }, [
      { id: 'mis-5', archived: false, subject: 'Mission A' },
      { id: 'mis-6', archived: false, subject: 'Formation EMSP' },
    ]);
    assert.equal(duplicate?.id, 'mis-6');
  });
});
