/**
 * Rendez-vous de démo : 5 créneaux de 15 min par jour,
 * du 20 octobre 2026 au 20 novembre 2026 (Africa/Conakry = UTC).
 * Relancer remplace uniquement ce lot (ids demo-rdv-*).
 */
import { PrismaClient, type AppointmentStatus, type AppointmentType, type Priority } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIX = 'demo-rdv-';
const START = '2026-10-20';
const END = '2026-11-20';

const SLOTS = [
  { hour: 9, minute: 0 },
  { hour: 10, minute: 15 },
  { hour: 11, minute: 30 },
  { hour: 14, minute: 30 },
  { hour: 16, minute: 15 },
] as const;

const SUBJECTS = [
  'Point de coordination cabinet',
  'Audience partenaire technique',
  'Revue des dossiers réglementaires',
  'Suivi des opérateurs',
  'Entretien direction technique',
  'Briefing hebdomadaire',
  'Point ministère de tutelle',
  'Comité de préparation',
  'Audience institutionnelle',
  'Cadrage projet numérique',
  'Point conformité et licences',
  'Réunion interdirections',
  'Suivi des réclamations',
  'Préparation déplacement',
  'Point communication',
] as const;

const PLACES = [
  'Cabinet du DGA',
  'Salle du conseil',
  'Salle de réunion A',
  'Ministère de tutelle',
  'Visioconférence',
] as const;

const TYPES: AppointmentType[] = ['INTERNAL', 'EXTERNAL', 'MINISTRY', 'INTERNAL', 'EXTERNAL'];
const PRIORITIES: Priority[] = ['MEDIUM', 'HIGH', 'LOW', 'MEDIUM', 'HIGH'];

function eachDay(start: string, end: string): string[] {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const cursor = new Date(Date.UTC(ys, ms - 1, ds));
  const last = Date.UTC(ye, me - 1, de);
  const days: string[] = [];
  while (cursor.getTime() <= last) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function at(day: string, hour: number, minute: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0, 0));
}

function embedMeta(userText: string, meta: Record<string, unknown>): string {
  const block = `<!--APPT_META:${JSON.stringify(meta)}-->`;
  return userText ? `${block}\n${userText}` : block;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { active: true, archived: false },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  if (users.length === 0) {
    throw new Error('Aucun utilisateur actif. Impossible de créer les rendez-vous.');
  }

  const reviewer =
    users.find((user) => user.role === 'ASSISTANT') ??
    users.find((user) => user.role === 'DG') ??
    users[0];
  const requesters = users.filter((user) => user.role !== 'DG');
  const pool = requesters.length > 0 ? requesters : users;

  const removed = await prisma.appointment.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });

  const now = new Date();
  const days = eachDay(START, END);
  const rows = days.flatMap((day, dayIndex) =>
    SLOTS.map((slot, slotIndex) => {
      const startAt = at(day, slot.hour, slot.minute);
      const endAt = new Date(startAt.getTime() + 15 * 60 * 1000);
      const future = startAt.getTime() > now.getTime();
      const pendingSlot = slotIndex === 1 || slotIndex === 4;
      const status: AppointmentStatus = future && pendingSlot ? 'PENDING' : 'APPROVED';
      const online = slotIndex === 4;
      const place = PLACES[(dayIndex + slotIndex) % PLACES.length];
      const subject = SUBJECTS[(dayIndex * 3 + slotIndex) % SUBJECTS.length];
      const requester = pool[(dayIndex + slotIndex) % pool.length];
      const stamp = day.replaceAll('-', '');

      return {
        id: `${PREFIX}${stamp}-${slotIndex + 1}`,
        title: subject,
        description: embedMeta('Créneau de démonstration pour la présentation du cabinet.', {
          urgencyLevel: slotIndex === 1 ? 'URGENT' : 'NORMAL',
          preContact: [],
          meetingFormat: online ? 'ONLINE' : 'PRESENTIEL',
          locationRef: online ? undefined : place,
        }),
        startAt,
        endAt,
        status,
        priority: PRIORITIES[slotIndex],
        type: TYPES[slotIndex],
        requestedById: requester.id,
        reviewedById: status === 'APPROVED' ? reviewer.id : null,
        reviewedAt: status === 'APPROVED' ? now : null,
        isOnlineMeeting: online,
        location: online ? 'Microsoft Teams' : place,
        timezone: 'Africa/Conakry',
        urgentOverride: false,
        archived: false,
      };
    })
  );

  const chunkSize = 40;
  for (let index = 0; index < rows.length; index += chunkSize) {
    await prisma.appointment.createMany({ data: rows.slice(index, index + chunkSize) });
  }

  const approved = rows.filter((row) => row.status === 'APPROVED').length;
  const pending = rows.length - approved;
  console.log(
    JSON.stringify({
      removed: removed.count,
      inserted: rows.length,
      days: days.length,
      perDay: SLOTS.length,
      durationMinutes: 15,
      from: START,
      to: END,
      approved,
      pending,
    })
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
