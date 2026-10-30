import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { AppRoleKey } from './rbac';
import { parseAppRole } from './rbac';

export const SESSION_COOKIE = 'pointage_session';

export type AppRole = AppRoleKey;

export type SessionPayload = {
  sub: string;
  email: string;
  appRole: AppRole;
};

const DEV_FALLBACK_SECRET = 'dev-only-pointage-auth-secret-change-me-32chars';

export function getAuthSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET?.trim();
  const secret = raw && raw.length >= 32 ? raw : process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set (min 32 characters) in production.');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const key = getAuthSecret();
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const key = getAuthSecret();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const appRole = parseAppRole(typeof payload.appRole === 'string' ? payload.appRole : null);
    if (!sub || !email) return null;
    return { sub, email, appRole };
  } catch {
    return null;
  }
}
