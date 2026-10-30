import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import { REFERENTIAL_CATEGORIES } from '@/lib/dg/referential-catalog';
import { DEFAULT_PLATFORM_CONFIG, type PlatformConfig } from '@/lib/dg/platform-config';
import {
  getHolidayMeta,
  getUnavailabilityMeta,
  isUnavailabilityMeta,
} from '@/lib/dg/referential-types';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockCreateReferential,
  mockEmptyReferentialsTrash,
  mockGetReferential,
  mockListReferentials,
  mockPurgeReferential,
  mockUpdateReferential,
  type ReferentialItem,
} from '@/lib/mock/referentials-store';
import {
  countReferentialsByCategory,
  dbCreateReferentialItem,
  dbEmptyReferentialsTrash,
  dbGetReferentialItem,
  dbListAllTrashItems,
  dbListReferentialItems,
  dbPurgeReferentialItem,
  dbUpdateReferentialItem,
} from '@/lib/services/referential-db';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/services/platform-settings';
import { validateReferentialPayload } from '@/lib/services/referential-validation';

export type ScheduleSettings = Pick<
  PlatformConfig,
  | 'workDayStart'
  | 'workDayEnd'
  | 'slotDurationMinutes'
  | 'defaultAppointmentDurationMinutes'
  | 'allowedDurationMinutes'
  | 'bufferMinutes'
  | 'maxAppointmentsPerDay'
  | 'maxAppointmentsPerWeek'
  | 'allowOutsideHours'
  | 'allowWeekendAppointments'
  | 'lunchBreakStart'
  | 'lunchBreakEnd'
  | 'workingDays'
  | 'timezone'
  | 'autoRejectBeforeStartMinutes'
>;

export async function getReferentialsOverview() {
  const schedule = await getPlatformSettings();
  const counts: Record<string, { active: number; trash: number }> = {};

  for (const cat of REFERENTIAL_CATEGORIES) {
    if (cat.kind === 'schedule') continue;
    if (isMockDataEnabled()) {
      counts[cat.id] = {
        active: mockListReferentials(cat.id, false).length,
        trash: mockListReferentials(cat.id, true).length,
      };
    } else {
      counts[cat.id] = {
        active: await countReferentialsByCategory(cat.id, false),
        trash: await countReferentialsByCategory(cat.id, true),
      };
    }
  }

  return {
    schedule: normalizeScheduleSettings(schedule),
    counts,
  };
}

export function normalizeScheduleSettings(schedule: PlatformConfig): ScheduleSettings {
  const allowed =
    schedule.allowedDurationMinutes?.length > 0
      ? schedule.allowedDurationMinutes
      : DEFAULT_PLATFORM_CONFIG.allowedDurationMinutes;
  const defaultDuration =
    schedule.defaultAppointmentDurationMinutes ?? schedule.slotDurationMinutes ?? 30;
  return {
    workDayStart: schedule.workDayStart ?? DEFAULT_PLATFORM_CONFIG.workDayStart,
    workDayEnd: schedule.workDayEnd ?? DEFAULT_PLATFORM_CONFIG.workDayEnd,
    slotDurationMinutes: defaultDuration,
    defaultAppointmentDurationMinutes: allowed.includes(defaultDuration)
      ? defaultDuration
      : allowed[0] ?? 30,
    allowedDurationMinutes: allowed,
    bufferMinutes: schedule.bufferMinutes ?? DEFAULT_PLATFORM_CONFIG.bufferMinutes,
    maxAppointmentsPerDay:
      schedule.maxAppointmentsPerDay ?? DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerDay,
    maxAppointmentsPerWeek:
      schedule.maxAppointmentsPerWeek ?? DEFAULT_PLATFORM_CONFIG.maxAppointmentsPerWeek,
    allowOutsideHours:
      schedule.allowOutsideHours ?? DEFAULT_PLATFORM_CONFIG.allowOutsideHours,
    allowWeekendAppointments:
      schedule.allowWeekendAppointments ?? DEFAULT_PLATFORM_CONFIG.allowWeekendAppointments,
    lunchBreakStart: schedule.lunchBreakStart ?? DEFAULT_PLATFORM_CONFIG.lunchBreakStart,
    lunchBreakEnd: schedule.lunchBreakEnd ?? DEFAULT_PLATFORM_CONFIG.lunchBreakEnd,
    workingDays: schedule.workingDays?.length
      ? schedule.workingDays
      : DEFAULT_PLATFORM_CONFIG.workingDays,
    timezone: schedule.timezone ?? DEFAULT_PLATFORM_CONFIG.timezone,
    autoRejectBeforeStartMinutes:
      schedule.autoRejectBeforeStartMinutes ??
      DEFAULT_PLATFORM_CONFIG.autoRejectBeforeStartMinutes,
  };
}

