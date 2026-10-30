import { createUser } from '../lib/services/users-admin';
import { isMockDataEnabled } from '../lib/mock/config';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('isMockDataEnabled:', isMockDataEnabled());
  const before = await prisma.user.count();
  console.log('users before:', before);

  const r = await createUser(
    {
      email: 'kabaa222@gmail.com',
      firstName: 'Abdoulaye',
      lastName: 'KABA',
      role: 'MANAGER',
      department: 'DSI',
      password: 'Password123!',
    },
    'seed-assistant'
  );
  console.log('result:', r);

  const after = await prisma.user.count();
  console.log('users after:', after);
  const row = await prisma.user.findUnique({ where: { email: 'kabaa222@gmail.com' } });
  console.log('row:', row ? { email: row.email, role: row.role } : null);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
