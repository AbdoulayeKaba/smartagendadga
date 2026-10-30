import type { AuditJournalEntry } from '@/lib/dg/audit-journal';
import {
  buildAuditDescription,
  normalizeDgAuditRow,
  resolveActionCategory,
  resolveActionLabel,
} from '@/lib/dg/audit-journal';
import type { DgRole } from '@/lib/dg/rbac';
import { dgRoleLabel } from '@/lib/dg/role-labels';
import { mockFindUserById, mockListUsers } from '@/lib/mock/users-store';

let seq = 1;
const entries: AuditJournalEntry[] = [];

function randomIp() {
  return `172.${Math.floor(Math.random() * 32)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function pushEntry(input: {
  userId: string;
  actionCode: string;
  hoursAgo: number;
  target?: string;
  comments?: string[];
  ip?: string;
  resourceType?: string;
}) {
  const user = mockFindUserById(input.userId);
  if (!user) return;
  const createdAt = new Date(Date.now() - input.hoursAgo * 60 * 60 * 1000);
  const actionLabel = resolveActionLabel(input.actionCode);
  const category = resolveActionCategory(input.actionCode);
  const row = normalizeDgAuditRow({
    id: `audit-${seq++}`,
    createdAt,
    userId: user.id,
    action: input.actionCode,
    meta: {
      email: input.target,
      target: input.target,
      ip: input.ip ?? randomIp(),
      comment: input.comments?.[0],
      otp: input.actionCode.includes('login'),
      resource: input.resourceType,
    },
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
  if (input.comments?.length) row.comments = input.comments;
  if (input.resourceType) {
    row.resourceType = input.resourceType;
    row.resourceLabel = input.target ?? row.resourceLabel;
  }
  row.description = buildAuditDescription(
    { firstName: user.firstName, lastName: user.lastName },
    actionLabel,
    input.target
  );
  entries.push(row);
}

export function seedAuditJournalMock() {
  if (entries.length > 0) return;

  const users = mockListUsers();
  const primary = users[0];
  const assistant = users.find((u) => u.role === 'ASSISTANT') ?? users[0];
  const manager = users.find((u) => u.role === 'MANAGER') ?? users[0];

  const targets = [
    'kabaa222@gmail.com',
    'dg@organisation.local',
    'assistante@organisation.local',
    'manager@organisation.local',
    'externe@partenaire.local',
  ];

  for (let i = 0; i < 44; i++) {
    pushEntry({
      userId: i % 3 === 0 ? primary.id : i % 3 === 1 ? assistant.id : manager.id,
      actionCode: 'auth.login',
      hoursAgo: Math.random() * 48,
      target: targets[i % targets.length],
      comments: ['Connexion validée par OTP', `Cible : ${targets[i % targets.length]}`],
      resourceType: 'User',
    });
  }

  for (let i = 0; i < 52; i++) {
    pushEntry({
      userId: assistant.id,
      actionCode: 'admin.settings.update',
      hoursAgo: Math.random() * 120,
      target: 'platform_settings',
      comments: ['Modification des paramètres système'],
      resourceType: 'Platform',
    });
  }

  for (let i = 0; i < 51; i++) {
    pushEntry({
      userId: manager.id,
      actionCode: 'admin.referential.update',
      hoursAgo: Math.random() * 200,
      target: `referential-${(i % 5) + 1}`,
      resourceType: 'Referential',
    });
  }

  for (let i = 0; i < 50; i++) {
    pushEntry({
      userId: assistant.id,
      actionCode: 'export',
      hoursAgo: Math.random() * 300,
      target: 'appointments.csv',
      resourceType: 'Export',
    });
  }

  for (let i = 0; i < 30; i++) {
    pushEntry({
      userId: manager.id,
      actionCode: 'appointment.approve',
      hoursAgo: Math.random() * 72,
      target: `mock-appt-${(i % 8) + 1}`,
      resourceType: 'Appointment',
    });
  }

  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

seedAuditJournalMock();

export function mockListAuditJournal(limit = 500): AuditJournalEntry[] {
  return entries.slice(0, limit);
}

export function mockWriteAuditJournal(
  userId: string,
  action: string,
  meta?: { target?: string; ip?: string; comments?: string[]; resource?: string; appointmentId?: string }
) {
  seedAuditJournalMock();
  const user = mockFindUserById(userId);
  if (!user) return;
  const row = normalizeDgAuditRow({
    id: `audit-${seq++}`,
    createdAt: new Date(),
    userId,
    action,
    meta: {
      target: meta?.target,
      email: meta?.target,
      ip: meta?.ip ?? randomIp(),
      comment: meta?.comments?.[0],
      resource: meta?.resource,
    },
    appointmentId: meta?.appointmentId,
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
  if (meta?.comments) row.comments = meta.comments;
  entries.unshift(row);
  if (entries.length > 500) entries.pop();
}

export type MockAuditLog = {
  id: string;
  action: string;
  appointmentId: string | null;
  createdAt: Date;
  user: { firstName: string; lastName: string; email: string };
};

export function mockWriteAudit(
  userId: string,
  action: string,
  appointmentId?: string,
  comments?: string[]
) {
  mockWriteAuditJournal(userId, action, {
    target: appointmentId,
    resource: appointmentId ? 'Appointment' : undefined,
    comments,
    appointmentId,
  });
}

export function mockListAuditLogs(limit = 50) {
  return mockListAuditJournal(limit).map((e) => ({
    id: e.id,
    action: e.actionCode,
    appointmentId: e.resourceType === 'Appointment' ? e.resourceLabel : null,
    createdAt: new Date(e.createdAt),
    user: {
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      email: e.user.email,
    },
  }));
}

export function mockAuditJournalUsers() {
  return mockListUsers()
    .filter((u) => !u.archived)
    .map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      roleLabel: dgRoleLabel(u.role),
    }));
}
