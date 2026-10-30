/** Format stocké à la création : `[SIGLE] — Description` ou description seule. */
export function formatRoleDescription(shortName: string, description: string): string {
  const parts = [
    shortName.trim() ? `[${shortName.trim()}]` : '',
    description.trim(),
  ].filter(Boolean);
  return parts.join(' — ');
}

export function parseRoleDescription(stored: string): { shortName: string; description: string } {
  const trimmed = stored.trim();
  const match = trimmed.match(/^\[([^\]]+)\]\s*(?:—\s*)?(.*)$/s);
  if (match) {
    return {
      shortName: match[1].trim(),
      description: (match[2] ?? '').trim(),
    };
  }
  return { shortName: '', description: trimmed };
}
