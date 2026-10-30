/**
 * Injecte les comptes rendus de démo dans MySQL sans réinitialiser la base.
 * Usage :
 *   npm run db:seed:reports
 *   npm run db:seed:reports -- --force
 */
import { PrismaClient } from '@prisma/client';
import { DEMO_REPORT_RECORDS, demoReportToPrismaCreate } from '../lib/seed/reports-demo-data';

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const demoIds = DEMO_REPORT_RECORDS.map((row) => row.id);

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  const assistant = await prisma.user.findFirst({
    where: { email: 'assistante@organisation.local' },
    select: { id: true },
  });
  if (!assistant) {
    console.error('Utilisateur assistante@organisation.local introuvable. Lancez d’abord npm run db:seed');
    process.exit(1);
  }

  const existing = await prisma.vaultDocument.count({ where: { category: 'REPORT' } });

  if (existing > 0 && !force) {
    const demoCount = await prisma.vaultDocument.count({
      where: { id: { in: demoIds }, category: 'REPORT' },
    });
    if (demoCount >= DEMO_REPORT_RECORDS.length) {
      console.log(`${demoCount} compte(s) rendu de démo déjà présents. Aucune insertion.`);
      return;
    }
    console.log(
      `Insertion des comptes rendus de démo manquants (${demoCount}/${DEMO_REPORT_RECORDS.length})…`
    );
  }

  if (force) {
    await prisma.vaultDocument.deleteMany({ where: { id: { in: demoIds } } });
    console.log('Comptes rendus de démo existants supprimés.');
  }

  for (const row of DEMO_REPORT_RECORDS) {
    const found = await prisma.vaultDocument.findUnique({ where: { id: row.id } });
    if (found && !force) continue;

    if (found) {
      await prisma.vaultDocument.delete({ where: { id: row.id } });
    }

    await prisma.vaultDocument.create({
      data: demoReportToPrismaCreate(row, daysFromNow, assistant.id),
    });
  }

  const { ensureDemoReportPdfFiles } = await import('../lib/seed/ensure-demo-report-files');
  const pdfCount = await ensureDemoReportPdfFiles();
  console.log(`✓ Fichiers PDF de démo prêts (${pdfCount}).`);

  const active = DEMO_REPORT_RECORDS.filter((r) => !r.archived).length;
  const trash = DEMO_REPORT_RECORDS.filter((r) => r.archived).length;
  console.log(`✓ ${DEMO_REPORT_RECORDS.length} comptes rendus de démo (${active} actifs, ${trash} corbeille).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
