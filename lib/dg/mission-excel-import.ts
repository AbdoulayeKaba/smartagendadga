import ExcelJS from 'exceljs';
import {
  normalizeDestinationCodes,
  resolveCountryCodeFromLabel,
} from '@/lib/workspace/mission-countries';
import { DEFAULT_MISSION_TYPE } from '@/lib/workspace/mission-types';
import type { MissionStatus } from '@/lib/workspace/types';

export type MissionImportField =
  | 'subject'
  | 'missionType'
  | 'destinations'
  | 'departAt'
  | 'returnAt'
  | 'participants'
  | 'details'
  | 'status';

const HEADER_ALIASES: Record<string, MissionImportField> = {
  objet: 'subject',
  subject: 'subject',
  titre: 'subject',
  title: 'subject',
  type: 'missionType',
  'type mission': 'missionType',
  missiontype: 'missionType',
  destination: 'destinations',
  destinations: 'destinations',
  pays: 'destinations',
  'date depart': 'departAt',
  'date départ': 'departAt',
  depart: 'departAt',
  départ: 'departAt',
  start: 'departAt',
  'date retour': 'returnAt',
  retour: 'returnAt',
  end: 'returnAt',
  participants: 'participants',
  participant: 'participants',
  details: 'details',
  détails: 'details',
  description: 'details',
  notes: 'details',
  statut: 'status',
  status: 'status',
};

export type MissionImportRow = {
  line: number;
  subject: string;
  missionType: string;
  destinations: string[];
  departAt: string;
  returnAt: string;
  participants: string;
  details: string | null;
  status: MissionStatus;
};

export type MissionImportParseError = {
  line: number;
  message: string;
};

export type MissionImportParseResult = {
  rows: MissionImportRow[];
  errors: MissionImportParseError[];
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

export function normalizeImportMissionStatus(input: string): MissionStatus {
  const v = input.trim().toLowerCase();
  if (v.includes('annul') || v === 'cancelled' || v === 'canceled') return 'CANCELLED';
  if (v.includes('cours') || v === 'ongoing') return 'ONGOING';
  if (v.includes('plan') || v === 'planned') return 'PLANNED';
  if (
    v.includes('termin') ||
    v.includes('clotur') ||
    v.includes('clôtur') ||
    v === 'completed' ||
    v.includes('achev')
  ) {
    return 'COMPLETED';
  }
  return 'COMPLETED';
}

export function inferImportMissionStatus(
  departAt: string,
  returnAt: string,
  explicit?: string
): MissionStatus {
  if (explicit?.trim()) return normalizeImportMissionStatus(explicit);
  const now = new Date();
  const depart = new Date(`${departAt}T00:00:00`);
  const ret = new Date(`${returnAt}T23:59:59`);
  if (ret.getTime() < now.getTime()) return 'COMPLETED';
  if (depart.getTime() <= now.getTime() && now.getTime() <= ret.getTime()) return 'ONGOING';
  return 'PLANNED';
}

function parseDestinations(raw: string): string[] {
  const parts = raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const codes: string[] = [];
  for (const part of parts) {
    const code = resolveCountryCodeFromLabel(part);
    if (code) codes.push(code);
  }
  return normalizeDestinationCodes(codes);
}

function mapHeaders(headerRow: ExcelJS.Row): Map<number, MissionImportField> {
  const map = new Map<number, MissionImportField>();
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const field = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (field) map.set(col, field);
  });
  return map;
}

function hasRequiredImportColumns(columnMap: Map<number, MissionImportField>): boolean {
  const fields = [...columnMap.values()];
  return fields.includes('subject') && fields.includes('departAt') && fields.includes('returnAt');
}

function findHeaderRow(sheet: ExcelJS.Worksheet): {
  rowNumber: number;
  columnMap: Map<number, MissionImportField>;
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

export async function parseMissionImportWorkbook(buffer: Buffer): Promise<MissionImportParseResult> {
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
            'En-têtes introuvables. La première ligne doit contenir au minimum : Objet, Date départ, Date retour.',
        },
      ],
    };
  }

  const { rowNumber: headerRowNumber, columnMap } = header;
  const rows: MissionImportRow[] = [];
  const errors: MissionImportParseError[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values: Partial<Record<MissionImportField, string>> = {};
    let hasContent = false;
    columnMap.forEach((field, col) => {
      const text = cellValue(row.getCell(col).value);
      if (text) hasContent = true;
      values[field] = text;
    });
    if (!hasContent) return;

    const subject = values.subject?.trim() ?? '';
    if (!subject) {
      errors.push({ line: rowNumber, message: 'Objet manquant.' });
      return;
    }

    const departRaw = values.departAt ?? '';
    const departAt = parseIsoDate(departRaw);
    if (!departAt) {
      errors.push({ line: rowNumber, message: `Date de départ invalide : « ${departRaw} ».` });
      return;
    }

    const returnRaw = values.returnAt ?? '';
    const returnAt = parseIsoDate(returnRaw);
    if (!returnAt) {
      errors.push({ line: rowNumber, message: `Date de retour invalide : « ${returnRaw} ».` });
      return;
    }

    if (returnAt < departAt) {
      errors.push({ line: rowNumber, message: 'La date de retour doit être après le départ.' });
      return;
    }

    const destinations = values.destinations ? parseDestinations(values.destinations) : [];
    if (destinations.length === 0) {
      errors.push({
        line: rowNumber,
        message: 'Destination invalide ou manquante (code ISO ou nom de pays).',
      });
      return;
    }

    rows.push({
      line: rowNumber,
      subject,
      missionType: values.missionType?.trim() || DEFAULT_MISSION_TYPE,
      destinations,
      departAt,
      returnAt,
      participants: values.participants?.trim() ?? '',
      details: values.details?.trim() || null,
      status: inferImportMissionStatus(departAt, returnAt, values.status),
    });
  });

  return { rows, errors };
}

export async function buildMissionImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DGA — Missions';
  const sheet = workbook.addWorksheet('Import missions', { properties: { defaultRowHeight: 20 } });

  sheet.mergeCells('A1:I1');
  const title = sheet.getCell('A1');
  title.value = 'Import historique des missions';
  title.font = { size: 14, bold: true };

  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value =
    'Renseignez une ligne par mission. Les missions passées sont importées en statut Terminée par défaut.';
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  const headers = [
    'Objet',
    'Type',
    'Destinations',
    'Date départ',
    'Date retour',
    'Participants',
    'Détails',
    'Statut',
  ];
  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  });

  const sampleDateDepart = `10/03/${new Date().getFullYear()}`;
  const sampleDateReturn = `14/03/${new Date().getFullYear()}`;

  const sample = sheet.getRow(5);
  [
    'Mission de coordination régionale',
    'Mission officielle',
    'Guinée; Sénégal',
    sampleDateDepart,
    sampleDateReturn,
    'Équipe technique ARPT',
    'Suivi des recommandations du conseil',
    'Terminée',
  ].forEach((v, i) => {
    sample.getCell(i + 1).value = v;
  });

  sheet.columns = [
    { width: 32 },
    { width: 22 },
    { width: 24 },
    { width: 14 },
    { width: 14 },
    { width: 24 },
    { width: 32 },
    { width: 12 },
  ];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
