/**
 * Démo : 3 rendez-vous EN ATTENTE par jour ouvré,
 * du jour courant (Africa/Conakry) au 30 octobre 2026.
 * Les jours absents du référentiel (week-end) et les jours fériés actifs sont ignorés.
 * Relancer remplace uniquement ce lot (ids demo-pending-*).
 */
import 'dotenv/config';
import { PrismaClient, type AppointmentType, type Priority } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIX = 'demo-pending-';
const END = '2026-10-30';
const DURATION_MINUTES = 45;

const WEEKDAY_BY_UTC = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const SUBJECTS = [
  'Point de coordination cabinet',
  'Audience partenaire technique',
  'Revue des dossiers réglementaires',
  'Suivi des opérateurs',
  'Entretien direction technique',
  'Briefing de préparation',
  'Point ministère de tutelle',
  'Comité de préparation',
  'Audience institutionnelle',
  'Cadrage projet numérique',
  'Point conformité et licences',
  'Réunion interdirections',
  'Suivi des réclamations',
  'Préparation de note',
  'Point communication institutionnelle',
] as const;

const PLACES = ['Cabinet du DGA', 'Salle du conseil', 'Salle de réunion A', 'Salle de réunion B'] as const;
const TYPES: AppointmentType[] = ['EXTERNAL', 'INTERNAL', 'MINISTRY'];
const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];

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

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function at(day: string, minutes: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0, 0));
}

function parseHm(value: string | undefined, fallback: string): number {
  const source = value?.trim() || fallback;
  const [h, m] = source.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    const [fh, fm] = fallback.split(':').map(Number);
    return fh * 60 + fm;
  }
  return h * 60 + m;
}

function overlaps(start: number, end: number, blockStart: number, blockEnd: number): boolean {
  return start < blockEnd && end > blockStart;
}

function defaultSlots(workStart: number, workEnd: number, lunchStart: number, lunchEnd: number): number[] {
  const candidates = [workStart + 60, workStart + 150, lunchEnd + 60];
  return candidates.filter((start) => {
    const end = start + DURATION_MINUTES;
    if (start < workStart || end > workEnd) return false;
    if (overlaps(start, end, lunchStart, lunchEnd)) return false;
    return true;
  });
}

function todaySlots(
  now: Date,
  workStart: number,
  workEnd: number,
  lunchStart: number,
  lunchEnd: number
): number[] {
  const earliest = Math.ceil((now.getUTCHours() * 60 + now.getUTCMinutes() + 20) / 15) * 15;
  const found: number[] = [];
  for (let start = Math.max(workStart, earliest); start + DURATION_MINUTES <= workEnd; start += 15) {
    const end = start + DURATION_MINUTES;
    if (overlaps(start, end, lunchStart, lunchEnd)) continue;
    if (found.length > 0 && start < found[found.length - 1] + DURATION_MINUTES + 15) continue;
    found.push(start);
    if (found.length === 3) break;
  }
  return found;
}

function embedMeta(userText: string, meta: Record<string, unknown>): string {
  const block = `<!--APPT_META:${JSON.stringify(meta)}-->`;
  return `${block}\n${userText}`;
}

function holidayDates(items: { value: string | null; meta: unknown }[]): Set<string> {
  const dates = new Set<string>();
  for (const item of items) {
    const meta = item.meta;
    if (meta && typeof meta === 'object' && 'active' in meta && (meta as { active?: boolean }).active === false) {
      continue;
    }
    const fromMeta =
      meta && typeof meta === 'object' && 'date' in meta && typeof (meta as { date?: unknown }).date === 'string'
        ? (meta as { date: string }).date
        : '';
    const date = fromMeta || item.value || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
  }
  return dates;
}

