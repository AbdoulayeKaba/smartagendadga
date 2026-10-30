import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { attendanceTimezone } from '@/lib/attendance/timezone';

export type ExportAttendanceRow = {
  date: string;
  matricule: string;
  nom: string;
  prenom: string;
  service: string;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  workedMinutes: number | null;
  checkInLocationName: string | null;
  checkOutLocationName: string | null;
};

function statusFr(status: string): string {
  if (status === 'present') return 'Présent';
  if (status === 'retard') return 'Retard';
  if (status === 'absent') return 'Absent';
  return status;
}

function fmtTime(d: Date | null): string {
  if (!d) return '';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

function fmtWorked(m: number | null): string {
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${mm.toString().padStart(2, '0')}`;
}

/** Génère un classeur .xlsx (buffer) pour les présences. */
export async function buildAttendanceExportBuffer(
  rows: ExportAttendanceRow[],
  meta: { title: string; timezone: string; periodLabel: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pointage ARPT';
  const sheet = workbook.addWorksheet('Présences', {
    properties: { defaultRowHeight: 18 },
  });

  sheet.mergeCells('A1:K1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = meta.title;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { vertical: 'middle' };

  sheet.mergeCells('A2:K2');
  const sub = sheet.getCell('A2');
  sub.value = `${meta.periodLabel} · Fuseau : ${meta.timezone}`;
  sub.font = { size: 11, color: { argb: 'FF666666' } };

  const headerRow = sheet.getRow(4);
  const headers = [
    'Date',
    'Matricule',
    'Nom',
    'Prénom',
    'Service',
    'Entrée',
    'Sortie',
    'Statut',
    'Lieu entrée',
    'Lieu sortie',
    'Durée',
  ];
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    c.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  let r = 5;
  for (const row of rows) {
    const line = sheet.getRow(r);
    const values = [
      row.date,
      row.matricule,
      row.nom,
      row.prenom,
      row.service,
      fmtTime(row.checkIn),
      fmtTime(row.checkOut),
      statusFr(row.status),
      row.checkInLocationName ?? '',
      row.checkOutLocationName ?? '',
      fmtWorked(row.workedMinutes),
    ];
    values.forEach((v, i) => {
      const c = line.getCell(i + 1);
      c.value = v;
      c.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
    });
    r += 1;
  }

  sheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
    { width: 26 },
    { width: 26 },
    { width: 12 },
  ];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function exportTimezoneLabel(): string {
  return attendanceTimezone();
}
