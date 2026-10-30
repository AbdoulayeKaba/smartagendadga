import { INLINE_REPORT_FILE_NAME, INLINE_REPORT_STORAGE_KEY } from '@/lib/workspace/report-content';
import type { VaultDocument } from '@/lib/workspace/types';

export type DemoReportSeed = {
  id: string;
  title: string;
  reportDateOffset: number;
  uploadedAtOffset: number;
  fileName: string;
  fileSize: number;
  storageKey: string;
  bodyHtml: string | null;
  archived?: boolean;
  archivedAtOffset?: number | null;
};

export const DEMO_REPORT_RECORDS: DemoReportSeed[] = [
  {
    id: 'report-demo-1',
    title: 'Compte rendu mission Conakry',
    reportDateOffset: -12,
    uploadedAtOffset: -10,
    fileName: 'cr-mission-conakry.pdf',
    fileSize: 890_000,
    storageKey: 'reports/report-demo-1/cr-mission-conakry.pdf',
    bodyHtml: null,
  },
  {
    id: 'report-demo-2',
    title: 'Compte rendu visite institutionnelle',
    reportDateOffset: -28,
    uploadedAtOffset: -25,
    fileName: INLINE_REPORT_FILE_NAME,
    fileSize: 1_240,
    storageKey: INLINE_REPORT_STORAGE_KEY,
    bodyHtml:
      '<p><strong>Visite institutionnelle</strong> — synthèse des échanges avec le cabinet et les directions techniques.</p><p>Points clés : calendrier de mise en œuvre, indicateurs de suivi et prochaines échéances.</p>',
  },
  {
    id: 'report-demo-3',
    title: 'Revue budgétaire trimestrielle',
    reportDateOffset: -18,
    uploadedAtOffset: -16,
    fileName: 'revue-budget-t2-2026.pdf',
    fileSize: 1_520_000,
    storageKey: 'reports/report-demo-3/revue-budget-t2-2026.pdf',
    bodyHtml: null,
  },
  {
    id: 'report-demo-4',
    title: 'Rapport de coordination ARPT',
    reportDateOffset: -8,
    uploadedAtOffset: -7,
    fileName: INLINE_REPORT_FILE_NAME,
    fileSize: 980,
    storageKey: INLINE_REPORT_STORAGE_KEY,
    bodyHtml:
      '<p>Coordination avec l’ARPT sur le déploiement des mesures de conformité réseau.</p><ul><li>Revue des indicateurs qualité de service</li><li>Plan d’actions partagé avec les opérateurs</li></ul>',
  },
  {
    id: 'report-demo-5',
    title: 'EFGFEK — Proposition de partenariat technique',
    reportDateOffset: -6,
    uploadedAtOffset: -5,
    fileName: 'proposition-partenariat-cellcom.pdf',
    fileSize: 1_540,
    storageKey: 'reports/report-demo-5/proposition-partenariat-cellcom.pdf',
    bodyHtml: null,
  },
  {
    id: 'report-demo-6',
    title: 'Compte rendu réunion comité technique',
    reportDateOffset: -3,
    uploadedAtOffset: -2,
    fileName: 'cr-comite-technique-juillet.pdf',
    fileSize: 645_000,
    storageKey: 'reports/report-demo-6/cr-comite-technique-juillet.pdf',
    bodyHtml: null,
  },
  {
    id: 'report-demo-7',
    title: 'Synthèse audience DGA — partenaires régionaux',
    reportDateOffset: -1,
    uploadedAtOffset: -1,
    fileName: INLINE_REPORT_FILE_NAME,
    fileSize: 760,
    storageKey: INLINE_REPORT_STORAGE_KEY,
    bodyHtml:
      '<p><strong>Audience du 8 juillet 2026</strong></p><p>Présentation des engagements mutuels et validation du calendrier de suivi bilatéral.</p>',
  },
  {
    id: 'report-demo-8',
    title: 'Ancien compte rendu mission Labé',
    reportDateOffset: -90,
    uploadedAtOffset: -88,
    fileName: 'cr-mission-labe-2025.pdf',
    fileSize: 412_000,
    storageKey: 'reports/report-demo-8/cr-mission-labe-2025.pdf',
    bodyHtml: null,
    archived: true,
    archivedAtOffset: -45,
  },
  {
    id: 'report-demo-9',
    title: 'Brouillon séminaire régulation numérique',
    reportDateOffset: -120,
    uploadedAtOffset: -118,
    fileName: INLINE_REPORT_FILE_NAME,
    fileSize: 540,
    storageKey: INLINE_REPORT_STORAGE_KEY,
    bodyHtml: '<p>Brouillon non finalisé — à compléter avant diffusion.</p>',
    archived: true,
    archivedAtOffset: -60,
  },
];

function offsetDate(daysFromNow: (n: number) => Date, offset: number): string {
  return daysFromNow(offset).toISOString();
}

export function demoReportToVaultDocument(
  row: DemoReportSeed,
  daysFromNow: (n: number) => Date,
  uploadedById = 'mock-assistant'
): VaultDocument {
  const archived = row.archived ?? false;
  return {
    id: row.id,
    title: row.title,
    category: 'REPORT',
    version: 1,
    fileName: row.fileName,
    fileSize: row.fileSize,
    storageKey: row.storageKey,
    reportDate: offsetDate(daysFromNow, row.reportDateOffset),
    bodyHtml: row.bodyHtml,
    tags: [],
    uploadedById,
    uploadedAt: offsetDate(daysFromNow, row.uploadedAtOffset),
    restricted: false,
    archived,
    archivedAt:
      archived && row.archivedAtOffset != null
        ? offsetDate(daysFromNow, row.archivedAtOffset)
        : null,
  };
}

export function demoReportToPrismaCreate(
  row: DemoReportSeed,
  daysFromNow: (n: number) => Date,
  uploadedById: string
) {
  const archived = row.archived ?? false;
  return {
    id: row.id,
    title: row.title,
    category: 'REPORT' as const,
    version: 1,
    fileName: row.fileName,
    fileSize: row.fileSize,
    storageKey: row.storageKey,
    reportDate: daysFromNow(row.reportDateOffset),
    bodyHtml: row.bodyHtml,
    tags: [] as string[],
    restricted: false,
    archived,
    archivedAt:
      archived && row.archivedAtOffset != null ? daysFromNow(row.archivedAtOffset) : null,
    uploadedById,
    uploadedAt: daysFromNow(row.uploadedAtOffset),
  };
}
