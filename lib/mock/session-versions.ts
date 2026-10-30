const versions = new Map<string, number>();

export function mockBumpSessionVersion(userId: string): number {
  const next = (versions.get(userId) ?? 0) + 1;
  versions.set(userId, next);
  return next;
}

export function mockGetSessionVersion(userId: string): number {
  return versions.get(userId) ?? 0;
}
