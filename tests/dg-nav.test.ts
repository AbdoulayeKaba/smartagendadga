import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/dg/permission-catalog';
import {
  expandMenuPermissions,
  normalizeToMenuPermissions,
  resolveEffectivePermissionMap,
} from '@/lib/dg/expand-menu-permissions';
import { DG_NAV_SECTIONS, filterDgNav } from '@/lib/layout/dg-nav';
import { DG_ROOM_MY_RESERVATIONS_LINK_LABEL } from '@/lib/dg/meeting-room-config';

function navLabels(role: 'ASSISTANT' | 'DG' | 'MANAGER' | 'EXTERNAL') {
  const permissions = resolveEffectivePermissionMap(DEFAULT_ROLE_PERMISSIONS[role]);
  return filterDgNav(DG_NAV_SECTIONS, role, permissions).flatMap((section) =>
    section.items.map((item) => item.label)
  );
}

test('ASSISTANT sees the three operational pillars and administration', () => {
  const labels = navLabels('ASSISTANT');
  assert.ok(labels.includes('Tableau de bord'));
  assert.ok(labels.includes('Espace assistante'));
  assert.equal(labels.includes('Mes demandes RDV'), false);
  assert.equal(labels.includes(DG_ROOM_MY_RESERVATIONS_LINK_LABEL), false);
  assert.ok(labels.includes('Liste des rendez-vous'));
  assert.ok(labels.includes('Planifier un RDV'));
  assert.ok(labels.includes('Historique RDV'));
  assert.ok(labels.includes("Lecture de la semaine"));
  assert.ok(labels.includes('Notifications'));
  assert.equal(labels.includes('Contacts stratégiques'), false);
  assert.ok(labels.includes('Utilisateurs'));
  assert.equal(labels.includes('Courriers départ'), false);
  assert.equal(labels.includes('Contacts'), false);
  assert.equal(labels.includes('Missions'), false);
  assert.equal(labels.includes('Compte rendu'), false);
  assert.equal(labels.includes('Analyse comparative'), false);
});

test('DG sees the review menu without personal lists or Administration', () => {
  const labels = navLabels('DG');
  assert.ok(labels.includes('Liste des rendez-vous'));
  assert.ok(labels.includes("Lecture de la semaine"));
  assert.equal(labels.includes('Contacts stratégiques'), false);
  assert.equal(labels.includes('Mes demandes RDV'), false);
  assert.equal(labels.includes(DG_ROOM_MY_RESERVATIONS_LINK_LABEL), false);
  assert.equal(labels.includes('Utilisateurs'), false);
});

test('MANAGER can plan without a personal requests menu', () => {
  const labels = navLabels('MANAGER');
  assert.equal(labels.includes('Mes demandes RDV'), false);
  assert.equal(labels.includes(DG_ROOM_MY_RESERVATIONS_LINK_LABEL), false);
  assert.equal(labels.includes('Planifier un RDV'), false);
  assert.equal(labels.includes('Contacts stratégiques'), false);
  assert.equal(labels.includes("Lecture de la semaine"), false);
  assert.equal(labels.includes('Liste des rendez-vous'), false);
  assert.equal(labels.includes('Espace assistante'), false);
});

test('MANAGER with review list sees the cabinet list only', () => {
  const permissions = resolveEffectivePermissionMap({
    ...DEFAULT_ROLE_PERMISSIONS.MANAGER,
    'menu.appointments_list': true,
  });
  const labels = filterDgNav(DG_NAV_SECTIONS, 'MANAGER', permissions).flatMap((section) =>
    section.items.map((item) => item.label)
  );
  assert.equal(labels.includes('Mes demandes RDV'), false);
  assert.ok(labels.includes('Liste des rendez-vous'));
});

test('legacy technical permissions migrate to menu permissions', () => {
  const menu = normalizeToMenuPermissions({
    'appointments.review': true,
    'appointments.request': true,
    'workspace.read': true,
    'admin.users.read': true,
    'admin.roles.manage': true,
    'admin.settings': true,
    'audit.read': true,
    'dashboard.dg': true,
  });
  assert.equal(menu['menu.appointments_list'], true);
  assert.equal(menu['menu.plan'], true);
  assert.equal(menu['menu.admin.users'], true);
  assert.equal(menu['menu.admin.roles'], true);
  assert.equal(menu['menu.admin.settings'], true);
  assert.equal(menu['menu.admin.audit'], true);
  assert.equal(menu['menu.dashboard'], true);
});

test('legacy menu.admin expands to all admin submenus', () => {
  const menu = normalizeToMenuPermissions({ 'menu.admin': true });
  assert.equal(menu['menu.admin.users'], true);
  assert.equal(menu['menu.admin.roles'], true);
  assert.equal(menu['menu.admin.referentials'], true);
  assert.equal(menu['menu.admin.settings'], true);
  assert.equal(menu['menu.admin.audit'], true);
});

test('expandMenuPermissions grants API capabilities', () => {
  const expanded = expandMenuPermissions(DEFAULT_ROLE_PERMISSIONS.ASSISTANT);
  assert.equal(expanded['appointments.review'], true);
  assert.equal(expanded['admin.platform'], true);
  assert.equal(expanded['workspace.documents'], true);
  assert.equal(expanded['appointments.view_own'], true);
});

test('EXTERNAL sees own notifications and history without the review list', () => {
  const permissions = resolveEffectivePermissionMap(DEFAULT_ROLE_PERMISSIONS.EXTERNAL);
  const labels = navLabels('EXTERNAL');
  assert.ok(labels.includes('Notifications'));
  assert.ok(labels.includes('Historique RDV'));
  assert.equal(labels.includes('Mes demandes RDV'), false);
  assert.equal(labels.includes('Liste des rendez-vous'), false);
  assert.equal(labels.includes('Contacts stratégiques'), false);
  assert.equal(labels.includes("Lecture de la semaine"), false);
  assert.equal(permissions['appointments.review'], false);
  assert.equal(permissions['menu.notifications'], true);
  assert.equal(permissions['menu.history'], true);
  assert.equal(permissions['menu.room_slots'], false);
  assert.equal(permissions['menu.my_room_reservations'], false);
  assert.equal(permissions['menu.room_reservations'], false);
  assert.equal(permissions['action.room_reservations.cancel'], false);
  assert.equal(permissions['action.room_reservations.approve'], false);
});

test('demandeur expansion grants view_own without review', () => {
  const expanded = expandMenuPermissions(DEFAULT_ROLE_PERMISSIONS.MANAGER);
  assert.equal(expanded['appointments.request'], false);
  assert.equal(expanded['appointments.view_own'], true);
  assert.equal(expanded['appointments.review'], false);
  assert.equal(expanded['admin.platform'], false);
});

test('granular admin menus gate sidebar items independently', () => {
  const permissions = resolveEffectivePermissionMap({
    'menu.admin.users': true,
    'menu.admin.audit': false,
    'menu.admin.roles': false,
    'menu.admin.referentials': false,
    'menu.admin.settings': false,
  });
  const labels = filterDgNav(DG_NAV_SECTIONS, 'ASSISTANT', permissions).flatMap((section) =>
    section.items.map((item) => item.label)
  );
  assert.ok(labels.includes('Utilisateurs'));
  assert.equal(labels.includes("Journal d'audit"), false);
});
