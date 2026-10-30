import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseRoleId, isDgRole, type RoleId } from '@/lib/dg/role-ids';
import { resolveEffectiveDgRole } from '@/lib/dg/role-access';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/dg/permission-catalog';
import { DG_ROLE_META } from '@/lib/dg/role-meta';
import { isAuthDisabled } from '@/lib/auth/open-access';
import { isMockDataEnabled } from '@/lib/mock/config';
import { getDefaultGuestUser, mockFindUserById } from '@/lib/mock/users-store';
import {
  getRoleLabel,
  getRolePermissionMap,
} from '@/lib/services/role-permissions-admin';

export type DgSessionContext = {
  userId: string;
  role: RoleId;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  avatarUrl?: string | null;
};

async function guestDgSession(): Promise<DgSessionContext> {
  if (!isMockDataEnabled()) {
    const assistant = await prisma.user.findFirst({
      where: { role: 'ASSISTANT' },
      orderBy: { email: 'asc' },
    });
    if (assistant) {
      return {
        userId: assistant.id,
        role: parseRoleId(assistant.role) ?? 'ASSISTANT',
        email: assistant.email,
        firstName: assistant.firstName,
        lastName: assistant.lastName,
        department: assistant.department ?? '',
        avatarUrl: assistant.avatarUrl ?? null,
      };
    }
  }

  const guest = getDefaultGuestUser();
  return {
    userId: guest.id,
    role: guest.role,
    email: guest.email,
    firstName: guest.firstName,
    lastName: guest.lastName,
    department: guest.department,
    avatarUrl: guest.avatarUrl ?? null,
  };
}

export async function getDgSession(): Promise<DgSessionContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return isAuthDisabled() ? guestDgSession() : null;
  }

  if (isMockDataEnabled()) {
    const mock = mockFindUserById(session.user.id);
    if (mock) {
      return {
        userId: mock.id,
        role: mock.role,
        email: mock.email,
        firstName: mock.firstName,
        lastName: mock.lastName,
        department: mock.department,
        avatarUrl: mock.avatarUrl ?? null,
      };
    }
    return {
      userId: session.user.id,
      role: parseRoleId(String(session.user.role)) ?? 'MANAGER',
      email: session.user.email ?? '',
      firstName: session.user.firstName ?? '',
      lastName: session.user.lastName ?? '',
      department: session.user.department ?? '',
      avatarUrl: null,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  return {
    userId: user.id,
    role: parseRoleId(user.role) ?? 'MANAGER',
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    department: user.department ?? '',
    avatarUrl: user.avatarUrl ?? null,
  };
}

function fallbackRoleLabel(roleId: RoleId): string {
  if (isDgRole(roleId)) return DG_ROLE_META[roleId].label;
  return roleId;
}

function fallbackRolePermissions(roleId: RoleId): Record<string, boolean> {
  if (isDgRole(roleId)) return { ...DEFAULT_ROLE_PERMISSIONS[roleId] };
  return {};
}

/** Compatibilité layout existant (AppProvider). */
export const getServerSessionContext = cache(async () => {
  try {
    const dg = await getDgSession();
    if (!dg) return null;

    let permissions = fallbackRolePermissions(dg.role);
    let roleLabel = fallbackRoleLabel(dg.role);
    try {
      [permissions, roleLabel] = await Promise.all([
        getRolePermissionMap(dg.role),
        getRoleLabel(dg.role),
      ]);
    } catch {
      // Repli si la base des permissions est indisponible (évite un layout SSR en échec).
    }

    const effectiveDgRole = resolveEffectiveDgRole(dg.role, permissions);

    return {
      payload: { sub: dg.userId, appRole: 'employee' as const },
      appRole: 'employee' as const,
      employeeId: dg.userId,
      user: {
        id: dg.userId,
        email: dg.email,
        firstName: dg.firstName,
        lastName: dg.lastName,
        role: 'analyste' as const,
        avatar: dg.avatarUrl ?? undefined,
        permissions: [],
        perimeter: { countries: [], themes: [] },
        // Chaîne ISO : seules les props sérialisables peuvent passer au AppProvider (client).
        createdAt: new Date().toISOString(),
      },
      roleId: dg.role,
      roleLabel,
      permissions,
      dgRole: effectiveDgRole,
    };
  } catch {
    return null;
  }
});
