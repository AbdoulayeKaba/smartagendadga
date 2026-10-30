import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signPortalToken } from '@/lib/portal/token';

const schema = z.object({
  matricule: z.string().trim().min(2),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM students WHERE matricule = ${parsed.data.matricule} AND date_of_birth = ${parsed.data.dateOfBirth} LIMIT 1`
  );
  const student = rows[0];
  if (!student) return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });

  const token = await signPortalToken({ role: 'student', studentId: student.id });
  return NextResponse.json({ token });
}
