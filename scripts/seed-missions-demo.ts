import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

const DEMO_MISSIONS = [
  {
    subject: 'Mission de représentation — sommet régional',
    missionType: 'Conférence',
    destination: '🇸🇳 Sénégal',
    destinations: ['SN'],
    details: 'Sommet régional — coordination bilatérale.',
    departAt: daysFromNow(5),
    returnAt: daysFromNow(8),
    status: 'PLANNED' as const,
    participants: 'DGA + conseiller technique',
    archived: false,
    archivedAt: null as Date | null,
  },
  {
    subject: 'Mission de travail — harmonisation réglementaire',
    missionType: 'Mission internationale',
    destination: '🇨🇮 Côte d’Ivoire',
    destinations: ['CI'],
    details: 'Coordination UEMOA et partenaires techniques.',
    departAt: daysFromNow(8),
    returnAt: daysFromNow(11),
    status: 'PLANNED' as const,
    participants: 'DGA, 2 conseillers',
    archived: false,
    archivedAt: null,
  },
  {
    subject: 'Audit qualité des opérateurs — tournée nationale',
    missionType: 'Mission de contrôle',
    destination: '🇬🇳 Guinée',
    destinations: ['GN'],
    details: 'Visites terrain et comités de suivi.',
    departAt: daysFromNow(14),
    returnAt: daysFromNow(18),
    status: 'ONGOING' as const,
    participants: 'DGA, direction technique',
    archived: false,
    archivedAt: null,
  },
  {
    subject: 'Forum annuel régulation numérique',
    missionType: 'Conférence',
    destination: '🇪🇹 Éthiopie',
    destinations: ['ET'],
    details: 'Addis-Abeba — panel régulateurs africains.',
    departAt: daysFromNow(21),
    returnAt: daysFromNow(24),
    status: 'PLANNED' as const,
    participants: 'DGA',
    archived: false,
    archivedAt: null,
  },
  {
    subject: 'Mission annulée — forum télécoms',
    missionType: 'Conférence',
    destination: '🇸🇳 Sénégal',
    destinations: ['SN'],
    details: null,
    departAt: daysFromNow(-20),
    returnAt: daysFromNow(-18),
    status: 'CANCELLED' as const,
    participants: 'DGA',
    archived: true,
    archivedAt: daysFromNow(-5),
  },
  {
    subject: 'Mission reportée — salon innovation',
    missionType: 'Séminaire',
    destination: '🇲🇦 Maroc',
    destinations: ['MA'],
    details: 'Reportée pour contraintes agenda.',
    departAt: daysFromNow(-12),
    returnAt: daysFromNow(-10),
    status: 'CANCELLED' as const,
    participants: 'DGA, attaché de presse',
    archived: true,
    archivedAt: daysFromNow(-2),
  },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const mission of DEMO_MISSIONS) {
    const exists = await prisma.dgMission.findFirst({
      where: { subject: mission.subject },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await prisma.dgMission.create({ data: mission });
    inserted += 1;
  }

  const counts = {
    active: await prisma.dgMission.count({ where: { archived: false } }),
    trash: await prisma.dgMission.count({ where: { archived: true } }),
  };

  console.log(`✓ ${inserted} mission(s) insérée(s), ${skipped} déjà présente(s).`);
  console.log(`  Actives : ${counts.active} — Corbeille : ${counts.trash}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
