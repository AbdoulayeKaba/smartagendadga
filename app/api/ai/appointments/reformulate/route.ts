import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import { reformulateAppointmentRequest } from '@/lib/ai/services/reformulate-urgency';

export async function POST(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG', 'MANAGER', 'EXTERNAL']);
  if (error) return error;

  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      justification?: string;
      urgencyLevel?: UrgencyLevel;
      type?: string;
    };

    const result = await reformulateAppointmentRequest({
      title: body.title ?? '',
      description: body.description ?? '',
      justification: body.justification,
      urgencyLevel: body.urgencyLevel,
      type: body.type,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error('[ai/appointments/reformulate]', e);
    return NextResponse.json({ error: 'REFORMULATE_FAILED' }, { status: 500 });
  }
}
