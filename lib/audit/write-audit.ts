import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/types';

export type AuditActor = {
  employeeId: string;
  user: Pick<User, 'email' | 'firstName' | 'lastName'>;
};

export async function logAuditFromRequest(
  req: Request,
  actor: AuditActor,
  event: { action: string; entity: string; entityId?: string | null; meta?: unknown }
): Promise<void> {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  await prisma.auditLog.create({
    data: {
      actorId: actor.employeeId,
      actorEmail: actor.user.email,
      actorName: `${actor.user.firstName} ${actor.user.lastName}`.trim(),
      action: event.action,
      entity: event.entity,
      entityId: event.entityId ?? null,
      meta: event.meta === undefined ? undefined : (event.meta as object),
      ip,
      userAgent: ua,
    },
  });
}
