import { hashPassword } from '../lib/auth/password';
import { prisma } from '../lib/prisma';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/reset-user-password.ts <email> <nouveau-mot-de-passe>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Utilisateur introuvable: ${email}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      active: true,
    },
  });

  console.log(`Mot de passe mis à jour pour ${email} (compte réactivé).`);
}

main().finally(() => prisma.$disconnect());
