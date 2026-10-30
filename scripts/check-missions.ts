import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.dgMission.findMany({
    select: { id: true, subject: true, archived: true, archivedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Total:', all.length);
  for (const m of all) {
    console.log(`- [${m.archived ? 'corbeille' : 'active'}] ${m.subject}`);
  }
}

main().finally(() => prisma.$disconnect());
