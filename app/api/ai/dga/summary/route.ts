import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { generateDgaDaySummary } from '@/lib/ai/services/dga-summary';

export async function POST() {
  const { error } = await requireApiPermission('appointments.review', ['ASSISTANT', 'DG']);
  if (error) return error;

  try {
    const result = await generateDgaDaySummary();
    return NextResponse.json(result);
  } catch (e) {
    console.error('[ai/dga/summary]', e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
