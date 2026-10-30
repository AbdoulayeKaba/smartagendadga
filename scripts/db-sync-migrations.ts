/**
 * Applique les migrations Prisma en marquant comme « déjà appliquées »
 * celles dont les tables existent déjà (récupération après échec partiel).
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../lib/prisma';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

function tableNamesFromSql(sql: string): string[] {
  const names: string[] = [];
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`([^`]+)`/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    names.push(m[1]);
  }
  return names;
}

async function existingTables(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ t: string }[]>(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  return new Set(rows.map((r) => r.t));
}

async function appliedMigrations(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  );
  return new Set(rows.map((r) => r.migration_name));
}

async function main() {
  const tables = await existingTables();
  const applied = await appliedMigrations();

  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    if (applied.has(dir)) continue;

    const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
    let sql: string;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      console.warn(`[skip] ${dir} — migration.sql introuvable`);
      continue;
    }

    const expected = tableNamesFromSql(sql);
    const allExist =
      expected.length > 0 && expected.every((t) => tables.has(t));

    if (allExist) {
      console.log(`[resolve] ${dir} — tables déjà présentes: ${expected.join(', ')}`);
      execSync(`npx prisma migrate resolve --applied ${dir}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      continue;
    }
  }

  console.log('\n--- prisma migrate deploy ---\n');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
