import { isMockDataEnabled } from '@/lib/mock/config';
import { mockListUsers } from '@/lib/mock/users-store';
import { listUsers } from '@/lib/services/users-admin';
import { WORKSPACE_ASSIGNEE_SERVICES } from '@/lib/workspace/assignee-utils';
import type { WorkspaceAssigneeOption } from '@/lib/workspace/types';

export async function listWorkspaceAssignees(): Promise<WorkspaceAssigneeOption[]> {
  const users = isMockDataEnabled() ? mockListUsers() : await listUsers();
  const activeUsers = users
    .filter((u) => u.active && !u.archived)
    .map(
      (u): WorkspaceAssigneeOption => ({
        id: `user:${u.id}`,
        label: `${u.firstName} ${u.lastName}`.trim(),
        kind: 'user',
        department: u.department ?? null,
      })
    );

  const serviceOptions: WorkspaceAssigneeOption[] = WORKSPACE_ASSIGNEE_SERVICES.map((name) => ({
    id: `service:${name}`,
    label: name,
    kind: 'service',
  }));

  return [...activeUsers, ...serviceOptions];
}
