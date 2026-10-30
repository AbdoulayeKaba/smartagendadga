import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { punchForEmployee } from '@/lib/attendance/punch-service';
import { BIOMETRIC_PROOF_COOKIE, readBiometricProofEmployeeId } from '@/lib/auth/biometric-proof';
import { logAuditFromRequest } from '@/lib/audit/write-audit';

const bodySchema = z.object({
  action: z.enum(['check_in', 'check_out']),
  locationId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => (s != null && String(s).trim() !== '' ? String(s).trim() : undefined)),
});

function mapError(code: string): { status: number; message: string } {
  switch (code) {
    case 'EMPLOYEE_NOT_FOUND':
      return { status: 404, message: 'Employé introuvable.' };
    case 'EMPLOYEE_INACTIVE':
      return { status: 403, message: 'Compte employé inactif.' };
    case 'ALREADY_CHECKED_IN':
      return { status: 409, message: 'Entrée déjà enregistrée aujourd’hui.' };
    case 'NO_CHECK_IN':
      return { status: 409, message: 'Aucune entrée à clôturer.' };
    case 'ALREADY_CHECKED_OUT':
      return { status: 409, message: 'Sortie déjà enregistrée.' };
    case 'INVALID_LOCATION':
      return { status: 422, message: 'Lieu de pointage inconnu.' };
    default:
      return { status: 400, message: 'Action impossible.' };
  }
}

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const proofEmployeeId = await readBiometricProofEmployeeId();
  if (proofEmployeeId !== ctx.employeeId) {
    return NextResponse.json(
      { error: 'BIOMETRIC_REQUIRED', message: 'Vérification biométrique requise avant le pointage.' },
      { status: 401 }
    );
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

  try {
    const result = await punchForEmployee(ctx.employeeId, parsed.data.action, new Date(), {
      locationId: parsed.data.locationId,
    });
    const a = result.attendance;
    const res = NextResponse.json({
      attendance: {
        id: a.id,
        date: a.date,
        checkIn: a.checkIn?.toISOString() ?? null,
        checkOut: a.checkOut?.toISOString() ?? null,
        status: a.status,
        workedMinutes: a.workedMinutes,
        checkInLocation: a.checkInLocation ?? null,
        checkOutLocation: a.checkOutLocation ?? null,
      },
      message: result.message,
    });
    res.cookies.set(BIOMETRIC_PROOF_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: parsed.data.action === 'check_in' ? 'attendance.check_in.biometric' : 'attendance.check_out.biometric',
        entity: 'attendance',
        entityId: a.id,
        meta: { locationId: parsed.data.locationId ?? null },
      });
    } catch {
      /* ignore */
    }
    return res;
  } catch (e) {
    const code = e instanceof Error ? e.message : 'UNKNOWN';
    const mapped = mapError(code);
    return NextResponse.json({ error: code, message: mapped.message }, { status: mapped.status });
  }
}
