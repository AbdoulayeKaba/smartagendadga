import type { WorkspaceAssigneeOption } from '@/lib/workspace/types';

/** Directions / services récurrents pour l'affectation des tâches. */
export const WORKSPACE_ASSIGNEE_SERVICES = [
  'Cabinet DGA',
  'Direction Technique',
  'Direction Régulation',
  'Service Juridique',
  'Affaires réglementaires',
  'Communication',
  'Secrétariat général',
] as const;

export function parseProjectPhases(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export function serializeProjectPhases(phases: string[]): string | null {
  const cleaned = phases.map((p) => p.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}

export function resolveAssigneeFromOption(
  optionId: string,
  options: WorkspaceAssigneeOption[]
): { assigneeName: string; assigneeUserId: string | null } {
  const found = options.find((o) => o.id === optionId);
  if (!found) {
    return { assigneeName: optionId, assigneeUserId: null };
  }
  if (found.kind === 'user') {
    return {
      assigneeName: found.label,
      assigneeUserId: found.id.replace(/^user:/, ''),
    };
  }
  return { assigneeName: found.label, assigneeUserId: null };
}

export function assigneeOptionId(task: {
  assigneeName: string;
  assigneeUserId: string | null;
}): string {
  if (task.assigneeUserId) return `user:${task.assigneeUserId}`;
  const service = WORKSPACE_ASSIGNEE_SERVICES.find((s) => s === task.assigneeName);
  if (service) return `service:${service}`;
  return `custom:${task.assigneeName}`;
}
