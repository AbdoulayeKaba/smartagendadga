import { prisma } from '@/lib/prisma';

export async function createArptNotification(input: {
  employeeId: string;
  leaveId?: string | null;
  type: 'leave_submitted' | 'leave_approved' | 'leave_rejected' | 'balance_low';
  title: string;
  message: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO arpt_notifications (id, employee_id, leave_id, type, title, message, created_at)
    VALUES (UUID(), ${input.employeeId}, ${input.leaveId ?? null}, ${input.type}, ${input.title}, ${input.message}, NOW())
  `;
}