function itemMatchesSearch(item: ReferentialItem, q: string): boolean {
  const haystack = [
    item.name,
    item.value,
    item.meta && 'motif' in item.meta ? item.meta.motif : '',
    item.meta && 'date' in item.meta ? item.meta.date : '',
    item.meta && 'type' in item.meta ? String(item.meta.type) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function sortReferentialItems(
  categoryId: ReferentialCategoryId,
  items: ReferentialItem[]
): ReferentialItem[] {
  return [...items].sort((a, b) => {
    if (categoryId === 'jours-feries') {
      const da = getHolidayMeta(a).date;
      const db = getHolidayMeta(b).date;
      return da.localeCompare(db);
    }
    if (categoryId === 'indisponibilites') {
      const da = getUnavailabilityMeta(a)?.startDate ?? '';
      const db = getUnavailabilityMeta(b)?.startDate ?? '';
      return da.localeCompare(db);
    }
    return a.name.localeCompare(b.name, 'fr');
  });
}

export async function listAllTrashItems(search?: string): Promise<ReferentialItem[]> {
  let items = isMockDataEnabled()
    ? (() => {
        const cats = REFERENTIAL_CATEGORIES.filter((c) => c.kind === 'list').map((c) => c.id);
        const all: ReferentialItem[] = [];
        for (const cat of cats) all.push(...mockListReferentials(cat, true));
        return all;
      })()
    : await dbListAllTrashItems();

  const q = search?.trim().toLowerCase();
  if (q) items = items.filter((i) => itemMatchesSearch(i, q));
  return items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function listReferentialItems(
  categoryId: ReferentialCategoryId,
  opts: { archived?: boolean; search?: string }
): Promise<ReferentialItem[]> {
  const archived = opts.archived ?? false;
  let items = isMockDataEnabled()
    ? mockListReferentials(categoryId, archived)
    : await dbListReferentialItems(categoryId, archived);

  const q = opts.search?.trim().toLowerCase();
  if (q) items = items.filter((i) => itemMatchesSearch(i, q));
  return sortReferentialItems(categoryId, items);
}

export async function getReferentialItemById(id: string): Promise<ReferentialItem | null> {
  if (isMockDataEnabled()) return mockGetReferential(id) ?? null;
  return dbGetReferentialItem(id);
}

export async function createReferentialItem(data: {
  categoryId: ReferentialCategoryId;
  name: string;
  value?: string;
  meta?: unknown;
}) {
  const validated = validateReferentialPayload(data.categoryId, data);
  if (!validated.ok) return { ok: false as const, error: validated.error };

  const payload = {
    categoryId: data.categoryId,
    name: data.name.trim(),
    value: validated.value,
    meta: validated.meta,
  };

  if (isMockDataEnabled()) {
    const item = mockCreateReferential(payload);
    return { ok: true as const, item };
  }

  const item = await dbCreateReferentialItem(payload);
  return { ok: true as const, item };
}

export async function updateReferentialItem(
  id: string,
  patch: Partial<Pick<ReferentialItem, 'name' | 'value' | 'meta' | 'archived'>>
) {
  if (isMockDataEnabled()) {
    const existing = mockGetReferential(id);
    if (!existing) return { ok: false as const, error: 'NOT_FOUND' };

    if (patch.name !== undefined || patch.meta !== undefined || patch.value !== undefined) {
      const validated = validateReferentialPayload(existing.categoryId, {
        name: patch.name ?? existing.name,
        value: patch.value ?? existing.value,
        meta: patch.meta ?? existing.meta,
      });
      if (!validated.ok) return { ok: false as const, error: validated.error };
      const item = mockUpdateReferential(id, {
        ...patch,
        name: patch.name ?? existing.name,
        value: validated.value,
        meta: validated.meta,
      });
      if (!item) return { ok: false as const, error: 'NOT_FOUND' };
      return { ok: true as const, item };
    }

    const item = mockUpdateReferential(id, patch);
    if (!item) return { ok: false as const, error: 'NOT_FOUND' };
    return { ok: true as const, item };
  }

  const existing = await dbGetReferentialItem(id);
  if (!existing) return { ok: false as const, error: 'NOT_FOUND' };

  if (patch.name !== undefined || patch.meta !== undefined || patch.value !== undefined) {
    const validated = validateReferentialPayload(existing.categoryId, {
      name: patch.name ?? existing.name,
      value: patch.value ?? existing.value,
      meta: patch.meta ?? existing.meta,
    });
    if (!validated.ok) return { ok: false as const, error: validated.error };
    const item = await dbUpdateReferentialItem(id, {
      ...patch,
      name: patch.name ?? existing.name,
      value: validated.value,
      meta: validated.meta,
    });
    if (!item) return { ok: false as const, error: 'NOT_FOUND' };
    return { ok: true as const, item };
  }

  const item = await dbUpdateReferentialItem(id, patch);
  if (!item) return { ok: false as const, error: 'NOT_FOUND' };
  return { ok: true as const, item };
}

export async function purgeReferentialItem(id: string) {
  if (isMockDataEnabled()) {
    const ok = mockPurgeReferential(id);
    return ok ? { ok: true as const } : { ok: false as const, error: 'NOT_FOUND' };
  }
  const ok = await dbPurgeReferentialItem(id);
  return ok ? { ok: true as const } : { ok: false as const, error: 'NOT_FOUND' };
}

export async function emptyReferentialsTrash() {
  if (isMockDataEnabled()) return { purged: mockEmptyReferentialsTrash() };
  const purged = await dbEmptyReferentialsTrash();
  return { purged };
}

export async function updateScheduleSettings(
  patch: Partial<ScheduleSettings>,
  userId: string
) {
  const normalized: Partial<PlatformConfig> = { ...patch };
  if (patch.defaultAppointmentDurationMinutes !== undefined) {
    normalized.slotDurationMinutes = patch.defaultAppointmentDurationMinutes;
  }
  const settings = await updatePlatformSettings(normalized, userId);
  return normalizeScheduleSettings(settings);
}

export async function listActiveHolidays(): Promise<ReferentialItem[]> {
  const items = await listReferentialItems('jours-feries', { archived: false });
  return items.filter((i) => getHolidayMeta(i).active);
}

export async function listActiveUnavailabilities(): Promise<ReferentialItem[]> {
  const items = await listReferentialItems('indisponibilites', { archived: false });
  return items.filter((i) => {
    const m = getUnavailabilityMeta(i);
    return m?.active ?? false;
  });
}

export { isUnavailabilityMeta };
