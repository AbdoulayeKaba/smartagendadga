import {
  hasReportWrittenContent,
  isInlineReportStorageKey,
  reportHasAttachment,
} from '@/lib/workspace/report-content';

export type ReportContentKind = 'written' | 'pdf' | 'word' | 'image' | 'spreadsheet' | 'unknown';

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  html: 'text/html',
};

export function reportFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

export function reportMimeTypeFromFileName(fileName: string): string {
  const ext = reportFileExtension(fileName);
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function reportContentKind(row: {
  bodyHtml?: string | null;
  fileName: string;
  storageKey: string;
}): ReportContentKind {
  if (hasReportWrittenContent(row.bodyHtml)) return 'written';
  if (!reportHasAttachment(row)) return 'unknown';

  const ext = reportFileExtension(row.fileName);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (['xls', 'xlsx'].includes(ext)) return 'spreadsheet';
  return 'unknown';
}

export function reportDocumentFileUrl(id: string, options?: { download?: boolean }): string {
  const base = `/api/workspace/documents/${id}/file`;
  if (options?.download) return `${base}?download=1`;
  return base;
}

export function canPreviewReportInApp(kind: ReportContentKind): boolean {
  return kind === 'written' || kind === 'pdf' || kind === 'word' || kind === 'image';
}

export function reportContentKindLabel(kind: ReportContentKind): string {
  switch (kind) {
    case 'written':
      return 'Rédaction';
    case 'pdf':
      return 'PDF';
    case 'word':
      return 'Word';
    case 'image':
      return 'Image';
    case 'spreadsheet':
      return 'Tableur';
    default:
      return 'Fichier';
  }
}

export function isInlineReportDocument(storageKey: string): boolean {
  return isInlineReportStorageKey(storageKey);
}
