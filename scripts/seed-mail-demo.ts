/**
 * Injecte les courriers de démo dans MySQL sans réinitialiser la base.
 * Usage :
 *   npm run db:seed:mail
 *   npm run db:seed:mail -- --force
 */
import { PrismaClient } from '@prisma/client';
import { DEMO_MAIL_RECORDS, demoMailToPrismaCreate } from '../lib/seed/mail-demo-data';

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const demoIds = DEMO_MAIL_RECORDS.map((row) => row.id);

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  const existing = await prisma.mailRecord.count();

  if (existing > 0 && !force) {
    const demoCount = await prisma.mailRecord.count({ where: { id: { in: demoIds } } });
    if (demoCount >= DEMO_MAIL_RECORDS.length) {
      console.log(`${demoCount} courrier(s) de démo déjà présents. Aucune insertion.`);
      return;
    }
    console.log(`Insertion des courriers de démo manquants (${demoCount}/${DEMO_MAIL_RECORDS.length})…`);
  }

  if (force) {
    await prisma.dgMailAttachment.deleteMany({ where: { mailId: { in: demoIds } } });
    await prisma.mailRecord.deleteMany({ where: { id: { in: demoIds } } });
    console.log('Courriers de démo existants supprimés.');
  }

  for (const row of DEMO_MAIL_RECORDS) {
    const found = await prisma.mailRecord.findUnique({ where: { id: row.id } });
    if (found && !force) continue;

    if (found) {
      await prisma.dgMailAttachment.deleteMany({ where: { mailId: row.id } });
      await prisma.mailRecord.delete({ where: { id: row.id } });
    }

    await prisma.mailRecord.create({
      data: demoMailToPrismaCreate(row, daysFromNow),
    });
  }

  console.log(`✓ ${DEMO_MAIL_RECORDS.length} courriers de démo disponibles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
