import { verifyPassword } from '../lib/auth/password';
import { verifyCredentialsLogin } from '../lib/auth/credentials-login';
import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, active: true, passwordHash: true },
    orderBy: { email: 'asc' },
  });

  console.log('--- Utilisateurs en base ---');
  for (const u of users) {
    console.log(`${u.email} | role=${u.role} | active=${u.active} | password=${u.passwordHash ? 'oui' : 'NON'}`);
  }

  const tests = [
    ['kabaa222@gmail.com', 'password123'],
    ['assistante@organisation.local', 'password123'],
    ['admin@arpt.dz', 'password123'],
  ];

  console.log('\n--- Test connexion ---');
  for (const [email, password] of tests) {
    const result = await verifyCredentialsLogin(email, password);
    console.log(`${email} / ${password} =>`, result.ok ? `OK (${result.user.role})` : result.error);
  }
}

main().finally(() => prisma.$disconnect());
