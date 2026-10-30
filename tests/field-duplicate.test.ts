import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findEmailConflict, findRoleLabelConflict } from '@/lib/form/field-duplicate';

describe('field-duplicate', () => {
  it('détecte les emails en doublon', () => {
    const users = [{ id: 'u1', email: 'test@org.local' }];
    assert.equal(findEmailConflict(users, 'test@org.local')?.id, 'u1');
    assert.equal(findEmailConflict(users, '  TEST@org.local  ')?.id, 'u1');
    assert.equal(findEmailConflict(users, 'test@org.local', 'u1'), undefined);
    assert.equal(findEmailConflict(users, 'autre@org.local'), undefined);
  });

  it('détecte les noms de rôle en doublon', () => {
    const roles = [
      { id: 'r1', label: 'Manager' },
      { id: 'r2', label: 'Autre' },
    ];
    assert.equal(findRoleLabelConflict(roles, 'manager')?.id, 'r1');
    assert.equal(findRoleLabelConflict(roles, 'Manager', 'r1'), undefined);
    assert.equal(findRoleLabelConflict(roles, 'Nouveau'), undefined);
  });
});
