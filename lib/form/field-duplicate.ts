export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findEmailConflict<T extends { id: string; email: string }>(
  candidates: T[],
  email: string,
  excludeId?: string
): T | undefined {
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes('@')) return undefined;
  return candidates.find((row) => row.id !== excludeId && normalizeEmail(row.email) === norm);
}

export function findRoleLabelConflict<T extends { id: string; label: string }>(
  candidates: T[],
  label: string,
  excludeId?: string
): T | undefined {
  const norm = label.trim().toLowerCase();
  if (norm.length < 2) return undefined;
  return candidates.find((row) => row.id !== excludeId && row.label.trim().toLowerCase() === norm);
}
