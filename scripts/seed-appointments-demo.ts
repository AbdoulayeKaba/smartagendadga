/**
 * Injecte les rendez-vous de démo dans MySQL sans réinitialiser la base.
 * Usage :
 *   npm run db:seed:appointments
 *   npm run db:seed:appointments -- --force
 */
import { PrismaClient } from '@prisma/client';
import {
  DEMO_APPOINTMENT_RECORDS,
  demoAppointmentToPrismaCreate,
} from '../lib/seed/appointments-demo-data';

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const demoIds = DEMO_APPOINTMENT_RECORDS.map((row) => row.id);

async function main() {
  const assistant = await prisma.user.findFirst({
    where: { email: 'assistante@organisation.local' },
  });
  if (!assistant) {
    console.error('Utilisateur assistante@organisation.local introuvable. Lancez d’abord npm run db:seed');
    process.exit(1);
  }

  const existing = await prisma.appointment.count({ where: { id: { in: demoIds } } });
  if (existing >= DEMO_APPOINTMENT_RECORDS.length && !force) {
    console.log(`${existing} rendez-vous de démo déjà présents. Aucune insertion.`);
    return;
  }

  if (force) {
    await prisma.participant.deleteMany({ where: { appointmentId: { in: demoIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: demoIds } } });
    console.log('Rendez-vous de démo existants supprimés.');
  }

  for (const row of DEMO_APPOINTMENT_RECORDS) {
    const found = await prisma.appointment.findUnique({ where: { id: row.id } });
    if (found && !force) continue;
    if (found) {
      await prisma.participant.deleteMany({ where: { appointmentId: row.id } });
      await prisma.appointment.delete({ where: { id: row.id } });
    }

    const data = demoAppointmentToPrismaCreate(row, {
      requestedById: assistant.id,
      reviewedById: assistant.id,
    });

    await prisma.appointment.create({
      data: {
        ...data,
        participants: {
          create: [
            {
              email: assistant.email,
              name: `${assistant.firstName} ${assistant.lastName}`,
              userId: assistant.id,
            },
          ],
        },
      },
    });
  }

  console.log(`✓ ${DEMO_APPOINTMENT_RECORDS.length} rendez-vous de démo disponibles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
