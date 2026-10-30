import { verifyPassword } from '../lib/auth/password';
import { prisma } from '../lib/prisma';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/test-user-password.ts <email> <password>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('email:', user.email);
  console.log('active:', user.active);
  console.log('hasHash:', Boolean(user.passwordHash));
  if (user.passwordHash) {
    console.log('match:', await verifyPassword(password, user.passwordHash));
  }
}

main().finally(() => prisma.$disconnect());
