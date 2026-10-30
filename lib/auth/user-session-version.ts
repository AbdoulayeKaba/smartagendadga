import { isMockDataEnabled } from '@/lib/mock/config';
import { mockBumpSessionVersion, mockGetSessionVersion } from '@/lib/mock/session-versions';
import { prisma } from '@/lib/prisma';

export async function bumpUserSessionVersion(userId: string): Promise<number> {
  if (isMockDataEnabled()) return mockBumpSessionVersion(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return user.sessionVersion;
}

export async function getUserSessionVersion(userId: string): Promise<number> {
  if (isMockDataEnabled()) return mockGetSessionVersion(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return user?.sessionVersion ?? 0;
}
