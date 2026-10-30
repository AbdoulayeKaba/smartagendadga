'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { countBusinessDays } from '@/lib/arpt/workdays';

const schema = z.object({
  leaveTypeId: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function submitLeaveRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const parsed = schema.safeParse({
    leaveTypeId: formData.get('leaveTypeId'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    note: formData.get('note'),
  });
  if (!parsed.success) return;
  if (parsed.data.startDate > parsed.data.endDate) return;

  const holidays = await prisma.$queryRaw<Array<{ date: string }>>`SELECT date FROM public_holidays`;
  const workingDays = countBusinessDays(
    parsed.data.startDate,
    parsed.data.endDate,
    new Set(holidays.map((h) => h.date))
  );

  await prisma.$executeRaw`
    INSERT INTO employee_leaves (
      id, employee_id, leave_type_id, start_date, end_date, type, status, note, working_days, submitted_at, created_at
    ) VALUES (
      UUID(),
      ${session.user.id},
      ${parsed.data.leaveTypeId},
      ${parsed.data.startDate},
      ${parsed.data.endDate},
      'autre',
      'submitted',
      ${parsed.data.note ?? null},
      ${workingDays},
      NOW(),
      NOW()
    )
  `;

  revalidatePath('/arpt/requests');
  revalidatePath('/arpt/dashboard');
}
