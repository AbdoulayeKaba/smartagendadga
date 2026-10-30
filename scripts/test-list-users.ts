import { listUsers } from '../lib/services/users-admin';
import { prisma } from '../lib/prisma';

async function main() {
  try {
    const users = await listUsers();
    console.log('OK', users.length, users[0]);
  } catch (e) {
    console.error('FAIL', e);
  }
}

main().finally(() => prisma.$disconnect());