async function main() {
  const start = todayIso();
  if (start > END) {
    throw new Error(`La date du jour (${start}) est après le ${END}.`);
  }

  const settings = await prisma.platformSetting.findMany({
    where: {
      key: {
        in: ['workingDays', 'workDayStart', 'workDayEnd', 'lunchBreakStart', 'lunchBreakEnd'],
      },
    },
  });
  const byKey = new Map(settings.map((row) => [row.key, row.value]));

  let workingDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  try {
    const parsed = JSON.parse(byKey.get('workingDays') ?? '[]') as unknown;
    if (Array.isArray(parsed) && parsed.every((day) => typeof day === 'string')) {
      workingDays = parsed;
    }
  } catch {
    workingDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  }
  const open = new Set(workingDays);

  const workStart = parseHm(byKey.get('workDayStart'), '08:00');
  const workEnd = parseHm(byKey.get('workDayEnd'), '18:00');
  const lunchStart = parseHm(byKey.get('lunchBreakStart'), '12:30');
  const lunchEnd = parseHm(byKey.get('lunchBreakEnd'), '14:00');

  const holidays = holidayDates(
    await prisma.referentialItem.findMany({
      where: { categoryId: 'jours-feries', archived: false },
      select: { value: true, meta: true },
    })
  );

  const users = await prisma.user.findMany({
    where: { active: true, archived: false },
    select: { id: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  if (users.length === 0) throw new Error('Aucun utilisateur actif.');
  const requesters = users.filter((user) => user.role !== 'DG' && user.role !== 'ASSISTANT');
  const pool = requesters.length > 0 ? requesters : users.filter((user) => user.role !== 'DG');
  const requesterPool = pool.length > 0 ? pool : users;

  const now = new Date();
  const skipped: string[] = [];
  const rows: {
    id: string;
    title: string;
    description: string;
    startAt: Date;
    endAt: Date;
    status: 'PENDING';
    priority: Priority;
    type: AppointmentType;
    requestedById: string;
    reviewedById: null;
    reviewedAt: null;
    rejectionReason: null;
    isOnlineMeeting: false;
    location: string;
    timezone: string;
    urgentOverride: false;
    archived: false;
  }[] = [];

  let dayIndex = 0;
  for (const day of eachDay(start, END)) {
    const weekday = WEEKDAY_BY_UTC[new Date(`${day}T00:00:00Z`).getUTCDay()];
    if (!open.has(weekday) || holidays.has(day)) {
      skipped.push(day);
      continue;
    }

    const starts =
      day === start
        ? todaySlots(now, workStart, workEnd, lunchStart, lunchEnd)
        : defaultSlots(workStart, workEnd, lunchStart, lunchEnd).slice(0, 3);

    if (starts.length < 3) {
      throw new Error(
        `Impossible de placer 3 créneaux le ${day} dans les horaires du référentiel (${starts.length} trouvé(s)).`
      );
    }

    starts.forEach((minutes, slotIndex) => {
      const startAt = at(day, minutes);
      const place = PLACES[(dayIndex + slotIndex) % PLACES.length];
      const subject = SUBJECTS[(dayIndex * 3 + slotIndex) % SUBJECTS.length];
      const requester = requesterPool[(dayIndex + slotIndex) % requesterPool.length];
      rows.push({
        id: `${PREFIX}${day.replaceAll('-', '')}-${slotIndex + 1}`,
        title: subject,
        description: embedMeta('Demande de démonstration, en attente de validation.', {
          urgencyLevel: 'NORMAL',
          preContact: [],
          meetingFormat: 'PRESENTIEL',
          locationRef: place,
        }),
        startAt,
        endAt: new Date(startAt.getTime() + DURATION_MINUTES * 60 * 1000),
        status: 'PENDING',
        priority: PRIORITIES[slotIndex],
        type: TYPES[slotIndex],
        requestedById: requester.id,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        isOnlineMeeting: false,
        location: place,
        timezone: 'Africa/Conakry',
        urgentOverride: false,
        archived: false,
      });
    });
    dayIndex += 1;
  }

  const removed = await prisma.appointment.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });

  await prisma.appointment.createMany({ data: rows });

  console.log(
    JSON.stringify({
      removed: removed.count,
      inserted: rows.length,
      days: dayIndex,
      perDay: 3,
      from: start,
      to: END,
      skipped,
      status: 'PENDING',
    })
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
