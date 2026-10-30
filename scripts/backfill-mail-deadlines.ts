/**
 * Reprise de données : attribue un délai d'exécution aux courriers entrants
 * encore actifs qui n'en ont pas, avec la même règle que l'enregistrement
 * (jours ouvrés selon la priorité).
 *
 * Usage : npx tsx scripts/backfill-mail-deadlines.ts [--apply]
 * Sans --apply, le script se contente d'afficher le plan (dry-run).
 */
import { PrismaClient } from '@prisma/client';
import { computeMailExecutionDeadline } from '../lib/workspace/mail-utils';

const prisma = new PrismaClient();

const ACTIVE_STATUSES = ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] as const;

async function main() {
  const apply = process.argv.includes('--apply');

  const rows = await prisma.mailRecord.findMany({
    where: {
      direction: 'INCOMING',
      executionDeadline: null,
      workflowStatus: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      id: true,
      reference: true,
      mailDate: true,
      priority: true,
      workflowStatus: true,
    },
    orderBy: { mailDate: 'asc' },
  });

  if (rows.length === 0) {
    console.log('Aucun courrier entrant actif sans délai. Rien à faire.');
    return;
  }

  const plan = rows.flatMap((row) => {
    const mailDate = row.mailDate.toISOString().slice(0, 10);
    const deadline = computeMailExecutionDeadline(mailDate, row.priority);
    return deadline ? [{ ...row, mailDate, deadline }] : [];
  });

  console.log(`${plan.length} courrier(s) à mettre à jour ${apply ? '(application)' : '(dry-run)'} :`);
  for (const item of plan) {
    console.log(
      `  ${item.reference} — ${item.workflowStatus} — enreg. ${item.mailDate} — délai ${item.deadline}`
    );
  }

  if (!apply) {
    console.log('\nRelancer avec --apply pour écrire les délais en base.');
    return;
  }

  let updated = 0;
  for (const item of plan) {
    await prisma.mailRecord.update({
      where: { id: item.id },
      data: { executionDeadline: new Date(item.deadline) },
    });
    updated += 1;
  }
  console.log(`\n${updated} délai(s) écrit(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
