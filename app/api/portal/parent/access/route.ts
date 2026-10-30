import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signPortalToken } from '@/lib/portal/token';

const schema = z.object({
  studentMatricule: z.string().trim().min(2),
  parentEmail: z.string().trim().email(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });

  const rows = await prisma.$queryRaw<Array<{ student_id: string; parent_id: string }>>(
    Prisma.sql`SELECT s.id AS student_id, p.id AS parent_id
               FROM students s
               INNER JOIN student_parents sp ON sp.student_id = s.id
               INNER JOIN parents p ON p.id = sp.parent_id
               WHERE s.matricule = ${parsed.data.studentMatricule}
                 AND p.email = ${parsed.data.parentEmail.toLowerCase()}
               LIMIT 1`
  );
  const item = rows[0];
  if (!item) return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });

  const token = await signPortalToken({ role: 'parent', studentId: item.student_id, parentId: item.parent_id });
  return NextResponse.json({ token });
}
