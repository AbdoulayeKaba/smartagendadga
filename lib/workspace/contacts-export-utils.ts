import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatDateMedium, formatIsoDate } from '@/lib/datetime';
import { CONTACT_CATEGORY_LABELS } from '@/lib/workspace/labels';
import type { StrategicContact } from '@/lib/workspace/types';

const EXCEL_HEADERS = [
  'N°',
  'Nom complet',
  'Fonction',
  'Organisation',
  'Catégorie',
  'Téléphone',
  'Email',
  'RDV',
  'Visites',
  'Notes',
  'Archivé le',
] as const;

const ADMIN_GREEN = 'FF1B5E3B';
const ADMIN_GREEN_LIGHT = 'FFE8F5EE';
const BORDER_GRAY = 'FFE2E8F0';
const TEXT_MUTED = 'FF64748B';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatArchivedAt(value: string | null | undefined): string {
  if (!value) return '—';
  return format(new Date(value), 'd MMM yyyy', { locale: fr });
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

function rowValues(item: StrategicContact, index: number) {
  return {
    index: index + 1,
    fullName: item.fullName,
    jobTitle: item.jobTitle ?? '—',
    organization: item.organization,
    category: CONTACT_CATEGORY_LABELS[item.category],
    phone: item.phone ?? '—',
    email: item.email ?? '—',
    appointmentCount: item.appointmentCount,
    visitCount: item.visitCount,
    notes: item.notes ?? '—',
    archivedAt: formatArchivedAt(item.archivedAt),
  };
}

/** Génère et télécharge un fichier Excel (.xlsx) des contacts stratégiques. */
export async function downloadContactsExcel(
  items: StrategicContact[],
  filePrefix = 'contacts-strategiques',
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agenda DGA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Contacts', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const lastCol = String.fromCharCode(64 + EXCEL_HEADERS.length);

  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Contacts stratégiques — Espace de travail DGA';
  titleCell.font = { size: 14, bold: true, color: { argb: ADMIN_GREEN } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subCell = sheet.getCell('A2');
  subCell.value = `Export du ${formatDateMedium(new Date())} · ${items.length} contact${items.length > 1 ? 's' : ''}`;
  subCell.font = { size: 10, color: { argb: TEXT_MUTED } };

  const headerRow = sheet.getRow(4);
  EXCEL_HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10, color: { argb: ADMIN_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ADMIN_GREEN_LIGHT } };
    cell.border = thinBorder();
  });
  headerRow.height = 22;

  items.forEach((item, index) => {
    const row = sheet.getRow(5 + index);
    const values = rowValues(item, index);
    const cells = [
      values.index,
      values.fullName,
      values.jobTitle,
      values.organization,
      values.category,
      values.phone,
      values.email,
      values.appointmentCount,
      values.visitCount,
      values.notes,
      values.archivedAt,
    ];

    cells.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { size: 10 };
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: colIndex === 9 };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet.columns = [
    { width: 5 },
    { width: 24 },
    { width: 20 },
    { width: 28 },
    { width: 22 },
    { width: 16 },
    { width: 28 },
    { width: 6 },
    { width: 8 },
    { width: 36 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filePrefix}-${formatIsoDate(new Date())}.xlsx`,
  );
}

/** Ouvre une fenêtre d'impression PDF des contacts stratégiques. */
export function printContactsPdf(items: StrategicContact[]): void {
  const withRdv = items.filter((i) => i.appointmentCount > 0).length;
  const withVisits = items.filter((i) => i.visitCount > 0).length;

  const rows = items
    .map((item, index) => {
      const values = rowValues(item, index);
      return `<tr>
        <td class="col-num">${values.index}</td>
        <td class="col-name">${escapeHtml(values.fullName)}<br/><span class="dept">${escapeHtml(values.jobTitle)}</span></td>
        <td>${escapeHtml(values.organization)}</td>
        <td><span class="badge">${escapeHtml(values.category)}</span></td>
        <td>${escapeHtml(values.phone)}</td>
        <td class="col-email">${escapeHtml(values.email)}</td>
        <td class="col-num">${values.appointmentCount}</td>
        <td class="col-num">${values.visitCount}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Contacts stratégiques — ${formatIsoDate(new Date())}</title>
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
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    thead th{background:#1b5e3b;color:#fff;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:9px 8px;text-align:left}
    tbody td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tbody tr:nth-child(even) td{background:#f8fafc}
    .col-num{color:#64748b;font-weight:600;text-align:center}
    .col-name{font-weight:600;max-width:160px}
    .col-email{font-size:10px;color:#475569}
    .dept{color:#94a3b8;font-size:9px;font-weight:400}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:600;background:#e8f5ee;color:#1b5e3b;white-space:nowrap}
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
      <h1>Contacts stratégiques — Espace de travail DGA</h1>
      <p>Export du ${escapeHtml(formatDateMedium(new Date()))} · ${items.length} contact${items.length > 1 ? 's' : ''}</p>
    </div>
    <div class="stats">
      <div class="stat"><strong>${items.length}</strong><span>Total</span></div>
      <div class="stat"><strong>${withRdv}</strong><span>Avec RDV</span></div>
      <div class="stat"><strong>${withVisits}</strong><span>Visites</span></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>N°</th><th>Nom</th><th>Organisation</th><th>Catégorie</th>
        <th>Téléphone</th><th>Email</th><th>RDV</th><th>Visites</th>
      </tr>
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
