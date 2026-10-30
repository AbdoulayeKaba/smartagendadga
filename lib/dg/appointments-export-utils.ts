import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import {
  formatDateMedium,
  formatIsoDate,
  formatTime,
} from '@/lib/datetime';
import {
  APPOINTMENT_PRIORITY_LABELS,
  APPOINTMENT_TYPE_LABELS,
  appointmentStatusLabel,
} from '@/lib/dg/appointments-review';

/** Forme minimale d'un rendez-vous exportable (compatible AppointmentReviewItem). */
export type ExportableAppointment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  priority: Priority;
  type: AppointmentType;
  location?: string | null;
  locationLabel?: string | null;
  autoRejected?: boolean;
  requestedBy?: {
    firstName: string;
    lastName: string;
    department: string | null;
  } | null;
};

const EXCEL_HEADERS = [
  'N°',
  'Titre',
  'Date',
  'Début',
  'Fin',
  'Statut',
  'Priorité',
  'Type',
  'Lieu',
  'Demandeur',
  'Service',
] as const;

const ADMIN_GREEN = 'FF1B5E3B';
const ADMIN_GREEN_LIGHT = 'FFE8F5EE';
const BORDER_GRAY = 'FFE2E8F0';
const TEXT_MUTED = 'FF64748B';

function requesterName(item: ExportableAppointment): string {
  return item.requestedBy
    ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}`.trim()
    : '';
}

function locationOf(item: ExportableAppointment): string {
  return item.locationLabel ?? item.location ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusPdfClass(status: AppointmentStatus, autoRejected?: boolean): string {
  if (autoRejected) return 'status-auto';
  if (status === 'APPROVED') return 'status-approved';
  if (status === 'PENDING') return 'status-pending';
  return 'status-rejected';
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

/** Génère et télécharge un fichier Excel (.xlsx) détaillé et mis en forme. */
export async function downloadAppointmentsExcel(
  items: ExportableAppointment[],
  filePrefix = 'agenda-dg',
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agenda DGA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Rendez-vous', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const lastCol = String.fromCharCode(64 + EXCEL_HEADERS.length);

  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Liste des rendez-vous — Agenda DGA';
  titleCell.font = { size: 14, bold: true, color: { argb: ADMIN_GREEN } };
  titleCell.alignment = { vertical: 'middle' };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subCell = sheet.getCell('A2');
  subCell.value = `Export du ${formatDateMedium(new Date())} · ${items.length} rendez-vous`;
  subCell.font = { size: 10, color: { argb: TEXT_MUTED } };
  subCell.alignment = { vertical: 'middle' };

  const headerRow = sheet.getRow(4);
  EXCEL_HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10, color: { argb: ADMIN_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ADMIN_GREEN_LIGHT } };
    cell.border = thinBorder();
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 22;

  items.forEach((item, index) => {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const row = sheet.getRow(5 + index);
    const values = [
      index + 1,
      item.title,
      formatIsoDate(start),
      formatTime(start),
      formatTime(end),
      appointmentStatusLabel(item),
      APPOINTMENT_PRIORITY_LABELS[item.priority],
      APPOINTMENT_TYPE_LABELS[item.type],
      locationOf(item),
      requesterName(item),
      item.requestedBy?.department ?? '',
    ];

    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { size: 10 };
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: colIndex === 1 };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet.columns = [
    { width: 5 },
    { width: 34 },
    { width: 12 },
    { width: 8 },
    { width: 8 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 22 },
    { width: 22 },
    { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filePrefix}-${formatIsoDate(new Date())}.xlsx`,
  );
}

/** Ouvre une fenêtre d'impression PDF professionnelle des rendez-vous fournis. */
export function printAppointmentsPdf(items: ExportableAppointment[]): void {
  const approved = items.filter((i) => i.status === 'APPROVED').length;
  const pending = items.filter((i) => i.status === 'PENDING').length;
  const rejected = items.filter((i) => i.status === 'REJECTED').length;

  const rows = items
    .map((item, index) => {
      const start = new Date(item.startAt);
      const end = new Date(item.endAt);
      const requester = escapeHtml(requesterName(item) || '—');
      const department = escapeHtml(item.requestedBy?.department ?? '—');
      const statusClass = statusPdfClass(item.status, item.autoRejected);
      const status = escapeHtml(appointmentStatusLabel(item));
      return `<tr>
        <td class="col-num">${index + 1}</td>
        <td class="col-title">${escapeHtml(item.title)}</td>
        <td class="col-slot">${formatIsoDate(start)}<br/><span class="slot-time">${formatTime(start)} – ${formatTime(end)}</span></td>
        <td><span class="badge ${statusClass}">${status}</span></td>
        <td>${escapeHtml(APPOINTMENT_PRIORITY_LABELS[item.priority])}</td>
        <td>${escapeHtml(APPOINTMENT_TYPE_LABELS[item.type])}</td>
        <td>${escapeHtml(locationOf(item) || '—')}</td>
        <td>${requester}<br/><span class="dept">${department}</span></td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Agenda DGA — ${formatIsoDate(new Date())}</title>
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
    .col-num{color:#94a3b8;font-weight:600;text-align:center;width:28px}
    .col-title{font-weight:600;max-width:180px}
    .col-slot{white-space:nowrap}
    .slot-time{color:#64748b;font-size:9.5px}
    .dept{color:#94a3b8;font-size:9px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:600;white-space:nowrap}
    .status-approved{background:#dcfce7;color:#166534}
    .status-pending{background:#fef9c3;color:#854d0e}
    .status-rejected{background:#fee2e2;color:#991b1b}
    .status-auto{background:#ffedd5;color:#9a3412}
    .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{
      body{padding:16px 20px}
      .header{margin-bottom:14px}
      @page{margin:12mm;size:A4 landscape}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Liste des rendez-vous — Agenda DGA</h1>
      <p>Export du ${escapeHtml(formatDateMedium(new Date()))} · ${items.length} rendez-vous</p>
    </div>
    <div class="stats">
      <div class="stat"><strong>${items.length}</strong><span>Total</span></div>
      <div class="stat"><strong>${approved}</strong><span>Approuvés</span></div>
      <div class="stat"><strong>${pending}</strong><span>En attente</span></div>
      <div class="stat"><strong>${rejected}</strong><span>Refusés</span></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>N°</th><th>Titre</th><th>Créneau</th><th>Statut</th>
        <th>Priorité</th><th>Type</th><th>Lieu</th><th>Demandeur</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Document généré automatiquement — Agenda DGA</span>
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
