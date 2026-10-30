import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { generateDailyAgenda } from '@/lib/ai/services/daily-agenda';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseReferenceDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request) {
  const { error } = await requireApiPermission('appointments.review', ['ASSISTANT', 'DG']);
  if (error) return error;

  let referenceDate: Date | undefined;
  try {
    const body = (await request.json().catch(() => null)) as { date?: unknown } | null;
    referenceDate = parseReferenceDate(body?.date);
  } catch {
    referenceDate = undefined;
  }

  try {
    const result = await generateDailyAgenda(referenceDate);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[ai/agenda/daily]', e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
