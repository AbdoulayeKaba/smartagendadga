import { prisma } from '../lib/prisma';
import { updateUser } from '../lib/services/users-admin';

async function main() {
  const u = await prisma.user.findFirst({
    where: { email: 'kabaa222@gmail.com' },
    select: { id: true, email: true, active: true, archived: true, role: true },
  });
  console.log('user:', u);
  if (!u) return;

  const result = await updateUser(u.id, { active: false }, 'test-script');
  console.log('updateUser result:', result);

  if (result.ok) {
    await updateUser(u.id, { active: true }, 'test-script');
    console.log('reverted to active');
  }
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
