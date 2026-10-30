import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import { validateAppointmentRequest } from '@/lib/services/appointment-request-validation';

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  allDay: z.boolean().optional(),
  urgencyLevel: z.enum(['NORMAL', 'URGENT', 'TRES_URGENT', 'CRITIQUE']).default('NORMAL'),
  justification: z.string().optional(),
  preContact: z.array(z.enum(['chef_service', 'directeur', 'aucun'])).default([]),
  appointmentTypeRef: z.string().optional(),
  requesterRole: z.enum(['MANAGER', 'EXTERNAL', 'ASSISTANT', 'DG']).default('MANAGER'),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const rules = await getAppointmentBusinessRules();
    const result = await validateAppointmentRequest(
      {
        requestedById: session.userId,
        requesterRole: parsed.data.requesterRole,
        title: parsed.data.title,
        description: parsed.data.description,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        allDay: parsed.data.allDay,
        urgencyLevel: parsed.data.urgencyLevel,
        justification: parsed.data.justification,
        preContact: parsed.data.preContact,
        appointmentTypeRef: parsed.data.appointmentTypeRef,
      },
      { rules }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('[appointment-constraints/test]', err);
    return NextResponse.json(
      { error: 'TEST_FAILED', message: 'Erreur lors de la simulation des règles.' },
      { status: 500 }
    );
  }
}
