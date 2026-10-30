import { isMockDataEnabled } from '@/lib/mock/config';
import { mockRecordLastLogin } from '@/lib/mock/users-store';
import { prisma } from '@/lib/prisma';

/** Enregistre la date/heure de dernière connexion réussie. */
export async function recordUserLastLogin(userId: string): Promise<void> {
  if (isMockDataEnabled()) {
    mockRecordLastLogin(userId);
    return;
  }

  await prisma.user
    .update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
    .catch(() => undefined);
}
