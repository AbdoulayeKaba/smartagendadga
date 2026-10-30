import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { isMockDataEnabled, mockNotifications } from '@/lib/mock-data';

export async function GET(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(20, Number(url.searchParams.get('limit') ?? 80)));
  if (isMockDataEnabled()) return NextResponse.json({ items: mockNotifications.slice(0, limit) });

  const items = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      message: string;
      channel: string;
      status: string;
      recipient_email: string | null;
      created_at: Date;
      sent_at: Date | null;
      student_id: string | null;
      student_first_name: string | null;
      student_last_name: string | null;
      student_matricule: string | null;
      parent_id: string | null;
      parent_first_name: string | null;
      parent_last_name: string | null;
      teacher_id: string | null;
      teacher_first_name: string | null;
      teacher_last_name: string | null;
      ay_id: string | null;
      ay_label: string | null;
    }>
  >(
    Prisma.sql`SELECT
      n.id, n.title, n.message, n.channel, n.status, n.recipient_email, n.created_at, n.sent_at,
      s.id AS student_id, s.first_name AS student_first_name, s.last_name AS student_last_name, s.matricule AS student_matricule,
      p.id AS parent_id, p.first_name AS parent_first_name, p.last_name AS parent_last_name,
      t.id AS teacher_id, t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
      ay.id AS ay_id, ay.label AS ay_label
    FROM notifications n
    LEFT JOIN students s ON s.id = n.student_id
    LEFT JOIN parents p ON p.id = n.parent_id
    LEFT JOIN teachers t ON t.id = n.teacher_id
    LEFT JOIN academic_years ay ON ay.id = n.academic_year_id
    ORDER BY n.created_at DESC
    LIMIT ${limit}`
  );

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      channel: n.channel,
      status: n.status,
      recipientEmail: n.recipient_email,
      student: n.student_id
        ? { id: n.student_id, firstName: n.student_first_name, lastName: n.student_last_name, matricule: n.student_matricule }
        : null,
      parent: n.parent_id ? { id: n.parent_id, firstName: n.parent_first_name, lastName: n.parent_last_name } : null,
      teacher: n.teacher_id ? { id: n.teacher_id, firstName: n.teacher_first_name, lastName: n.teacher_last_name } : null,
      academicYear: n.ay_id ? { id: n.ay_id, label: n.ay_label } : null,
      createdAt: n.created_at.toISOString(),
      sentAt: n.sent_at?.toISOString() ?? null,
    })),
  });
}
