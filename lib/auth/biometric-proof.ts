import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getAuthSecret } from './session';

export const BIOMETRIC_PROOF_COOKIE = 'pointage_bio_proof';
const PROOF_TTL_SECONDS = 120;

type ProofPayload = {
  sub: string;
  verifiedAt: number;
};

export async function issueBiometricProof(employeeId: string): Promise<string> {
  return new SignJWT({ verifiedAt: Date.now() } as ProofPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime(`${PROOF_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function readBiometricProofEmployeeId(): Promise<string | null> {
  const token = (await cookies()).get(BIOMETRIC_PROOF_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

