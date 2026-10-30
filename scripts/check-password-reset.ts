import { prisma } from '../lib/prisma';
import { getPlatformSettings } from '../lib/services/platform-settings';
import { smtpConfigReady } from '../lib/services/smtp-mailer';

async function main() {
  const cols = await prisma.$queryRawUnsafe<{ Field: string }[]>(
    "SHOW COLUMNS FROM users LIKE 'password_reset%'"
  );
  console.log('reset_columns:', cols.map((c) => c.Field));

  const user = await prisma.user.findUnique({
    where: { email: 'kaba.abdoulaye@arpt.gov.gn' },
    select: { id: true, active: true, archived: true, passwordHash: true },
  });
  console.log('user:', {
    exists: Boolean(user),
    active: user?.active ?? null,
    archived: user?.archived ?? null,
    hasPassword: Boolean(user?.passwordHash),
  });

  const settings = await getPlatformSettings();
  console.log('smtp_ready:', smtpConfigReady(settings));
  console.log('smtp_host:', settings.smtpHost || '(empty)');
  console.log('smtp_from:', settings.smtpFromEmail || '(empty)');
  console.log('smtp_user_set:', Boolean(settings.smtpUser?.trim()));
  console.log('smtp_pass_set:', Boolean(settings.smtpPassword?.trim()));
}

main()
  .catch((e) => {
    console.error('ERR', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
