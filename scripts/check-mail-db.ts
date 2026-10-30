import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.mailRecord.count();
  const sample = await prisma.mailRecord.findMany({
    take: 3,
    orderBy: { mailDate: 'desc' },
    select: { id: true, reference: true, direction: true, mailDate: true },
  });
  console.log('mail_count', count);
  console.log(
    'sample_years',
    sample.map((r) => ({
      reference: r.reference,
      direction: r.direction,
      year: r.mailDate.getFullYear(),
    }))
  );

  try {
    const withAttachments = await prisma.mailRecord.findMany({
      take: 1,
      include: { attachments: true },
    });
    console.log('attachments_include_ok', withAttachments.length > 0);
  } catch (error) {
    console.error('attachments_include_error', error);
  }
}

main()
  .finally(() => void prisma.$disconnect());
