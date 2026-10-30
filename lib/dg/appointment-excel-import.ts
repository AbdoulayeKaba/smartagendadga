import ExcelJS from 'exceljs';
import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';

export type AppointmentImportField =
  | 'title'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'requesterEmail'
  | 'status'
  | 'type'
  | 'priority'
  | 'location'
  | 'description'
  | 'allDay';

const HEADER_ALIASES: Record<string, AppointmentImportField> = {
  titre: 'title',
  title: 'title',
  objet: 'title',
  date: 'date',
  'heure debut': 'startTime',
  'heure début': 'startTime',
  debut: 'startTime',
  début: 'startTime',
  start: 'startTime',
  'heure fin': 'endTime',
  fin: 'endTime',
  end: 'endTime',
  'email demandeur': 'requesterEmail',
  demandeur: 'requesterEmail',
  'demandeur email': 'requesterEmail',
  email: 'requesterEmail',
  statut: 'status',
  status: 'status',
  type: 'type',
  priorite: 'priority',
  priorité: 'priority',
  priority: 'priority',
  emplacement: 'location',
  lieu: 'location',
  location: 'location',
  description: 'description',
  motif: 'description',
  notes: 'description',
  'toute la journee': 'allDay',
  'toute la journée': 'allDay',
  allday: 'allDay',
};

export type AppointmentImportRow = {
  line: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  requesterEmail: string;
  status: AppointmentStatus;
  type: AppointmentType;
  priority: Priority;
  location: string | null;
  description: string | null;
  allDay: boolean;
};

export type AppointmentImportParseError = {
  line: number;
  message: string;
};

export type AppointmentImportParseResult = {
  rows: AppointmentImportRow[];
  errors: AppointmentImportParseError[];
};

function normalizeHeader(value: ExcelJS.CellValue): string {
  const raw =
    value == null
      ? ''
      : typeof value === 'object' && value !== null && 'text' in value
        ? String(value.text ?? '')
        : String(value);
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function cellValue(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, '0');
    const m = String(value.getMinutes()).padStart(2, '0');
    if (h === '00' && m === '00') {
      const y = value.getFullYear();
      const mo = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
    return `${h}:${m}`;
  }
  if (typeof value === 'object' && value !== null) {
    if ('result' in value && value.result != null) return cellValue(value.result as ExcelJS.CellValue);
    if ('text' in value && value.text != null) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text).join('').trim();
    }
  }
  return String(value).trim();
}

function parseIsoDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const fr = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (fr) {
    const day = fr[1].padStart(2, '0');
    const month = fr[2].padStart(2, '0');
    const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  return null;
}

function parseTime(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})[:h](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseAllDay(input: string): boolean {
  const v = input.trim().toLowerCase();
  return v === 'oui' || v === 'yes' || v === 'true' || v === '1' || v === 'x';
}

export function normalizeImportStatus(input: string): AppointmentStatus {
  const v = input.trim().toLowerCase();
  if (v.includes('refus') || v === 'rejected') return 'REJECTED';
  if (v.includes('attent') || v === 'pending') return 'PENDING';
  if (v.includes('approu') || v === 'approved' || v.includes('valid')) return 'APPROVED';
  return 'APPROVED';
}

export function normalizeImportType(input: string): AppointmentType {
  const v = input.trim().toLowerCase();
  if (v.startsWith('extern')) return 'EXTERNAL';
  if (v.startsWith('minist')) return 'MINISTRY';
  if (v.startsWith('person')) return 'PERSONAL';
  return 'INTERNAL';
}

export function normalizeImportPriority(input: string): Priority {
  const v = input.trim().toLowerCase();
  if (v.startsWith('haut') || v === 'high') return 'HIGH';
  if (v.startsWith('bas') || v === 'low') return 'LOW';
  return 'MEDIUM';
}

function mapHeaders(headerRow: ExcelJS.Row): Map<number, AppointmentImportField> {
  const map = new Map<number, AppointmentImportField>();
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const field = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (field) map.set(col, field);
  });
  return map;
}

function hasRequiredImportColumns(columnMap: Map<number, AppointmentImportField>): boolean {
  const fields = [...columnMap.values()];
  return (
    fields.includes('title') && fields.includes('date') && fields.includes('requesterEmail')
  );
}

function findHeaderRow(sheet: ExcelJS.Worksheet): {
  rowNumber: number;
  columnMap: Map<number, AppointmentImportField>;
} | null {
  const maxScan = Math.min(20, sheet.rowCount || 20);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber++) {
    const columnMap = mapHeaders(sheet.getRow(rowNumber));
    if (hasRequiredImportColumns(columnMap)) {
      return { rowNumber, columnMap };
    }
  }
  return null;
}

