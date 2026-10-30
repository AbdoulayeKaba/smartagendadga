import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import { DEFAULT_APPOINTMENT_BUSINESS_RULES } from '../lib/dg/appointment-business-rules';
import {
  DEFAULT_PLATFORM_CONFIG,
  serializePlatformConfig,
} from '../lib/dg/platform-config';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/dg/permission-catalog';
import { APPOINTMENT_BUSINESS_RULES_KEY } from '../lib/services/appointment-business-rules-admin';
import { DEFAULT_REFERENTIAL_SEED } from '../lib/seed/referentials-default';
import { DEMO_MAIL_RECORDS, demoMailToPrismaCreate } from '../lib/seed/mail-demo-data';
import {
  DEMO_APPOINTMENT_RECORDS,
  demoAppointmentToPrismaCreate,
} from '../lib/seed/appointments-demo-data';
import {
  DEMO_REPORT_RECORDS,
  demoReportToPrismaCreate,
} from '../lib/seed/reports-demo-data';

const prisma = new PrismaClient();
const ROLE_PERMISSIONS_KEY = 'dg_role_permissions';

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  const passwordHash = await hashPassword(process.env.SEED_PASSWORD ?? 'password123');

  await prisma.dgTaskHistory.deleteMany();
  await prisma.dgTaskComment.deleteMany();
  await prisma.dgTaskAttachment.deleteMany();
  await prisma.dgTask.deleteMany();
  await prisma.dgDecision.deleteMany();
  await prisma.dgMissionHotelReservationAttachment.deleteMany();
  await prisma.dgMissionHotelReservation.deleteMany();
  await prisma.dgMailAttachment.deleteMany();
  await prisma.mailRecord.deleteMany();
  await prisma.strategicContact.deleteMany();
  await prisma.audienceRecord.deleteMany();
  await prisma.officialInvitation.deleteMany();
  await prisma.dgMission.deleteMany();
  await prisma.importantDeadline.deleteMany();
  await prisma.vaultDocument.deleteMany();
  await prisma.referentialItem.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.platformSetting.deleteMany();
  await prisma.user.deleteMany();

  const dg = await prisma.user.create({
    data: {
      email: 'dg@organisation.local',
      passwordHash,
      firstName: 'Directeur',
      lastName: 'General',
      role: 'DG',
      department: 'Direction',
    },
  });

  const assistant = await prisma.user.create({
    data: {
      email: 'assistante@organisation.local',
      passwordHash,
      firstName: 'Marie',
      lastName: 'Diallo',
      role: 'ASSISTANT',
      department: 'Cabinet DGA',
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@organisation.local',
      passwordHash,
      firstName: 'Ibrahim',
      lastName: 'Camara',
      role: 'MANAGER',
      department: 'Affaires reglementaires',
    },
  });

  await prisma.user.create({
    data: {
      email: 'externe@partenaire.local',
      passwordHash,
      firstName: 'Sophie',
      lastName: 'Martin',
      role: 'EXTERNAL',
      department: 'Partenaire',
    },
  });

  const assistantName = `${assistant.firstName} ${assistant.lastName}`;

  for (const row of DEFAULT_REFERENTIAL_SEED) {
    await prisma.referentialItem.create({
      data: {
        categoryId: row.categoryId,
        name: row.name,
        value: row.value ?? null,
        meta: row.meta ?? undefined,
      },
    });
  }

  const platformSerialized = serializePlatformConfig(DEFAULT_PLATFORM_CONFIG);
  for (const [key, value] of Object.entries(platformSerialized)) {
    await prisma.platformSetting.create({
      data: { key, value, updatedById: assistant.id },
    });
  }

  await prisma.platformSetting.create({
    data: {
      key: APPOINTMENT_BUSINESS_RULES_KEY,
      value: JSON.stringify(DEFAULT_APPOINTMENT_BUSINESS_RULES),
      updatedById: assistant.id,
    },
  });

  await prisma.platformSetting.create({
    data: {
      key: ROLE_PERMISSIONS_KEY,
      value: JSON.stringify({
        permissions: DEFAULT_ROLE_PERMISSIONS,
        archived: [],
        descriptions: {},
        customRoles: [],
      }),
      updatedById: assistant.id,
    },
  });

  for (const row of DEMO_APPOINTMENT_RECORDS) {
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
              name: assistantName,
              userId: assistant.id,
            },
          ],
        },
      },
    });
  }

  const task = await prisma.dgTask.create({
    data: {
      title: 'Preparer note de synthese Conseil',
      description: 'Consolidation des indicateurs trimestriels.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      projectName: 'Conseil T2',
      projectPhase: 'Preparation',
      assigneeName: 'Direction Technique',
      startAt: daysFromNow(-4),
      dueAt: daysFromNow(3),
      estimatedHours: 12,
      createdById: assistant.id,
    },
  });

  await prisma.dgTaskHistory.create({
    data: {
      taskId: task.id,
      userId: assistant.id,
      userName: assistantName,
      action: 'task.create',
      detail: task.title,
    },
  });

  await prisma.dgDecision.create({
    data: {
      title: 'Renforcement controle qualite reseau',
      context: 'Suite a la reunion du comite technique.',
      decisionText: 'Lancer un audit cible sur 3 operateurs.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      ownerName: 'Direction Regulation',
      dueAt: daysFromNow(14),
      meetingDate: daysFromNow(-7),
      createdById: assistant.id,
    },
  });

  for (const mailRow of DEMO_MAIL_RECORDS) {
    await prisma.mailRecord.create({
      data: demoMailToPrismaCreate(mailRow, daysFromNow),
    });
  }

  for (const reportRow of DEMO_REPORT_RECORDS) {
    await prisma.vaultDocument.create({
      data: demoReportToPrismaCreate(reportRow, daysFromNow, assistant.id),
    });
  }

  await prisma.strategicContact.create({
    data: {
      category: 'MINISTRY',
      fullName: 'Dr. Aissatou Bah',
      jobTitle: 'Directrice des affaires generales',
      organization: 'Ministere des Postes et Telecommunications',
      email: 'a.bah@ministere.gov',
      phone: '+224 620 00 00 01',
    },
  });

  await prisma.officialInvitation.create({
    data: {
      organizer: 'Union Africaine des Regulateurs',
      eventTitle: 'Forum annuel regulation numerique',
      eventDate: daysFromNow(21),
      location: 'Addis-Abeba',
      importance: 'HIGH',
      status: 'RECEIVED',
    },
  });

  await prisma.dgMission.create({
    data: {
      subject: 'Mission de representation — sommet regional',
      missionType: 'Conférence',
      destination: '🇸🇳 Sénégal',
      destinations: ['SN'],
      details: 'Sommet regional — coordination bilaterale.',
      departAt: daysFromNow(10),
      returnAt: daysFromNow(13),
      status: 'PLANNED',
      participants: 'DGA + conseiller technique',
    },
  });

  await prisma.importantDeadline.create({
    data: {
      title: 'Renouvellement convention operateur A',
      kind: 'RENEWAL',
      status: 'DUE_SOON',
      dueAt: daysFromNow(5),
      ownerName: 'Direction Juridique',
      description: 'Relecture clauses tarifaires',
      alertDaysBefore: 14,
    },
  });

  await prisma.vaultDocument.create({
    data: {
      title: 'Projet de decision — audit qualite',
      category: 'DECISION',
      fileName: 'projet-decision-audit.pdf',
      fileSize: 245_000,
      storageKey: `vault/${assistant.id}/seed-audit.pdf`,
      reportDate: daysFromNow(-14),
      tags: ['audit', 'qualite'],
      restricted: true,
      uploadedById: assistant.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed DG complet — mot de passe:', process.env.SEED_PASSWORD ?? 'password123');
  // eslint-disable-next-line no-console
  console.log('  DG:', dg.email);
  // eslint-disable-next-line no-console
  console.log('  Assistante:', assistant.email);
  // eslint-disable-next-line no-console
  console.log('  Manager:', manager.email);
  // eslint-disable-next-line no-console
  console.log('  Referentiels:', DEFAULT_REFERENTIAL_SEED.length, 'elements');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
