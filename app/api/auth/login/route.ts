import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, signSession } from '@/lib/auth/session';
import { parseAppRole } from '@/lib/auth/rbac';
import { BIOMETRIC_PROOF_COOKIE } from '@/lib/auth/biometric-proof';

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const { email, password } = parsed.data;

  const employee = await prisma.employee.findUnique({
    where: { email },
    include: { credential: true },
  });

  if (!employee?.credential) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const ok = await verifyPassword(password, employee.credential.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  if (employee.statut !== 'actif') {
    return NextResponse.json({ error: 'EMPLOYEE_INACTIVE' }, { status: 403 });
  }

  const appRole = parseAppRole(employee.credential.appRole);
  const token = await signSession({
    sub: employee.id,
    email: employee.email,
    appRole,
  });

  const res = NextResponse.json({
    ok: true,
    employeeId: employee.id,
    appRole,
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  res.cookies.set(BIOMETRIC_PROOF_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return res;
}
