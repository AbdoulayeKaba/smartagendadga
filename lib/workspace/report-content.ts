export const INLINE_REPORT_STORAGE_KEY = 'reports/inline/content';

export const INLINE_REPORT_FILE_NAME = 'saisie-en-ligne.html';

export function stripReportHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasReportWrittenContent(bodyHtml: string | null | undefined): boolean {
  return stripReportHtml(bodyHtml ?? '').length > 0;
}

export function isInlineReportStorageKey(storageKey: string): boolean {
  return storageKey === INLINE_REPORT_STORAGE_KEY || storageKey.startsWith('reports/inline/');
}

export function reportHasAttachment(row: {
  storageKey: string;
  bodyHtml?: string | null;
}): boolean {
  return Boolean(row.storageKey) && !isInlineReportStorageKey(row.storageKey);
}

export function reportContentPreview(
  row: {
    bodyHtml?: string | null;
    fileName: string;
    storageKey: string;
  },
  maxLength = 120
): string {
  if (hasReportWrittenContent(row.bodyHtml)) {
    const text = stripReportHtml(row.bodyHtml ?? '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
  }
  if (reportHasAttachment(row)) {
    return row.fileName;
  }
  return '—';
}

export function normalizeReportTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function reportsShareTitle(a: { title: string }, b: { title: string }): boolean {
  return normalizeReportTitle(a.title) === normalizeReportTitle(b.title);
}

export function findReportTitleConflict<T extends { id: string; title: string }>(
  candidates: T[],
  input: { title: string },
  excludeId?: string
): T | undefined {
  return candidates.find((row) => row.id !== excludeId && reportsShareTitle(input, row));
}

/** @deprecated Utiliser reportsShareTitle */
export function reportsShareTitleAndDate(
  a: { title: string },
  b: { title: string }
): boolean {
  return reportsShareTitle(a, b);
}

/** @deprecated Utiliser reportsShareTitle */
export function reportsAreDuplicates(a: { title: string }, b: { title: string }): boolean {
  return reportsShareTitle(a, b);
}
