import { DEMO_REPORT_RECORDS } from '@/lib/seed/reports-demo-data';
import { saveWorkspaceFile } from '@/lib/storage/workspace-uploads';

/** PDF minimal valide (1 page) pour la démo / aperçu navigateur. */
export function buildMinimalPdfBuffer(title: string): Buffer {
  const safeTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '-')
    .slice(0, 72);

  const stream = [
    'BT',
    '/F1 16 Tf',
    '50 740 Td',
    `(${safeTitle.replace(/[()\\]/g, '')}) Tj`,
    '0 -28 Td',
    '/F1 11 Tf',
    '(Document de demonstration ARPT - apercu PDF) Tj',
    '0 -20 Td',
    '(Le fichier source sera remplace lors dun vrai depot.) Tj',
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

export async function ensureDemoReportPdfFiles(): Promise<number> {
  let written = 0;
  for (const row of DEMO_REPORT_RECORDS) {
    if (!row.fileName.toLowerCase().endsWith('.pdf') || row.bodyHtml) continue;
    try {
      await saveWorkspaceFile(row.storageKey, buildMinimalPdfBuffer(row.title));
      written += 1;
    } catch {
      /* ignore */
    }
  }
  return written;
}

export async function ensureDemoReportPdfIfMissing(
  storageKey: string,
  title: string
): Promise<Buffer | null> {
  const isDemo = DEMO_REPORT_RECORDS.some(
    (row) => row.storageKey === storageKey && row.fileName.toLowerCase().endsWith('.pdf')
  );
  if (!isDemo) return null;
  const buffer = buildMinimalPdfBuffer(title);
  await saveWorkspaceFile(storageKey, buffer);
  return buffer;
}
