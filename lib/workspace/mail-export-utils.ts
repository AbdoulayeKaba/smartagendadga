import { formatDateMedium, formatIsoDate } from '@/lib/datetime';
import {
  MAIL_PRIORITY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_VIEW_LABELS,
} from '@/lib/workspace/labels';
import { formatMailDate } from '@/lib/workspace/mail-utils';
import type { MailItem, MailViewMode } from '@/lib/workspace/types';

const ADMIN_GREEN = 'FF1B5E3B';
const ADMIN_GREEN_LIGHT = 'FFE8F5EE';
const BORDER_GRAY = 'FFE2E8F0';
const TEXT_MUTED = 'FF64748B';

type ExportRow = { headers: string[]; values: (string | number)[][] };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
    left: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
    bottom: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
    right: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  };
}

function statusPdfClass(status: MailItem['workflowStatus']): string {
  if (status === 'PROCESSED' || status === 'SENT') return 'status-approved';
  if (status === 'IN_PROGRESS' || status === 'ASSIGNED') return 'status-pending';
  if (status === 'ARCHIVED') return 'status-auto';
  return 'status-received';
}

function buildExportRows(items: MailItem[], viewMode: MailViewMode): ExportRow {
  if (viewMode === 'dga') {
    return {
      headers: [
        'N°',
        'Sens',
        'N° enreg.',
        "Date",
        'Référence',
        'Correspondant',
        'Objet',
        'Statut',
        'Priorité',
        'Instruction DGA',
      ],
      values: items.map((r, index) => [
        index + 1,
        r.direction === 'INCOMING' ? 'Entrant' : 'Sortant',
        r.registrationNumber ?? '—',
        formatMailDate(r.mailDate),
        r.reference,
        r.counterpart,
        r.subject,
        MAIL_STATUS_LABELS[r.workflowStatus],
        MAIL_PRIORITY_LABELS[r.priority],
        r.direction === 'INCOMING' ? (r.dgaInstruction ?? '—') : '—',
      ]),
    };
  }

  if (viewMode === 'depart') {
    return {
      headers: [
        'N°',
        'Date du courrier',
        'Objet',
        'Destinataire',
        'Statut',
        'Niveau exécution',
        'Date envoi SC',
        'Coursier',
      ],
      values: items.map((r, index) => [
        index + 1,
        formatMailDate(r.mailDate),
        r.subject,
        r.counterpart,
        MAIL_STATUS_LABELS[r.workflowStatus],
        r.action ?? '—',
        formatMailDate(r.scSentAt),
        r.courierName ?? '—',
      ]),
    };
  }

  return {
    headers: [
      'N°',
      "Date d'enreg.",
      'N° enreg.',
      'Objet',
      'Exécutant',
      'Action',
      'Statut',
      'Date envoi SC',
      'Délais',
      'Suivi',
    ],
    values: items.map((r, index) => [
      index + 1,
      formatMailDate(r.mailDate),
      r.registrationNumber ?? '—',
      r.subject,
      r.executor ?? '—',
      r.action ?? '—',
      MAIL_STATUS_LABELS[r.workflowStatus],
      formatMailDate(r.scSentAt),
      formatMailDate(r.executionDeadline),
      r.followUp ?? '—',
    ]),
  };
}

/** Génère et télécharge un fichier Excel (.xlsx) des courriers. */
export async function downloadMailExcel(
  items: MailItem[],
  viewMode: MailViewMode,
  filePrefix = 'courriers',
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { headers, values } = buildExportRows(items, viewMode);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agenda DGA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Courriers', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const lastCol = String.fromCharCode(64 + headers.length);

  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Courriers — ${MAIL_VIEW_LABELS[viewMode]}`;
  titleCell.font = { size: 14, bold: true, color: { argb: ADMIN_GREEN } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subCell = sheet.getCell('A2');
  subCell.value = `Export du ${formatDateMedium(new Date())} · ${items.length} courrier${items.length > 1 ? 's' : ''}`;
  subCell.font = { size: 10, color: { argb: TEXT_MUTED } };

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10, color: { argb: ADMIN_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ADMIN_GREEN_LIGHT } };
    cell.border = thinBorder();
  });
  headerRow.height = 22;

  values.forEach((rowValues, index) => {
    const row = sheet.getRow(5 + index);
    rowValues.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { size: 10 };
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: colIndex >= 5 };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet.columns = headers.map((_, i) => ({
    width: i === 0 ? 5 : i === headers.length - 1 ? 28 : 16,
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filePrefix}-${viewMode}-${formatIsoDate(new Date())}.xlsx`,
  );
}

