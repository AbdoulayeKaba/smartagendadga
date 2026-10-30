import { SignJWT, jwtVerify } from 'jose';
import { getAuthSecret } from '@/lib/auth/session';

const QR_PURPOSE = 'employee_punch_qr';

function secretKey(): Uint8Array {
  return getAuthSecret();
}

/** JWT court pour QR « Mon badge » (scanné par la borne RH). */
export async function signEmployeePunchQrToken(employeeId: string): Promise<string> {
  const key = secretKey();
  return new SignJWT({ p: QR_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime('90s')
    .sign(key);
}

export async function verifyEmployeePunchQrToken(token: string): Promise<{ employeeId: string } | null> {
  try {
    const key = secretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (payload.p !== QR_PURPOSE) return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) return null;
    return { employeeId: sub };
  } catch {
    return null;
  }
}
