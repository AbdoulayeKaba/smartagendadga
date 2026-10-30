import { NextResponse } from 'next/server';
import { buildAssistantAiContext } from '@/lib/ai/context';
import { requireApiPermission } from '@/lib/auth/permission-guard';

export async function POST() {
  const { error } = await requireApiPermission('appointments.review', ['ASSISTANT', 'DG']);
  if (error) return error;

  try {
    const ctx = await buildAssistantAiContext();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      pressure: ctx.pressure,
    });
  } catch (e) {
    console.error('[ai/agenda/pressure]', e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
