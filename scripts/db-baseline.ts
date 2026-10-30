/**
 * Aligne la base `pointage` sur le schéma Prisma actuel :
 * 1. Marque les migrations en attente comme appliquées (historique hérité instable).
 * 2. Exécute `prisma db push` pour créer les tables DG manquantes.
 */
import { execSync } from 'node:child_process';
import { prisma } from '../lib/prisma';

const ALL_MIGRATIONS = [
  '20250504120000_init_pointage_mysql',
  '20260504124715_pointage',
  '20260504140000_public_holidays_and_leaves',
  '20260504152000_rbac_audit_leave_workflow',
  '20260504160000_audit_logs',
  '20260507103000_webauthn_biometric',
  '20260507155000_esmt_admissions_core',
  '20260507162000_school_core_entities',
  '20260507170000_academic_management_core',
  '20260507173000_notifications_core',
  '20260508091500_leave_workflow_pivot',
  '20260508094000_arpt_leave_platform_core',
  '20260508112500_arpt_leave_suite_core',
  '20260522120000_dg_appointments_core',
  '20260522120000_user_security_fields',
  '20260522140000_user_microsoft_oauth',
  '20260522160000_platform_settings',
  '20260602120000_dg_referentials_workspace',
  '20260603100000_mission_destinations_details',
  '20260603120000_mission_type',
  '20260604100000_mission_hotel_reservations',
  '20260604120000_user_role_string',
  '20260605100000_user_role_string',
];

const REQUIRED_TABLES = [
  'users',
  'appointments',
  'participants',
  'dg_notifications',
  'dg_audit_logs',
  'platform_settings',
  'dg_referential_items',
  'dg_tasks',
  'dg_task_comments',
  'dg_task_attachments',
  'dg_task_history',
  'dg_decisions',
  'dg_mail_records',
  'dg_strategic_contacts',
  'dg_audience_records',
  'dg_official_invitations',
  'dg_missions',
  'dg_mission_hotel_reservations',
  'dg_mission_hotel_reservation_attachments',
  'dg_important_deadlines',
  'dg_vault_documents',
];

async function appliedMigrations(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  );
  return new Set(rows.map((r) => r.migration_name));
}

function run(cmd: string) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
  const applied = await appliedMigrations();

  for (const name of ALL_MIGRATIONS) {
    if (applied.has(name)) continue;
    try {
      run(`npx prisma migrate resolve --applied ${name}`);
    } catch {
      console.warn(`[warn] impossible de marquer ${name} — peut-être déjà en échec, tentative rolled-back puis applied`);
      try {
        run(`npx prisma migrate resolve --rolled-back ${name}`);
        run(`npx prisma migrate resolve --applied ${name}`);
      } catch (e) {
        console.error(`[error] ${name}`, e);
      }
    }
  }

  run('npx prisma db push --accept-data-loss');

  const rows = await prisma.$queryRawUnsafe<{ t: string }[]>(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  const tables = new Set(rows.map((r) => r.t));
  const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));

  console.log('\n=== Tables DG requises ===');
  for (const t of REQUIRED_TABLES) {
    console.log(`  ${tables.has(t) ? '✓' : '✗'} ${t}`);
  }

  if (missing.length > 0) {
    console.error('\nTables manquantes:', missing.join(', '));
    process.exit(1);
  }

  console.log('\nBase alignée sur le schéma Prisma actuel.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
