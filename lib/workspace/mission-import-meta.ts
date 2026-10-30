const EXCEL_IMPORT_MARKER = 'Importé depuis un fichier Excel.';

export function buildImportedMissionDetails(details: string | null | undefined): string | null {
  const trimmed = details?.trim() ?? '';
  if (!trimmed) return EXCEL_IMPORT_MARKER;
  if (trimmed.includes(EXCEL_IMPORT_MARKER)) return trimmed;
  return `${trimmed}\n\n— ${EXCEL_IMPORT_MARKER}`;
}

export function isMissionImportedFromExcel(details: string | null | undefined): boolean {
  return (details ?? '').includes(EXCEL_IMPORT_MARKER);
}
