import { NextResponse } from 'next/server';
import { getDgSession, type DgSessionContext } from '@/lib/auth/session-server';
import type { DgRole } from '@/lib/dg/rbac';
import { isDgRole } from '@/lib/dg/role-ids';
import { resolveEffectiveDgRole } from '@/lib/dg/role-access';
import { getRolePermissionMap } from '@/lib/services/role-permissions-admin';

export async function requireApiSession(roles?: DgRole[]) {
  const session = await getDgSession();
  if (!session) {
    return { session: null as null, error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  }
  if (roles?.length) {
    if (isDgRole(session.role) && roles.includes(session.role)) {
      return { session: session as DgSessionContext, error: null };
    }
    // Rôles personnalisés : autoriser via le rôle effectif dérivé des permissions.
    const permissions = await getRolePermissionMap(session.role);
    const effective = resolveEffectiveDgRole(session.role, permissions);
    if (!roles.includes(effective)) {
      return { session: null as null, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
    }
  }
  return { session: session as DgSessionContext, error: null };
}