export async function parseAppointmentImportWorkbook(
  buffer: Buffer
): Promise<AppointmentImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: [{ line: 0, message: 'Fichier Excel vide.' }] };
  }

  const header = findHeaderRow(sheet);
  if (!header) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            'En-têtes introuvables. La première ligne doit contenir au minimum : Titre, Date, Email demandeur.',
        },
      ],
    };
  }

  const { rowNumber: headerRowNumber, columnMap } = header;

  const rows: AppointmentImportRow[] = [];
  const errors: AppointmentImportParseError[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values: Partial<Record<AppointmentImportField, string>> = {};
    let hasContent = false;
    columnMap.forEach((field, col) => {
      const text = cellValue(row.getCell(col).value);
      if (text) hasContent = true;
      values[field] = text;
    });
    if (!hasContent) return;

    const title = values.title?.trim() ?? '';
    if (!title) {
      errors.push({ line: rowNumber, message: 'Titre manquant.' });
      return;
    }

    const dateRaw = values.date ?? '';
    const date = parseIsoDate(dateRaw);
    if (!date) {
      errors.push({ line: rowNumber, message: `Date invalide : « ${dateRaw} ».` });
      return;
    }

    const allDay = parseAllDay(values.allDay ?? '');
    let startTime = allDay ? '00:00' : parseTime(values.startTime ?? '') ?? '';
    let endTime = allDay ? '23:59' : parseTime(values.endTime ?? '') ?? '';

    if (!allDay && (!startTime || !endTime)) {
      errors.push({ line: rowNumber, message: 'Heures de début et de fin requises.' });
      return;
    }

    const requesterEmail = (values.requesterEmail ?? '').trim().toLowerCase();
    if (!requesterEmail || !requesterEmail.includes('@')) {
      errors.push({ line: rowNumber, message: 'Email demandeur invalide.' });
      return;
    }

    if (!allDay && endTime <= startTime) {
      errors.push({ line: rowNumber, message: 'L’heure de fin doit être après le début.' });
      return;
    }

    rows.push({
      line: rowNumber,
      title,
      date,
      startTime,
      endTime,
      requesterEmail,
      status: normalizeImportStatus(values.status ?? 'Approuvé'),
      type: normalizeImportType(values.type ?? 'Interne'),
      priority: normalizeImportPriority(values.priority ?? 'Moyenne'),
      location: values.location?.trim() || null,
      description: values.description?.trim() || null,
      allDay,
    });
  });

  return { rows, errors };
}

export async function buildAppointmentImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DGA — Rendez-vous';
  const sheet = workbook.addWorksheet('Import RDV', { properties: { defaultRowHeight: 20 } });

  sheet.mergeCells('A1:L1');
  const title = sheet.getCell('A1');
  title.value = 'Import historique des rendez-vous';
  title.font = { size: 14, bold: true };

  sheet.mergeCells('A2:L2');
  sheet.getCell('A2').value =
    'Renseignez une ligne par rendez-vous. Les anciens RDV sont importés en statut Approuvé par défaut.';
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  const headers = [
    'Titre',
    'Date',
    'Heure début',
    'Heure fin',
    'Email demandeur',
    'Statut',
    'Type',
    'Priorité',
    'Emplacement',
    'Description',
    'Toute la journée',
  ];
  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  });

  const sampleDate = `15/03/${new Date().getFullYear()}`;

  const sample = sheet.getRow(5);
  [
    'Audience ministère',
    sampleDate,
    '10:00',
    '11:00',
    'manager@organisation.local',
    'Approuvé',
    'Interne',
    'Moyenne',
    'Salle du Conseil',
    'Suivi dossier réglementaire',
    'Non',
  ].forEach((v, i) => {
    sample.getCell(i + 1).value = v;
  });

  sheet.columns = [
    { width: 28 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 20 },
    { width: 32 },
    { width: 14 },
  ];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type AppointmentImportRowError = {
  line: number;
  message: string;
};

export type AppointmentImportResult = {
  created: number;
  skipped: number;
  errors: AppointmentImportRowError[];
};

/** Enregistre les lignes déjà validées par le parseur Excel. */
export async function importHistoricalAppointments(
  rows: AppointmentImportRow[],
  actorId: string
): Promise<AppointmentImportResult> {
  const { isMockDataEnabled } = await import('@/lib/mock/config');
  if (isMockDataEnabled()) {
    const { mockImportAppointments } = await import('@/lib/mock/store');
    return mockImportAppointments(rows, actorId);
  }

  const { buildImportedAppointmentDescription } = await import('@/lib/dg/appointment-request-meta');
  const { parseDateTime } = await import('@/lib/dg/scheduling');
  const { APP_TIMEZONE } = await import('@/lib/datetime/locale');
  const { prisma } = await import('@/lib/prisma');

  const errors: AppointmentImportRowError[] = [];
  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const row of rows) {
    const requester = await prisma.user.findUnique({
      where: { email: row.requesterEmail },
      select: { id: true, email: true, firstName: true, lastName: true, active: true, role: true },
    });
    if (!requester || !requester.active) {
      errors.push({
        line: row.line,
        message: `Demandeur introuvable : ${row.requesterEmail}`,
      });
      skipped += 1;
      continue;
    }

    const startAt = parseDateTime(row.date, row.startTime);
    const endAt = parseDateTime(row.date, row.endTime);
    if (!(endAt > startAt)) {
      errors.push({ line: row.line, message: 'L’heure de fin doit être après le début.' });
      skipped += 1;
      continue;
    }

    const reviewed = row.status !== 'PENDING';
    const name = `${requester.firstName} ${requester.lastName}`.trim() || requester.email;

    try {
      await prisma.appointment.create({
        data: {
          title: row.title.slice(0, 191),
          description: buildImportedAppointmentDescription(row.description),
          startAt,
          endAt,
          status: row.status,
          priority: row.priority,
          type: row.type,
          requestedById: requester.id,
          reviewedById: reviewed ? actorId : null,
          reviewedAt: reviewed ? now : null,
          location: row.location,
          timezone: APP_TIMEZONE,
          allDay: row.allDay,
          participants: {
            create: {
              email: requester.email,
              name: name.slice(0, 191),
              userId: requester.id,
              isExternal: requester.role === 'EXTERNAL',
            },
          },
        },
      });
      created += 1;
    } catch {
      errors.push({ line: row.line, message: 'Erreur lors de l’enregistrement de la ligne.' });
      skipped += 1;
    }
  }

  if (created > 0) {
    await prisma.auditLog
      .create({
        data: {
          userId: actorId,
          action: 'appointment.import',
          meta: { created, skipped },
        },
      })
      .catch(() => undefined);
  }

  return { created, skipped, errors };
}
