import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily, isHrPrivileged } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

const postSchema = z.object({
  assignmentId: z.string().min(1),
  teacherId: z.string().min(1),
  classroomId: z.string().min(1),
  subjectId: z.string().min(1),
  academicYearId: z.string().min(1),
  weekday: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomLabel: z.string().trim().max(64).optional().nullable(),
});

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrFamily(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const items = await prisma.timetableSession.findMany({
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true } },
      classroom: { select: { id: true, name: true, level: true, section: true } },
      academicYear: { select: { id: true, label: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!isHrPrivileged(ctx.appRole)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });

  const created = await prisma.timetableSession.create({
    data: {
      ...parsed.data,
      roomLabel: parsed.data.roomLabel || null,
    },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
