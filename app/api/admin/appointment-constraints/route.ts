import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import {
  getAppointmentBusinessRules,
  updateAppointmentBusinessRules,
} from '@/lib/services/appointment-business-rules-admin';
import { mockWriteAuditJournal } from '@/lib/mock/audit';
import { isMockDataEnabled } from '@/lib/mock/config';
import { prisma } from '@/lib/prisma';

const workflowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  matchPattern: z.string(),
  steps: z.array(z.string().min(1)),
});

const patchSchema = z
  .object({
    minSubmissionLead: z
      .object({
        enabled: z.boolean().optional(),
        minHours: z.number().int().min(0).max(720).optional(),
        minDays: z.number().int().min(0).max(90).optional(),
      })
      .optional(),
    maxPendingPerEmployee: z
      .object({
        enabled: z.boolean().optional(),
        maxCount: z.number().int().min(1).max(50).optional(),
      })
      .optional(),
    duplicateControl: z.object({ enabled: z.boolean().optional() }).optional(),
    urgencyJustification: z
      .object({
        enabled: z.boolean().optional(),
        minChars: z.number().int().min(10).max(2000).optional(),
        levels: z
          .array(z.enum(['NORMAL', 'URGENT', 'TRES_URGENT', 'CRITIQUE'] as [UrgencyLevel, ...UrgencyLevel[]]))
          .optional(),
      })
      .optional(),
    standardizedDuration: z.object({ enabled: z.boolean().optional() }).optional(),
    maxPerMonth: z
      .object({
        enabled: z.boolean().optional(),
        maxCount: z.number().int().min(1).max(100).optional(),
        periodDays: z.number().int().min(1).max(365).optional(),
      })
      .optional(),
    hierarchicalValidation: z
      .object({
        enabled: z.boolean().optional(),
        workflows: z.array(workflowSchema).optional(),
      })
      .optional(),
    allowedSlotsOnly: z.object({ enabled: z.boolean().optional() }).optional(),
    preContactFilter: z
      .object({
        enabled: z.boolean().optional(),
        warnIfNone: z.boolean().optional(),
      })
      .optional(),
    autoPrioritization: z
      .object({
        enabled: z.boolean().optional(),
        priorityThreshold: z.number().int().min(0).max(500).optional(),
        weights: z
          .object({
            director: z.number().int().min(0).max(200).optional(),
            deptHead: z.number().int().min(0).max(200).optional(),
            strategicProject: z.number().int().min(0).max(200).optional(),
            urgencyNormal: z.number().int().min(0).max(200).optional(),
            urgencyUrgent: z.number().int().min(0).max(200).optional(),
            urgencyTresUrgent: z.number().int().min(0).max(200).optional(),
            urgencyCritique: z.number().int().min(0).max(200).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const rules = await getAppointmentBusinessRules();
  return NextResponse.json({ rules });
}

export async function PATCH(req: Request) {
  const auth = await requireApiPermission('admin.settings', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const rules = await updateAppointmentBusinessRules(parsed.data, session.userId);

  if (isMockDataEnabled()) {
    mockWriteAuditJournal(session.userId, 'admin.appointment_constraints.update', {
      target: 'Contraintes RDV',
      resource: 'appointment_constraints',
    });
  } else {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'admin.appointment_constraints.update',
        meta: { section: 'appointment_constraints' },
      },
    });
  }

  return NextResponse.json({ rules });
}
