import { auth } from '@/auth';

export type ArptRole = 'admin' | 'rh' | 'chef' | 'employe';

export async function requireArptAuth() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export function hasArptRole(role: string | undefined, allowed: ArptRole[]) {
  if (!role) return false;
  return allowed.includes(role as ArptRole);
}
