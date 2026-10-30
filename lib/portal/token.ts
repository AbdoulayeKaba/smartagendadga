import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getAuthSecret } from '@/lib/auth/session';

type PortalRole = 'student' | 'parent';

export type PortalTokenPayload = {
  role: PortalRole;
  studentId: string;
  parentId?: string;
};

export type PortalQrPayload = {
  role: 'student_qr';
  studentId: string;
};

export async function signPortalToken(payload: PortalTokenPayload): Promise<string> {
  const key = getAuthSecret();
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.studentId)
    .setIssuedAt()
    .setExpirationTime('6h')
    .sign(key);
}

export async function verifyPortalToken(token: string): Promise<PortalTokenPayload | null> {
  try {
    const key = getAuthSecret();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const role = payload.role === 'student' || payload.role === 'parent' ? payload.role : null;
    const studentId = typeof payload.studentId === 'string' ? payload.studentId : null;
    const parentId = typeof payload.parentId === 'string' ? payload.parentId : undefined;
    if (!role || !studentId) return null;
    return { role, studentId, parentId };
  } catch {
    return null;
  }
}

export async function signStudentQrToken(studentId: string): Promise<string> {
  const key = getAuthSecret();
  return new SignJWT({ role: 'student_qr', studentId } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(studentId)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(key);
}

export async function verifyStudentQrToken(token: string): Promise<PortalQrPayload | null> {
  try {
    const key = getAuthSecret();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const role = payload.role === 'student_qr' ? payload.role : null;
    const studentId = typeof payload.studentId === 'string' ? payload.studentId : null;
    if (!role || !studentId) return null;
    return { role, studentId };
  } catch {
    return null;
  }
}

