import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { ALLOWED_APPOINTMENT_DURATIONS } from '@/lib/dg/referential-types';
import { updateScheduleSettings } from '@/lib/services/referentials-admin';

const patchSchema = z.object({
  workDayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.number().int().min(5).max(240).optional(),
  defaultAppointmentDurationMinutes: z
    .number()
    .int()
    .refine((n) => ALLOWED_APPOINTMENT_DURATIONS.includes(n as 15 | 30 | 45 | 60))
    .optional(),
  allowedDurationMinutes: z
    .array(
      z
        .number()
        .int()
        .refine((n) => ALLOWED_APPOINTMENT_DURATIONS.includes(n as 15 | 30 | 45 | 60))
    )
    .min(1)
    .optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  maxAppointmentsPerDay: z.number().int().min(0).max(99).optional(),
  maxAppointmentsPerWeek: z.number().int().min(0).max(500).optional(),
  allowOutsideHours: z.boolean().optional(),
  allowWeekendAppointments: z.boolean().optional(),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingDays: z
    .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .min(1)
    .optional(),
  timezone: z.string().min(2).max(64).optional(),
  autoRejectBeforeStartMinutes: z.number().int().min(0).max(1440).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireApiPermission('admin.referentials', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;
  if (!(await userHasPermission(session!.role, 'action.referentials.schedule'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const data = { ...parsed.data };
  if (data.defaultAppointmentDurationMinutes !== undefined) {
    data.slotDurationMinutes = data.defaultAppointmentDurationMinutes;
  }

  const schedule = await updateScheduleSettings(data, session!.userId);
  return NextResponse.json({ schedule });
}
