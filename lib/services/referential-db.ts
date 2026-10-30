import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import type { ReferentialItemMeta } from '@/lib/dg/referential-types';
import type { ReferentialItem } from '@/lib/mock/referentials-store';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

function toItem(row: {
  id: string;
  categoryId: string;
  name: string;
  value: string | null;
  meta: unknown;
  archived: boolean;
}): ReferentialItem {
  return {
    id: row.id,
    categoryId: row.categoryId as ReferentialCategoryId,
    name: row.name,
    value: row.value ?? undefined,
    meta: (row.meta ?? undefined) as ReferentialItemMeta | undefined,
    archived: row.archived,
  };
}

export async function countReferentialsByCategory(
  categoryId: ReferentialCategoryId,
  archived: boolean
): Promise<number> {
  return prisma.referentialItem.count({
    where: { categoryId, archived },
  });
}

export async function dbListReferentialItems(
  categoryId: ReferentialCategoryId,
  archived: boolean
): Promise<ReferentialItem[]> {
  const rows = await prisma.referentialItem.findMany({
    where: { categoryId, archived },
    orderBy: { name: 'asc' },
  });
  return rows.map(toItem);
}

export async function dbGetReferentialItem(id: string): Promise<ReferentialItem | null> {
  const row = await prisma.referentialItem.findUnique({ where: { id } });
  return row ? toItem(row) : null;
}

export async function dbCreateReferentialItem(data: {
  categoryId: ReferentialCategoryId;
  name: string;
  value?: string;
  meta?: ReferentialItemMeta;
}): Promise<ReferentialItem> {
  const row = await prisma.referentialItem.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      value: data.value ?? null,
      meta: data.meta ? (data.meta as Prisma.InputJsonValue) : undefined,
    },
  });
  return toItem(row);
}

export async function dbUpdateReferentialItem(
  id: string,
  patch: Partial<Pick<ReferentialItem, 'name' | 'value' | 'meta' | 'archived'>>
): Promise<ReferentialItem | null> {
  try {
    const row = await prisma.referentialItem.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.value !== undefined ? { value: patch.value ?? null } : {}),
        ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
        ...(patch.meta !== undefined
          ? { meta: patch.meta ? (patch.meta as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
    });
    return toItem(row);
  } catch {
    return null;
  }
}

export async function dbPurgeReferentialItem(id: string): Promise<boolean> {
  try {
    await prisma.referentialItem.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function dbEmptyReferentialsTrash(): Promise<number> {
  const result = await prisma.referentialItem.deleteMany({ where: { archived: true } });
  return result.count;
}

export async function dbListAllTrashItems(): Promise<ReferentialItem[]> {
  const rows = await prisma.referentialItem.findMany({
    where: { archived: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(toItem);
}