/** Ouvre une fenêtre d'impression PDF des courriers. */
export function printMailPdf(items: MailItem[], viewMode: MailViewMode): void {
  const { headers, values } = buildExportRows(items, viewMode);
  const urgent = items.filter((i) => i.priority === 'URGENT').length;
  const pending = items.filter(
    (i) => i.workflowStatus === 'RECEIVED' || i.workflowStatus === 'ASSIGNED',
  ).length;

  const rows = values
    .map((row) => {
      const cells = row
        .map((value, colIndex) => {
          const header = headers[colIndex]?.toLowerCase() ?? '';
          if (header.includes('statut') && typeof value === 'string') {
            const statusKey = Object.entries(MAIL_STATUS_LABELS).find(([, label]) => label === value)?.[0];
            const statusClass = statusKey ? statusPdfClass(statusKey as MailItem['workflowStatus']) : 'status-received';
            return `<td><span class="badge ${statusClass}">${escapeHtml(String(value))}</span></td>`;
          }
          if (header === 'objet') {
            return `<td class="col-title">${escapeHtml(String(value))}</td>`;
          }
          if (header === 'n°') {
            return `<td class="col-num">${escapeHtml(String(value))}</td>`;
          }
          return `<td>${escapeHtml(String(value))}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Courriers — ${escapeHtml(MAIL_VIEW_LABELS[viewMode])}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:32px 36px}
    .header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1b5e3b}
    .header-left h1{font-size:20px;font-weight:700;color:#1b5e3b;letter-spacing:-.02em}
    .header-left p{font-size:12px;color:#64748b;margin-top:4px}
    .stats{display:flex;gap:10px;flex-shrink:0}
    .stat{text-align:center;padding:8px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;min-width:72px}
    .stat strong{display:block;font-size:18px;font-weight:700;color:#1b5e3b;line-height:1.1}
    .stat span{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:10px}
    thead th{background:#1b5e3b;color:#fff;font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:8px 6px;text-align:left}
    tbody td{padding:7px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tbody tr:nth-child(even) td{background:#f8fafc}
    .col-num{color:#94a3b8;font-weight:600;text-align:center;width:24px}
    .col-title{font-weight:600;max-width:200px}
    .badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:8.5px;font-weight:600;white-space:nowrap}
    .status-approved{background:#dcfce7;color:#166534}
    .status-pending{background:#fef9c3;color:#854d0e}
    .status-received{background:#e0f2fe;color:#075985}
    .status-auto{background:#f1f5f9;color:#475569}
    .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{
      body{padding:16px 20px}
      @page{margin:12mm;size:A4 landscape}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Courriers — ${escapeHtml(MAIL_VIEW_LABELS[viewMode])}</h1>
      <p>Export du ${escapeHtml(formatDateMedium(new Date()))} · ${items.length} courrier${items.length > 1 ? 's' : ''}</p>
    </div>
    <div class="stats">
      <div class="stat"><strong>${items.length}</strong><span>Total</span></div>
      <div class="stat"><strong>${pending}</strong><span>En attente</span></div>
      <div class="stat"><strong>${urgent}</strong><span>Urgents</span></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Document généré automatiquement — Espace de travail DGA</span>
    <span>${escapeHtml(formatDateMedium(new Date()))}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }
}
