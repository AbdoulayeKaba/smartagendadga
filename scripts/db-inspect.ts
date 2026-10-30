import { prisma } from '../lib/prisma';

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ Tables_in_pointage: string }[]>(
    'SHOW TABLES'
  );
  console.log('TABLES:', tables.map((r) => Object.values(r)[0]).sort().join(', '));

  const migrations = await prisma.$queryRawUnsafe<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at');
  console.log('MIGRATIONS:');
  for (const m of migrations) {
    const status = m.rolled_back_at ? 'rolled_back' : m.finished_at ? 'applied' : 'failed/pending';
    console.log(`  ${m.migration_name} — ${status}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
