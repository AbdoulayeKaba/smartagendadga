import assert from 'node:assert/strict';
import test from 'node:test';
import { purgeTrashedRole, sanitizePurgedRoleIds } from '../lib/dg/role-trash';

function record() {
  return {
    archived: ['MANAGER', 'EXTERNAL', 'custom_abc'],
    purged: [] as ('MANAGER' | 'EXTERNAL' | 'DG' | 'ASSISTANT')[],
    permissions: {
      MANAGER: { 'menu.plan': true },
      custom_abc: { 'menu.plan': false },
    },
    descriptions: { MANAGER: 'Manager interne' },
    labels: { EXTERNAL: 'Utilisateur externe' },
    customRoles: [{ id: 'custom_abc' }],
  };
}

test('vider la corbeille masque les rôles système au lieu de les restaurer', () => {
  const state = record();
  assert.equal(purgeTrashedRole(state, 'MANAGER'), 'purged');
  assert.equal(purgeTrashedRole(state, 'EXTERNAL'), 'purged');
  assert.deepEqual(state.archived, ['custom_abc']);
  assert.deepEqual(state.purged, ['MANAGER', 'EXTERNAL']);
  assert.equal(state.descriptions.MANAGER, undefined);
  assert.equal(state.labels.EXTERNAL, undefined);
  assert.equal(state.permissions.MANAGER['menu.plan'], true);
});

test('un rôle personnalisé est supprimé et ne revient pas', () => {
  const state = record();
  assert.equal(purgeTrashedRole(state, 'custom_abc'), 'purged');
  assert.deepEqual(state.customRoles, []);
  assert.equal(state.permissions.custom_abc, undefined);
  assert.equal(state.archived.includes('custom_abc'), false);
});

test('le rôle assistant reste protégé', () => {
  const state = record();
  state.archived.push('ASSISTANT');
  assert.equal(purgeTrashedRole(state, 'ASSISTANT'), 'protected');
  assert.equal(state.archived.includes('ASSISTANT'), true);
  assert.equal(state.purged.includes('ASSISTANT'), false);
});

test('sanitize ignore les identifiants inconnus et l’assistant', () => {
  assert.deepEqual(sanitizePurgedRoleIds(['MANAGER', 'ASSISTANT', 'nope', 'MANAGER']), ['MANAGER']);
});
