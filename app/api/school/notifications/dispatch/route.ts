import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { sendEmailNotification, sendSmsNotification } from '@/lib/notifications/providers';

export async function POST() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const pending = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      message: string;
      channel: string;
      recipient_email: string | null;
    }>
  >(
    Prisma.sql`SELECT id, title, message, channel, recipient_email
               FROM notifications
               WHERE status = 'pending'
               ORDER BY created_at ASC
               LIMIT 100`
  );

  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    try {
      if (n.channel === 'email' && n.recipient_email) {
        await sendEmailNotification({ to: n.recipient_email, subject: n.title, message: n.message });
      } else if (n.channel === 'sms' && n.recipient_email) {
        await sendSmsNotification({ to: n.recipient_email, message: n.message });
      }

      await prisma.$executeRaw(
        Prisma.sql`UPDATE notifications SET status = 'sent', sent_at = NOW(3) WHERE id = ${n.id}`
      );
      sent += 1;
    } catch {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE notifications SET status = 'failed' WHERE id = ${n.id}`
      );
      failed += 1;
    }
  }

  return NextResponse.json({ processed: pending.length, sent, failed });
}

