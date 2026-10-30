import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { analyzeAppointmentUrgency } from '@/lib/ai/services/reformulate-urgency';

export async function POST(req: Request) {
  const { error } = await requireApiPermission('appointments.review', ['ASSISTANT', 'DG']);
  if (error) return error;

  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      justification?: string;
      declaredLevel?: UrgencyLevel;
      priority?: string;
      type?: string;
    };

    const result = await analyzeAppointmentUrgency({
      title: body.title ?? '',
      description: body.description ?? '',
      justification: body.justification,
      declaredLevel: body.declaredLevel ?? 'NORMAL',
      priority: body.priority,
      type: body.type,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error('[ai/appointments/analyze-urgency]', e);
    return NextResponse.json({ error: 'ANALYSIS_FAILED' }, { status: 500 });
  }
}
