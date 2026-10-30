import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOG } from '@/lib/dg/permission-catalog';
import { expandMenuPermissions } from '@/lib/dg/expand-menu-permissions';
import {
  buildMenuPermissionUpdates,
  enforceMenuActionDependencies,
  mergePermissionUpdates,
} from '@/lib/dg/permission-menu-deps';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { homePathForRole } from '@/lib/auth/post-login-redirect';

test('catalog contains menu and action permissions', () => {
  assert.equal(PERMISSION_CATALOG.length, 72);
  assert.ok(PERMISSION_CATALOG.every((p) => p.id.startsWith('menu.') || p.id.startsWith('action.')));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'menu.my_appointments'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'menu.my_room_reservations'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'menu.admin.users'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.appointments.approve'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.appointments.archive'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.contacts.history'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.contacts.edit'));
  assert.equal(PERMISSION_CATALOG.some((p) => p.id === 'menu.missions'), false);
  assert.equal(PERMISSION_CATALOG.some((p) => p.id.startsWith('action.missions.')), false);
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.documents.view'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.documents.export'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.room_reservations.approve'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.room_reservations.cancel'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.users.view'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.users.toggle_active'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.referentials.schedule'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.referentials.trash'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.settings.general'));
  assert.ok(PERMISSION_CATALOG.some((p) => p.id === 'action.settings.integrations'));
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.documents.view'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.documents.create'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.room_reservations.approve'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.users.view'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.referentials.schedule'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['action.settings.general'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.MANAGER['menu.room_slots'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.MANAGER['action.room_reservations.approve'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EXTERNAL['menu.room_slots'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EXTERNAL['menu.my_room_reservations'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['action.appointments.edit'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['action.users.edit'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['action.referentials.holidays'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['action.settings.security'], true);
});

test('MANAGER can request appointments but not review them', () => {
  const perms = expandMenuPermissions(DEFAULT_ROLE_PERMISSIONS.MANAGER);
  assert.equal(perms['appointments.request'], false);
  assert.equal(perms['appointments.view_own'], true);
  assert.equal(perms['appointments.own.detail'], true);
  assert.equal(perms['appointments.own.edit'], true);
  assert.equal(perms['appointments.own.delete'], false);
  assert.equal(perms['calendar.view'], false);
  assert.equal(perms['appointments.review'], false);
  assert.equal(perms['admin.platform'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.MANAGER['menu.plan'], false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.MANAGER['menu.appointments_list'], false);
});

test('ASSISTANT has full admin and review permissions', () => {
  const perms = expandMenuPermissions(DEFAULT_ROLE_PERMISSIONS.ASSISTANT);
  assert.equal(perms['admin.platform'], true);
  assert.equal(perms['admin.users.create'], true);
  assert.equal(perms['appointments.review'], true);
  assert.equal(perms['appointments.view_own'], true);
  assert.equal(perms['workspace.manage'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['menu.admin.users'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.ASSISTANT['menu.admin.roles'], true);
});

test('DG can review but not administer users', () => {
  const perms = expandMenuPermissions(DEFAULT_ROLE_PERMISSIONS.DG);
  assert.equal(perms['appointments.review'], true);
  assert.equal(perms['appointments.view_own'], true);
  assert.equal(perms['admin.users.create'], false);
  assert.equal(perms['dashboard.dg'], true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.DG['menu.admin.users'], false);
});

test('permissionsForRole returns human labels for MANAGER', () => {
  const labels = permissionsForRole('MANAGER');
  assert.equal(labels.includes('Planifier un RDV'), false);
  assert.equal(labels.includes('Créneaux salles'), false);
  assert.equal(labels.includes('Liste des rendez-vous'), false);
  assert.equal(labels.includes('Suivre ses demandes'), false);
});

test('post-login redirect matches role', () => {
  assert.equal(homePathForRole('ASSISTANT'), '/dg/assistant');
  assert.equal(homePathForRole('DG'), '/dg/dashboard');
  assert.equal(homePathForRole('MANAGER'), '/appointments/board');
  assert.equal(homePathForRole('EXTERNAL'), '/appointments/board');
});

test('disabling a menu cascades to its actions', () => {
  const base = { ...DEFAULT_ROLE_PERMISSIONS.ASSISTANT };
  const updates = buildMenuPermissionUpdates(base, 'menu.appointments_list', false);
  const merged = mergePermissionUpdates(base, updates);
  assert.equal(merged['menu.appointments_list'], false);
  assert.equal(merged['action.appointments.approve'], false);
  assert.equal(merged['action.appointments.reject'], false);
});

test('agenda stays available when another room menu remains active', () => {
  const base = {
    ...DEFAULT_ROLE_PERMISSIONS.MANAGER,
    'menu.room_slots': true,
    'menu.room_reservations': true,
    'action.room_reservations.agenda': true,
  };
  const updates = buildMenuPermissionUpdates(base, 'menu.room_reservations', false);
  const merged = mergePermissionUpdates(base, updates);
  assert.equal(merged['menu.room_reservations'], false);
  assert.equal(merged['action.room_reservations.agenda'], true);
});

test('enforceMenuActionDependencies clears orphan actions', () => {
  const merged = enforceMenuActionDependencies({
    'menu.contacts': false,
    'action.contacts.edit': true,
  });
  assert.equal(merged['action.contacts.edit'], false);
});
