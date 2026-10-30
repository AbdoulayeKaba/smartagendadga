import { NextResponse } from 'next/server';
import type { DgSessionContext } from '@/lib/auth/session-server';
import { getDgSession } from '@/lib/auth/session-server';
import type { DgRole } from '@/lib/dg/rbac';
import { isDgRole } from '@/lib/dg/role-ids';
import { roleHasPermission } from '@/lib/services/role-permissions-admin';
import type { RoleId } from '@/lib/dg/role-ids';

export async function userHasPermission(
  role: RoleId | DgRole,
  permissionId: string
): Promise<boolean> {
  return roleHasPermission(role, permissionId);
}

export async function requireApiPermission(
  permissionId: string,
  allowedRoles?: DgRole[]
): Promise<
  | { session: DgSessionContext; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getDgSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  }
  // Rôles système : garde-fou optionnel. Les rôles personnalisés passent par la matrice de permissions.
  if (
    allowedRoles?.length &&
    isDgRole(session.role) &&
    !allowedRoles.includes(session.role)
  ) {
    return { session: null, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  const ok = await userHasPermission(session.role, permissionId);
  if (!ok) {
    return { session: null, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { session, error: null };
}
