import type { CredentialDeviceType } from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function getRpIdFromRequest(req: Request): string {
  const url = new URL(req.url);
  return process.env.WEBAUTHN_RP_ID?.trim() || url.hostname;
}

export function getOriginFromRequest(req: Request): string {
  const url = new URL(req.url);
  return process.env.WEBAUTHN_ORIGIN?.trim() || url.origin;
}

function fromBase64Url(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

export async function saveChallenge(employeeId: string, challenge: string, purpose: 'register' | 'authenticate') {
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO webauthn_challenges (id, employee_id, challenge, purpose, created_at, expires_at)
               VALUES (${crypto.randomUUID().replace(/-/g, '')}, ${employeeId}, ${challenge}, ${purpose}, NOW(3), ${new Date(
                 Date.now() + CHALLENGE_TTL_MS
               )})`
  );
}

export async function consumeChallenge(employeeId: string, purpose: 'register' | 'authenticate') {
  const rows = await prisma.$queryRaw<Array<{ id: string; challenge: string }>>(
    Prisma.sql`SELECT id, challenge
               FROM webauthn_challenges
               WHERE employee_id = ${employeeId}
                 AND purpose = ${purpose}
                 AND expires_at > NOW(3)
               ORDER BY created_at DESC
               LIMIT 1`
  );
  const row = rows[0];
  if (!row) return null;
  await prisma.$executeRaw(Prisma.sql`DELETE FROM webauthn_challenges WHERE id = ${row.id}`);
  return row.challenge;
}

export async function clearExpiredChallenges() {
  await prisma.$executeRaw(Prisma.sql`DELETE FROM webauthn_challenges WHERE expires_at < NOW(3)`);
}

export async function registrationOptions(req: Request, employeeId: string, userName: string) {
  const credentials = await prisma.$queryRaw<Array<{ credential_id: string; transports: string | null }>>(
    Prisma.sql`SELECT credential_id, transports FROM webauthn_credentials WHERE employee_id = ${employeeId}`
  );
  const options = await generateRegistrationOptions({
    rpName: process.env.WEBAUTHN_RP_NAME?.trim() || 'Pointage RH',
    rpID: getRpIdFromRequest(req),
    userName,
    userID: new TextEncoder().encode(employeeId),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : [],
    })),
  });
  await saveChallenge(employeeId, options.challenge, 'register');
  return options;
}

export async function verifyRegistration(
  req: Request,
  employeeId: string,
  response: Record<string, unknown>
): Promise<VerifiedRegistrationResponse> {
  const expectedChallenge = await consumeChallenge(employeeId, 'register');
  if (!expectedChallenge) throw new Error('INVALID_OR_EXPIRED_CHALLENGE');

  const verification = await verifyRegistrationResponse({
    response: response as unknown as Parameters<typeof verifyRegistrationResponse>[0]['response'],
    expectedChallenge,
    expectedOrigin: getOriginFromRequest(req),
    expectedRPID: getRpIdFromRequest(req),
    requireUserVerification: false,
  });

  if (verification.verified && verification.registrationInfo) {
    const info = verification.registrationInfo;
    const credentialId = typeof info.credential.id === 'string'
      ? info.credential.id
      : Buffer.from(info.credential.id).toString('base64url');
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO webauthn_credentials (
                   id, employee_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at
                 ) VALUES (
                   ${crypto.randomUUID().replace(/-/g, '')},
                   ${employeeId},
                   ${credentialId},
                   ${Buffer.from(info.credential.publicKey).toString('base64url')},
                   ${info.credential.counter},
                   ${JSON.stringify((response.response as { transports?: string[] })?.transports ?? [])},
                   ${info.credentialDeviceType},
                   ${info.credentialBackedUp},
                   NOW(3)
                 )
                 ON DUPLICATE KEY UPDATE
                   employee_id = VALUES(employee_id),
                   public_key = VALUES(public_key),
                   counter = VALUES(counter),
                   transports = VALUES(transports),
                   device_type = VALUES(device_type),
                   backed_up = VALUES(backed_up)`
    );
  }
  return verification;
}

export async function authenticationOptions(req: Request, employeeId: string) {
  const credentials = await prisma.$queryRaw<Array<{ credential_id: string; transports: string | null }>>(
    Prisma.sql`SELECT credential_id, transports FROM webauthn_credentials WHERE employee_id = ${employeeId}`
  );
  const options = await generateAuthenticationOptions({
    rpID: getRpIdFromRequest(req),
    userVerification: 'preferred',
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : [],
    })),
  });
  await saveChallenge(employeeId, options.challenge, 'authenticate');
  return options;
}

export async function verifyAuthentication(
  req: Request,
  employeeId: string,
  response: Record<string, unknown>
): Promise<VerifiedAuthenticationResponse> {
  const expectedChallenge = await consumeChallenge(employeeId, 'authenticate');
  if (!expectedChallenge) throw new Error('INVALID_OR_EXPIRED_CHALLENGE');

  const credentialId = (response.id && typeof response.id === 'string')
    ? response.id
    : response.rawId && typeof response.rawId === 'string'
      ? response.rawId
      : null;
  if (!credentialId) throw new Error('INVALID_CREDENTIAL_ID');

  const rows = await prisma.$queryRaw<
    Array<{ id: string; credential_id: string; public_key: string; counter: number; transports: string | null }>
  >(
    Prisma.sql`SELECT id, credential_id, public_key, counter, transports
               FROM webauthn_credentials
               WHERE employee_id = ${employeeId}
                 AND credential_id IN (${credentialId}, ${credentialId.replace(/=+$/, '')})
               LIMIT 1`
  );
  const dbCredential = rows[0];
  if (!dbCredential) throw new Error('UNKNOWN_CREDENTIAL');

  const verification = await verifyAuthenticationResponse({
    response: response as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge,
    expectedOrigin: getOriginFromRequest(req),
    expectedRPID: getRpIdFromRequest(req),
    credential: {
      id: dbCredential.credential_id,
      publicKey: fromBase64Url(dbCredential.public_key) as unknown as Uint8Array<ArrayBuffer>,
      counter: dbCredential.counter,
      transports: dbCredential.transports ? (JSON.parse(dbCredential.transports) as AuthenticatorTransport[]) : [],
    },
    requireUserVerification: false,
  });

  if (verification.verified && verification.authenticationInfo) {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE webauthn_credentials
                 SET counter = ${verification.authenticationInfo.newCounter},
                     last_verified_at = NOW(3)
                 WHERE id = ${dbCredential.id}`
    );
  }
  return verification;
}

export async function biometricStatus(employeeId: string) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(
    Prisma.sql`SELECT COUNT(*) AS total FROM webauthn_credentials WHERE employee_id = ${employeeId}`
  );
  const count = Number(rows[0]?.total ?? 0);
  return { enrolled: count > 0, credentialCount: count };
}

export async function listBiometricCredentials(employeeId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string | null;
      created_at: Date;
      last_verified_at: Date | null;
      device_type: string | null;
      backed_up: number | boolean;
    }>
  >(
    Prisma.sql`SELECT id, name, created_at, last_verified_at, device_type, backed_up
               FROM webauthn_credentials
               WHERE employee_id = ${employeeId}
               ORDER BY created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? null,
    createdAt: r.created_at.toISOString(),
    lastVerifiedAt: r.last_verified_at?.toISOString() ?? null,
    deviceType: (r.device_type as CredentialDeviceType | null) ?? null,
    backedUp: Boolean(r.backed_up),
  }));
}

