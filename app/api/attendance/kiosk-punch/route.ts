import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { verifyEmployeePunchQrToken } from '@/lib/attendance/qr-kiosk';
import { punchForEmployee } from '@/lib/attendance/punch-service';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  token: z.string().min(20),
  action: z.enum(['check_in', 'check_out']),
  locationId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => (s != null && String(s).trim() !== '' ? String(s).trim() : undefined)),
});

function extractTokenFromScan(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('http')) {
    try {
      const u = new URL(t);
      const q = u.searchParams.get('t');
      if (q) return q;
    } catch {
      /* ignore */
    }
  }
  return t;
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!isHrPrivileged(ctx.appRole)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

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

  const token = extractTokenFromScan(parsed.data.token);
  const verified = await verifyEmployeePunchQrToken(token);
  if (!verified) {
    return NextResponse.json({ error: 'INVALID_OR_EXPIRED_QR' }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: verified.employeeId },
    select: { id: true, statut: true, prenom: true, nom: true },
  });
  if (!employee || employee.statut !== 'actif') {
    return NextResponse.json({ error: 'EMPLOYEE_NOT_FOUND' }, { status: 404 });
  }

  try {
    const result = await punchForEmployee(employee.id, parsed.data.action, new Date(), {
      locationId: parsed.data.locationId,
    });
    return NextResponse.json({
      ok: true,
      employee: { id: employee.id, nom: employee.nom, prenom: employee.prenom },
      message: result.message,
      attendance: {
        date: result.attendance.date,
        checkIn: result.attendance.checkIn?.toISOString() ?? null,
        checkOut: result.attendance.checkOut?.toISOString() ?? null,
        status: result.attendance.status,
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'UNKNOWN';
    const messages: Record<string, { status: number; message: string }> = {
      ALREADY_CHECKED_IN: { status: 409, message: 'Entrée déjà enregistrée aujourd’hui.' },
      NO_CHECK_IN: { status: 409, message: 'Aucune entrée à clôturer.' },
      ALREADY_CHECKED_OUT: { status: 409, message: 'Sortie déjà enregistrée.' },
      EMPLOYEE_INACTIVE: { status: 403, message: 'Employé inactif.' },
      INVALID_LOCATION: { status: 422, message: 'Lieu inconnu.' },
    };
    const m = messages[code] ?? { status: 400, message: 'Action impossible.' };
    return NextResponse.json({ error: code, message: m.message }, { status: m.status });
  }
}
